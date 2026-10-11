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

## Current scope

This is the current reviewed prototype. The decorative planet is a static ASCII frame, not yet animated. Only the confirmed GitHub contact URL is included. The Neutron Agency end date is intentionally omitted pending confirmation.

Publishing, DNS and hosting are not configured by this repository upload.

## Attribution

The decorative ASCII planet frame comes from [ascii.rest](https://ascii.rest/planet/), by bas3line, under the MIT license. See `THIRD_PARTY_LICENSES.txt`.
