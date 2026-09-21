import { LandingFooter } from "@/components/landing/LandingFooter";
import { WhatsAppFloat } from "@/components/landing/WhatsAppFloat";
import { PharmaHeader } from "@/components/pharmaquick/PharmaHeader";

export default function PharmaQuickLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PharmaHeader />
      {children}
      <LandingFooter />
      <WhatsAppFloat />
    </>
  );
}
