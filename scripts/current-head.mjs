import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Redirects are rejected so authenticated requests cannot forward credentials.
export async function request(url, options, fetchImpl = fetch, timeoutMs = 5000) {
  try {
    return await fetchImpl(url, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error("Network request failed or timed out");
  }
}

export async function isCurrentMain(env, fetchImpl = fetch) {
  if (env.GITHUB_REF !== "refs/heads/main" || env.GITHUB_EVENT_NAME === "pull_request") {
    return false;
  }
  if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "")) {
    throw new Error("A valid GITHUB_SHA is required");
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? "")) {
    throw new Error("A valid GITHUB_REPOSITORY is required");
  }
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required for the head guard");
  const response = await request(
    `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/git/ref/heads/main`,
    {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
    fetchImpl,
  );
  if (!response.ok) throw new Error(`Head guard failed: HTTP ${response.status}`);
  let head;
  try {
    head = (await response.json()).object?.sha;
  } catch {
    throw new Error("Head guard returned invalid JSON");
  }
  if (!/^[a-f0-9]{40}$/.test(head ?? "")) {
    throw new Error("Head guard returned an invalid revision");
  }
  return head === env.GITHUB_SHA;
}

export async function writeHeadOutput(env, fetchImpl = fetch) {
  const current = await isCurrentMain(env, fetchImpl);
  if (!env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
  await appendFile(env.GITHUB_OUTPUT, `current=${current}\n`);
  console.log(current ? "Current main head confirmed" : "Stale or non-main run skipped");
  return current;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await writeHeadOutput(process.env);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
