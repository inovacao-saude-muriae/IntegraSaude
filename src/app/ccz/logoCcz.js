// ═══════════════════════════════════════════════════════════════════════════
// LOGOMARCA INSTITUCIONAL DO CCZ
//
// A logomarca do projeto (public/img/logo/logo-ccz.png) tem 709 × 709 px e,
// inserida crua no jsPDF, gera ~2 MB por documento. Aqui ela é reduzida para
// a resolução realmente impressa (mantendo a proporção e a transparência) e
// convertida para uma data URL usada por todos os PDFs do CCZ.
//
// Nenhuma imagem é recriada: é a mesma logomarca oficial, apenas otimizada.
// ═══════════════════════════════════════════════════════════════════════════

export const LOGO_CCZ = "/img/logo/logo-ccz.png";

// Lado da imagem reduzida, em pixels (impresso a ~20 mm ⇒ ~150 dpi).
const LADO_PX = 160;

let cache = null;
let carregando = null;

const redimensionar = (img) =>
  new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = LADO_PX;
      canvas.height = LADO_PX;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, LADO_PX, LADO_PX);
      resolve(canvas.toDataURL("image/png"));
    } catch {
      resolve(null);
    }
  });

/** Data URL otimizada da logomarca (ou null se não for possível carregar). */
export function obterLogoCcz() {
  if (cache) return Promise.resolve(cache);
  if (carregando) return carregando;

  carregando = new Promise((resolve) => {
    if (typeof window === "undefined" || typeof Image === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = async () => {
      const dataUrl = await redimensionar(img);
      cache = dataUrl;
      resolve(dataUrl);
    };
    img.onerror = () => resolve(null);
    img.src = LOGO_CCZ;
  });

  return carregando;
}
