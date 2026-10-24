import { randomUUID } from 'node:crypto'
import { posix, extname, isAbsolute } from 'node:path'
import { WORLD_READ_CAPS as CAP, ARTIFACT_CAPS, WorkflowError } from '@zcode/dynamic-workflow'

const quote = text => `'${String(text).replaceAll("'", "'\\''")}'`
const check = (ok, message) => { if (!ok) throw new TypeError(message) }
const text = value => typeof value === 'string' && !value.includes('\0')
const capError = message => new WorkflowError('WorldReadCapExceeded', message)
const bounded = (value, limit) => { if (Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value)) > limit) throw capError(`世界读取超过 ${limit} 字节上限`); return value }
const ref = value => { check(text(value) && value.length > 0 && !value.startsWith('-') && !value.includes('..') && !/[\s~^:?*\\\[]/.test(value), 'Git base 必须是单个有效 ref'); return value }

export function createWorld(parent, { cwd: runCwd, journal, runId, signal, effect, completeEffect }) {
  const ctx = parent.ctx
  const cwd = runCwd ?? ctx.get("workingDirectory")?.get(parent.session) ?? parent.session.header.cwd
  check(typeof cwd === 'string' && cwd.length > 0, '父会话没有工作目录')
  const root = ctx.get('fs').resolve(cwd)
  async function target(path) {
    check(text(path) && path.length > 0 && !isAbsolute(path) && !path.split(/[\\/]/).includes('..'), '路径必须位于工作区内')
    const resolved = await ctx.get('fs').resolve(path, { cwd, signal })
    if (!ctx.get('fs').contains(await root, resolved)) throw new WorkflowError('ArtifactPathOutsideWorkspace', '路径或符号链接指向工作区外')
    return resolved
  }
  async function command(argv, { maxBytes = CAP.runStdoutMaxBytes, timeoutMs = CAP.runDefaultTimeoutMs } = {}) {
    signal.throwIfAborted()
    const policy = ctx.get('sandboxPolicy').resolve({ session: parent.session })
    const spec = ctx.get('shell').resolve({ command: `exec ${argv.map(quote).join(' ')}`, workdir: cwd, signal, timeoutMs, onExpiry: 'kill', stdoutMaxBytes: maxBytes + 1, sandboxPolicy: policy })
    const process = await ctx.get('shell').execute(spec)
    const result = await process.result()
    if (result.aborted || signal.aborted) throw new Error('世界命令已中止；外部副作用可能已经发生')
    if (result.timedOut) throw new Error('世界命令超时；外部副作用可能已经发生')
    if (result.sandbox?.denied || result.sandbox?.runnerFailed) throw new Error('DSH 沙箱拒绝了世界命令')
    if (result.stdout.truncated || result.stderr.truncated) throw capError('世界命令输出超过上限')
    const stdout = bounded(result.stdout.text, maxBytes)
    const stderr = bounded(result.stderr.text, maxBytes)
    check(Number.isInteger(result.exitCode), '命令没有已知退出码')
    return { exitCode: result.exitCode, stdout, stderr }
  }
  async function guardedCommand(argv, { maxBytes = CAP.runStdoutMaxBytes, timeoutMs = CAP.runDefaultTimeoutMs, evidence = () => {} } = {}) {
    signal.throwIfAborted()
    const callId = randomUUID()
    let jobId
    let cleanup
    const stopJob = () => cleanup ??= (async () => {
      const job = ctx.get('jobs').get(jobId, parent.id)
      if (!job) throw new Error(`无法找到本次命令的作业 ${jobId}，外部结果仍未知`)
      if (['completed', 'killed', 'failed'].includes(job.status)) return
      ctx.get('jobs').kill(jobId, parent.id, 'workflow world.run foreground deadline expired')
      const stopped = await ctx.get('jobs').wait(jobId, 5000, parent.id)
      if (!['completed', 'killed', 'failed'].includes(stopped.status)) throw new Error(`作业 ${jobId} 尚未停止，外部结果仍未知`)
    })()
    const unobserve = ctx.on('tools/post-execute', async (exec, result, next) => {
      if (exec.callId === callId) {
        const value = result.isError ? undefined : result.value
        if (['promoted', 'background'].includes(value?.kind) && typeof value.jobId === 'string') jobId = value.jobId
        evidence({ callId, isError: result.isError, ...(result.isError ? { error: result.error } : { kind: value?.kind, jobId: value?.jobId, timedOut: value?.timedOut, aborted: value?.aborted, exitCode: value?.exitCode, stdout: value?.stdout && { truncated: value.stdout.truncated, spillPath: value.stdout.spillPath }, stderr: value?.stderr && { truncated: value.stderr.truncated, spillPath: value.stderr.spillPath } }) })
      }
      return next()
    }, { prepend: true })
    try {
      const result = await ctx.get('tools').execute({ callId, name: 'bash', arguments: { description: '运行工作流命令并记录结果', command: `exec ${argv.map(quote).join(' ')}`, workdir: cwd, timeoutMs, run_in_background: false }, agent: parent, signal })
      if (!result.isError && ['promoted', 'background'].includes(result.value?.kind)) jobId = result.value.jobId
      if (jobId) { await stopJob(); throw new Error(`命令超过前台时限并转为作业 ${jobId}；作业已收口，外部结果仍需核对`) }
      if (result.isError) throw new Error(`DSH 命令未成功：${result.error.message}`)
      const value = result.value
      check(value?.kind === 'foreground', '原生 Bash 没有返回可核对的前台命令结果')
      if (value.aborted || signal.aborted || value.timedOut) throw new Error('命令已中止或超时，外部结果未知')
      if (value.sandbox?.denied || value.sandbox?.runnerFailed) throw new Error('DSH 沙箱拒绝了世界命令')
      const output = async stream => {
        if (!stream.truncated) return bounded(stream.text, maxBytes)
        const path = stream.spillPath
        if (!path) throw capError('原生命令输出已截断，且没有可读取的完整输出')
        const target = await ctx.get('fs').resolve(path, { cwd, signal })
        let bytes
        try { bytes = await ctx.get('fs').readBytes(target, signal, maxBytes) }
        catch (error) { if (error.code === 'FS_TOO_LARGE') throw capError('完整命令输出超过上游字节上限'); throw error }
        return bounded(new TextDecoder('utf-8').decode(bytes), maxBytes)
      }
      check(Number.isInteger(value.exitCode), '命令没有已知退出码')
      const [stdout, stderr] = await Promise.all([output(value.stdout), output(value.stderr)])
      return { exitCode: value.exitCode, stdout, stderr }
    } catch (error) {
      if (jobId) { try { await stopJob() } catch (cleanupError) { throw new AggregateError([error, cleanupError], `命令结果未知且作业收口未完成：${cleanupError.message}`) } }
      throw error
    } finally { unobserve() }
  }
  async function git(args, maxBytes = CAP.gitDiffMaxBytes) {
    const result = await command(['git', '-c', 'core.fsmonitor=false', '--no-pager', ...args], { maxBytes })
    if (result.exitCode !== 0) throw new Error(`Git 读取失败：${result.stderr}`)
    return result.stdout
  }
  async function execute(op, args) {
    check(Array.isArray(args), '世界读取参数必须是数组')
    if (op === 'read') {
      check(args.length === 1, 'files.read 只接受一个路径')
      const file = await target(args[0])
      let content = ''
      let length = 0
      for await (const chunk of await ctx.get('fs').streamText(file, signal)) {
        length += Buffer.byteLength(chunk)
        if (length > 1024 * 1024) throw capError('files.read 超过 1 MiB 上限')
        content += chunk
      }
      return content
    }
    if (op === 'glob' || op === 'grep') {
      check(args.length >= 1 && args.length <= (op === 'glob' ? 1 : 2) && text(args[0]), 'files.glob/grep 参数无效')
      if (args[1] !== undefined) check(text(args[1]), 'grep glob 必须是字符串')
      const argv = op === 'glob' ? ['rg', '--files', '--hidden', '--null', '--glob', args[0], '--glob', '!.git/**', '.'] : ['rg', '--json', '--hidden', '--glob', '!.git/**', ...(args[1] === undefined ? [] : ['--glob', args[1]]), '--', args[0], '.']
      const result = await command(argv, { maxBytes: 2 * 1024 * 1024 })
      if (result.exitCode > 1) throw new Error(result.stderr || 'ripgrep 读取失败')
      if (op === 'glob') {
        const paths = result.stdout.split('\0').filter(Boolean).map(path => path.replace(/^\.\//, '')).sort()
        if (paths.length > CAP.globMaxFiles) throw capError(`glob 超过 ${CAP.globMaxFiles} 个文件`)
        return paths
      }
      const matches = []
      for (const line of result.stdout.split('\n')) {
        if (!line) continue
        const row = JSON.parse(line)
        if (row.type !== 'match') continue
        check(typeof row.data.path.text === 'string' && typeof row.data.lines.text === 'string', 'grep 不支持非 UTF-8 路径或内容')
        matches.push({ path: row.data.path.text.replace(/^\.\//, ''), line: row.data.line_number, text: row.data.lines.text.replace(/\r?\n$/, '') })
        if (matches.length > CAP.grepMaxMatches) throw capError(`grep 超过 ${CAP.grepMaxMatches} 条命中`)
      }
      return bounded(matches, CAP.grepMaxSerializedBytes)
    }
    if (op === 'git-diff' || op === 'git-changed-files') {
      check(args.length <= (op === 'git-diff' ? 2 : 1), 'Git 读取参数过多')
      const base = args[0] === undefined ? 'HEAD' : ref(args[0])
      if (args[1] !== undefined) await target(args[1])
      const path = args[1] ?? '.'
      if (op === 'git-diff') return git(['diff', '--no-ext-diff', '--no-textconv', '--relative', base, '--', path])
      const tracked = (await git(['diff', '--name-only', '-z', '--relative', base, '--', '.'])).split('\0').filter(Boolean)
      if (args[0] === undefined) tracked.push(...(await git(['ls-files', '--others', '--exclude-standard', '-z', '--', '.'])).split('\0').filter(Boolean))
      return [...new Set(tracked)].sort()
    }
    if (op === 'git-status') {
      check(args.length === 0, 'git.status 不接受参数')
      const prefix = (await git(['rev-parse', '--show-prefix'])).trim()
      const status = (await git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.'])).split('\0').filter(Boolean)
      const result = { clean: status.length === 0, staged: [], unstaged: [], untracked: [] }
      const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
      if (branch !== 'HEAD') result.branch = branch
      for (let i = 0; i < status.length; i++) {
        const row = status[i]
        const path = row.slice(3)
        if (row[0] === 'R' || row[0] === 'C') i++
        if (!path.startsWith(prefix)) continue
        const relative = path.slice(prefix.length)
        if (row.startsWith('??')) result.untracked.push(relative)
        else { if (row[0] !== ' ') result.staged.push(relative); if (row[1] !== ' ') result.unstaged.push(relative) }
      }
      return result
    }
    if (op === 'git-log') {
      check(args.length <= 1, 'git.log 参数过多')
      const count = args[0] ?? CAP.gitLogDefaultCount
      check(Number.isInteger(count) && count > 0, 'git.log count 必须是正整数')
      if (count > CAP.gitLogMaxCount) throw capError(`git.log 最多 ${CAP.gitLogMaxCount} 条`)
      const fields = (await git(['log', `-${count}`, '--format=%H%x00%s%x00%an%x00%aI%x00'])).split('\0')
      const commits = []
      for (let i = 0; i + 3 < fields.length; i += 4) commits.push({ hash: fields[i].trim(), subject: fields[i + 1], author: fields[i + 2], date: fields[i + 3] })
      return commits
    }
    if (op === 'run') {
      check(args.length >= 1 && args.length <= 3 && text(args[0]) && args[0].length > 0, 'world.run 命令无效')
      const argv = args[1] ?? []
      const opts = args[2] ?? {}
      check(Array.isArray(argv) && argv.every(text) && typeof opts === 'object' && opts !== null && !Array.isArray(opts) && Object.keys(opts).every(key => key === 'timeoutMs'), 'world.run 参数无效')
      const timeoutMs = opts.timeoutMs ?? CAP.runDefaultTimeoutMs
      check(Number.isFinite(timeoutMs) && timeoutMs > 0, 'timeoutMs 必须是正数')
      const pending = effect(op, args)
      if (pending.resolution === 'accept') return pending.value
      try { const result = await guardedCommand([args[0], ...argv], { timeoutMs, evidence: native => journal.putEffect({ ...journal.getEffect(pending.id), native }) }); completeEffect(pending.id, result); return result }
      catch (error) { completeEffect(pending.id, undefined, error); throw error }
    }
    throw new Error(`不支持的世界读取：${op}`)
  }
  async function publish(request) {
    const { id, version, op, opts = {} } = request
    check(typeof opts === 'object' && opts !== null && !Array.isArray(opts), '产物选项必须是对象')
    for (const key of Object.keys(opts)) check(['title', 'description', 'contentType', 'primary'].includes(key), `未知产物选项 ${key}`)
    for (const [key, cap] of [['title', ARTIFACT_CAPS.maxTitleLength], ['description', ARTIFACT_CAPS.maxDescriptionLength]]) if (opts[key] !== undefined) check(typeof opts[key] === 'string' && opts[key].length <= cap, `${key} 超过上限`)
    if (opts.primary !== undefined) check(typeof opts.primary === 'boolean', 'primary 必须是布尔值')
    if (opts.contentType !== undefined) check(typeof opts.contentType === 'string' && /^[\w.+-]+\/[\w.+-]+(?:; charset=utf-8)?$/.test(opts.contentType), 'contentType 无效')
    let bytes
    let contentType = opts.contentType
    if (op === 'markdown') {
      check(typeof request.content === 'string', 'Markdown 正文必须是字符串')
      bytes = Buffer.from(request.content)
      if (bytes.length > ARTIFACT_CAPS.maxMarkdownBytes) throw new WorkflowError('ArtifactTooLarge', 'Markdown 超过上限')
      contentType ??= 'text/markdown; charset=utf-8'
    } else {
      const file = await target(request.path)
      try { bytes = await ctx.get('fs').readBytes(file, signal, ARTIFACT_CAPS.maxFileBytes) }
      catch (error) { throw new WorkflowError(error.code === 'FS_TOO_LARGE' ? 'ArtifactTooLarge' : 'ArtifactSourceMissing', error.message) }
      contentType ??= ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf', '.txt': 'text/plain', '.csv': 'text/csv', '.json': 'application/json', '.svg': 'image/svg+xml', '.html': 'text/html' })[extname(request.path).toLowerCase()] ?? 'application/octet-stream'
    }
    const record = { id, version, kind: op, ...opts, contentType, bytes: bytes.length, publishedAt: Date.now(), uri: `dsh-workflow:${runId}/${id}/${version}`, ...(request.path === undefined ? {} : { sourcePath: posix.normalize(request.path) }) }
    const existing = journal.getArtifact(runId, id, version)
    if (existing) {
      check(Buffer.from(existing.bytes).equals(bytes), '已落盘产物与恢复时的内容不同')
      return existing.record
    }
    journal.putArtifact(runId, id, version, bytes, record)
    return record
  }
  return { execute, publish }
}
