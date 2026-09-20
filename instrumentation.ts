// Next awaits this hook before serving requests, but skips it during builds.
// Keep the server validator out of non-Node instrumentation bundles.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateServerEnv } = await import("./lib/env");
    validateServerEnv();
  }
}
