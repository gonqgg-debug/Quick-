/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/staff/historial", destination: "/admin/historial", permanent: false },
      { source: "/staff/importar", destination: "/admin/catalogo/importar", permanent: false },
      { source: "/staff/imagenes", destination: "/admin/catalogo/imagenes", permanent: false },
    ];
  },
};

export default nextConfig;
