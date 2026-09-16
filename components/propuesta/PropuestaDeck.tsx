"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ExpansionMap } from "@/components/propuesta/ExpansionMap";
import { SlidePhoto } from "@/components/propuesta/SlidePhoto";
import { EXPANSION_SITES } from "@/lib/expansion-sites";
import { downloadPropuestaPdf } from "@/lib/propuesta-pdf";
import { brand, whatsappHref } from "@/lib/theme";

const SLIDE_COUNT = 10;
const PHARMA_BG = "#F3F8FD";

const PRODUCT_GROUPS = [
  { title: "Frutas y vegetales", emoji: "🥬", tone: "green", text: "Lo fresco de la semana: frutas, vegetales y hierbas para tu día a día." },
  { title: "Desayuno", emoji: "🥣", tone: "orange", text: "Café, leche, pan, cereales y huevos frescos desde primera hora." },
  { title: "Cocina y abarrotes", emoji: "🍝", tone: "orange", text: "Aceites, arroz, pastas, enlatados y los esenciales de tu despensa." },
  { title: "Lácteos y refrigerados", emoji: "🥛", tone: "blue", text: "Leche, yogurt, quesos variados y básicos del refrigerador." },
  { title: "Snacks y antojos", emoji: "🍪", tone: "orange", text: "Chips, galletas, chocolates y los favoritos de la comunidad." },
  { title: "Bebidas refrescantes", emoji: "🥤", tone: "blue", text: "Agua, jugos, refrescos y hielo listo para el clima de Bávaro." },
  { title: "Bebidas calientes", emoji: "☕", tone: "green", text: "Café, té e infusiones para tu mañana o tus jornadas de home office." },
  { title: "Bebidas frías con alcohol", emoji: "🍺", tone: "orange", text: "Cervezas y cócteles listos para tomar, siempre a temperatura ideal." },
  { title: "Cuidado personal", emoji: "🧴", tone: "blue", text: "Higiene personal, salud dental, cuidado del cabello y básicos del baño." },
  { title: "Hogar y limpieza", emoji: "🧹", tone: "blue", text: "Detergentes, papel, desechables y los insumos que se agotan al instante." },
  { title: "Bebés y mascotas", emoji: "🍼", tone: "orange", text: "Pañales, fórmula, alimento para mascotas y las urgencias del hogar." },
  { title: "Congelados", emoji: "🧊", tone: "blue", text: "Helados, hielo, vegetales y comidas prácticas para resolver la semana." },
] as const;

const SERVICE_VALUES = [
  { title: "Servicio de excelencia", icon: "star", tone: "green", text: "Optimizamos cada proceso día a día para brindarte una atención ágil, confiable y a la altura de tus necesidades." },
  { title: "Garantía de calidad", icon: "badge", tone: "orange", text: "Mantenemos la misma excelencia en atención, higiene y cumplimiento en cada sucursal." },
  { title: "Esenciales al día", icon: "cart", tone: "blue", text: "Encuentras lo que buscas para tu rutina diaria de forma rápida y sin complicaciones." },
  { title: "Impacto positivo", icon: "people", tone: "green", text: "Un espacio estructurado que eleva la plusvalía del residencial y respalda al talento local." },
] as const;

const TECH_FEATURES = [
  { title: "Catálogo con fotos y precios", icon: "cart", tone: "green", text: "Explora por producto, marca o categoría. Tienes la misma variedad de nuestros pasillos, al alcance de tu mano." },
  { title: "Pedidos rápidos y favoritos", icon: "bolt", tone: "orange", text: "Guarda tu última compra o accede a los productos más solicitados de tu comunidad para pedir de nuevo en un par de clics." },
  { title: "Seguimiento y flexibilidad", icon: "gear", tone: "blue", text: "Consulta el estado de tu pedido, realiza modificaciones o cancela directamente por WhatsApp mientras lo preparamos." },
  { title: "¿Buscas algo en específico?", icon: "search", tone: "green", text: "Si no encuentras un artículo en el catálogo digital, indícanoslo por el chat; nuestro equipo verifica la disponibilidad al instante." },
  { title: "QuickCoins", icon: "coins", tone: "orange", text: "Acumula puntos automáticos en cada compra y canjéalos por descuentos en tus próximos pedidos." },
] as const;

