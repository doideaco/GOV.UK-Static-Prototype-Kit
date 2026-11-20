# Changelog

## Unreleased

- Decrypt encrypted prototypes once per session: a service worker serves the decrypted pages, so moving between pages no longer downloads or decrypts the payload. Falls back to rendering in place where service workers are unavailable.
- Compress the encrypted payload before encryption and keep text files as text inside it; envelope format 2, format 1 still accepted.
- Revalidate the encrypted payload instead of skipping the cache, and reference unlock assets and the payload by content hash.
- Identify each deploy by its payload salt, check for new deploys at most once a minute, and break reload loops, fixing a loop and per-page lag in Safari.
- Show "Opening prototype" instead of the passphrase form when an unlocked tab opens a page, restore the form after 8 seconds if opening stalls, and keep "Unlocking prototype" until the page changes.
- Add a skip link and header and footer landmarks to the unlock screen.
- Run the encrypted suite in WebKit as well as Chromium, locally and in CI.
- Fix GOV.UK Frontend components not starting: add the `govuk-frontend-supported` body class.
- Allow Eleventy pagination templates, which compute their permalinks, in route validation.
- Group Dependabot updates, and run checks once per pull request.

- Add optional standard form-action and inline radio routing, with navigation-only `redirect` groups and answer-preserving `data-next` attributes.
- Validate rendered form destinations, conflicting routing sources and missing option routes during the build; retain existing YAML journeys.
- Add working routing examples, automatic inline selection validation and ordinary/encrypted browser coverage.

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
