# Architecture decisions

1. Eleventy and Nunjucks produce readable static HTML using official macros, with less runtime machinery than a SPA. Node is a build/development dependency only.
2. Browser state is distinct from build data: Nunjucks renders configuration, while data-answer and data-show-when read session/local storage after load. Runtime strings use textContent.
3. GitHub Pages is the default for public, fictional prototypes because it needs no application server. It cannot enforce the included demo gate; confidential work requires authenticated hosting protecting file delivery.
4. The optional demo gate is deliberately described as convenience. Its public passphrase is not a secret and session markers can be forged.
5. One URL helper prefixes every local route/asset with a validated build base path. CI exercises root and repository paths. GOV.UK Frontend comes from an exact dependency, independently updated through Dependabot and browser/manual visual review.

The first version supports the example folder as its validated authoring surface. No server routing, production data handling or Express compatibility is provided.
