# Encrypted static export

Encrypted publishing is the default GitHub Pages publishing mode for small, fictional prototypes. Local encrypted export is available through `npm run build:encrypted`. Local development still uses the ordinary Eleventy site. The publishing build encrypts all generated files and outputs a separate `_encrypted/` folder.

This implementation uses the pinned [StatiCrypt](https://github.com/robinmoisson/staticrypt) package for password derivation and authenticated encryption. It does not treat a client-side password comparison as protection.

## Build and preview

```sh
npm run build:encrypted
npm run preview:encrypted
```

The build prompts for a passphrase with input hidden. Use a long, unique, randomly generated passphrase; at least 20 characters are required, but length alone does not establish strength. Do not reuse a login password. Share it separately from the prototype URL.

For automation, supply `ENCRYPTION_PASSPHRASE` through a CI secret or your process environment. Do not put it in site.yaml, a command argument, a committed `.env` file, a URL, or the README. The script does not load `.env` files automatically. The normal Eleventy/assets subprocess does not receive the encryption secret.

Only publish `_encrypted/`. `_site/` and `build/` still contain plaintext locally and are ignored by Git. Never upload the entire working directory as a deployment artefact. A failed encrypted build stops rather than publishing a plaintext fallback; it can leave the previous encrypted output locally, so do not publish an old directory after an error.

A repository-subpath build uses the same BASE_PATH as ordinary publishing:

```sh
BASE_PATH=/GOV.UK-Static-Prototype-Kit/ npm run build:encrypted
```

`preview:encrypted` is a simple file server, intended for a root-path build. For a project-path build, use a static host configured to serve that folder at the corresponding path, or run the encrypted test suite's subpath server.

## Enable encrypted GitHub Pages deployment

In **Settings → Secrets and variables → Actions**:

1. In the **Secrets** tab, choose **New repository secret**. Name it `ENCRYPTION_PASSPHRASE` and use a strong, unique, randomly generated passphrase of at least 20 characters. Do not use a repository variable for the secret.
2. No `PROTOTYPE_PUBLISH_MODE` variable is required: publishing defaults to `encrypted`. If a mode variable already exists, delete it or set it to `encrypted`.
3. Enable GitHub Pages with **GitHub Actions** as the source, then run **Deploy GitHub Pages** or push to `main`. Share the passphrase separately with participants.

The deployment workflow builds with the Pages base path and uploads `_encrypted/` only. Missing/short credentials or an invalid mode stop deployment. The passphrase is supplied to the encryption process through the environment and is not written into the published files. Tests use a fresh random throwaway credential; CI does not need the deployment secret to run them.

The default mode is `encrypted`. Deleting the mode variable keeps encrypted publishing. To deliberately opt out, set the Actions repository variable `PROTOTYPE_PUBLISH_MODE=static`; this publishes plaintext `_site/`. Existing explicit `static` variables continue to opt out, so review them when upgrading. Protect repository settings and review publishing changes. Missing/short credentials stop the new deployment; they do not remove or protect a version already live. Rotating a passphrase requires changing the secret and rebuilding. Each build generates a fresh salt, so remembered unlock keys stop working on the new build.

**This public kit repository contains its sample prototype in plaintext. Encrypting its deployment does not make the already-public source or screenshots secret.** Use a separate private source repository for designs whose content you intend to withhold. Review the complete Git history, releases, pull requests, Actions logs, artefacts and previous deployments for prior disclosures. Do not change this kit repository's visibility to work around that limitation.

## What the exporter publishes

| File | Public contents |
| --- | --- |
| Each page's `index.html` and a generic `404.html` | The same generic GOV.UK-styled unlock screen, without page titles or prototype content. |
| `__encrypted/payload.json` | Format version, random salt, base path and authenticated ciphertext containing the generated file map. |
| `__encrypted/unlock.js` | Generic decryption and rendering code; no passphrase or decryption key. |
| `__encrypted/unlock.css` and its `assets/` | Official GOV.UK styles, fonts and images used by the generic unlock screen. |

Every file from `_site/`, including custom CSS, JavaScript, images, downloads and embedded scenario data, is included inside the encrypted map. Unlike StatiCrypt's ordinary recursive CLI, this exporter does not copy non-HTML prototype assets into the public output. Symlinks and unsupported page output shapes fail the build.

Route directory names, the base path, approximate encrypted size and the existence of the site remain public. The payload is not compressed. Allow for base64 and encryption encoding overhead: this mode is designed for small prototypes, not large media libraries.

## What happens in the browser

1. The generic shell fetches the encrypted map, revalidating it with the server so a stale copy is never used. It does not display underlying page content while unlocking. If this tab is already unlocked, the form stays hidden and the shell shows "Opening prototype" instead.
2. StatiCrypt derives a key from the visitor's passphrase and public salt, authenticates the ciphertext and decrypts it. The map is gzip-compressed before encryption and decompressed in the browser.
3. **Decrypt once.** The loader hands every decrypted file to a service worker (`sw.js` at the base path) and reloads. The service worker keeps the files in Cache Storage and serves pages and assets from there, so later navigation needs no download or decryption. The encrypted files under `__encrypted/` always come from the network.
4. Each decrypted page starts with a check: if the tab has no unlocked session, the page is hidden before it paints, the decrypted cache is cleared and the shell loads instead. A shell opened without a usable session also clears any decrypted pages left on the device.
5. At most once a minute, a page navigation checks `__encrypted/version.txt`, which holds the deploy's salt. A new deploy clears the decrypted cache and loads the shell, bypassing the HTTP cache. The time of the last check is kept in Cache Storage, because Safari stops idle service workers quickly. Because the salt travels inside the payload, the version a page installs always matches `version.txt`, even if the shell itself came from a stale HTTP cache.
6. **Loop breaker.** If a tab returns to the shell and installs twice within 30 seconds, it stops using the service worker and renders in place.
7. **Fallback.** Where service workers are unavailable, or do not register within 3 seconds, the loader renders the page in place: it creates memory-only blob URLs for local assets, rewrites references and replaces the document. Each navigation then loads the shell and decrypts again with the remembered session key.

The raw passphrase is not stored. A derived decryption key is stored in sessionStorage, namespaced by base path and tied to the build's salt. **That derived key is an access credential:** possession is sufficient to decrypt the build. It is not a harmless password hash. There is no long-lived “remember me” option or key-in-URL feature.

**Decrypted pages are stored on the device.** With the service worker, readable copies of every page stay in Cache Storage after the tab closes. They are cleared when someone locks the prototype, opens it in a tab without an unlocked session, or a new version is deployed, not when the tab closes: a service worker cannot detect that. Treat a device that has unlocked the prototype as holding its content until one of those happens.

**Lock prototype** removes the current tab's remembered key and that prototype's fictional answers, clears the decrypted cache, revokes any blob URLs, and reloads the shell. Browser Back is checked to avoid restoring a usable unlocked page after locking. Locking is not secure erasure of memory or revocation of content a visitor has already copied. Other unlocked tabs keep their session credentials and decrypt again on their next navigation. Browsers can duplicate/restore tab session storage, so closing a tab is not a reliable revocation mechanism.

If sessionStorage is blocked, initial decryption still works but every full page navigation requires the passphrase again. HTTPS or localhost and JavaScript are required. Browser storage of answers is unchanged: encryption protects published files, not answers entered during research.

## Supported authoring surface

The standard kit journey, bundled scripts, stylesheets, CSS `url()` references, ordinary local CSS imports, images, basic `srcset` lists, local downloadable links and fictional scenarios work. All HTML pages must use directory-style `index.html` output, with an optional `404.html`. The exporter fails on other HTML filenames rather than silently publish an incomplete journey.

The encrypted renderer is not a general-purpose virtual web server. Author scripts using runtime `fetch()` for local files, unbundled JavaScript modules with relative imports, workers, service workers, relative references inside standalone SVGs, and complex data-URI `srcset` lists need their own integration. The build cannot guarantee that arbitrary new scripts or external embeds work or preserve confidentiality. Bundle scripts, keep content local and test each customised journey in encrypted mode. External resources and third-party scripts are outside the encrypted archive's protection.

Because rendering uses blob URLs and script execution, a restrictive Content Security Policy requires a separate design and testing exercise. No protection against hostile scripts on the same origin is claimed.

## Security boundary

- **Offline guessing is possible.** Anyone can download the ciphertext. Password strength is essential; there is no server-side rate limiting.
- **The host and delivered unlock code must be trusted.** An attacker who can replace the loader can capture entered passphrases or unlocked content. HMAC authentication of the payload does not authenticate a compromised loader.
- **Source and history matter.** Encryption cannot retract material already present in public source, README screenshots, logs, caches, artefacts or older deployments.
- **No per-user access or revocation.** Anyone with the shared credential can copy it. Re-encryption cannot revoke previously downloaded copies.
- **Origins matter.** Session storage is isolated by origin and tab, not by URL path. GitHub project sites under one owner's `github.io` host share an origin. A compromised sibling site can endanger a remembered key; prefer a dedicated origin and never load untrusted scripts.
- **Answers remain browser data.** This does not encrypt participant answers at rest or provide a secure submission channel. Continue to use fictional information only.

StatiCrypt 3.5.4 uses AES-256-CBC, an HMAC-SHA256 check before decryption and its 600,000-total-iteration password-derivation sequence. The kit disables legacy-key fallback when decoding new exports. Random salts and IVs are regenerated on each export. Package-internal APIs are pinned, isolated in one adapter and covered by tests. This integration has not received an independent security audit.

Use authenticated organisational hosting for personal data, confidential research or protected government material. Encrypted export reduces passive disclosure of published prototype files; it is not organisational identity/access management or a production security assurance.

## Verify

```sh
npm run check
npm run test:encrypted
```

The encrypted suite generates a random passphrase, builds at `/sample.repo/`, serves `_encrypted/` on an isolated port, and checks desktop/mobile behaviour: no plaintext prototype files, incorrect credentials, tampered ciphertext, keyboard/error focus, axe checks, styles, full journey navigation, answer editing, refresh, scenarios, locking/browser Back and disabled JavaScript. It does not print or commit the random credential.

The suite leaves a test-specific build locally. Run `npm run build` afterwards to restore normal root-path output. Never deploy the test output: generate a fresh export using your own build-time credential.

## Faster checks without weakening encryption

Deployment waits for the same required Checks workflow used by pull requests. Its root, subpath, demo-gate and encrypted desktop/mobile suites run in parallel. Chromium and WebKit downloads are cached by OS, architecture and lockfile; system dependencies are installed on each runner. Build assets are reused only after input and output hash validation. Generated site files, passphrases and derived keys are never placed in the Actions dependency cache.

After unlocking, a service worker serves decrypted pages from Cache Storage, so following links, submitting forms and refreshing do not download or decrypt the payload again. See [What happens in the browser](#what-happens-in-the-browser) for when those copies are cleared. Encryption parameters, authentication checks, fresh salts and fresh IVs are unchanged.
