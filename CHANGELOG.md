# Changelog

## Unreleased

- Default GitHub Pages publishing to encrypted output, with an explicit static opt-out and failure before building when credentials are absent.
- Upload the directory selected by the successful publishing build.
- Put encryption setup and upgrade instructions near the top of the README.

## 1.1.0

- Add optional complete-site encryption using pinned StatiCrypt primitives, a GOV.UK unlock screen, session unlock keys and a lock action.
- Support encrypted GitHub Pages publishing through a repository variable and build-time secret, with no plaintext fallback on failure.
- Add authenticated-decryption, ciphertext-tampering, asset-leak and desktop/mobile encrypted-journey tests.
- Accept dotted repository base paths, including this project's own name.
- Document the encryption workflow, supported authoring patterns and security boundaries.

## 1.0.0

Initial static Eleventy starter, browser journeys, fictional scenarios, optional demo gate, Pages deployment, tests and authoring documentation.
