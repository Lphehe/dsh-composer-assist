# dsh-composer-fusion (experimental standalone package)

A separately installable, *unpublished* DSH workflow addon built from the existing isolated `workflow/` implementation. It does **not** change the prediction plugin `dsh-composer-assist` or its tracked `dist/client.js`.

## Local package/build

From repository root:

```sh
pnpm install --frozen-lockfile
node scripts/build-fusion-addon.mjs
node scripts/verify-fusion-addon.mjs
cd packages/dsh-composer-fusion
npm pack --ignore-scripts
```

The tarball contains the standalone Host entry, compiler worker, and browser client, with no runtime `file:` dependency on development-only vendored packages. Package scripts build from repository checkout and are **not** run by end users. The package is `private: true` to prevent accidental npm publication; the tarball is only for local testing. Remove that flag only in a separate reviewed release PR after live DSH validation.

## Installation (after local pack)

Use the **DSH CLI associated with the target profile**. On macOS Desktop the CLI may live at:

```sh
'/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh' plugin --profile desktop add ./dsh-composer-fusion-0.1.0-alpha.0.tgz
```

This is a proposed test installation command; DSH Desktop must be installed and compatible. The ordinary `dsh` CLI can be used for its own non-Desktop profiles. No Desktop smoke test has been performed yet.

Restart the client after installation. A **Workflows** view should expose the **Fusion** form. The Host route must be available for create/launch/review. First launch still requires explicit confirmation, and no workflow automatically pushes code or deploys anything.

## Verification boundary

The CI checks bundling, JS syntax, package contents, and existing model-free UI/engine selfchecks. These do **not** establish runtime compatibility with a particular DSH version, correct sandbox enforcement on a real host, or visual UX quality. Keep this package private and the PR in Draft until a real DSH Desktop smoke test and security regression suite are recorded.

Implementation status is distinct from a published release. See `../../workflow/docs/fusion.md` for the workflow engine and safety contract.
