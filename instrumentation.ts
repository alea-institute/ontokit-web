// Next awaits this hook before serving requests, but skips it during builds.
// Keep the server validator out of non-Node instrumentation bundles.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateServerEnv } = await import("./lib/env");
    try {
      validateServerEnv();
    } catch {
      // A rejected register() can leave Next's standalone process running.
      // Exit explicitly so orchestrators cannot mistake invalid auth for startup.
      // Keep raw error details out of logs: they may contain configuration values.
      console.error("Server startup aborted: missing or invalid server environment configuration.");
      process.exit(1);
    }
  }
}
