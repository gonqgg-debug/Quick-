import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin && (url.pathname === "/pos" || url.pathname.startsWith("/pos/")),
        handler: "NetworkFirst",
        options: {
          cacheName: "pos-shell",
          expiration: {
            maxEntries: 24,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
          networkTimeoutSeconds: 4,
        },
      },
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/pos/"),
        handler: "NetworkOnly",
        method: "GET",
        options: {
          cacheName: "pos-api",
        },
      },
    ],
  },
});

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

export default withPWA(nextConfig);
