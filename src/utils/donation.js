// Dados dos métodos de doação exibidos no modal "Buy me a coffee" (src/options/donationModal.js).
//
// `copyText` é o valor mostrado com um botão "copiar" em cada seção.
// `link` é opcional — quando presente, mostra também um botão "Abrir" (ex.: um link
// paypal.me/revolut.me que já pré-preenche valor). Deixe `null` quando não houver.
// `qrAsset` é o caminho, relativo à raiz da extensão, da imagem do QR code:
//   - termina em ".svg"  → gerado localmente a partir do `copyText` por
//     scripts/generate-donation-qrcodes.mjs (caso do PIX). Rode esse script depois de
//     editar o copyText correspondente, antes de commitar.
//   - qualquer outra extensão (ex. ".png") → imagem oficial exportada manualmente do
//     próprio app de pagamento (caso do MB WAY/Revolut e do PayPal). O script de geração
//     pula esses métodos de propósito — nunca sobrescreva a imagem oficial.
export const DONATION_METHODS = [
  {
    id: "pix",
    name: "PIX",
    copyText:
      "00020126660014BR.GOV.BCB.PIX0111099202954690229Gostei muito da sua extensão!52040000530398654041.005802BR5925Saulo Alexandre de Barros6009SAO PAULO62140510iBwtttNTEr6304BE5A",
    link: "https://nubank.com.br/cobrar/525f3/6a7c8dcb-ae41-452d-919c-418fbe5e3bcb",
    qrAsset: "assets/donation-qrcodes/pix.svg"
  },
  {
    id: "mbway",
    name: "MB WAY",
    copyText: "https://revolut.me/saulo_barros?currency=EUR&amount=100",
    link: "https://revolut.me/saulo_barros?currency=EUR&amount=100",
    qrAsset: "assets/donation-qrcodes/mbway.png"
  },
  {
    id: "paypal",
    name: "PayPal",
    copyText: "saulbpt@gmail.com",
    link: null,
    qrAsset: "assets/donation-qrcodes/paypal.png"
  }
];

export function getDonationMethodById(id) {
  return DONATION_METHODS.find((method) => method.id === id) ?? null;
}
