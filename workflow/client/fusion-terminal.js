/* Evidence-based terminal topology for Fusion runs (not a simulated demo). */
const short = (v,n=120) => typeof v === 'string' ? v.slice(0,n) : '';
const numeric = v => typeof v === 'number' && Number.isFinite(v);
const roleName = (actor) => String(actor?.name ?? actor?.persona?.name ?? '').toLowerCase();
const roleActor = (run, key) => (run?.actors ?? []).find(a => roleName(a).includes(key));
const model = (run, role) => {
  const choice = run?.args?.models?.[role];
  if (typeof choice === 'string' && choice) return choice;
  const actor = roleActor(run, role);
  if (typeof actor?.resolvedModel === 'string') {
    try { const parsed = JSON.parse(actor.resolvedModel); if (parsed?.model) return (parsed.provider ? parsed.provider+'/' : '') + parsed.model; } catch {}
    return actor.resolvedModel;
  }
  return null;
};
const actorState = (run, role) => {
  const actor = roleActor(run, role);
  if (!actor) return 'pending';
  const rows = (run?.nodes ?? []).filter(n => n.kind === 'ask' && n.actorSiteId === actor.siteId);
  return rows.at(-1)?.status ?? 'pending';
};
export function fusionTerminalSnapshot(run) {
  const evidence = (run?.reports ?? []).map(r=>r?.item).filter(i=>i?.preset==='fusion.v1');
  const result = run?.result;
  const last = evidence.at(-1);
  const test = result?.test ?? [...evidence].reverse().find(i=>i?.test)?.test;
  const review = result?.review ?? [...evidence].reverse().find(i=>i?.review)?.review;
  const rounds = Number.isInteger(result?.rounds) ? result.rounds : Number.isInteger(last?.rounds) ? last.rounds : null;
  const reviewState = review === undefined ? 'pending' : review.approved===true && Array.isArray(review.blockingIssues) && review.blockingIssues.length===0 ? 'completed' : 'failed';
  const tests = numeric(test?.exitCode) ? test.exitCode===0 ? 'completed' : 'failed' : 'pending';
  return {
    status:run?.status ?? 'draft', tokens:numeric(run?.spentTokens)?run.spentTokens:null,
    rounds, maxRounds:Number.isInteger(run?.args?.maxRounds)?run.args.maxRounds:null,
    models:{lead:model(run,'lead'),sidekick:model(run,'sidekick'),reviewer:model(run,'reviewer')},
    actors:{lead:actorState(run,'lead'),sidekick:actorState(run,'sidekick'),reviewer:actorState(run,'reviewer')},
    tests, testExit:numeric(test?.exitCode)?test.exitCode:null,review:reviewState,
    signoff:result?.success === true ? 'completed' : result?.success===false ? 'failed' : 'pending',
    script:typeof run?.args?.testScript==='string'?run.args.testScript:null,
    blockers:Array.isArray(review?.blockingIssues)?review.blockingIssues.slice(0,4).map(x=>short(String(x))):[],
    logs:(run?.events??[]).slice(-7).map((r,i)=>({
      seq:r.sequence ?? i, type:short(r.event?.type??r.type??'event',45),
      message:short(r.event?.message??r.event?.name??r.message??'',110),
    })),
  };
}

