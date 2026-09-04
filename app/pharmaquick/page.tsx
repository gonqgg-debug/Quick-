import type { Metadata } from "next";
import "./pharmaquick.css";

export const metadata: Metadata = {
  title: "PharmaQuick! | Muy pronto",
  description:
    "Muy pronto abrimos PharmaQuick!, nuestra farmacia hermana. Salud y conveniencia, a pasos de tu casa.",
};

export default function PharmaQuickPage() {
  return (
    <main className="pharmaquick-page">
      <header className="hero-banner">
        <div className="hero-title-card">
          <h1 className="hero-title">PHARMAQUICK!</h1>
          <p className="hero-subtitle">Tu farmacia, a pasos de casa.</p>
        </div>
      </header>

      <section className="about-section">
        <div className="container">
          <div className="content-block">
            <h2>Muy pronto en tu residencial</h2>
            <p>
              <strong>PharmaQuick!</strong> es nuestra farmacia hermana. Muy pronto abrimos para
              acercarte medicamentos, cuidado personal y lo que necesitas para el día a día de tu
              salud — con la misma cercanía de Quick!, ahora pensada para tu bienestar.
            </p>
          </div>

          <div className="content-block">
            <h2>La misma conveniencia. Un propósito distinto.</h2>
            <p>
              Nacimos para que no tengas que ir lejos por lo básico. PharmaQuick! extiende esa idea
              a la farmacia: un espacio de confianza dentro de tu comunidad, con servicio cercano y
              la consistencia de una cadena.
            </p>
            <p>
              Estamos preparando la apertura. Mientras tanto, Quick! Mini Market sigue a un paso de
              tu casa — y PharmaQuick! llega pronto.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
