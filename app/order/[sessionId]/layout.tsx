import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catálogo · Quick! Mini Market",
  description: "Pide del minimarket y te lo llevamos a casa",
};

export default function OrderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-screen bg-brand-white">{children}</div>;
}
