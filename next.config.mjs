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

export default nextConfig;
