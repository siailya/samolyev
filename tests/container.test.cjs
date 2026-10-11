const { test } = require("node:test");
const assert = require("node:assert/strict");
const base = process.env.SITE_CONTAINER_URL;
test(
  "Nginx health, pages, cache, headers, 404s and tooling exclusion",
  { skip: !base },
  async () => {
    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);
    assert.equal(await health.text(), "ok\n");
    const revision = await fetch(`${base}/revision.txt`);
    assert.equal(revision.status, 200);
    assert.equal(revision.headers.get("cache-control"), "no-cache");
    assert.equal(await revision.text(), `${process.env.SITE_REVISION ?? "unknown"}\n`);
    for (const url of ["/", "/ru", "/experience", "/ru/experience"]) {
      const response = await fetch(base + url, { redirect: "manual" });
      assert.equal(response.status, 200, url);
      assert.match(response.headers.get("content-type"), /^text\/html(?:;|$)/);
      assert.equal(response.headers.get("cache-control"), "no-cache");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.match(
        response.headers.get("content-security-policy"),
        /https:\/\/ascii.rest/,
      );
      assert.equal(response.headers.get("location"), null);
      assert.equal(
        response.headers.get("referrer-policy"),
        "strict-origin-when-cross-origin",
      );
      assert.equal(
        response.headers.get("permissions-policy"),
        "camera=(), microphone=(), geolocation=()",
      );
      const html = await response.text();
      assert.match(html, /Magnit/);
      assert.match(html, /Neutron Agency/);
      assert.ok(html.includes(`rel="canonical" href="https://samolyev.ru${url}"`));
      assert.ok(
        html.includes(`<html lang="${/^\/ru(?:\/|$)/.test(url) ? "ru" : "en"}">`),
      );
      assert.match(html, url.includes("experience") ? /Kafka/ : /piece="planet"/);
      assert.ok(
        html.includes(
          url.includes("experience")
            ? /^\/ru(?:\/|$)/.test(url)
              ? "Опыт работы"
              : "Experience"
            : /^\/ru(?:\/|$)/.test(url)
              ? "Продуктовый full-stack разработчик"
              : "Product Full-Stack Engineer",
        ),
      );
      assert.doesNotMatch(html, /href="[^"]*\.html(?:[?#][^"]*)?"/);
      for (const [, asset] of html.matchAll(
        /(?:href|src)="(\/[^"?#]+\.(?:css|js|ico|png))"/g,
      )) {
        const response = await fetch(base + asset, { redirect: "manual" });
        assert.equal(response.status, 200, `${url}: ${asset}`);
      }
    }
    for (const url of ["/style.css", "/init.js", "/language.js"]) {
      const response = await fetch(base + url);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "public, max-age=3600");
    }
    for (const url of [
      "/missing",
      "/en/missing",
      "/experience/missing",
      "/ru/experience/missing",
      "/missing.html",
      "/ru/missing",
      "/experience/index.html/missing",
      "/ru/experience/index.html/missing",
      "/en/experience/index.html/missing",
      "/ruexperience",
      "/experiences",
      "/ru/index.html/missing",
      "/README.md",
      "/package.json",
      "/.git/config",
      "/tests/site.test.cjs",
      "/nginx.conf",
      "/compose.yaml",
      "/scripts/komodo-deploy.mjs",
      "/node_modules/prettier/package.json",
    ]) {
      const response = await fetch(base + url);
      assert.equal(response.status, 404, url);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    }
  },
);

const aliases = {
  "/en": "/",
  "/en/": "/",
  "/en/index.html": "/",
  "/index.html": "/",
  "/ru/": "/ru",
  "/ru/index.html": "/ru",
  "/experience/": "/experience",
  "/experience.html": "/experience",
  "/experience/index.html": "/experience",
  "/ru/experience/": "/ru/experience",
  "/ru/experience.html": "/ru/experience",
  "/ru/experience/index.html": "/ru/experience",
  "/en/experience": "/experience",
  "/en/experience/": "/experience",
  "/en/experience.html": "/experience",
  "/en/experience/index.html": "/experience",
};
for (const [alias, canonical] of Object.entries(aliases)) {
  test(
    `Nginx permanently redirects ${alias} to ${canonical} without loops`,
    { skip: !base },
    async () => {
      for (const query of [
        "",
        "?source=legacy&next=%2Fru%2F&value=a%20b",
        "?next=%2Fen%2Fexperience.html&source=ru",
      ]) {
        const response = await fetch(base + alias + query, { redirect: "manual" });
        assert.ok(
          [301, 308].includes(response.status),
          `${alias}${query}: ${response.status}`,
        );
        assert.equal(response.headers.get("location"), canonical + query);
        const direct = await fetch(base + canonical + query, { redirect: "manual" });
        assert.equal(direct.status, 200, `${canonical}${query}`);
        assert.equal(direct.headers.get("location"), null);
        assert.match(direct.headers.get("content-type"), /^text\/html(?:;|$)/);
        assert.equal(direct.headers.get("cache-control"), "no-cache");
        const followed = await fetch(base + alias + query);
        assert.equal(followed.status, 200);
        assert.equal(followed.url, new URL(canonical + query, base).href);
        assert.match(await followed.text(), /Magnit/);
      }
    },
  );
}
test(
  "Nginx root stays English for Russian browser and stored preferences",
  { skip: !base },
  async () => {
    const response = await fetch(`${base}/?language=ru`, {
      redirect: "manual",
      headers: { "Accept-Language": "ru-RU,ru;q=0.9", Cookie: "language=ru" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
    const html = await response.text();
    assert.match(html, /<html lang="en">/);
    assert.match(html, /Product Full-Stack Engineer/);
    const init = await fetch(`${base}/init.js`);
    assert.doesNotMatch(
      await init.text(),
      /location\.replace|navigator\.languages|read\("language"\)/,
    );
  },
);
