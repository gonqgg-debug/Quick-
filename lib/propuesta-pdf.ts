const PDF_NAME = "Quick-Mini-Market-Propuesta-Comercial.pdf";
const PAGE_WIDTH = 1920;
const PAGE_HEIGHT = 1080;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function backgroundOf(slide: HTMLElement): string {
  const color = window.getComputedStyle(slide).backgroundColor;
  return color && color !== "rgba(0, 0, 0, 0)" ? color : "#ffffff";
}

export async function downloadPropuestaPdf(): Promise<void> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const chrome = document.querySelector<HTMLElement>(".propuesta-chrome");
  const slides = Array.from(document.querySelectorAll<HTMLElement>(".propuesta-slide"));
  if (slides.length === 0) {
    throw new Error("No se encontraron las diapositivas.");
  }

  document.documentElement.classList.add("is-exporting");
  chrome?.classList.add("is-hidden");

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [PAGE_WIDTH, PAGE_HEIGHT],
    hotfixes: ["px_scaling"],
    compress: true,
  });

  try {
    for (let index = 0; index < slides.length; index += 1) {
      const slide = slides[index];
      slide.scrollIntoView({ behavior: "instant", block: "start" });
      await delay(slide.querySelector("[data-map]") ? 700 : 180);

      const canvas = await html2canvas(slide, {
        scale: 2,
        useCORS: true,
        backgroundColor: backgroundOf(slide),
        width: slide.offsetWidth,
        height: slide.offsetHeight,
        windowWidth: slide.offsetWidth,
        windowHeight: slide.offsetHeight,
        logging: false,
      });

      const image = canvas.toDataURL("image/jpeg", 0.92);
      if (index > 0) {
        pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], "landscape");
      }
      pdf.addImage(image, "JPEG", 0, 0, PAGE_WIDTH, PAGE_HEIGHT, undefined, "FAST");
    }

    pdf.save(PDF_NAME);
  } finally {
    document.documentElement.classList.remove("is-exporting");
    chrome?.classList.remove("is-hidden");
  }
}
