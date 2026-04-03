import { z } from "zod";
import { isAuthRequired } from "./auth-mode";

const serverSchema = z.object({
  ZITADEL_ISSUER: z.url("ZITADEL_ISSUER must be a valid URL"),
  ZITADEL_CLIENT_ID: z.string().min(1, "ZITADEL_CLIENT_ID is required"),
  ZITADEL_CLIENT_SECRET: z.string().min(1, "ZITADEL_CLIENT_SECRET is required"),
  NEXTAUTH_URL: z.url().optional(),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),
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
  // When auth is not required, Zitadel vars are optional
  const schema = isAuthRequired()
    ? serverSchema
    : z.object({
        ZITADEL_ISSUER: z.url().optional(),
        ZITADEL_CLIENT_ID: z.string().optional(),
        ZITADEL_CLIENT_SECRET: z.string().optional(),
        NEXTAUTH_URL: z.url().optional(),
        NEXTAUTH_SECRET: z
          .string()
          .min(1, "NEXTAUTH_SECRET is required")
          .default("ontokit-dev-secret"),
      });

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
  return result.data as ServerEnv;
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

export const serverEnv: ServerEnv = isTestEnv()
  ? (new Proxy({} as ServerEnv, {
      get(_, prop: string) {
        return validateServerEnv()[prop as keyof ServerEnv];
      },
    }))
  : validateServerEnv();

export const clientEnv: ClientEnv = isTestEnv()
  ? (new Proxy({} as ClientEnv, {
      get(_, prop: string) {
        return validateClientEnv()[prop as keyof ClientEnv];
      },
    }))
  : validateClientEnv();
