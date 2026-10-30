# Encrypted static export

Encrypted publishing is an optional build mode for small, fictional prototypes. Local development still uses the ordinary Eleventy site. The publishing build encrypts all generated files and outputs a separate `_encrypted/` folder.

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

1. Add a repository **variable** named `PROTOTYPE_PUBLISH_MODE` with value `encrypted`.
2. Add a repository **secret** named `ENCRYPTION_PASSPHRASE` with a strong, unique passphrase of at least 20 characters.
3. Enable GitHub Pages with **GitHub Actions** as the source, then run **Deploy GitHub Pages** or push to `main`.

The deployment workflow builds with the Pages base path and uploads `_encrypted/` only. Missing/short credentials or an invalid mode stop deployment. The passphrase is supplied to the encryption process through the environment and is not written into the published files. Tests use a fresh random throwaway credential; CI does not need the deployment secret to run them.

The default mode remains `static` for existing users. Removing the mode variable or setting it to `static` deliberately returns to publishing plaintext `_site/`; protect repository settings and review publishing changes. Rotating a passphrase requires changing the secret and rebuilding. Each build generates a fresh salt, so remembered unlock keys stop working on the new build.

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

1. The generic shell fetches the encrypted map. It does not display underlying page content while unlocking.
2. StatiCrypt derives a key from the visitor's passphrase and public salt, authenticates the ciphertext and decrypts it.
3. The loader finds the current page, creates memory-only blob URLs for its local assets and rewrites the HTML/CSS references before rendering it.
4. Ordinary links and form navigation load another generic shell at the next static route. The remembered session key decrypts it again without another prompt.

The raw passphrase is not stored. A derived decryption key is stored in sessionStorage, namespaced by base path and tied to the build's salt. **That derived key is an access credential:** possession is sufficient to decrypt the build. It is not a harmless password hash. There is no long-lived “remember me” option or key-in-URL feature.

**Lock prototype** removes the current tab's remembered key and that prototype's fictional answers, revokes its active blob URLs, and reloads the shell. Browser Back is checked to avoid restoring a usable unlocked page after locking. Locking is not secure erasure of memory or revocation of content a visitor has already copied. Other unlocked tabs retain their own session credentials. Browsers can duplicate/restore tab session storage, so closing a tab is not a reliable revocation mechanism.

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
