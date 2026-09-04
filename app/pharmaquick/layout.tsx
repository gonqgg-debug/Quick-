import { PharmaFooter } from "@/components/pharmaquick/PharmaFooter";
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
      <PharmaFooter />
    </>
  );
}
