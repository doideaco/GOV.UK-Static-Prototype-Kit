# Security and privacy

**Never use GitHub Pages + client-side gate for real personal data, confidential research, unpublished sensitive policy, or protected internal material.**

The demo gate is a bypassable convenience screen. Its public passphrase and HTML/assets are recoverable. Hashing the passphrase would not change that. Browser storage is neither confidential nor trusted. Use invented information and clear answers after research.

For confidential prototypes deploy `_site` behind organisational authentication or Cloudflare Access. Protect every HTML and asset request before delivery, disable any public Pages/preview/origin endpoint, and verify unauthenticated deep links and assets are rejected. Configure identity policies and session expiry with your organisation. This is a hosting migration, not a frontend authentication adapter.

Do not commit secrets. Report security issues privately to the repository owner's security contact rather than including sensitive information in public issues.