const OPERATION_STATS = [
  { title: "Dónde está", icon: "pin", tone: "green", text: "Residencial Jardines 3, Pueblo Bávaro, La Altagracia." },
  { title: "Horario", icon: "clock", tone: "orange", text: "Todos los días, de 8:00 a. m. a 12:00 a. m." },
  { title: "Pedidos", icon: "whatsapp", tone: "green", text: "Catálogo por WhatsApp. Entrega a edificio y apartamento." },
  { title: "Zona de entrega", icon: "truck", tone: "blue", text: "Jardines III, Crisfer y Canas del Este." },
  { title: "Pagos", icon: "card", tone: "orange", text: "Efectivo y tarjeta en tienda y en el pedido." },
  { title: "El equipo", icon: "people", tone: "blue", text: "Personal de tienda y delivery, en un mismo sistema." },
] as const;

const SEEK_OPTIONS = [
  { num: "01", title: "Alquiler", icon: "home", tone: "green", text: "Local en residencial, plaza comercial o local independiente." },
  { num: "02", title: "Compra", icon: "cart", tone: "orange", text: "Adquirir el espacio cuando el proyecto y la ubicación lo justifiquen." },
  { num: "03", title: "Alianza", icon: "hands", tone: "blue", text: "Acuerdo con la administración o el desarrollador del residencial." },
] as const;

const PHARMA_ITEMS = [
  { title: "Medicamentos y salud integral", icon: "pill", tone: "blue", text: "Todo lo esencial para el cuidado diario, medicamentos con receta, artículos de primeros auxilios y productos de bienestar, sin salir de tu comunidad." },
  { title: "El estándar que te da tranquilidad", icon: "shield", tone: "blue", text: "Mantenemos la misma garantía de servicio, organización y atención personalizada que caracteriza a nuestra marca." },
  { title: "Todo en una sola plataforma", icon: "phone", tone: "orange", text: "Si tu zona cuenta con Quick! y PharmaQuick!, puedes hacer un solo pedido combinando productos de ambas tiendas desde WhatsApp y recibirlo todo en una sola entrega." },
] as const;

type Tone = "green" | "orange" | "blue";

const TONE: Record<Tone, string> = {
  green: brand.green,
  orange: brand.orange,
  blue: brand.blue,
};

