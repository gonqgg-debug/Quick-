const PDF_TITLE = "Quick-Mini-Market-Propuesta-Comercial";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function waitForImages(root: ParentNode = document): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Native print-to-PDF. Chrome/Safari/Edge render the slides with the same
 * engine as the screen (photos, CSS, Leaflet). html2canvas re-paints the DOM
 * in JS and drops object-fit, gradients, map pins and web fonts.
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

  const mapSlide = document.getElementById("slide-8");
  mapSlide?.scrollIntoView({ behavior: "instant", block: "start" });
  window.dispatchEvent(new Event("propuesta:prepare-print"));

  await document.fonts.ready;
  await waitForImages();
  await nextPaint();
  await delay(mapSlide ? 700 : 150);

  await new Promise<void>((resolve) => {
    const finish = () => {
      cleanup();
      resolve();
    };
    window.addEventListener("afterprint", finish, { once: true });
    window.print();
    window.setTimeout(finish, 180_000);
  });
}
