# samolyev.ru

A bilingual English/Russian personal website for Ilia Samoilov, built with plain
HTML, CSS and JavaScript. It includes experience pages, saved language preferences,
System/Light/Dark themes and an animated ASCII planet that respects reduced motion.
No application build step or backend is required.

Run locally and open http://localhost:8000:

```sh
python3 -m http.server 8000
```

Install development dependencies and run the checks:

```sh
npm ci
npm test
npm run format:check
```

Build and run the Docker image, then open http://localhost:8080:

```sh
docker build -t samolyev-site .
docker run --rm -p 8080:8080 samolyev-site
```

The ASCII planet uses ascii.rest by bas3line under MIT. Theme icons use Lucide
under ISC, with Feather-derived icons under MIT. See
[THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt) for attribution and license text.
