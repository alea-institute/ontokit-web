// A local UI-test server with ownership checks around the repository manager.
// `script` gives the manager a TTY: a late port conflict receives "q", never
// its non-interactive --force path that could kill an unrelated process.
import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid UI-test port");
const pidFile = ".ontokit-web.pid";
try {
  await access(pidFile);
  throw new Error("Existing .ontokit-web.pid: use a separate checkout or OW4_UI_BASE_URL");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(port, "127.0.0.1", resolve);
});
await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));

let ownedPid;
let stopping = false;
let started = false;
let stopRequested = false;
async function stop() {
  stopRequested = true;
  if (!started || stopping) return;
  stopping = true;
  if (ownedPid) {
    const currentPid = await readFile(pidFile, "utf8").catch(() => "");
    if (currentPid.trim() === ownedPid) {
      await new Promise(resolve => {
        const child = spawn("bash", ["./ontokit-web.sh", "stop"], { stdio: "inherit" });
        child.once("exit", resolve);
        child.once("error", resolve);
      });
    }
  }
  starter.stdin.end();
  starter.kill("SIGTERM");
  process.exit(0);
}
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
const serverEnv = {
  ...process.env,
  PORT: String(port),
  AUTH_MODE: "disabled",
  NEXT_PUBLIC_API_URL: "http://127.0.0.1:38471",
  NEXT_PUBLIC_WS_URL: "ws://127.0.0.1:38471",
  NEXT_TELEMETRY_DISABLED: "1",
};
// Optional configuration must be absent, not an invalid empty URL/string.
for (const name of ["ZITADEL_ISSUER", "ZITADEL_CLIENT_ID", "ZITADEL_CLIENT_SECRET", "AUTH_SECRET", "NEXTAUTH_SECRET"]) {
  delete serverEnv[name];
}
const starter = spawn("script", ["-qec", "bash ./ontokit-web.sh start && cat >/dev/null", "/dev/null"], {
  env: serverEnv,
  stdio: ["pipe", "inherit", "inherit"],
});
// Keep the pseudo-terminal open while Next is running; closing it can end the
// dev-server session even though the manager starts npm through nohup.
starter.stdin.write("q\n");
let starterExited = false;
starter.once("exit", () => { starterExited = true; });
for (let attempt = 0; attempt < 100; attempt++) {
  ownedPid = (await readFile(pidFile, "utf8").catch(() => "")).trim();
  if (/^\d+$/.test(ownedPid)) break;
  if (starterExited) throw new Error("UI server manager exited before writing its PID");
  await delay(100);
}
if (!/^\d+$/.test(ownedPid)) {
  starter.stdin.end();
  starter.kill("SIGTERM");
  throw new Error("UI server manager did not produce a PID");
}
started = true;
if (stopRequested) await stop();
// Keep the wrapper alive for Playwright's graceful shutdown.
setInterval(() => {
  try { process.kill(Number(ownedPid), 0); } catch { void stop(); }
}, 1000);
