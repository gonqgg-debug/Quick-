"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ExpansionMap } from "@/components/propuesta/ExpansionMap";
import { EXPANSION_SITES } from "@/lib/expansion-sites";
import { downloadPropuestaPdf } from "@/lib/propuesta-pdf";
import { brand, whatsappHref } from "@/lib/theme";

const SLIDE_COUNT = 11;

const PRODUCT_GROUPS = [
  { title: "Frutas y vegetales", emoji: "🥬", text: "Lo fresco de la semana: frutas, vegetales y hierbas para tu día a día." },
  { title: "Desayuno", emoji: "🥣", text: "Café, leche, pan, cereales y huevos frescos desde primera hora." },
  { title: "Cocina y abarrotes", emoji: "🍝", text: "Aceites, arroz, pastas, enlatados y los esenciales de tu despensa." },
  { title: "Lácteos y refrigerados", emoji: "🥛", text: "Leche, yogurt, quesos variados y básicos del refrigerador." },
  { title: "Snacks y antojos", emoji: "🍪", text: "Chips, galletas, chocolates y los favoritos de la comunidad." },
  { title: "Bebidas refrescantes", emoji: "🥤", text: "Agua, jugos, refrescos y hielo listo para el clima de Bávaro." },
  { title: "Bebidas calientes", emoji: "☕", text: "Café, té e infusiones para tu mañana o tus jornadas de home office." },
  { title: "Bebidas frías con alcohol", emoji: "🍺", text: "Cervezas y cócteles listos para tomar, siempre a temperatura ideal." },
  { title: "Cuidado personal", emoji: "🧴", text: "Higiene personal, salud dental, cuidado del cabello y básicos del baño." },
  { title: "Hogar y limpieza", emoji: "🧹", text: "Detergentes, papel, desechables y los insumos que se agotan al instante." },
  { title: "Bebés y mascotas", emoji: "🍼", text: "Pañales, fórmula, alimento para mascotas y las urgencias del hogar." },
  { title: "Congelados", emoji: "🧊", text: "Helados, hielo, vegetales y comidas prácticas para resolver la semana." },
] as const;

const SERVICE_VALUES = [
  {
    title: "Servicio de excelencia",
    text: "Optimizamos cada proceso día a día para brindarte una atención ágil, confiable y a la altura de tus necesidades.",
  },
  {
    title: "Garantía de calidad",
    text: "Mantenemos la misma excelencia en atención, higiene y cumplimiento en cada sucursal.",
  },
  {
    title: "Esenciales al día",
    text: "Encuentras lo que buscas para tu rutina diaria de forma rápida y sin complicaciones.",
  },
  {
    title: "Impacto positivo",
    text: "Un espacio estructurado que eleva la plusvalía del residencial y respalda al talento local.",
  },
] as const;

const TECH_FEATURES = [
  {
    title: "Catálogo con fotos y precios",
    emoji: "📱",
    text: "Explora por producto, marca o categoría. Tienes la misma variedad de nuestros pasillos, al alcance de tu mano.",
  },
  {
    title: "Pedidos rápidos y favoritos",
    emoji: "⚡",
    text: "Guarda tu última compra o accede a los productos más solicitados de tu comunidad para pedir de nuevo en un par de clics.",
  },
  {
    title: "Seguimiento y flexibilidad",
    emoji: "🛵",
    text: "Consulta el estado de tu pedido, realiza modificaciones o cancela directamente por WhatsApp mientras lo preparamos.",
  },
  {
    title: "¿Buscas algo en específico?",
    emoji: "🔎",
    text: "Si no encuentras un artículo en el catálogo digital, indícanoslo por el chat; nuestro equipo verifica la disponibilidad al instante.",
  },
  {
    title: "QuickCoins",
    emoji: "🪙",
    text: "Acumula puntos automáticos en cada compra y canjéalos por descuentos en tus próximos pedidos.",
  },
] as const;

