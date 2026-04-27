import withPWAInit from "next-pwa";

// Disable PWA on Vercel build for now — next-pwa@5.6.0 has known incompat
// with Next 14.2 + pnpm hoisting. Re-enable after migrating to @serwist/next.
const PWA_ENABLED = process.env.PWA_ENABLED === "true";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: !PWA_ENABLED || process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^\/api\/payment\/.*$/,
      handler: "NetworkOnly",
      options: { cacheName: "no-cache" },
    },
    {
      urlPattern: /^\/api\/(jobs|shops|slots)\/.*$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        networkTimeoutSeconds: 30,
        expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|webp|woff2?)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverComponentsExternalPackages: ["@napi-rs/canvas", "pdf-lib"] },
  images: { remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }] },
};

export default withPWA(nextConfig);
