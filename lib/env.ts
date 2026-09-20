import { z } from "zod";
import { getAuthMode, isAuthActive, isAuthRequired, isZitadelConfigured } from "./auth-mode";

// Base schema: all auth vars optional so the inferred ServerEnv type honestly
// reflects that they can be absent (disabled/optional mode without Zitadel).
// validateServerEnv() promotes the relevant keys to required at runtime when
// Zitadel is actually in use — see the `strict` gate below.
const serverSchema = z.object({
  ZITADEL_ISSUER: z.url("ZITADEL_ISSUER must be a valid URL").optional(),
  ZITADEL_CLIENT_ID: z.string().min(1, "ZITADEL_CLIENT_ID is required").optional(),
  ZITADEL_CLIENT_SECRET: z.string().min(1, "ZITADEL_CLIENT_SECRET is required").optional(),
  NEXTAUTH_URL: z.url().optional(),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required").optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .url("NEXT_PUBLIC_API_URL must be a valid URL")
    .default("http://localhost:8000"),
  NEXT_PUBLIC_WS_URL: z.url().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

function validateServerEnv(): ServerEnv {
  // Next replaces these direct public-env references with the browser build's
  // constants. Runtime overrides cannot disguise a different authentication
  // contract. Unbundled tools without a compiled mode retain schema validation.
  const compiledMode = process.env.NEXT_PUBLIC_AUTH_MODE;
  if (compiledMode !== undefined) {
    const compiledConfigured = process.env.NEXT_PUBLIC_ZITADEL_CONFIGURED === "true";
    const compiledIssuer = process.env.NEXT_PUBLIC_ZITADEL_ISSUER || "";
    if (
      compiledMode !== getAuthMode() ||
      compiledConfigured !== isZitadelConfigured() ||
      compiledIssuer !== (process.env.ZITADEL_ISSUER || "")
    ) {
      throw new Error(
        "Runtime authentication settings disagree with the compiled authentication configuration. " +
          "Use matching runtime settings or rebuild the image."
      );
    }
  }

  // Zitadel vars + a real NEXTAUTH_SECRET are mandatory whenever auth is required
  // OR Zitadel is active. The active-provider case matters even in "optional"
  // mode: it still mints real authenticated sessions, so a missing
  // secret (which auth.ts would otherwise fill with a random per-process value)
  // must instead be a hard error — a real, stable secret is required so sessions
  // survive restarts and can't be forged. Only the no-Zitadel case relaxes.
  const strict = isAuthRequired() || isAuthActive();
  const schema = strict
    ? serverSchema.required({
        ZITADEL_ISSUER: true,
        ZITADEL_CLIENT_ID: true,
        ZITADEL_CLIENT_SECRET: true,
        NEXTAUTH_SECRET: true,
      })
    : serverSchema;

  const result = schema.safeParse(process.env);
  if (!result.success) {
    const tree = z.treeifyError(result.error);
    const messages = Object.entries(tree.properties ?? {})
      .map(([key, val]) => {
        const errors = val?.errors ?? [];
        return `  ${key}: ${errors.join(", ")}`;
      })
      .join("\n");
    throw new Error(
      `Missing or invalid server environment variables:\n${messages}\n` +
        `Set the required variables before starting the server.`
    );
  }
  // No cast needed: both the strict (required-promoted) and relaxed schemas
  // produce values structurally assignable to ServerEnv (all-optional).
  return result.data;
}

function validateClientEnv(): ClientEnv {
  const raw = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || undefined,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || undefined,
  };
  const result = clientSchema.safeParse(raw);
  if (!result.success) {
    const tree = z.treeifyError(result.error);
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(tree.properties ?? {})) {
      if (val?.errors?.length) {
        fieldErrors[key] = val.errors;
      }
    }
    throw new Error(
      `Invalid client environment variables: ${JSON.stringify(fieldErrors)}`
    );
  }
  return result.data;
}

export { validateServerEnv, validateClientEnv };

// Guard module-level validation so tests can import the functions without triggering throws.
// In test environments (VITEST / NODE_ENV=test), these are set lazily on first access.
function isTestEnv(): boolean {
  return !!(process.env.VITEST || process.env.NODE_ENV === "test");
}

// Imports remain safe during compilation. Cache only successful runtime reads;
// tests deliberately revalidate so each environment fixture remains independent.
let cachedServerEnv: ServerEnv | undefined;
export const serverEnv: ServerEnv = new Proxy({} as ServerEnv, {
  get(_, prop: string) {
    const values = isTestEnv()
      ? validateServerEnv()
      : (cachedServerEnv ??= validateServerEnv());
    return values[prop as keyof ServerEnv];
  },
});

export const clientEnv: ClientEnv = isTestEnv()
  ? (new Proxy({} as ClientEnv, {
      get(_, prop: string) {
        return validateClientEnv()[prop as keyof ClientEnv];
      },
    }))
  : validateClientEnv();
