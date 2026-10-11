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
    for (const url of [
      "/",
      "/en/",
      "/ru/",
      "/en/experience.html",
      "/ru/experience.html",
    ]) {
      const response = await fetch(base + url);
      assert.equal(response.status, 200, url);
      assert.equal(response.headers.get("cache-control"), "no-cache");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.match(
        response.headers.get("content-security-policy"),
        /https:\/\/ascii.rest/,
      );
      assert.match(await response.text(), /Magnit/);
    }
    for (const url of ["/style.css", "/init.js", "/language.js"]) {
      const response = await fetch(base + url);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "public, max-age=3600");
    }
    for (const url of [
      "/missing",
      "/en/missing",
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
