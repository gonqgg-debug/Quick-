import withPWAInit from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.openfoodfacts.org" },
      { protocol: "https", hostname: "*.openfoodfacts.org" },
    ],
  },
  async redirects() {
    return [
      { source: "/staff/historial", destination: "/admin/historial", permanent: false },
      { source: "/staff/importar", destination: "/admin/catalogo/importar", permanent: false },
      { source: "/staff/imagenes", destination: "/admin/catalogo/imagenes", permanent: false },
    ];
  },
};

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: false,
  reloadOnOnline: false,
  cacheOnFrontEndNav: true,
  cacheStartUrl: false,
  // El script vive en la raíz para poder abarcar /pos (sin barra final).
  // next-pwa añade la barra al scope que inyecta; el registro lo hacemos a mano.
  scope: "/pos",
  sw: "sw.js",
  publicExcludes: ["!noprecache/**/*", "!images/**/*", "!brand/**/*"],
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /\/api\/pos\/productos\/?$/,
        handler: "NetworkFirst",
        method: "GET",
        options: {
          cacheName: "pos-productos",
          networkTimeoutSeconds: 4,
          expiration: { maxEntries: 2, maxAgeSeconds: 24 * 60 * 60 },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        urlPattern: ({ request, url }) => request.mode === "navigate" && url.pathname.startsWith("/pos"),
        handler: "NetworkFirst",
        options: {
          cacheName: "pos-pages",
          networkTimeoutSeconds: 4,
          expiration: { maxEntries: 16, maxAgeSeconds: 7 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [200] },
        },
      },
    ],
  },
});

export default process.env.NODE_ENV === "development" ? nextConfig : withPWA(nextConfig);
