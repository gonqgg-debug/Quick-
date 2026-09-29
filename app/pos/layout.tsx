import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Cobro",
  description: "Cobro en mostrador",
  applicationName: "Quick! Cobro",
  manifest: "/pos-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Cobro",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#7EB341",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
