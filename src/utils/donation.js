// Dados dos métodos de doação exibidos no modal "Buy me a coffee" (donationModal.js). `link` é opcional
// (botão "Abrir"). `qrAsset` termina em ".svg" quando gerado por generate-donation-qrcodes.mjs (rode-o após editar copyText), senão é imagem oficial manual — nunca sobrescreva.
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
