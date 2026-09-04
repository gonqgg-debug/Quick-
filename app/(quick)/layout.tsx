import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { WhatsAppFloat } from "@/components/landing/WhatsAppFloat";

export default function QuickLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <LandingHeader />
      {children}
      <LandingFooter />
      <WhatsAppFloat />
    </>
  );
}
