# Vendored ZCode dynamic workflow

Source: https://github.com/zai-org/ZCode

Pinned commit: `3c5b227649371507ddc4eb46ac5133afe6db1cab`.

The `dynamic-workflow/` and `dynamic-workflow-runtime/` directories are copied from
`apps/zcode-cli/packages/` at that commit. Their compiler, static analysis, schema
synthesis, execution engine, journal replay, subprocess runtime, tests and fixtures
are upstream implementations. Source files are retained verbatim. `dist/` and
`dynamic-workflow/src/compiler/libs.generated.ts` are generated with TypeScript
5.9.3 by the upstream generator and compiler.

Packaging changes: the runtime manifest's `@zcode/dynamic-workflow` dependency uses
`file:../dynamic-workflow` instead of the upstream `workspace:*`, so the two
vendored packages install outside the upstream monorepo. The core `.gitignore`
allows the generated standard-library source to be tracked for redistribution.
No upstream exported API or runtime behavior is changed.

Build from the plugin root with `node scripts/build-workflow.mjs` after installing
the root dependencies. It runs the original standard-library generator and builds
the core before the runtime. It also refreshes generated `dist/` files in pnpm's
installed `file:` package copies so local imports use the current build. Commit
generated artifacts with the source so an installed plugin does not need a build
toolchain. Upstream package scripts are retained as provenance; workspace-only
helpers are not the plugin build entry.

Runtime imports are `@zcode/dynamic-workflow` and
`@zcode/dynamic-workflow-runtime`. The runtime renders a self-contained child entry
file; it does not require a separately copied child executable. Its Node process
and filesystem access must be bound by the DSH integration; Node's `vm` is not an
operating-system security boundary.

`LICENSE`, `NOTICE.md`, and `THIRD-PARTY-NOTICES.md` are the original upstream
notices. ZCode first-party code is Apache-2.0. The surrounding plugin's separate license
does not relicense this code. Embedded TypeScript standard-library declarations
retain their original notices; the TypeScript license and third-party notice text
are also included alongside this document.
