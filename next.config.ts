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
    NEXT_PUBLIC_ZITADEL_CONFIGURED: process.env.ZITADEL_ISSUER ? "true" : "false",
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