const OPERATION_STATS = [
  { title: "Dónde está", text: "Residencial Jardines 3, Pueblo Bávaro, La Altagracia." },
  { title: "Horario", text: "Todos los días, de 8:00 a. m. a 12:00 a. m." },
  { title: "Pedidos", text: "Catálogo por WhatsApp. Entrega a edificio y apartamento." },
  { title: "Zona de entrega", text: "Jardines III, Crisfer y Canas del Este." },
  { title: "Pagos", text: "Efectivo y tarjeta en tienda y en el pedido." },
  { title: "El equipo", text: "Personal de tienda y delivery, en un mismo sistema." },
] as const;

const SEEK_OPTIONS = [
  { num: "01", title: "Alquiler", text: "Local en residencial, plaza comercial o local independiente." },
  { num: "02", title: "Compra", text: "Adquirir el espacio cuando el proyecto y la ubicación lo justifiquen." },
  { num: "03", title: "Alianza", text: "Acuerdo con la administración o el desarrollador del residencial." },
] as const;

const GAIN_ITEMS = [
  {
    title: "Necesidades siempre cubiertas",
    text: "El residente resuelve lo de todos los días sin salir del complejo: leche, cena, un antojo o lo que se acabó.",
  },
  {
    title: "Valor del inmueble",
    text: "Una amenidad de cadena a pasos suma a la percepción del residencial y a la valuación de los apartamentos.",
  },
  {
    title: "Comunidad",
    text: "Un punto cotidiano de encuentro, empleo local y un vecino que opera con el mismo estándar todos los días.",
  },
  {
    title: "Servicio profesional hasta la puerta",
    text: "Pedido por WhatsApp, seguimiento del chat y entrega al apartamento — no un recadero improvisado.",
  },
] as const;

const TILE_STYLES = [
  { background: brand.green, color: "#ffffff", muted: "rgba(255,255,255,0.88)" },
  { background: brand.orange, color: "#ffffff", muted: "rgba(255,255,255,0.9)" },
  { background: brand.cream, color: brand.ink, muted: brand.muted },
  { background: brand.blue, color: "#ffffff", muted: "rgba(255,255,255,0.9)" },
  { background: "#ffffff", color: brand.ink, muted: brand.muted },
  { background: "#F1F7EA", color: brand.ink, muted: brand.muted },
] as const;

