"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ExpansionMap } from "@/components/propuesta/ExpansionMap";
import { EXPANSION_SITES } from "@/lib/expansion-sites";
import { downloadPropuestaPdf } from "@/lib/propuesta-pdf";
import { brand, whatsappHref } from "@/lib/theme";

const SLIDE_COUNT = 12;

const PRODUCT_GROUPS = [
  { title: "Desayuno", emoji: "🥣", text: "Café, leche, pan, cereal, huevos y lo que se pide a primera hora." },
  { title: "Cocina", emoji: "🍝", text: "Aceites, arroz, pastas, enlatados y lo básico para armar la comida." },
  { title: "Snacks y antojos", emoji: "🍪", text: "Lo que se pide en el residencial: chips, galletas, dulces y más." },
  { title: "Bebidas y lácteos", emoji: "🥤", text: "Aguas, jugos, refrescos, leche, yogurt y quesos." },
  { title: "Hogar", emoji: "🧹", text: "Limpieza, papel, desechables y lo que no puede faltar en el apto." },
  { title: "Cuidado y familia", emoji: "🧴", text: "Higiene, bebé, mascotas y congelados del día a día." },
] as const;

const SERVICE_VALUES = [
  {
    title: "Cercanía",
    text: "Abrimos donde vive la gente, no donde es más fácil para nosotros.",
  },
  {
    title: "Consistencia",
    text: "Misma calidad, mismo horario y el mismo trato en cada sucursal.",
  },
  {
    title: "Simplicidad",
    text: "Lo del día a día, sin complicaciones ni surtido que cambia cada semana.",
  },
  {
    title: "Comunidad",
    text: "Empleo local y un espacio que suma al residencial, no un colmado improvisado.",
  },
] as const;

const TECH_BLOCKS = [
  {
    title: "Para el residente",
    items: [
      "Catálogo con fotos y precios, desde WhatsApp.",
      "Repite el último pedido, favoritos y lo más pedido del residencial.",
      "Sigue, modifica o cancela el pedido por el mismo chat.",
      "Si no está en catálogo, lo pide igual y el equipo lo confirma.",
      "QuickCoins: puntos en cada compra, canjeables en el siguiente pedido.",
    ],
  },
  {
    title: "Para la operación",
    items: [
      "Pedidos con dirección de edificio y apartamento.",
      "Avisos: en preparación, en camino y entregado.",
      "Si falta un producto, se avisa y se ofrece quitarlo o reemplazarlo.",
      "Encuesta de satisfacción después de la entrega.",
    ],
  },
  {
    title: "Para el siguiente local",
    items: [
      "Delivery: cola del día, chat y ruta.",
      "Administración: caja, inventario, compras y catálogo.",
      "Misma plataforma en cada tienda: el estándar no depende de quién esté en turno.",
    ],
  },
] as const;

const OPERATION_STATS = [
  { title: "Tienda piloto", text: "Residencial Jardines 3, Pueblo Bávaro." },
  { title: "Todos los días", text: "De 8:00 a. m. a 12:00 a. m." },
  { title: "Pedidos y entrega", text: "WhatsApp + catálogo. Entrega a edificio y apto." },
  { title: "Cobertura actual", text: "Jardines III, Crisfer y Canas del Este." },
  { title: "Pagos", text: "Efectivo y tarjeta. Caja en back office." },
  { title: "Equipo", text: "Delivery y Administración, en un mismo sistema." },
] as const;

const SEEK_OPTIONS = [
  { num: "01", title: "Alquiler", text: "Local en residencial, plaza comercial o local independiente." },
  { num: "02", title: "Compra", text: "Adquirir el espacio cuando el proyecto y la ubicación lo justifiquen." },
  { num: "03", title: "Alianza", text: "Acuerdo con la administración o el desarrollador del residencial." },
] as const;