function Icon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "bolt":
      return <svg viewBox="0 0 24 24" aria-hidden><path {...common} d="M13 3 5 14h7l-1 7 8-11h-7l1-7Z" /></svg>;
    case "home":
      return <svg viewBox="0 0 24 24" aria-hidden><path {...common} d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" /></svg>;
    case "truck":
      return <svg viewBox="0 0 24 24" aria-hidden><path {...common} d="M3 7h11v10H3V7Zm11 3h4l3 3v4h-7v-7ZM7 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" /></svg>;
    case "pin":
      return <svg viewBox="0 0 24 24" aria-hidden><path {...common} d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle {...common} cx="12" cy="10" r="2.2" /></svg>;
    case "clock":
      return <svg viewBox="0 0 24 24" aria-hidden><circle {...common} cx="12" cy="12" r="8" /><path {...common} d="M12 8v4.5L15 15" /></svg>;
    case "whatsapp":
      return <svg viewBox="0 0 24 24" aria-hidden><path {...common} d="M5 19l1.2-3.3A8 8 0 1 1 19 12a8 8 0 0 1-9.8 7.8L5 19Z" /><path {...common} d="M9.2 9.6c.3 1.8 1.8 3.3 3.6 3.6.3 0 .8-.2 1.1-.5l.7-.7c.2-.2.2-.5 0-.7l-.8-.8c-.2-.2-.5-.2-.7 0l-.3.3c-.8-.3-1.4-.9-1.7-1.7l.3-.3c.2-.2.2-.5 0-.7l-.8-.8c-.2-.2-.5-.2-.7 0l-.7.7c-.3.3-.5.8-.5 1.1Z" /></svg>;
    case "card":
      return <svg viewBox="0 0 24 24" aria-hidden><rect {...common} x="3" y="6" width="18" height="12" rx="2" /><path {...common} d="M3 10h18" /></svg>;
    case "people":
      return <svg viewBox="0 0 24 24" aria-hidden><circle {...common} cx="9" cy="8" r="2.4" /><circle {...common} cx="16" cy="9" r="2" /><path {...common} d="M4.5 18a4.5 4.5 0 0 1 9 0M14 18a3.8 3.8 0 0 1 5.5 0" /></svg>;
    case "star":
      return <svg viewBox="0 0 24 24" aria-hidden><path {...common} d="m12 4 2.2 4.6 5 .7-3.6 3.5.9 5L12 15.8 7.5 18.8l.9-5L4.8 10.3l5-.7L12 4Z" /></svg>;
    case "badge":
      return <svg viewBox="0 0 24 24" aria-hidden><circle {...common} cx="12" cy="12" r="7" /><path {...common} d="m9 12 2 2 4-4" /></svg>;
    case "cart":
      return <svg viewBox="0 0 24 24" aria-hidden><path {...common} d="M4 6h2l1.2 8.2A2 2 0 0 0 9.2 16H17a2 2 0 0 0 2-1.6L20 8H7" /><circle {...common} cx="9.5" cy="19" r="1.2" /><circle {...common} cx="16.5" cy="19" r="1.2" /></svg>;
    case "gear":
      return <svg viewBox="0 0 24 24" aria-hidden><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M12 5v2M12 17v2M5 12h2M17 12h2M7.2 7.2l1.4 1.4M15.4 15.4l1.4 1.4M7.2 16.8l1.4-1.4M15.4 8.6l1.4-1.4" /></svg>;
    case "search":
      return <svg viewBox="0 0 24 24" aria-hidden><circle {...common} cx="11" cy="11" r="6" /><path {...common} d="m16 16 4 4" /></svg>;
    case "coins":
      return <svg viewBox="0 0 24 24" aria-hidden><ellipse {...common} cx="12" cy="8" rx="6" ry="3" /><path {...common} d="M6 8v4c0 1.7 2.7 3 6 3s6-1.3 6-3V8M6 12v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4" /></svg>;
    case "pill":
      return <svg viewBox="0 0 24 24" aria-hidden><path {...common} d="m9 15 6-6a3.5 3.5 0 0 1 5 5l-6 6a3.5 3.5 0 0 1-5-5Z" /><path {...common} d="m11.5 12.5 4-4" /></svg>;
    case "shield":
      return <svg viewBox="0 0 24 24" aria-hidden><path {...common} d="M12 4 5 7v6c0 4 3 6.5 7 8 4-1.5 7-4 7-8V7l-7-3Z" /></svg>;
    case "phone":
      return <svg viewBox="0 0 24 24" aria-hidden><rect {...common} x="8" y="3" width="8" height="18" rx="2" /><path {...common} d="M11 18h2" /></svg>;
    case "hands":
      return <svg viewBox="0 0 24 24" aria-hidden><path {...common} d="M8 12v7M16 12v7M5 14h3l2 2h4l2-2h3M9 9V6a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v3" /></svg>;
    case "mail":
      return <svg viewBox="0 0 24 24" aria-hidden><rect {...common} x="3" y="6" width="18" height="12" rx="2" /><path {...common} d="m4 8 8 6 8-6" /></svg>;
    default:
      return <span aria-hidden>{name}</span>;
  }
}

function Orb({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="propuesta-orb" style={{ color: TONE[tone] }}>
      {children}
    </span>
  );
}

function Kicker({ children, color }: { children: string; color?: string }) {
  return (
    <p className="propuesta-kicker" style={{ color: color ?? brand.orange }}>
      {children}
    </p>
  );
}

