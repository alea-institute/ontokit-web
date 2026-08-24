import type { NextConfig } from "next";
import { codecovWebpackPlugin } from "@codecov/webpack-plugin";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Standalone output for Docker deployments (copies only needed files to .next/standalone)
  output: "standalone",

  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Configure allowed image domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.githubusercontent.com",
      },
    ],
  },

  // Environment variables available to the browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_AUTH_MODE: process.env.AUTH_MODE || "required",
    // Must use the SAME predicate as server-side isZitadelConfigured() (issuer AND
    // client id) — otherwise the client shows a "Sign in" button while the server
    // has no provider, and clicking it dead-ends.
    NEXT_PUBLIC_ZITADEL_CONFIGURED:
      process.env.ZITADEL_ISSUER && process.env.ZITADEL_CLIENT_ID ? "true" : "false",
  },

  // Baseline CSP for the PR Party routes.
  //
  // PR Party renders LLM-written summaries of third-party pull requests — the
  // one place in the app where attacker-influenced prose reaches the DOM. The
  // components render it as text nodes only; this header is the second layer,
  // so a future regression there is contained rather than exploitable.
  //
  // It is scoped to `/pr-party/*` rather than applied app-wide because the rest
  // of the app loads Monaco and other machinery that a conservative policy
  // would break — a global policy is a separate, larger piece of work.
  //
  // Honest about its limits: Next.js needs `unsafe-inline` and `unsafe-eval`
  // for its own runtime (and the dev overlay), so the script-src is not a
  // meaningful barrier on its own. What this header does buy is `default-src
  // 'self'`, a connect-src pinned to the API origin, and no framing — i.e. an
  // injected string cannot exfiltrate to an arbitrary host.
  async headers() {
    const apiOrigin = (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").origin;
      } catch {
        return "";
      }
    })();
    const wsOrigin = (() => {
      try {
        return process.env.NEXT_PUBLIC_WS_URL
          ? new URL(process.env.NEXT_PUBLIC_WS_URL).origin
          : "";
      } catch {
        return "";
      }
    })();

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      `connect-src 'self' ${apiOrigin} ${wsOrigin}`.trim(),
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/pr-party/:path*",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
      {
        source: "/pr-party",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
    ];
  },

  // WSL2: use polling for file watching since inotify doesn't work across the VM boundary
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    config.plugins.push(
      codecovWebpackPlugin({
        enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
        bundleName: isServer ? "ontokit-web-server" : "ontokit-web-client",
        uploadToken: process.env.CODECOV_TOKEN,
      }),
    );
    return config;
  },
};

export default withNextIntl(nextConfig);
