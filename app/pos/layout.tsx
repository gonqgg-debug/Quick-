import type { Metadata, Viewport } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Caja | Quick!",
  description: "Punto de venta del mostrador Quick! Mini Market",
  applicationName: "Quick Caja",
  manifest: "/pos/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Quick Caja",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/pos-icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/pos-icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#7EB341",
};

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh overflow-hidden">{children}</div>;
}
