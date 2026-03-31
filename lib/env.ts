import { z } from "zod";

const serverSchema = z.object({
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required").default("folio-dev-secret"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string()
    .url("NEXT_PUBLIC_API_URL must be a valid URL")
    .default("http://localhost:8000"),
  NEXT_PUBLIC_WS_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

function validateServerEnv(): ServerEnv {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    const messages = Object.entries(formatted)
      .filter(([key]) => key !== "_errors")
      .map(([key, val]) => {
        const errors = (val as { _errors?: string[] })?._errors ?? [];
        return `  ${key}: ${errors.join(", ")}`;
      })
      .join("\n");
    throw new Error(
      `Missing or invalid server environment variables:\n${messages}\n` +
        `Set the required variables before starting the server.`
    );
  }
  return result.data;
}

function validateClientEnv(): ClientEnv {
  const raw = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || undefined,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || undefined,
  };
  const result = clientSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid client environment variables: ${JSON.stringify(
        result.error.flatten().fieldErrors
      )}`
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
