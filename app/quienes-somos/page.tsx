import type { Metadata } from "next";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { WhatsAppFloat } from "@/components/landing/WhatsAppFloat";
import "./quienes-somos.css";

export const metadata: Metadata = {
  title: "Quiénes somos | Quick! Mini Market",
  description:
    "Nacimos para que no tengas que ir lejos por lo que necesitas cada día. Mini markets de cadena para comunidades residenciales.",
};

const FAQ_ITEMS = [
  {
    question: "¿Qué es Quick! Mini Market?",
    answer:
      "Quick! Mini Market es una cadena de mini markets pensada para comunidades residenciales. Traemos productos del día a día directo a donde vives, con la consistencia de una cadena y la cercanía de tu vecino.",
  },
  {
    question: "¿Dónde están ubicados?",
    answer:
      "Nuestra primera tienda está en Residencial Jardines 3, Pueblo Bávaro. Estamos creciendo hacia más residenciales próximamente.",
  },
  {
    question: "¿Tienen programa de lealtad?",
    answer:
      "Sí. QuickCoins es nuestro programa de lealtad. Ganas puntos con cada compra y los cambias por descuentos en tu próximo pedido.",
  },
] as const;

export default function QuienesSomosPage() {
  return (
    <>
      <LandingHeader />
      <main className="quienes-somos-page">
        <header className="hero-banner">
          <div className="container">
            <span className="sub-heading">QUIÉNES SOMOS</span>
            <h1 className="main-heading">
              Nacimos para que no tengas que ir lejos
              <br />
              por lo que necesitas cada día.
            </h1>
          </div>
        </header>

        <section className="about-section">
          <div className="container">
            <div className="content-block">
              <h2>Una nueva forma de conveniencia cotidiana</h2>
              <p>
                <strong>Quick! Mini Market</strong> es una cadena de mini markets diseñada desde cero
                para comunidades residenciales. Creemos que la conveniencia no debería estar a 20
                minutos en carro — debería estar a pasos de tu casa. Por eso abrimos tiendas dentro
                de los residenciales donde vives, con los productos que necesitas todos los días y un
                servicio que se mantiene consistente en cada tienda.
              </p>
            </div>

          </div>
        </section>

        <section className="split-section">
          <div className="split-copy">
            <h2>Hecho para la vida diaria. Aquí mismo.</h2>
            <p>
              Llevamos esa experiencia a comunidades residenciales, empezando con nuestra primera
              tienda en Residencial Jardines 3, Pueblo Bávaro. Estamos enfocados en crear valor
              económico y social mientras entregamos una experiencia de conveniencia moderna en los
              vecindarios donde tenemos presencia.
            </p>
            <p>
              Cada tienda está diseñada para apoyar las necesidades del día a día — ofreciendo
              productos de calidad, empleos locales y una contribución positiva a las comunidades
              que nos reciben.
            </p>
          </div>
          <div className="split-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/quienes-somos-tienda.jpg"
              alt="Interior de Quick! Mini Market con una colaboradora en caja y pasillos de productos"
            />
          </div>
        </section>

        <section className="split-section split-section-reverse">
          <div className="split-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/quienes-somos-equipo.jpg"
              alt="Equipo de Quick! Mini Market frente a la tienda"
            />
          </div>
          <div className="split-copy">
            <h3>PROPÓSITO</h3>
            <p>
              Que nadie tenga que ir lejos por lo básico. Existimos para llevar conveniencia real a
              comunidades residenciales, con un servicio que se siente cercano y una operación que
              crece junto a los vecinos que nos reciben.
            </p>
            <h3>VALORES</h3>
            <p>
              <strong>Cercanía:</strong> Abrimos donde vives, no donde es más fácil para nosotros.
            </p>
            <p>
              <strong>Consistencia:</strong> Calidad de cadena, trato de vecino.
            </p>
            <p>
              <strong>Simplicidad:</strong> Lo que necesitas, sin complicaciones.
            </p>
            <p>
              <strong>Innovación:</strong> Siempre buscando cómo hacer la experiencia más fácil para
              ti.
            </p>
          </div>
        </section>

        <section className="faq-section">
          <div className="container">
            <h2 className="faq-title">Preguntas frecuentes</h2>

            {FAQ_ITEMS.map((item) => (
              <div className="faq-item" key={item.question}>
                <details>
                  <summary>{item.question}</summary>
                  <div className="faq-answer">
                    <p>{item.answer}</p>
                  </div>
                </details>
              </div>
            ))}
          </div>
        </section>
      </main>
      <LandingFooter />
      <WhatsAppFloat />
    </>
  );
}
