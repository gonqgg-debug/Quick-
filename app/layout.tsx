import type { Metadata } from "next";
import { Baloo_2, Inter } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({
  subsets: ["latin"],
  variable: "--font-brand-display",
  weight: ["400", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-brand-body",
});

export const metadata: Metadata = {
  title: "Quick! Mini Market",
  description:
    "La conveniencia de tu residencial, todos los días. Pedidos por WhatsApp en Pueblo Bávaro.",
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
        className={`${baloo.variable} ${inter.variable} bg-white font-sans antialiased`}
        style={{ color: "#1A1A1A", backgroundColor: "#FFFFFF" }}
      >
        {children}
      </body>
    </html>
  );
}
