import { brand, quickCoinsLogoPublicPath, whatsappHref } from "@/lib/theme";

const CREAM = "#FDE9C8";
const GREEN = brand.green;
const HEADLINE_GREEN = "#2D5016";
const JOIN_MESSAGE = "Hola! Quiero unirme a QuickCoins 🪙";

const diamondPattern = {
  backgroundImage: `
    linear-gradient(135deg, ${CREAM} 25%, transparent 25%),
    linear-gradient(225deg, ${CREAM} 25%, transparent 25%),
    linear-gradient(45deg, ${CREAM} 25%, transparent 25%),
    linear-gradient(315deg, ${CREAM} 25%, ${GREEN} 25%)
  `,
  backgroundPosition: "25px 0, 25px 0, 0 0, 0 0",
  backgroundSize: "50px 50px",
  backgroundRepeat: "repeat",
} as const;

function AlternatingHeadline({ lines }: { lines: readonly string[] }) {
  let charIndex = 0;

  return (
    <>
      {lines.map((line, lineIndex) => (
        <span key={line} className={lineIndex > 0 ? "block" : undefined}>
          {line.split("").map((char, i) => {
            if (char === " ") {
              return <span key={`${lineIndex}-${i}`}>&nbsp;</span>;
            }
            const color = charIndex % 2 === 0 ? CREAM : HEADLINE_GREEN;
            charIndex += 1;
            return (
              <span key={`${lineIndex}-${i}`} style={{ color }}>
                {char}
              </span>
            );
          })}
        </span>
      ))}
    </>
  );
}

export function QuickCoinsBanner() {
  const joinHref = `${whatsappHref()}?text=${encodeURIComponent(JOIN_MESSAGE)}`;

  return (
    <section
      id="quick-coins"
      className="relative flex min-h-[340px] w-full flex-col items-stretch overflow-hidden md:h-[340px] md:flex-row md:items-stretch"
      style={{ backgroundColor: GREEN }}
    >
      <div className="flex flex-1 flex-col justify-center gap-4 px-6 py-10 md:px-16">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={quickCoinsLogoPublicPath} alt="" className="h-10 w-10 object-contain" />
          <div className="flex flex-col leading-tight">
            <span className="font-display text-xl font-bold text-white">QuickCoins</span>
            <span className="text-[10px] font-light uppercase tracking-wide text-white/70">
              El programa de lealtad de Quick!
            </span>
          </div>
        </div>

        <h2 className="font-display text-4xl font-black uppercase leading-[1.05] md:text-6xl">
          <AlternatingHeadline lines={["Gana con cada", "pedido"]} />
        </h2>

        <p className="text-base font-normal text-white">
          Únete a QuickCoins y cambia tus puntos por descuentos en tu próximo pedido.
        </p>
      </div>

      <div className="flex h-auto items-center gap-8 self-stretch px-6 pb-10 md:pb-0 md:pl-0 md:pr-0">
        <a
          href={joinHref}
          target="_blank"
          rel="noopener noreferrer"
          className="z-10 ml-0 flex-shrink-0 whitespace-nowrap rounded-full px-7 py-3 text-sm font-bold uppercase shadow-md transition hover:brightness-95 md:ml-auto"
          style={{ backgroundColor: CREAM, color: brand.orange }}
        >
          Únete a QuickCoins
        </a>

        <div
          className="hidden h-full w-[160px] flex-shrink-0 self-stretch opacity-90 md:block"
          style={diamondPattern}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
