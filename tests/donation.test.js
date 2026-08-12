import { describe, expect, it } from "vitest";
import { DONATION_METHODS, getDonationMethodById } from "../src/utils/donation.js";

describe("donation methods config", () => {
  it("lists PIX, MB WAY and PayPal, in that order", () => {
    expect(DONATION_METHODS.map((method) => method.id)).toEqual(["pix", "mbway", "paypal"]);
  });

  it("keeps the exact PIX copia-e-cola payload untouched", () => {
    const pix = getDonationMethodById("pix");
    expect(pix.copyText).toBe(
      "00020126660014BR.GOV.BCB.PIX0111099202954690229Gostei muito da sua extensão!52040000530398654041.005802BR5925Saulo Alexandre de Barros6009SAO PAULO62140510iBwtttNTEr6304BE5A"
    );
    expect(pix.link).toBe("https://nubank.com.br/cobrar/525f3/6a7c8dcb-ae41-452d-919c-418fbe5e3bcb");
    expect(pix.qrAsset).toBe("assets/donation-qrcodes/pix.svg");
  });

  it("returns null for an unknown method id", () => {
    expect(getDonationMethodById("bitcoin")).toBeNull();
  });

  it("uses the official PayPal QR image (static, not generated) alongside the e-mail as copyable text", () => {
    const paypal = getDonationMethodById("paypal");
    expect(paypal.copyText).toBe("saulbpt@gmail.com");
    expect(paypal.link).toBeNull();
    expect(paypal.qrAsset).toBe("assets/donation-qrcodes/paypal.png");
  });

  it("uses the official Revolut QR image (static, not generated) for MB WAY, with a copyable and openable link", () => {
    const mbway = getDonationMethodById("mbway");
    expect(mbway.copyText).toBe("https://revolut.me/saulo_barros?currency=EUR&amount=100");
    expect(mbway.link).toBe("https://revolut.me/saulo_barros?currency=EUR&amount=100");
    expect(mbway.qrAsset).toBe("assets/donation-qrcodes/mbway.png");
  });
});