function Kicker({ children, color }: { children: string; color?: string }) {
  return (
    <p className="propuesta-kicker" style={{ color: color ?? brand.orange }}>
      {children}
    </p>
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
    <section id={id} className={`propuesta-slide ${className}`} style={style}>
      <div className={`propuesta-slide-inner ${innerClassName}`}>{children}</div>
    </section>
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
        <SlideFrame id="slide-0" className="propuesta-scallop">
          <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center justify-center text-center">
            <div className="w-full rounded-[40px] bg-[#FFF6E8] px-10 py-12 shadow-[0_24px_50px_rgba(26,26,26,0.18)] md:px-16 md:py-14">
              <Logo className="mx-auto h-16 max-w-[260px]" />
              <p className="mt-8 text-2xl font-semibold md:text-3xl" style={{ color: brand.orange }}>
                Traemos la conveniencia
              </p>
              <h1
                className="font-display mt-1 text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.04em] md:text-7xl"
                style={{ color: brand.orange }}
              >
                A tu residencial
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-lg" style={{ color: brand.muted }}>
                Mini market de cadena, a un paso de tu casa.
              </p>
              <p
                className="mt-8 text-xs font-bold uppercase tracking-[0.18em]"
                style={{ color: brand.green }}
              >
                Propuesta para residenciales y locales
              </p>
            </div>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-1" style={{ backgroundColor: "#F1F7EA" }}>
          <div className="propuesta-fill propuesta-idea">
            <div className="flex min-h-0 flex-col justify-center pr-4">
              <Kicker color={brand.green}>La idea</Kicker>
              <h2 className="propuesta-title">Una cadena pensada para comunidades residenciales.</h2>
              <p className="propuesta-lead">
                Llevamos un mini market de primer nivel a la puerta de tu casa. Nos integramos a tu
                residencial o plaza local para ofrecerte la calidad de una gran cadena con la calidez,
                confianza y atención personalizada que te mereces.
              </p>
              <div className="propuesta-grid mt-6 md:grid-cols-2">
                <article className="propuesta-card">
                  <Logo className="h-10 max-w-[180px]" />
                  <h3 className="mt-4">Quick! Mini Market</h3>
                  <p>Conveniencia cotidiana: lo que se necesita todos los días, a pasos de casa.</p>
                </article>
                <article className="propuesta-card">
                  <Logo variant="pharma" className="h-9 max-w-[220px]" />
                  <h3 className="mt-4">PharmaQuick!</h3>
                  <p>Farmacia hermana. Misma forma de atenderte, un propósito distinto: tu salud.</p>
                </article>
              </div>
            </div>
            <div className="relative min-h-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/tienda-isometrica.png"
                alt="Ilustración isométrica del formato Quick! Mini Market"
                className="absolute inset-0 h-full w-full object-contain object-center"
              />
            </div>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-2" innerClassName="is-flush" style={{ backgroundColor: brand.green }}>
          <div className="propuesta-fill propuesta-split">
            <div className="flex min-h-0 flex-col justify-center px-10 py-10 md:px-14">
              <Kicker color="rgba(255,255,255,0.82)">La tienda</Kicker>
              <h2 className="propuesta-title text-white">Así opera Quick! en el residencial.</h2>
              <p className="propuesta-lead !text-white/90">
                Así funciona Quick! en tu comunidad: un mini market con horario extendido, los
                productos que necesitas todos los días y entrega directo a tu puerta. Ya sea que nos
                visites o pidas a domicilio, recibes siempre la misma calidad.
              </p>
              <div className="mt-7 grid grid-cols-2 gap-3">
                {OPERATION_STATS.map((item) => (
                  <article key={item.title} className="propuesta-stat">
                    <h3 className="font-display text-base font-bold">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/90">{item.text}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="propuesta-split-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/quienes-somos-tienda.jpg"
                alt="Interior de Quick! Mini Market con personal en caja"
                style={{ objectPosition: "center 20%" }}
              />
            </div>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-3" innerClassName="is-flush" style={{ backgroundColor: brand.cream }}>
          <div className="propuesta-fill propuesta-split">
            <div className="flex min-h-0 flex-col justify-center px-10 py-10 md:px-14">
              <Kicker>Estándar de servicio</Kicker>
              <h2 className="propuesta-title">
                Servicio de primer nivel,
                <br />
                atención cercana.
              </h2>
              <p className="propuesta-lead">
                Tu residencial merece una experiencia de compra estable, moderna y siempre disponible.
              </p>
              <div className="propuesta-service-grid mt-7">
                {SERVICE_VALUES.map((item) => (
                  <article key={item.title} className="propuesta-card">
                    <span className="propuesta-dot-mark" style={{ backgroundColor: brand.green }} />
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="propuesta-split-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/quienes-somos-equipo.jpg"
                alt="Equipo de Quick! Mini Market frente a la tienda"
                style={{ objectPosition: "center 30%" }}
              />
            </div>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-4" style={{ backgroundColor: "#F1F7EA" }}>
          <Kicker color={brand.green}>Surtido Quick!</Kicker>
          <h2 className="propuesta-title">Mini market para tu vida diaria, siempre a la mano.</h2>
          <p className="propuesta-lead">
            Diseñamos nuestro inventario pensando en la dinámica de cada residencial, adaptando el
            surtido a las necesidades y al estilo de vida de tu comunidad.
          </p>
          <div className="propuesta-assortment-grid">
            {PRODUCT_GROUPS.map((item, index) => {
              const tile = TILE_STYLES[index % TILE_STYLES.length];
              return (
                <article key={item.title} className="propuesta-tile" style={{ background: tile.background, color: tile.color }}>
                  <span className="mb-1 text-xl" aria-hidden>
                    {item.emoji}
                  </span>
                  <h3>{item.title}</h3>
                  <p style={{ color: tile.muted }}>{item.text}</p>
                </article>
              );
            })}
          </div>
        </SlideFrame>

        <SlideFrame id="slide-5" innerClassName="is-flush" style={{ backgroundColor: brand.cream }}>
          <div className="propuesta-fill propuesta-tech">
            <div className="min-h-0">
              <Kicker>Tecnología</Kicker>
              <h2 className="propuesta-title" style={{ fontSize: "clamp(28px, 3.4vw, 44px)" }}>
                Tu mini market, ahora en tu celular.
              </h2>
              <p className="propuesta-lead">
                Olvídate de mandar listas de compras por texto. Explora nuestro catálogo digital
                directamente en WhatsApp: consulta fotos, confirma precios en tiempo real y gestiona
                tu pedido por el mismo chat.
              </p>
              <ul className="propuesta-tech-features">
                {TECH_FEATURES.map((feature) => (
                  <li key={feature.title} className="flex gap-3">
                    <span className="text-base leading-none" aria-hidden>
                      {feature.emoji}
                    </span>
                    <div>
                      <h3 className="font-display text-base font-bold">{feature.title}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed" style={{ color: brand.muted }}>
                        {feature.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <a
                href={catalogHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-bold text-white"
                style={{ backgroundColor: brand.green }}
              >
                Prueba la experiencia Quick! por WhatsApp
              </a>
            </div>
            <a
              href={catalogHref}
              target="_blank"
              rel="noopener noreferrer"
              className="group shrink-0 no-underline"
              aria-label="Abrir el catálogo Quick! por WhatsApp"
            >
              <PhoneFrame className="!mx-0 !w-[230px] md:!w-[250px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/catalogo-screenshot.png"
                  alt="Catálogo Quick! en el celular"
                  className="absolute inset-0 h-full w-full object-cover object-top"
                />
              </PhoneFrame>
              <p
                className="mt-3 text-center text-xs font-bold uppercase tracking-[0.12em]"
                style={{ color: brand.orange }}
              >
                Abrir catálogo
              </p>
            </a>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-6" innerClassName="is-flush" style={{ backgroundColor: "#EAF4FB" }}>
          <div className="propuesta-fill propuesta-split">
            <div className="flex min-h-0 flex-col justify-center px-10 py-10 md:px-14">
              <div className="w-fit rounded-2xl bg-white px-4 py-3 shadow-[0_10px_24px_rgba(31,130,197,0.12)]">
                <Logo variant="pharma" className="h-10 max-w-[240px]" />
              </div>
              <Kicker color={brand.blue}>PharmaQuick!</Kicker>
              <h2 className="propuesta-title" style={{ color: brand.blue }}>
                Muy pronto. Noviembre 2026.
              </h2>
              <p className="propuesta-lead">
                La misma conveniencia. Un propósito distinto: tu salud. Un residencial o plaza puede
                encajar Quick!, PharmaQuick!, o ambos.
              </p>
              <p className="font-display mt-4 text-5xl font-black uppercase leading-none" style={{ color: brand.blue }}>
                Nov 2026
              </p>
              <ul className="mt-5 grid gap-3">
                {[
                  {
                    title: "Medicamentos y cuidado personal",
                    text: "Lo esencial para la salud del día a día, sin salir del entorno de la comunidad.",
                  },
                  {
                    title: "La misma cercanía de Quick!",
                    text: "Calidad de cadena, trato de vecino. Si ya conoces Quick!, vas a reconocer PharmaQuick!.",
                  },
                  {
                    title: "Plaza Crisfer, Local 11",
                    text: "Pueblo Bávaro. Un espacio de confianza, fácil de llegar.",
                  },
                ].map((item) => (
                  <li key={item.title} className="propuesta-card">
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="propuesta-split-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/pharmaquick-storefront.jpeg"
                alt="Fachada de PharmaQuick! en Plaza Crisfer"
              />
            </div>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-7" innerClassName="is-tight" style={{ backgroundColor: brand.cream }}>
          <Kicker>Panorama de crecimiento</Kicker>
          <h2 className="propuesta-title" style={{ fontSize: "clamp(28px, 3.2vw, 42px)" }}>
            Nuestra ruta de expansión
          </h2>
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

        <SlideFrame id="slide-8" innerClassName="is-flush" style={{ backgroundColor: brand.cream }}>
          <div className="propuesta-fill propuesta-seek">
            <div className="relative min-h-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/tienda-fachada.jpeg"
                alt="Pasillo residencial junto a un local para Quick!"
                className="h-full w-full object-cover"
                style={{ objectPosition: "88% center" }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 40%, rgba(255,246,232,0.35) 78%, #FFF6E8 100%)",
                }}
              />
              <p className="absolute bottom-8 left-8 max-w-[220px] rounded-full bg-[#1A1A1A]/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white">
                Un local, un residencial
              </p>
            </div>
            <div className="flex min-h-0 flex-col justify-center px-10 py-10 md:px-14">
              <Kicker>Qué buscamos</Kicker>
              <h2 className="propuesta-title">Espacios que encajen con el modelo.</h2>
              <p className="propuesta-lead">
                Evaluamos de forma continua locales bien ubicados, espacios dentro de residenciales y
                alianzas a largo plazo.
              </p>
              <div className="mt-8 grid gap-5">
                {SEEK_OPTIONS.map((item) => (
                  <article key={item.title} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4">
                    <span className="propuesta-num" style={{ color: brand.orange }}>
                      {item.num}
                    </span>
                    <div className="border-t border-[#ead9bf] pt-3">
                      <h3 className="font-display text-2xl font-extrabold">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed" style={{ color: brand.muted }}>
                        {item.text}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
              <p className="mt-6 text-sm font-semibold" style={{ color: brand.ink }}>
                Para evaluar: tamaño, visibilidad, parqueo, restricciones y el nombre del residencial.
              </p>
            </div>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-9" innerClassName="is-flush" style={{ backgroundColor: "#F1F7EA" }}>
          <div className="propuesta-fill propuesta-split">
            <div className="flex min-h-0 flex-col justify-center px-10 py-10 md:px-14">
              <Kicker color={brand.green}>Qué gana el residencial</Kicker>
              <h2 className="propuesta-title">Una amenidad que se vende. Un inquilino que opera.</h2>
              <div className="propuesta-gains-grid mt-7">
                {GAIN_ITEMS.map((item) => (
                  <article key={item.title} className="propuesta-card">
                    <span className="propuesta-dot-mark" style={{ backgroundColor: brand.green }} />
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="propuesta-split-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/Banner1.jpeg"
                alt="Entrega Quick! en la puerta del apartamento"
                style={{ objectPosition: "center 40%" }}
              />
            </div>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-10" innerClassName="is-flush" style={{ backgroundColor: brand.cream }}>
          <div className="propuesta-fill propuesta-close">
            <div className="relative min-h-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/hero.jpeg"
                alt="Delivery Quick! entregando un pedido en el residencial"
                className="h-full w-full object-cover"
                style={{ objectPosition: "center 20%" }}
              />
            </div>
            <div className="flex min-h-0 flex-col items-center justify-center px-10 py-12 text-center md:px-16">
              <Logo className="h-14 max-w-[220px]" />
              <h2 className="propuesta-title mt-6" style={{ color: brand.orange }}>
                ¿Tu residencial tiene un espacio para Quick!?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: brand.muted }}>
                Hablemos. Traemos conveniencia a más comunidades.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a
                  href={joinHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center justify-center rounded-full px-7 text-base font-bold text-white"
                  style={{ backgroundColor: brand.green }}
                >
                  Escribir por WhatsApp
                </a>
                <a
                  href="/expansion"
                  className="inline-flex min-h-12 items-center justify-center rounded-full px-7 text-base font-bold text-white"
                  style={{ backgroundColor: brand.orange }}
                >
                  Enviar una propuesta
                </a>
              </div>
              <p className="mt-6 text-sm font-semibold" style={{ color: brand.ink }}>
                WhatsApp 809 226 4986 · Pueblo Bávaro, La Altagracia
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
