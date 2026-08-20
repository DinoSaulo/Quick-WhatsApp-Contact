import { COUNTRIES } from "./countries.js";

// Most rules are the curated country mask reduced to its significant digit count.
// These overrides preserve alternate lengths and formats with meaningful literal digits.
const FORMAT_OVERRIDES_BY_DDI = {
  "1": ["XXX-XXXX"],
  "7": ["XXX-XX-XX"],
  "20": ["XXXXXXXX", "XXXXXXXXX"],
  "32": ["XXXXXXXX", "XXXXXXXXX"],
  "36": ["XXXXXXXX", "XXXXXXXXX"],
  "39": ["XXXXXXXXXX", "XXXXXXXXXXX"],
  "44": ["XXXXXXXXXX", "XXXXXXXXXXX"],
  "46": ["XXXXXXXX", "XXXXXXXXX"],
  "49": ["XXXXXXXXXXX", "XXXXXXXXXXXX"],
  "54": ["XXXXXXXXXX", "XXXXXXXXXXX"],
  "55": ["(XX) 9XXXX-XXXX", "(XX) XXXX-XXXX"],
  "61": ["XXXXXXXXX"],
  "62": ["XXXXXXXXXX", "XXXXXXXXXXX"],
  "64": ["XXXXXXXX", "XXXXXXXXXX"],
  "82": ["XXXXXXXXX", "XXXXXXXXXX"],
};

function formatFromPhoneMask(phoneMask) {
  const digitCount = String(phoneMask).replace(/\D/g, "").length;
  return "X".repeat(digitCount);
}

function deriveFormatRules(countries) {
  const rules = {};

  for (const country of countries) {
    const dialCode = country.dialCode.replace(/\D/g, "");
    const format = formatFromPhoneMask(country.phoneMask);
    const formats = rules[dialCode] ?? (rules[dialCode] = []);
    if (!formats.includes(format)) formats.push(format);
  }

  return rules;
}

export const PHONE_FORMAT_RULES_BY_DDI = {
  ...deriveFormatRules(COUNTRIES),
  ...FORMAT_OVERRIDES_BY_DDI,
};