const STYLE = `
.caw-tty{--bg:#0b1018;--panel:#101722;--edge:#303d50;--ink:#dbe4f4;--muted:#9aaac4;--blue:#86adf6;--violet:#c9a8f3;--green:#7fe0ae;--amber:#e8ae90;background:var(--bg);color:var(--ink);border:1px solid var(--edge);border-radius:8px;overflow:hidden;font:12px/1.48 ui-monospace,SFMono-Regular,Consolas,monospace;min-width:0}
.caw-tty *{box-sizing:border-box}
.caw-tty .tty-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:12px 15px;border-bottom:1px solid var(--edge);letter-spacing:.07em}
.caw-tty .tty-title{font-weight:700;color:var(--green)}
.caw-tty .tty-metrics{display:flex;flex-wrap:wrap;gap:8px;color:var(--muted);font-size:11px}
.caw-tty .tty-pill{border:1px solid var(--edge);padding:3px 7px;border-radius:3px}
.caw-tty .tty-scene{display:grid;grid-template-columns:minmax(170px,.6fr) minmax(0,2fr);gap:16px;padding:16px}
.caw-tty .tty-aside{border:1px solid #725e9f;background:#141322;padding:14px;display:flex;flex-direction:column;gap:10px;min-height:340px}
.caw-tty .tty-label{font-size:10px;letter-spacing:.11em;color:var(--muted);text-transform:uppercase}
.caw-tty .tty-name{font-weight:700;font-size:13px;overflow-wrap:anywhere}
.caw-tty .tty-aside .tty-name{color:var(--violet)}
.caw-tty .tty-model{font-size:11px;color:var(--muted);overflow-wrap:anywhere}
.caw-tty .tty-oversight{margin-top:auto;padding-top:12px;border-top:1px solid #3e334e}
.caw-tty .tty-flow{display:flex;flex-direction:column;align-items:center;min-width:0}
.caw-tty .tty-node{border:1px solid var(--edge);padding:11px 10px;background:var(--panel);text-align:center;min-width:0;width:min(100%,290px)}
.caw-tty .tty-implement{border-color:#ab7960}
.caw-tty .tty-implement .tty-name{color:var(--amber)}
.caw-tty .tty-gate{border-color:#4f967b;background:#10201d}
.caw-tty .tty-gate .tty-name{color:var(--green)}
.caw-tty .tty-branch{width:100%;display:flex;gap:8px;max-width:630px}
.caw-tty .tty-branch .tty-node{flex:1;width:auto;border-color:#58759d;padding:9px 5px}
.caw-tty .tty-branch .tty-name{color:var(--blue);font-size:12px}
.caw-tty .tty-spine{width:1px;height:24px;background:var(--edge);position:relative}
.caw-tty .tty-spine:before{content:"";position:absolute;top:0;left:-2px;background:var(--blue);width:5px;height:5px;border-radius:50%}
.caw-tty[data-status=running] .tty-spine:before{animation:tty-flow 1.55s linear infinite}
.caw-tty .tty-fork{height:20px;width:78%;border-top:1px solid var(--edge);border-left:1px solid var(--edge);border-right:1px solid var(--edge);margin-top:7px}
.caw-tty .tty-join{height:20px;width:78%;border-bottom:1px solid var(--edge);border-left:1px solid var(--edge);border-right:1px solid var(--edge)}
.caw-tty .tty-return{border:1px solid #826554;padding:7px 12px;background:#1d1717;color:var(--amber);font-size:11px;text-align:center}
.caw-tty .tty-state{font-size:10px;color:var(--muted);margin-top:4px}
.caw-tty .tty-state[data-status=completed]{color:var(--green)}
.caw-tty .tty-state[data-status=failed]{color:var(--amber)}
.caw-tty .tty-gauge{display:flex;height:5px;gap:2px;background:#2d3b38;margin-top:9px}
.caw-tty .tty-gauge span{flex:1;background:#3d665a}
.caw-tty .tty-gauge span[data-done=true]{background:var(--green)}
.caw-tty .tty-console{border-top:1px solid var(--edge);padding:12px 15px;background:#0e141e}
.caw-tty .tty-console-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;gap:10px}
.caw-tty .tty-console button{border:1px solid var(--edge);color:var(--blue);font:inherit;font-size:11px;padding:3px 9px;background:#172335;cursor:pointer;border-radius:3px}
.caw-tty .tty-log{display:grid;grid-template-columns:50px minmax(80px,125px) minmax(0,1fr);gap:8px;border-bottom:1px solid #1d2836;padding:3px 0;color:var(--muted);font-size:11px}
.caw-tty .tty-log code{color:var(--blue);overflow-wrap:anywhere}
.caw-tty .tty-log span:last-child{overflow-wrap:anywhere}
.caw-tty .tty-alert{border-left:2px solid var(--amber);margin-top:10px;padding:3px 9px;color:var(--amber);overflow-wrap:anywhere}
.caw-tty .tty-footnote{color:var(--muted);font-size:10px;margin-top:8px}
@keyframes tty-flow{from{transform:translateY(0);opacity:.5}to{transform:translateY(22px);opacity:0}}
@container(max-width:760px){.caw-tty .tty-scene{grid-template-columns:1fr}.caw-tty .tty-aside{min-height:auto}}
@container(max-width:470px){.caw-tty .tty-scene{padding:10px}.caw-tty .tty-branch{flex-direction:column}.caw-tty .tty-fork,.caw-tty .tty-join{display:none}.caw-tty .tty-log{grid-template-columns:50px 1fr}.caw-tty .tty-log span:last-child{grid-column:2}}
@media(prefers-reduced-motion:reduce){.caw-tty .tty-spine:before{animation:none!important}}
`;

