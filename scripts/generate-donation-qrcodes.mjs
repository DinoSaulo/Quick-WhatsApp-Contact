// Gera os SVGs de QR code do modal de doação a partir de src/utils/donation.js.
// Diferente dos ícones de bandeira (copiados no build), ficam versionados em assets/ — rode manualmente quando `copyText` mudar.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { DONATION_METHODS } from "../src/utils/donation.js";

const projectRoot = resolve(import.meta.dirname, "..");
const DEFAULT_FILE_SYSTEM = Object.freeze({ mkdirSync, writeFileSync });
const defaultToSvg = (copyText) =>
  QRCode.toString(copyText, { type: "svg", errorCorrectionLevel: "M", margin: 1 });

export async function generateDonationQrCodes({
  root = projectRoot,
  methods = DONATION_METHODS,
  fileSystem = DEFAULT_FILE_SYSTEM,
  toSvg = defaultToSvg,
  logger = console
} = {}) {
  const outputDir = resolve(root, "assets", "donation-qrcodes");
  fileSystem.mkdirSync(outputDir, { recursive: true });

  let generated = 0;
  let skipped = 0;

  for (const method of methods) {
    if (!method.qrAsset.endsWith(".svg")) {
      // qrAsset aponta pra uma imagem estática fornecida manualmente (ex.: QR oficial
      // exportado de um app de pagamento) — este script só gera SVGs a partir de copyText.
      logger.warn(`Pulando "${method.id}": qrAsset (${method.qrAsset}) não é gerado por este script.`);
      skipped++;
      continue;
    }

    if (!method.copyText) {
      logger.warn(`Pulando "${method.id}": copyText vazio (preencha src/utils/donation.js primeiro).`);
      skipped++;
      continue;
    }

    const svg = await toSvg(method.copyText);
    fileSystem.writeFileSync(resolve(outputDir, `${method.id}.svg`), svg, "utf8");
    generated++;
  }

  return { generated, skipped };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { generated, skipped } = await generateDonationQrCodes();
  console.log(`QR codes gerados: ${generated}. Pulados (sem copyText ainda): ${skipped}.`);
}