function Title({ children }: { children: ReactNode }) {
  return (
    <h2 className="propuesta-title">
      {children}
      <span className="propuesta-title-dot">.</span>
    </h2>
  );
}

function SlideFrame({
  id,
  children,
  className = "",
  innerClassName = "",
  style,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <section id={id} className={`propuesta-slide propuesta-canvas ${className}`} style={style}>
      <div className="propuesta-blob-tr" aria-hidden />
      <div className="propuesta-blob-bl" aria-hidden />
      <div className={`propuesta-slide-inner ${innerClassName}`}>{children}</div>
    </section>
  );
}

function Media({
  src,
  alt,
  objectPosition,
  fit,
  className = "",
}: {
  src: string;
  alt: string;
  objectPosition?: string;
  fit?: "cover" | "contain";
  className?: string;
}) {
  return (
    <div className={`propuesta-media ${className}`}>
      <SlidePhoto src={src} alt={alt} objectPosition={objectPosition} fit={fit} />
    </div>
  );
}

export function PropuestaDeck() {
  const [active, setActive] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("propuesta-html");
    const params = new URLSearchParams(window.location.search);
    const slide = Number(params.get("slide"));
    if (!Number.isNaN(slide) && slide >= 0) {
      document.getElementById(`slide-${slide}`)?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
    }
    return () => document.documentElement.classList.remove("propuesta-html");
  }, []);

  const goTo = useCallback((index: number) => {
    const next = Math.max(0, Math.min(SLIDE_COUNT - 1, index));
    document.getElementById(`slide-${next}`)?.scrollIntoView({ behavior: "smooth" });
    setActive(next);
  }, []);

  const onDownloadPdf = useCallback(async () => {
    if (exporting) {
      return;
    }
    setExporting(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await downloadPropuestaPdf();
    } catch (error) {
      console.error(error);
      window.alert("No se pudo abrir el diálogo de PDF. Prueba Archivo → Imprimir y elige Guardar como PDF.");
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  useEffect(() => {
    const slides = Array.from(document.querySelectorAll<HTMLElement>(".propuesta-slide"));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible?.target.id) {
          return;
        }
        const index = Number(visible.target.id.replace("slide-", ""));
        if (!Number.isNaN(index)) {
          setActive(index);
        }
      },
      { threshold: 0.55 },
    );
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goTo(active + 1);
      }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goTo(active - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, goTo]);

  const joinHref = `${whatsappHref()}?text=${encodeURIComponent(
    "Hola! Quiero proponer un espacio para Quick! Mini Market.",
  )}`;
  const catalogHref = `${whatsappHref()}?text=${encodeURIComponent(
    "Hola! Quiero ver el catálogo de Quick! Mini Market.",
  )}`;

  return (
    <div className="propuesta-root">
      <div className="propuesta-deck">
        <SlideFrame id="slide-0" className="is-cover">
          <p className="propuesta-cover-eyebrow">
            Más tiempo
            <br />
            para lo que
            <br />
            importa
          </p>
          <div className="propuesta-cover-v2">
            <div className="propuesta-cover-copy">
              <Logo className="h-14 max-w-[240px]" />
              <p className="propuesta-cover-line" style={{ color: brand.green }}>
                Traemos la conveniencia
              </p>
              <h1 className="propuesta-cover-title" style={{ color: brand.blue }}>
                A tu residencial<span className="propuesta-title-dot">.</span>
              </h1>
              <p className="propuesta-lead">Mini market de cadena, a un paso de tu casa.</p>
              <div className="propuesta-cover-features">
                <div>
                  <Orb tone="green">
                    <Icon name="bolt" />
                  </Orb>
                  <strong>Fácil y rápido</strong>
                </div>
                <div>
                  <Orb tone="orange">
                    <Icon name="home" />
                  </Orb>
                  <strong>Tus productos favoritos</strong>
                </div>
                <div>
                  <Orb tone="blue">
                    <Icon name="truck" />
                  </Orb>
                  <strong>Directo a tu puerta</strong>
                </div>
              </div>
              <p className="propuesta-cover-foot">Propuesta para residenciales y locales</p>
            </div>
            <Media src="/images/nathalia-rosa-rWMIbqmOxrY-unsplash.jpg" alt="Pasillo de un mini market Quick!" />
          </div>
          <div className="propuesta-brandbar" aria-hidden />
        </SlideFrame>

        <SlideFrame id="slide-1">
          <Logo className="propuesta-slide-logo" />
          <div className="propuesta-fill propuesta-split-clean">
            <div className="propuesta-copy">
              <Kicker>La idea</Kicker>
              <Title>Una cadena pensada para comunidades residenciales</Title>
              <p className="propuesta-lead">
                Llevamos un mini market de primer nivel a la puerta de tu casa. Nos integramos a tu
                residencial o plaza local para ofrecerte la calidad de una gran cadena con la calidez,
                confianza y atención personalizada que te mereces.
              </p>
              <div className="propuesta-brand-cards">
                <article className="propuesta-soft-card">
                  <Logo className="h-8 max-w-[160px]" />
                  <h3>Quick! Mini Market</h3>
                  <p>Conveniencia cotidiana: lo que se necesita todos los días, a pasos de casa.</p>
                </article>
                <article className="propuesta-soft-card">
                  <Logo variant="pharma" className="h-8 max-w-[190px]" />
                  <h3>PharmaQuick!</h3>
                  <p>Farmacia hermana. Misma forma de atenderte, un propósito distinto: tu salud.</p>
                </article>
              </div>
            </div>
            <Media
              src="/images/tienda-isometrica.png"
              alt="Ilustración isométrica del formato Quick! Mini Market"
              fit="contain"
              className="is-contain"
            />
          </div>
        </SlideFrame>

        <SlideFrame id="slide-2">
          <Logo className="propuesta-slide-logo" />
          <div className="propuesta-fill propuesta-split-clean">
            <div className="propuesta-copy">
              <Kicker>La tienda</Kicker>
              <Title>Así opera Quick! en el residencial</Title>
              <p className="propuesta-lead">
                Así funciona Quick! en tu comunidad: un mini market con horario extendido, los
                productos que necesitas todos los días y entrega directo a tu puerta. Ya sea que nos
                visites o pidas a domicilio, recibes siempre la misma calidad.
              </p>
              <div className="propuesta-icon-grid">
                {OPERATION_STATS.map((item) => (
                  <article key={item.title} className="propuesta-icon-item">
                    <Orb tone={item.tone}>
                      <Icon name={item.icon} />
                    </Orb>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <Media
              src="/images/quienes-somos-tienda.jpg"
              alt="Interior de Quick! Mini Market con personal en caja"
              objectPosition="center 20%"
            />
          </div>
        </SlideFrame>

        <SlideFrame id="slide-3">
          <Logo className="propuesta-slide-logo" />
          <div className="propuesta-fill propuesta-split-clean">
            <div className="propuesta-copy">
              <Kicker>Estándar de servicio</Kicker>
              <Title>Servicio de primer nivel, atención cercana</Title>
              <p className="propuesta-lead">
                Tu residencial merece una experiencia de compra estable, moderna y siempre disponible.
              </p>
              <div className="propuesta-icon-grid">
                {SERVICE_VALUES.map((item) => (
                  <article key={item.title} className="propuesta-icon-item">
                    <Orb tone={item.tone}>
                      <Icon name={item.icon} />
                    </Orb>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <Media
              src="/images/quienes-somos-equipo.jpg"
              alt="Equipo de Quick! Mini Market frente a la tienda"
              objectPosition="center 20%"
            />
          </div>
        </SlideFrame>

        <SlideFrame id="slide-4">
          <Logo className="propuesta-slide-logo" />
          <Kicker color={brand.green}>Surtido Quick!</Kicker>
          <Title>Mini market para tu vida diaria, siempre a la mano</Title>
          <p className="propuesta-lead">
            Diseñamos nuestro inventario pensando en la dinámica de cada residencial, adaptando el
            surtido a las necesidades y al estilo de vida de tu comunidad.
          </p>
          <div className="propuesta-assortment-clean">
            {PRODUCT_GROUPS.map((item) => (
              <article key={item.title} className="propuesta-icon-item">
                <Orb tone={item.tone}>
                  <span aria-hidden>{item.emoji}</span>
                </Orb>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </SlideFrame>

        <SlideFrame id="slide-5">
          <Logo className="propuesta-slide-logo" />
          <div className="propuesta-fill propuesta-split-clean is-tech">
            <div className="propuesta-copy">
              <Kicker>Tecnología</Kicker>
              <Title>Tu mini market, ahora en tu celular</Title>
              <p className="propuesta-lead">
                Olvídate de mandar listas de compras por texto. Explora nuestro catálogo digital
                directamente en WhatsApp: consulta fotos, confirma precios en tiempo real y gestiona
                tu pedido por el mismo chat.
              </p>
              <div className="propuesta-icon-stack">
                {TECH_FEATURES.map((feature) => (
                  <article key={feature.title} className="propuesta-icon-item">
                    <Orb tone={feature.tone}>
                      <Icon name={feature.icon} />
                    </Orb>
                    <div>
                      <h3>{feature.title}</h3>
                      <p>{feature.text}</p>
                    </div>
                  </article>
                ))}
              </div>
              <a href={catalogHref} target="_blank" rel="noopener noreferrer" className="propuesta-pill is-green">
                <Icon name="whatsapp" />
                Prueba la experiencia Quick! por WhatsApp
              </a>
            </div>
            <a
              href={catalogHref}
              target="_blank"
              rel="noopener noreferrer"
              className="propuesta-phone-link"
              aria-label="Abrir el catálogo Quick! por WhatsApp"
            >
              <PhoneFrame className="!mx-0 !w-[230px] md:!w-[250px]">
                <SlidePhoto
                  src="/images/catalogo-screenshot.png"
                  alt="Catálogo Quick! en el celular"
                  objectPosition="center top"
                  className="absolute inset-0"
                />
              </PhoneFrame>
              <p>Abrir catálogo</p>
            </a>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-6" className="is-pharma" style={{ backgroundColor: PHARMA_BG }}>
          <Logo variant="pharma" className="propuesta-slide-logo h-10 max-w-[260px]" />
          <div className="propuesta-fill propuesta-split-clean">
            <div className="propuesta-copy">
              <Kicker color={brand.blue}>Próximamente en Noviembre 2026</Kicker>
              <h2 className="propuesta-title" style={{ color: brand.blue }}>
                PharmaQuick<span className="propuesta-title-dot">!</span>
              </h2>
              <p className="propuesta-lead">
                La misma conveniencia que ya conoces, ahora con un propósito dedicado a tu bienestar.
                Una propuesta diseñada para cuidar de ti y de tu familia con acceso fácil, seguridad y
                total tranquilidad.
              </p>
              <div className="propuesta-icon-stack">
                {PHARMA_ITEMS.map((item) => (
                  <article key={item.title} className="propuesta-icon-item">
                    <Orb tone={item.tone}>
                      <Icon name={item.icon} />
                    </Orb>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <Media src="/images/pharmaquick-storefront.jpeg" alt="Fachada de PharmaQuick! en Plaza Crisfer" />
          </div>
        </SlideFrame>

        <SlideFrame id="slide-7" innerClassName="is-tight">
          <Kicker>Panorama de crecimiento</Kicker>
          <Title>Nuestra ruta de expansión</Title>
          <div className="propuesta-map-wrap">
            <ExpansionMap />
            <aside className="propuesta-legend">
              <h3>En el mapa</h3>
              {EXPANSION_SITES.map((site) => (
                <div key={site.id} className="propuesta-legend-item">
                  <span
                    className={`propuesta-legend-swatch${site.status === "projected" ? " is-projected" : ""}${
                      site.brand === "pharmaquick" ? " is-pharma" : ""
                    }`}
                  />
                  <div>
                    <strong>{site.name}</strong>
                    <div style={{ color: brand.muted }}>
                      {site.brand === "pharmaquick" ? "PharmaQuick!" : "Quick!"} · {site.area}
                      {site.opening ? ` · ${site.opening}` : site.status === "open" ? " · Abierta" : " · Proyectada"}
                    </div>
                  </div>
                </div>
              ))}
              <p className="mt-2 text-xs leading-relaxed" style={{ color: brand.muted }}>
                Punto sólido: abierta. Anillo: proyectada. Los Robles queda a la altura del Hard Rock,
                al otro lado de la carretera. Green One Villas &amp; Resort, enfrente del Iberostar.
              </p>
            </aside>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-8">
          <div className="propuesta-fill propuesta-split-clean is-photo-left">
            <div className="relative min-h-0">
              <Media
                src="/images/tienda-fachada.jpeg"
                alt="Fachada de Quick! Mini Market en el residencial"
                objectPosition="32% center"
              />
              <p className="propuesta-media-chip">Un local, un residencial</p>
            </div>
            <div className="propuesta-copy">
              <Kicker>Qué buscamos</Kicker>
              <Title>Espacios que encajen con el modelo</Title>
              <p className="propuesta-lead">
                Evaluamos de forma continua locales bien ubicados, espacios dentro de residenciales y
                alianzas a largo plazo.
              </p>
              <div className="propuesta-icon-stack mt-6">
                {SEEK_OPTIONS.map((item) => (
                  <article key={item.title} className="propuesta-icon-item is-numbered">
                    <Orb tone={item.tone}>
                      <Icon name={item.icon} />
                    </Orb>
                    <div>
                      <h3>
                        <span style={{ color: TONE[item.tone] }}>{item.num}</span> {item.title}
                      </h3>
                      <p>{item.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-9">
          <div className="propuesta-fill propuesta-split-clean is-photo-left is-close">
            <Media
              src="/images/Banner1.jpeg"
              alt="Delivery Quick! entregando un pedido en el residencial"
              objectPosition="center 40%"
            />
            <div className="propuesta-copy">
              <Logo className="h-12 max-w-[200px]" />
              <h2 className="propuesta-title mt-5">
                ¿Tu residencial tiene un espacio para <span style={{ color: brand.orange }}>Quick!</span>?
              </h2>
              <p className="propuesta-lead">Hablemos. Traemos conveniencia a más comunidades.</p>
              <div className="propuesta-close-actions">
                <a href={joinHref} target="_blank" rel="noopener noreferrer" className="propuesta-pill is-green">
                  <Icon name="whatsapp" />
                  Escribir por WhatsApp
                </a>
                <a href="/expansion" className="propuesta-pill is-orange">
                  <Icon name="mail" />
                  Enviar una propuesta
                </a>
              </div>
              <p className="propuesta-contact">
                <a href="tel:+13056083660">Contáctanos: +1 305 608 3660</a>
              </p>
            </div>
          </div>
        </SlideFrame>
      </div>

      <div className="propuesta-chrome">
        <div className="propuesta-dots" aria-label="Diapositivas">
          {Array.from({ length: SLIDE_COUNT }, (_, index) => (
            <button
              key={index}
              type="button"
              className={`propuesta-dot${index === active ? " is-active" : ""}`}
              aria-label={`Ir a la diapositiva ${index + 1}`}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
        <button type="button" className="propuesta-print-btn" disabled={exporting} onClick={() => void onDownloadPdf()}>
          {exporting ? "Abriendo PDF…" : "Descargar PDF"}
        </button>
      </div>
      {exporting ? (
        <p className="propuesta-print-hint">
          En el diálogo, elige <strong>Guardar como PDF</strong> y márgenes <strong>Ninguno</strong>.
        </p>
      ) : null}
    </div>
  );
}
