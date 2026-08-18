// Gera os SVGs de QR code do modal de doação a partir de src/utils/donation.js.
// Diferente dos ícones de bandeira (copiados no build), ficam versionados em assets/ — rode manualmente quando `copyText` mudar.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import QRCode from "qrcode";
import { DONATION_METHODS } from "../src/utils/donation.js";

const projectRoot = resolve(import.meta.dirname, "..");
const outputDir = resolve(projectRoot, "assets", "donation-qrcodes");
mkdirSync(outputDir, { recursive: true });

let generated = 0;
let skipped = 0;

for (const method of DONATION_METHODS) {
  if (!method.qrAsset.endsWith(".svg")) {
    // qrAsset aponta pra uma imagem estática fornecida manualmente (ex.: QR oficial
    // exportado de um app de pagamento) — este script só gera SVGs a partir de copyText.
    console.warn(`Pulando "${method.id}": qrAsset (${method.qrAsset}) não é gerado por este script.`);
    skipped++;
    continue;
  }

  if (!method.copyText) {
    console.warn(`Pulando "${method.id}": copyText vazio (preencha src/utils/donation.js primeiro).`);
    skipped++;
    continue;
  }

  const svg = await QRCode.toString(method.copyText, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1
  });

  writeFileSync(resolve(outputDir, `${method.id}.svg`), svg, "utf8");
  generated++;
}

console.log(`QR codes gerados: ${generated}. Pulados (sem copyText ainda): ${skipped}.`);
