const PDF_TITLE = "Quick-Mini-Market-Propuesta-Comercial";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function decodeImages(root: ParentNode = document): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      if (typeof image.decode === "function") {
        try {
          await image.decode();
          return;
        } catch {
          // Fall through to load listeners.
        }
      }
      if (image.complete) {
        return;
      }
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
}

async function prepareSlidesForPrint(): Promise<void> {
  const slides = Array.from(document.querySelectorAll<HTMLElement>(".propuesta-slide"));
  for (const slide of slides) {
    slide.scrollIntoView({ behavior: "instant", block: "start" });
    await nextPaint();
    await decodeImages(slide);
  }
}

/**
 * Native print-to-PDF. Chrome/Safari/Edge render the slides with the same
 * engine as the screen (photos as CSS backgrounds, map tiles, web fonts).
 * html2canvas re-paints the DOM in JS and drops object-fit, gradients and pins.
 */
export async function downloadPropuestaPdf(): Promise<void> {
  const chrome = document.querySelector<HTMLElement>(".propuesta-chrome");
  const previousTitle = document.title;
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    document.title = previousTitle;
    document.documentElement.classList.remove("is-exporting");
    chrome?.classList.remove("is-hidden");
  };

  document.documentElement.classList.add("is-exporting");
  chrome?.classList.add("is-hidden");
  document.title = PDF_TITLE;

  await document.fonts.ready;
  await prepareSlidesForPrint();

  const mapSlide = document.querySelector<HTMLElement>("[data-map]")?.closest<HTMLElement>(".propuesta-slide");
  mapSlide?.scrollIntoView({ behavior: "instant", block: "start" });
  window.dispatchEvent(new Event("propuesta:prepare-print"));
  await nextPaint();
  await delay(mapSlide ? 700 : 150);

  await new Promise<void>((resolve) => {
    const finish = () => {
      window.setTimeout(() => {
        cleanup();
        resolve();
      }, 800);
    };
    window.addEventListener("afterprint", finish, { once: true });
    window.print();
    window.setTimeout(finish, 180_000);
  });
}
