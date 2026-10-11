# samolyev.ru

Minimal bilingual personal website for Ilia Samoilov, built with plain HTML, CSS and small shared scripts. There is no app build step or backend.

## Pages and preferences

- `/` — complete English homepage, also usable with JavaScript disabled. A small synchronous head script redirects Russian visitors to `/ru/` before rendering, using a valid saved language first, then the browser's ordered English/Russian preferences.
- `/en/`, `/ru/` — introductions and experience summaries.
- `/en/experience.html`, `/ru/experience.html` — the existing detailed experience and skills.

Explicit locale URLs never auto-redirect. Language links save the manual choice when storage is available; choosing EN overrides a Russian browser preference on later root visits. Blocked storage never prevents navigation or theme changes.

The compact theme button on every page cycles through System, Light and Dark, using local Lucide monitor, sun and moon SVG icons. Its tooltip and accessible label describe the current mode and the next one. The initial theme is applied before CSS, follows system changes in System mode, and saves manual choices. Without JavaScript, CSS still follows the system theme. Content is always visible; optional reveals last 240ms and move only 4px. Reduced motion disables reveals, including when enabled during a visit.

The decorative planet keeps the real ascii.rest animation, pinned at 0.4.0 on jsDelivr with Subresource Integrity. It pauses off-screen or in a hidden tab, and respects reduced motion. The original static frame is the fallback when the CDN is unavailable. Its color follows the page theme on desktop and mobile.

## Run locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Dependencies are only needed for development checks:

```sh
npm ci
npm test
npm run format:check
npm run format
```

Prettier is pinned in the lockfile and formats all supported repository files, including workflow YAML. Dockerfile and native Nginx configuration use consistent manual formatting because Prettier has no built-in parser for those formats. Tests use Node's built-in runner with no extra dependencies.

## Container

```sh
docker build -t samolyev-site .
docker run --rm -p 8080:8080 --name samolyev-site samolyev-site
```

Open http://localhost:8080. The image uses non-root Nginx (UID 101), listening on 8080. The pinned [1.28.0-alpine-slim tag is published on Docker Hub](https://hub.docker.com/layers/nginxinc/nginx-unprivileged/1.28.0-alpine-slim/images/sha256-3fac8e5cca4d3c4e37f88f3a550bd49c172f39ea6264bbb5aafc9b6eb6404ae4). Only explicitly listed public assets are copied; tooling, repository metadata and documentation are excluded from the build context. `/healthz` returns `ok`. HTML uses `no-cache`, JS/CSS use a one-hour cache, and missing paths return 404. Security headers allow the external ASCII module, piece requests and font; inline styles are allowed for the library's shadow DOM.

With the container running, execute the HTTP integration checks:

```sh
SITE_CONTAINER_URL=http://localhost:8080 node --test tests/container.test.cjs
```

Without that environment variable, `npm test` explicitly skips container integration checks. The other tests execute the real scripts in a simulated browser environment and check static content and links; they do not replace visual browser inspection.

## Browser checks

- Disable JavaScript and open `/`: verify the full English homepage, experience link and contacts.
- Clear the site's saved language, set the browser to Russian and open `/`: verify `/ru/`. Open `/en/` directly: it stays English. Click EN, then revisit `/`: it stays English.
- Switch to System and change the OS color scheme: the palette updates. Switch to Light or Dark: system changes no longer override it. Reload to verify persistence; also try with storage blocked.
- Test desktop and a narrow mobile viewport: the planet remains decorative behind the content, and links and the theme button are keyboard accessible. Enable reduced motion: the planet is still and content reveals stop.

## CI and publishing

GitHub Actions runs dependency installation, formatting, regression tests, a container build and HTTP integration checks on pull requests, pushes to `main`, and manual dispatch. Only non-PR events publish `ghcr.io/siailya/samolyev-site:latest` and `ghcr.io/siailya/samolyev-site:sha-<commit>` after checks succeed. The publish job alone receives `packages: write` and authenticates with `GITHUB_TOKEN`. The OCI source label links to `https://github.com/siailya/samolyev`. No deployment is configured.

## Content and attribution

Existing experience facts are preserved; the Neutron Agency end date remains omitted pending confirmation. The displayed nicknames are `@siailya / @samolyev`, with the first linking to `https://t.me/siailya`. Footer contacts include GitHub, Telegram and LinkedIn.

The decorative ASCII planet frame comes from [ascii.rest](https://ascii.rest/planet/), by bas3line, under the MIT license. See `THIRD_PARTY_LICENSES.txt`.

Theme icons come from [Lucide](https://icones.js.org/collection/lucide) under the ISC license, with Feather-derived monitor and moon icons also covered by MIT. See `THIRD_PARTY_LICENSES.txt`.
