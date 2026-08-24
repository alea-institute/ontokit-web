/** ntfy topics are path segments and are effectively a shared secret. */
export const NTFY_TOPIC_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Has a timestamp already passed?
 *
 * The generation token, unlike the reviewer's own credential, carries no
 * server-computed `expired` flag — only `expires_at` — so this is the one
 * expiry the client has to decide for itself. `now` is injectable so reading
 * the clock stays out of render and tests remain deterministic.
 */
export function hasLapsed(
  expiresAt: string | null,
  now: number = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const at = new Date(expiresAt).getTime();
  return Number.isFinite(at) && at <= now;
}
