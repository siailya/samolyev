# samolyev.ru

Minimal bilingual personal website for Ilia Samoilov, built with plain HTML, CSS and a small amount of JavaScript.

## Pages

- `/` — selects Russian or English using the saved preference, then browser language.
- `/ru/index.html`, `/en/index.html` — brief introduction and experience.
- `/ru/experience.html`, `/en/experience.html` — AI-native development, core skills and detailed experience.

Language-specific URLs remain accessible directly. The language switch saves the visitor's choice where localStorage is available.

## Run locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. No build step or package installation is required.

## Formatting

Node.js and npm are needed only for development formatting, not to serve the site.

```sh
npm ci
npm run format
npm run format:check
```

Prettier is pinned in the lockfile. HTML, CSS, JavaScript, JSON and Markdown use the repository configuration. The page scripts are kept in `language.js` and `redirect.js` rather than inline HTML.

## Current scope

This is the current reviewed prototype. The decorative planet uses the real ascii.rest animation (version 0.4.0, pinned on jsDelivr with Subresource Integrity). It pauses when off-screen or when the tab is hidden, and respects reduced-motion preferences. A static fallback remains visible if the library cannot load. Only the confirmed GitHub contact URL is included. The Neutron Agency end date is intentionally omitted pending confirmation.

Publishing, DNS and hosting are not configured by this repository upload.

## Attribution

The decorative ASCII planet frame comes from [ascii.rest](https://ascii.rest/planet/), by bas3line, under the MIT license. See `THIRD_PARTY_LICENSES.txt`.
