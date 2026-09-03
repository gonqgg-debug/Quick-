import type { Metadata } from "next";
import { ExpansionForm } from "@/components/landing/ExpansionForm";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { WhatsAppFloat } from "@/components/landing/WhatsAppFloat";
import "./expansion.css";

export const metadata: Metadata = {
  title: "Expansión | Quick! Mini Market",
  description:
    "¿Tu residencial tiene un espacio para Quick!? Hablemos. Traemos conveniencia a más comunidades.",
};

export default function ExpansionPage() {
  return (
    <>
      <LandingHeader />
      <main className="expansion-page">
        <header className="hero-banner">
          <div className="hero-title-card">
            <h1 className="hero-title">EXPANSIÓN</h1>
          </div>
        </header>

        <section className="partner-band">
          <h2>Trae Quick! a tu comunidad</h2>
        </section>

        <section className="lead-section">
          <div className="container">
            <div className="lead-intro">
              <h2>¿Tu residencial tiene un espacio para Quick!? Hablemos.</h2>
              <p>
                Si eres propietario, administrador o desarrollador y estás evaluando vender, alquilar
                o asociarte, queremos revisar propuestas que encajen con nuestro modelo: mini markets
                dentro de comunidades residenciales. Completa los datos y te contactamos.
              </p>
            </div>
            <ExpansionForm />
          </div>
        </section>
      </main>
      <LandingFooter />
      <WhatsAppFloat />
    </>
  );
}