export function createFusionTerminalView(React,{t,button}) {
  const h=React.createElement;
  const state=(s)=>h('span',{className:'tty-state','data-status':s},t(s??'unknown'));
  const role=(caption,model,status)=>h('div',{className:'tty-node'},
    h('div',{className:'tty-name'},caption),
    h('div',{className:'tty-model'},model??t('fusionTerminalUnknown')),
    state(status));
  const line=()=>h('div',{className:'tty-spine','aria-hidden':true});
  function FusionTerminal({run,onLogs}) {
    if(run?.args?.preset!=='fusion.v1') return null;
    const d=fusionTerminalSnapshot(run);
    const rounds=d.maxRounds?Array.from({length:Math.min(3,d.maxRounds)},(_,i)=>i<(d.rounds??0)):[];
    return h('section',{className:'caw-tty','data-fusion-terminal':'','data-status':d.status,'aria-label':t('fusionTerminalTitle')},
      h('style',null,STYLE),
      h('header',{className:'tty-head'},
        h('span',{className:'tty-title'},'▣  '+t('fusionTerminalTitle')),
        h('div',{className:'tty-metrics'},
          h('span',{className:'tty-pill'},t(d.status)),
          h('span',{className:'tty-pill'},t('fusionRounds')+': '+(d.rounds??'—')+'/'+(d.maxRounds??'—')),
          h('span',{className:'tty-pill'},t('tokens')+': '+(d.tokens===null?'—':d.tokens.toLocaleString())))),
      h('div',{className:'tty-scene'},
        h('aside',{className:'tty-aside'},
          h('div',{className:'tty-label'},t('fusionTerminalOversight')),
          h('div',{className:'tty-name'},'LEAD / '+t('fusionTerminalDecision')),
          h('div',{className:'tty-model'},d.models.lead??t('fusionTerminalUnknown')),
          state(d.actors.lead),
          h('div',{className:'tty-oversight'},
            h('div',{className:'tty-label'},t('fusionTerminalSignoff')),
            state(d.signoff),
            h('p',{className:'tty-model'},t('fusionTerminalNotAdvisor')))),
        h('div',{className:'tty-flow'},
          h('div',{className:'tty-label'},t('fusionTerminalExecution')),
          h('div',{className:'tty-node tty-implement'},
            h('div',{className:'tty-name'},'SIDEKICK / '+t('fusionTerminalBuild')),
            h('div',{className:'tty-model'},d.models.sidekick??t('fusionTerminalUnknown')),
            state(d.actors.sidekick)),
          line(),
          h('div',{className:'tty-node tty-gate'},
            h('div',{className:'tty-name'},t('fusionTerminalGate')),
            h('div',{className:'tty-model'},d.script?'pnpm run '+d.script:t('fusionTerminalUnknown')),
            state(d.tests),
            d.testExit!==null&&h('div',{className:'tty-state'},'exit '+d.testExit),
            rounds.length>0&&h('div',{className:'tty-gauge','aria-label':t('fusionRounds')},
              rounds.map((done,i)=>h('span',{key:i,'data-done':done})))) ,
          line(),
          h('div',{className:'tty-label'},t('fusionTerminalParallel')),
          h('div',{className:'tty-fork','aria-hidden':true}),
          h('div',{className:'tty-branch'},
            role(t('fusionTerminalPlan'),d.models.lead,d.actors.lead),
            role(t('fusionTerminalTest'),d.script?'pnpm run '+d.script:null,d.tests),
            role(t('fusionTerminalReview'),d.models.reviewer,d.review)),
          h('div',{className:'tty-join','aria-hidden':true}),line(),
          h('div',{className:'tty-return'},t('fusionTerminalReturn')+' · '+t(d.signoff)))),
      h('div',{className:'tty-console'},
        h('div',{className:'tty-console-head'},
          h('span',{className:'tty-label'},t('fusionTerminalLogs')),
          button(t('fusionInspect'),onLogs,false,false,{className:'tty-console-button'})),
        d.logs.length?d.logs.map(e=>h('div',{className:'tty-log',key:e.seq},
          h('span',null,'#'+e.seq),h('code',null,e.type),h('span',null,e.message||'—'))):
          h('div',{className:'tty-model'},t('fusionTerminalNoLogs')),
        d.blockers.length>0&&h('div',{className:'tty-alert',role:'status'},
          t('fusionBlockingIssues')+': '+d.blockers.join(' · ')),
        h('div',{className:'tty-footnote'},t('fusionTerminalEvidence'))));
  }
  return {FusionTerminal};
}
