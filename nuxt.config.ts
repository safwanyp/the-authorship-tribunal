export default defineNuxtConfig({
  compatibilityDate: "2026-07-04",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  runtimeConfig: {
    convexServerSecret: process.env.CONVEX_SERVER_SECRET || "",
    allowedOrigins: process.env.NUXT_ALLOWED_ORIGINS || "",
    public: {
      convexUrl: process.env.NUXT_PUBLIC_CONVEX_URL || "",
      appBaseUrl:
        process.env.NUXT_PUBLIC_APP_BASE_URL || "http://localhost:3000",
    },
  },
  nitro: {
    experimental: {
      wasm: true,
    },
  },
  typescript: {
    strict: true,
  },
  vite: {
    optimizeDeps: {
      include: ["convex/browser", "convex/server"],
    },
  },
});
