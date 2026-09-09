"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { ExpansionMap } from "@/components/propuesta/ExpansionMap";
import { EXPANSION_SITES } from "@/lib/expansion-sites";
import { brand, whatsappHref } from "@/lib/theme";

const SLIDE_COUNT = 12;

const PRODUCT_GROUPS = [
  { title: "Desayuno", text: "Café, leche, pan, cereal, huevos y lo que se pide a primera hora." },
  { title: "Cocina", text: "Aceites, arroz, pastas, enlatados y lo básico para armar la comida." },
  { title: "Snacks y antojos", text: "Lo que se pide en el residencial: chips, galletas, dulces y más." },
  { title: "Bebidas y lácteos", text: "Aguas, jugos, refrescos, leche, yogurt y quesos." },
  { title: "Hogar", text: "Limpieza, papel, desechables y lo que no puede faltar en el apto." },
  { title: "Cuidado y familia", text: "Higiene, bebé, mascotas y congelados del día a día." },
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
  const deckRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const goTo = useCallback((index: number) => {
    const next = Math.max(0, Math.min(SLIDE_COUNT - 1, index));
    document.getElementById(`slide-${next}`)?.scrollIntoView({ behavior: "smooth" });
    setActive(next);
  }, []);

  useEffect(() => {
    const root = deckRef.current;
    if (!root) {
      return;
    }
    const slides = Array.from(root.querySelectorAll<HTMLElement>(".propuesta-slide"));
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
      { root, threshold: 0.55 },
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
      <div ref={deckRef} className="propuesta-deck">
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

        <SlideFrame id="slide-1" style={{ backgroundColor: brand.cream }}>
          <Kicker>El problema</Kicker>
          <h2 className="propuesta-title">
            La conveniencia no debería estar
            <br />a 20 minutos en carro.
          </h2>
          <p className="propuesta-lead">
            Los residentes salen del complejo por lo de todos los días. Un local vacío o un colmado
            informal no sube el valor del residencial: genera quejas, stock irregular y poca
            confianza.
          </p>
          <div className="propuesta-grid mt-8 md:grid-cols-3">
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
            ].map((item) => (
              <article key={item.title} className="propuesta-card">
                <span className="propuesta-dot-mark" style={{ backgroundColor: brand.orange }} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </SlideFrame>

        <SlideFrame id="slide-2" style={{ backgroundColor: "#F1F7EA" }}>
          <Kicker color={brand.green}>La idea</Kicker>
          <h2 className="propuesta-title">Una cadena pensada para comunidades residenciales.</h2>
          <p className="propuesta-lead">
            Quick! Mini Market no es un colmado de carretera. Abrimos dentro del residencial o en la
            plaza que ya usa el vecino — calidad de cadena, trato de vecino.
          </p>
          <div className="propuesta-grid md:grid-cols-2">
            <article className="propuesta-card">
              <Logo className="h-12 max-w-[200px]" />
              <h3 className="mt-5">Quick! Mini Market</h3>
              <p>
                Conveniencia cotidiana: lo que se necesita todos los días, a pasos de casa. El formato
                de mini market para residenciales y plazas de comunidad.
              </p>
            </article>
            <article className="propuesta-card">
              <Logo variant="pharma" className="h-10 max-w-[240px]" />
              <h3 className="mt-5">PharmaQuick!</h3>
              <p>
                Farmacia hermana. Misma forma de atenderte, un propósito distinto: la salud de la
                comunidad. Un segundo formato para plazas y locales de confianza.
              </p>
            </article>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-3" style={{ backgroundColor: brand.green }}>
          <Kicker color="rgba(255,255,255,0.8)">Operación</Kicker>
          <h2 className="propuesta-title text-white">Ya está en marcha. No es un concepto en papel.</h2>
          <p className="propuesta-lead !text-white/90">
            Llega una operación con tienda, personal, caja, inventario y canal digital — no un
            inquilino a “ver cómo le va”.
          </p>
          <div className="propuesta-grid md:grid-cols-3">
            {[
              {
                title: "Tienda piloto",
                text: "Residencial Jardines 3, Pueblo Bávaro, La Altagracia.",
              },
              {
                title: "Todos los días",
                text: "De 8:00 a. m. a 12:00 a. m. Horario largo, presencia real.",
              },
              {
                title: "Pedidos y entrega",
                text: "WhatsApp + catálogo en el celular. Entrega a edificio y apartamento.",
              },
              {
                title: "Cobertura actual",
                text: "Jardines III, Crisfer y Canas del Este.",
              },
              {
                title: "Pagos",
                text: "Efectivo y tarjeta. Caja y recuento de turno en back office.",
              },
              {
                title: "Equipo",
                text: "Delivery (pedidos, chat, ruta) y Administración (caja, compras, catálogo).",
              },
            ].map((item) => (
              <article key={item.title} className="rounded-3xl bg-white/15 px-5 py-4 text-white">
                <h3 className="font-display text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/90">{item.text}</p>
              </article>
            ))}
          </div>
        </SlideFrame>

        <SlideFrame id="slide-4" style={{ backgroundColor: brand.cream }}>
          <Kicker>Estándar de servicio</Kicker>
          <h2 className="propuesta-title">
            Calidad de cadena.
            <br />
            Trato de vecino.
          </h2>
          <p className="propuesta-lead">
            El vecino baja a una cadena; no a un negocio que cambia de dueño y de calidad.
          </p>
          <div className="propuesta-grid md:grid-cols-2">
            {SERVICE_VALUES.map((item) => (
              <article key={item.title} className="propuesta-card">
                <span className="propuesta-dot-mark" style={{ backgroundColor: brand.green }} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </SlideFrame>

        <SlideFrame id="slide-5" style={{ backgroundColor: "#F1F7EA" }}>
          <Kicker color={brand.green}>Surtido Quick!</Kicker>
          <h2 className="propuesta-title">Mini market de vida diaria, no de fin de semana.</h2>
          <p className="propuesta-lead">
            El catálogo se arma con lo que el residencial pide. Si no está, el vecino lo solicita y
            el equipo lo evalúa.
          </p>
          <div className="propuesta-grid md:grid-cols-3">
            {PRODUCT_GROUPS.map((item) => (
              <article key={item.title} className="propuesta-card">
                <span className="propuesta-dot-mark" style={{ backgroundColor: brand.orange }} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </SlideFrame>

        <SlideFrame id="slide-6" innerClassName="is-tight" style={{ backgroundColor: brand.cream }}>
          <Kicker>Tecnología</Kicker>
          <h2 className="propuesta-title" style={{ fontSize: "clamp(28px, 3.4vw, 44px)" }}>
            Tu mini market, ahora en el celular.
          </h2>
          <p className="propuesta-lead">
            No es mandar una lista por chat. Es abrir el catálogo completo desde WhatsApp — con
            fotos, precios y confirmación por el mismo chat.
          </p>
          <div className="propuesta-grid md:grid-cols-3">
            {TECH_BLOCKS.map((block) => (
              <article key={block.title} className="propuesta-card">
                <span className="propuesta-dot-mark" style={{ backgroundColor: brand.green }} />
                <h3>{block.title}</h3>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: brand.muted }}>
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold" style={{ color: brand.ink }}>
            No instalamos un mostrador. Llevamos un sistema que ya corre en Jardines 3 y se replica
            en el siguiente local.
          </p>
        </SlideFrame>

        <SlideFrame id="slide-7" style={{ backgroundColor: "#EAF4FB" }}>
          <Kicker color={brand.blue}>PharmaQuick!</Kicker>
          <h2 className="propuesta-title" style={{ color: brand.blue }}>
            Muy pronto. Noviembre 2026.
          </h2>
          <p className="propuesta-lead">
            La misma conveniencia. Un propósito distinto: tu salud. Un residencial o plaza puede
            encajar Quick!, PharmaQuick!, o ambos.
          </p>
          <div className="mt-6 grid items-start gap-6 md:grid-cols-[1.2fr_1fr]">
            <div>
              <Logo variant="pharma" className="h-12 max-w-[280px]" />
              <ul className="mt-6 grid gap-4">
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
            <aside
              className="rounded-[28px] px-6 py-8 text-white shadow-[0_16px_40px_rgba(31,130,197,0.28)]"
              style={{ backgroundColor: brand.blue }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">Apertura</p>
              <p className="font-display mt-3 text-4xl font-black uppercase leading-none">Nov 2026</p>
              <p className="mt-4 text-sm leading-relaxed text-white/90">
                No es el mismo local ni el mismo permiso. Es el mismo grupo y el mismo estándar de
                servicio.
              </p>
            </aside>
          </div>
        </SlideFrame>

        <SlideFrame id="slide-8" innerClassName="is-tight" style={{ backgroundColor: brand.cream }}>
          <Kicker>Panorama de crecimiento</Kicker>
          <h2 className="propuesta-title" style={{ fontSize: "clamp(28px, 3.2vw, 42px)" }}>
            Cada tienda, un punto. Cada marca, su logo.
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

        <SlideFrame id="slide-9" style={{ backgroundColor: brand.orange }}>
          <Kicker color="#FDE9C8">Qué buscamos</Kicker>
          <h2 className="propuesta-title text-white">Espacios que encajen con el modelo.</h2>
          <p className="max-w-2xl text-lg text-white/90">
            Evaluamos de forma continua locales bien ubicados, espacios dentro de residenciales y
            alianzas a largo plazo.
          </p>
          <div className="propuesta-grid md:grid-cols-3">
            {[
              { title: "Alquiler", text: "Local en residencial, plaza comercial o local independiente." },
              { title: "Compra", text: "Adquirir el espacio cuando el proyecto y la ubicación lo justifiquen." },
              { title: "Alianza", text: "Acuerdo con la administración o el desarrollador del residencial." },
            ].map((item) => (
              <article key={item.title} className="rounded-3xl bg-[#FFF6E8] px-5 py-5">
                <h3 className="font-display text-xl font-extrabold" style={{ color: brand.orange }}>
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: brand.muted }}>
                  {item.text}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm font-semibold text-white">
            Para evaluar: tamaño, visibilidad, parqueo, restricciones y el nombre del residencial.
          </p>
        </SlideFrame>

        <SlideFrame id="slide-10" style={{ backgroundColor: "#F1F7EA" }}>
          <Kicker color={brand.green}>Qué gana el residencial</Kicker>
          <h2 className="propuesta-title">Una amenidad que se vende. Un inquilino que opera.</h2>
          <div className="propuesta-grid md:grid-cols-2">
            {[
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
            ].map((item) => (
              <article key={item.title} className="propuesta-card">
                <span className="propuesta-dot-mark" style={{ backgroundColor: brand.green }} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </SlideFrame>

        <SlideFrame id="slide-11" className="propuesta-scallop">
          <div className="relative z-10 mx-auto flex h-full max-w-4xl flex-col items-center justify-center text-center">
            <div className="w-full rounded-[40px] bg-[#FFF6E8] px-10 py-12 md:px-16">
              <Logo className="mx-auto h-14 max-w-[220px]" />
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
        <button type="button" className="propuesta-print-btn" onClick={() => window.print()}>
          Exportar PDF
        </button>
      </div>
    </div>
  );
}
