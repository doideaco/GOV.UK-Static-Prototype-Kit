# Security and privacy

**Never use GitHub Pages + client-side gate for real personal data, confidential research, unpublished sensitive policy, or protected internal material.**

The demo gate is a bypassable convenience screen. Its public passphrase and HTML/assets are recoverable. Hashing the passphrase would not change that. Browser storage is neither confidential nor trusted. Use invented information and clear answers after research.

For confidential prototypes deploy `_site` behind organisational authentication or Cloudflare Access. Protect every HTML and asset request before delivery, disable any public Pages/preview/origin endpoint, and verify unauthenticated deep links and assets are rejected. Configure identity policies and session expiry with your organisation. This is a hosting migration, not a frontend authentication adapter.

Do not commit secrets. Report security issues privately to the repository owner's security contact rather than including sensitive information in public issues.

## Encrypted export

Default encrypted Pages publishing protects generated prototype files in `_encrypted/` using the pinned StatiCrypt implementation. It does not make public source/history private, protect entered answers, prevent offline password guessing, authenticate the hosting origin, or provide per-user revocation. The integration has not had an independent security audit. Continue to use fictional information.

Never publish plaintext `_site/` or `build/` when intending an encrypted export. Keep the real `ENCRYPTION_PASSPHRASE` in a build-time CI secret or enter it through the hidden local prompt. A derived session unlock key is an access credential, readable by scripts on the same origin. Locking clears the current tab's key, not copies held by other tabs or visitors.

The default deployment mode is encrypted. Supply the Actions repository secret `ENCRYPTION_PASSPHRASE` (minimum 20 characters); no mode variable is required. Missing/short credentials stop deployment without a plaintext fallback, but do not remove an older live version. Only an explicit repository variable `PROTOTYPE_PUBLISH_MODE=static` selects public plaintext publishing. Review any existing static setting when upgrading and protect settings from unintended changes. Read the full [encrypted-export threat model](docs/encrypted-export.md) before use.
