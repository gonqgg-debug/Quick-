import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Baloo_2, Caveat, Inter } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({
  subsets: ["latin"],
  variable: "--font-brand-display",
  weight: ["400", "600", "700", "800"],
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-brand-hand",
  weight: ["600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-brand-body",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Quick! Mini Market",
  description:
    "Mini market de cadena, a un paso de tu casa. Conveniencia cotidiana en residenciales de Bávaro y Verón, con pedidos por WhatsApp.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${baloo.variable} ${caveat.variable} ${inter.variable} bg-white font-sans antialiased`}
        style={{ color: "#1A1A1A", backgroundColor: "#FFFFFF" }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
