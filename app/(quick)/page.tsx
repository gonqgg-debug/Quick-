import { LandingCatalogPreview } from "@/components/landing/LandingCatalogPreview";
import { LandingExpansionCta } from "@/components/landing/LandingExpansionCta";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingPharmaTeaser } from "@/components/landing/LandingPharmaTeaser";
import { LandingValue } from "@/components/landing/LandingValue";
import { QuickCoinsBanner } from "@/components/landing/QuickCoinsBanner";
import { brand } from "@/lib/theme";

export default function Home() {
  return (
    <main style={{ color: brand.body, backgroundColor: brand.cream }}>
      <LandingHero />
      <LandingValue />
      <LandingCatalogPreview />
      <QuickCoinsBanner />
      <LandingPharmaTeaser />
      <LandingExpansionCta />
    </main>
  );
}