const GAIN_ITEMS = [
  {
    title: "Se siente en el brochure",
    text: "Tienda de cadena a pasos. Eso retiene residentes y suma al argumento de venta.",
  },
  {
    title: "Tráfico que se queda adentro",
    text: "El vecino resuelve lo de todos los días sin salir del complejo.",
  },
  {
    title: "Operación profesional",
    text: "Horario largo, marca, personal y tecnología. No un mostrador a prueba.",
  },
  {
    title: "Un segundo formato",
    text: "PharmaQuick! puede anclar salud + conveniencia en la misma plaza o en un local hermano.",
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

function SlidePhoto({
  src,
  alt,
  objectPosition = "center",
}: {
  src: string;
  alt: string;
  objectPosition?: string;
}) {
  return (
    <div className="propuesta-photo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={{ objectPosition }} />
    </div>
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
      await downloadPropuestaPdf();
    } catch (error) {
      console.error(error);
      window.alert("No se pudo generar el PDF. Recarga e inténtalo de nuevo.");
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

  return (
    <div className="propuesta-root">
      <div className="propuesta-deck">
        <SlideFrame id="slide-0" innerClassName="is-flush" style={{ backgroundColor: brand.ink }}>
          <SlidePhoto
            src="/images/tienda-fachada.jpeg"
            alt="Fachada de Quick! Mini Market en el Residencial Jardines 3"
            objectPosition="left center"
          />
          <div
            className="propuesta-veil"
            style={{
              background:
                "linear-gradient(90deg, transparent 18%, rgba(26,26,26,0.18) 48%, rgba(26,26,26,0.55) 100%)",
            }}
          />
          <div className="propuesta-fill propuesta-cover">
            <div />
            <div className="flex items-center justify-end px-10 py-12 md:px-14">
              <div className="w-full max-w-lg rounded-[36px] bg-[#FFF6E8] px-8 py-10 shadow-[0_28px_60px_rgba(26,26,26,0.28)] md:px-10 md:py-12">
                <Logo className="h-14 max-w-[220px]" />
                <p className="mt-7 text-xl font-semibold md:text-2xl" style={{ color: brand.orange }}>
                  Traemos la conveniencia
                </p>
                <h1
                  className="font-display mt-1 text-4xl font-extrabold uppercase leading-[0.9] tracking-[-0.04em] md:text-6xl"
                  style={{ color: brand.orange }}
                >
                  A tu residencial
                </h1>
                <p className="mt-4 text-base leading-relaxed md:text-lg" style={{ color: brand.muted }}>
                  Mini market de cadena, a un paso de tu casa.
                </p>
                <p
                  className="mt-7 text-xs font-bold uppercase tracking-[0.18em]"
                  style={{ color: brand.green }}
                >
                  Propuesta para residenciales y locales
                </p>
              </div>
            </div>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-1" innerClassName="is-flush" style={{ backgroundColor: brand.cream }}>
          <div className="propuesta-fill propuesta-problem">
            <div className="flex min-h-0 flex-col justify-center px-10 py-10 md:px-14">
              <Kicker>El problema</Kicker>
              <h2 className="propuesta-title">
                La conveniencia no debería estar
                <br />a 20 minutos en carro.
              </h2>
              <p className="propuesta-lead">
                Los residentes salen del complejo por lo de todos los días. Un local vacío o un
                colmado informal no sube el valor del residencial: genera quejas, stock irregular y
                poca confianza.
              </p>
              <ol className="mt-8 grid gap-4">
                {[
                  {
                    title: "Lejos de casa",
                    text: "El súper queda en la carretera. Bajar a comprar leche se vuelve un viaje.",
                  },
                  {
                    title: "El local no suma",
                    text: "Un espacio vacío o un negocio que cambia de dueño no se vende en el brochure.",
                  },
                  {
                    title: "Sin estándar",
                    text: "Horario irregular, surtido que falta y un trato que no se replica mañana.",
                  },
                ].map((item, index) => (
                  <li key={item.title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
                    <span className="propuesta-num" style={{ color: brand.orange }}>
                      0{index + 1}
                    </span>
                    <div>
                      <h3 className="font-display text-xl font-extrabold">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed" style={{ color: brand.muted }}>
                        {item.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="relative min-h-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/nathalia-rosa-rWMIbqmOxrY-unsplash.jpg"
                alt="Pasillo de supermercado lejos de casa"
                className="h-full w-full object-cover object-center"
              />
              <div className="propuesta-stamp">
                <span className="font-display text-4xl font-black leading-none" style={{ color: brand.orange }}>
                  20
                </span>
                <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: brand.ink }}>
                  minutos
                </span>
              </div>
            </div>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-2" innerClassName="is-flush" style={{ backgroundColor: "#F1F7EA" }}>
          <div className="propuesta-fill propuesta-idea">
            <div className="flex min-h-0 flex-col justify-center pr-4">
              <Kicker color={brand.green}>La idea</Kicker>
              <h2 className="propuesta-title">Una cadena pensada para comunidades residenciales.</h2>
              <p className="propuesta-lead">
                Quick! Mini Market no es un colmado de carretera. Abrimos dentro del residencial o en
                la plaza que ya usa el vecino — calidad de cadena, trato de vecino.
              </p>
              <div className="relative mt-6 min-h-0 flex-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/tienda-isometrica.png"
                  alt="Ilustración isométrica del formato Quick! Mini Market"
                  className="absolute inset-0 h-full w-full object-contain object-left"
                />
              </div>
            </div>
            <div className="relative min-h-0">
              <figure className="propuesta-polaroid absolute left-2 top-8 w-[72%] -rotate-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/tienda-fachada.jpeg" alt="Quick! Mini Market en Jardines 3" />
                <figcaption>
                  <Logo className="mx-auto h-8 max-w-[140px]" />
                </figcaption>
              </figure>
              <figure className="propuesta-polaroid absolute bottom-10 right-3 w-[72%] rotate-[7deg]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/pharmaquick-storefront.jpeg" alt="Fachada de PharmaQuick!" />
                <figcaption>
                  <Logo variant="pharma" className="mx-auto h-7 max-w-[180px]" />
                </figcaption>
              </figure>
            </div>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-3" innerClassName="is-flush" style={{ backgroundColor: brand.green }}>
          <SlidePhoto
            src="/images/quienes-somos-tienda.jpg"
            alt="Interior de Quick! Mini Market con personal en caja"
            objectPosition="72% center"
          />
          <div
            className="propuesta-veil"
            style={{
              background:
                "linear-gradient(90deg, rgba(126,179,65,0.96) 0%, rgba(126,179,65,0.9) 42%, rgba(126,179,65,0.28) 70%, transparent 100%)",
            }}
          />
          <div className="propuesta-fill justify-center px-10 py-10 md:max-w-[58%] md:px-14">
            <p className="inline-flex w-fit rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
              En operación
            </p>
            <Kicker color="rgba(255,255,255,0.82)">Operación</Kicker>
            <h2 className="propuesta-title text-white">Ya está en marcha. No es un concepto en papel.</h2>
            <p className="propuesta-lead !text-white/90">
              Llega una operación con tienda, personal, caja, inventario y canal digital — no un
              inquilino a “ver cómo le va”.
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
        </SlideFrame>

        <SlideFrame id="slide-4" innerClassName="is-flush" style={{ backgroundColor: brand.ink }}>
          <SlidePhoto
            src="/images/quienes-somos-equipo.jpg"
            alt="Equipo de Quick! Mini Market frente a la tienda"
            objectPosition="center 35%"
          />
          <div
            className="propuesta-veil"
            style={{
              background:
                "linear-gradient(180deg, rgba(26,26,26,0.22) 0%, rgba(26,26,26,0.38) 42%, rgba(26,26,26,0.78) 100%)",
            }}
          />
          <div className="propuesta-fill justify-between px-10 py-10 md:px-14">
            <div className="max-w-3xl">
              <Kicker color="#FDE9C8">Estándar de servicio</Kicker>
              <h2 className="propuesta-title text-white">
                Calidad de cadena.
                <br />
                Trato de vecino.
              </h2>
              <p className="propuesta-lead !text-white/85">
                El vecino baja a una cadena; no a un negocio que cambia de dueño y de calidad.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {SERVICE_VALUES.map((item) => (
                <article key={item.title} className="propuesta-glass rounded-[22px] px-4 py-4">
                  <span className="propuesta-dot-mark" style={{ backgroundColor: brand.green }} />
                  <h3 className="font-display text-lg font-extrabold">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed" style={{ color: brand.muted }}>
                    {item.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-5" innerClassName="is-flush" style={{ backgroundColor: brand.ink }}>
          <div className="propuesta-fill propuesta-bento">
            <div className="relative min-h-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/quienes-somos-tienda.jpg"
                alt="Surtido del mini market en anaqueles"
                className="h-full w-full object-cover"
                style={{ objectPosition: "86% center" }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(26,26,26,0.08) 20%, rgba(26,26,26,0.82) 100%)",
                }}
              />
              <div className="absolute inset-x-0 bottom-0 p-8 md:p-10">
                <Kicker color="#FDE9C8">Surtido Quick!</Kicker>
                <h2 className="propuesta-title text-white" style={{ fontSize: "clamp(28px, 3.4vw, 46px)" }}>
                  Mini market de vida diaria, no de fin de semana.
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/85 md:text-base">
                  El catálogo se arma con lo que el residencial pide. Si no está, el vecino lo
                  solicita y el equipo lo evalúa.
                </p>
              </div>
            </div>
            <div className="grid min-h-0 grid-cols-2 grid-rows-3 gap-3 p-4 md:p-5">
              {PRODUCT_GROUPS.map((item, index) => {
                const tile = TILE_STYLES[index];
                return (
                  <article key={item.title} className="propuesta-tile" style={{ background: tile.background, color: tile.color }}>
                    <span className="mb-2 text-2xl" aria-hidden>
                      {item.emoji}
                    </span>
                    <h3>{item.title}</h3>
                    <p style={{ color: tile.muted }}>{item.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-6" innerClassName="is-flush" style={{ backgroundColor: brand.cream }}>
          <div className="propuesta-fill propuesta-tech">
            <div className="min-h-0">
              <Kicker>Tecnología</Kicker>
              <h2 className="propuesta-title" style={{ fontSize: "clamp(28px, 3.4vw, 44px)" }}>
                Tu mini market, ahora en el celular.
              </h2>
              <p className="propuesta-lead">
                No es mandar una lista por chat. Es abrir el catálogo completo desde WhatsApp — con
                fotos, precios y confirmación por el mismo chat.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {TECH_BLOCKS.map((block) => (
                  <article key={block.title} className="rounded-[22px] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(26,26,26,0.08)]">
                    <span className="propuesta-dot-mark" style={{ backgroundColor: brand.green }} />
                    <h3 className="font-display text-base font-extrabold">{block.title}</h3>
                    <ul className="mt-2 space-y-1.5 text-[12px] leading-snug" style={{ color: brand.muted }}>
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
              <p className="mt-4 text-sm font-semibold" style={{ color: brand.ink }}>
                No instalamos un mostrador. Llevamos un sistema que ya corre en Jardines 3 y se
                replica en el siguiente local.
              </p>
            </div>
            <PhoneFrame className="!mx-0 !w-[230px] shrink-0 md:!w-[250px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/catalogo-screenshot.png"
                alt="Catálogo Quick! en el celular"
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
            </PhoneFrame>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-7" innerClassName="is-flush" style={{ backgroundColor: brand.blue }}>
          <SlidePhoto
            src="/images/pharmaquick-storefront.jpeg"
            alt="Fachada de PharmaQuick! en Plaza Crisfer"
            objectPosition="center"
          />
          <div
            className="propuesta-veil"
            style={{
              background:
                "linear-gradient(90deg, rgba(31,130,197,0.94) 0%, rgba(31,130,197,0.82) 46%, rgba(31,130,197,0.2) 78%, transparent 100%)",
            }}
          />
          <div className="propuesta-fill justify-center px-10 py-10 md:max-w-[58%] md:px-14">
            <div className="w-fit rounded-2xl bg-white px-4 py-3">
              <Logo variant="pharma" className="h-10 max-w-[240px]" />
            </div>
            <Kicker color="rgba(255,255,255,0.8)">PharmaQuick!</Kicker>
            <h2 className="propuesta-title text-white">Muy pronto. Noviembre 2026.</h2>
            <p className="propuesta-lead !text-white/90">
              La misma conveniencia. Un propósito distinto: tu salud. Un residencial o plaza puede
              encajar Quick!, PharmaQuick!, o ambos.
            </p>
            <p className="font-display mt-5 text-6xl font-black uppercase leading-none text-white md:text-7xl">
              Nov 2026
            </p>
            <ul className="mt-6 grid gap-3">
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
                <li key={item.title} className="rounded-[20px] bg-white/15 px-4 py-3 text-white">
                  <h3 className="font-display text-lg font-bold">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/88">{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-8" innerClassName="is-tight" style={{ backgroundColor: brand.cream }}>
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

        <SlideFrame id="slide-9" innerClassName="is-flush" style={{ backgroundColor: brand.cream }}>
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

        <SlideFrame id="slide-10" innerClassName="is-flush" style={{ backgroundColor: "#F1F7EA" }}>
          <div className="propuesta-fill">
            <div className="propuesta-gains-hero">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/Banner1.jpeg"
                alt="Entrega Quick! en la puerta del apartamento"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(26,26,26,0.15) 0%, rgba(26,26,26,0.55) 100%)",
                }}
              />
              <div className="absolute inset-x-0 bottom-0 px-10 py-7 md:px-14">
                <Kicker color="#FDE9C8">Qué gana el residencial</Kicker>
                <h2 className="propuesta-title text-white" style={{ fontSize: "clamp(28px, 3.3vw, 46px)" }}>
                  Una amenidad que se vende. Un inquilino que opera.
                </h2>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 p-6 md:grid-cols-4 md:p-8">
              {GAIN_ITEMS.map((item) => (
                <article key={item.title} className="rounded-[24px] bg-white px-5 py-5 shadow-[0_12px_32px_rgba(26,26,26,0.08)]">
                  <span className="propuesta-dot-mark" style={{ backgroundColor: brand.green }} />
                  <h3 className="font-display text-lg font-extrabold leading-tight">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed" style={{ color: brand.muted }}>
                    {item.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-11" innerClassName="is-flush" style={{ backgroundColor: brand.cream }}>
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
          {exporting ? "Generando PDF…" : "Descargar PDF"}
        </button>
      </div>
    </div>
  );
}
