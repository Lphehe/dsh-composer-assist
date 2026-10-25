# Third-party provenance

The standalone Fusion host and compiler incorporate upstream ZCode dynamic workflow code from `vendor/zcode` bundled at build time.

- Upstream: https://github.com/zai-org/ZCode
- Pinned source commit: `3c5b227649371507ddc4eb46ac5133afe6db1cab`
- License: Apache-2.0 for ZCode first-party code; see the vendored upstream `LICENSE`, `NOTICE.md`, and `THIRD-PARTY-NOTICES.md` in the repository.
- The embedded TypeScript standard-library declarations retain their original upstream attribution.

The composer prediction package is not bundled into this experimental addon.
