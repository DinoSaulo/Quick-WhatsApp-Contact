import { PHONE_FORMAT_RULES_BY_DDI } from "./phoneFormats.js";

export function sanitizePhoneNumber(value = "") {
  return String(value).replace(/[^\d+]/g, "");
}

export function normalizeSelectedNumber(value = "") {
  const sanitized = sanitizePhoneNumber(value).trim();

  if (!sanitized) {
    return "";
  }

  if (sanitized.startsWith("+")) {
    return `+${sanitized.slice(1).replace(/\+/g, "")}`;
  }

  return sanitized.replace(/\+/g, "");
}

export function hasCountryCode(value = "") {
  return normalizeSelectedNumber(value).startsWith("+");
}

export function isLikelyPhoneText(value = "", minimumDigits = 8, maximumDigits = 15) {
  const rawValue = String(value || "").trim();
  if (!/^\+?[\d\s().-]+$/.test(rawValue)) {
    return false;
  }
  const digitCount = rawValue.replace(/\D/g, "").length;
  return digitCount >= minimumDigits && digitCount <= maximumDigits;
}

function normalizeDialCode(dialCode = "") {
  return String(dialCode).replace(/\D/g, "");
}

function formatMaskToRegex(formatMask) {
  const normalizedMask = String(formatMask).replace(/[^X0-9]/g, "");
  const regexSource = normalizedMask.replace(/X/g, "\\d");
  // regexSource comes only from the static PHONE_FORMAT_RULES_BY_DDI table, stripped to [X0-9] — never user/storage input, so no regex-injection or ReDoS surface.
  // eslint-disable-next-line security/detect-non-literal-regexp
  return new RegExp(`^${regexSource}$`);
}

export function getExpectedFormatsForDdi(dialCode = "") {
  const normalizedDialCode = normalizeDialCode(dialCode);
  return PHONE_FORMAT_RULES_BY_DDI[normalizedDialCode] ?? [];
}

export function isLocalNumberValidForDdi(localNumber = "", dialCode = "") {
  const expectedFormats = getExpectedFormatsForDdi(dialCode);
  if (!expectedFormats.length) {
    return true;
  }

  const localDigits = String(localNumber).replace(/\D/g, "");
  return expectedFormats.some((formatMask) => formatMaskToRegex(formatMask).test(localDigits));
}

export function isValidPhoneForSend(phoneNumber, minimumDigits = 8, maximumDigits = 15) {
  const normalizedNumber = normalizeSelectedNumber(phoneNumber).replace(/^\+/, "");
  return (
    /^\d+$/.test(normalizedNumber) &&
    normalizedNumber.length >= minimumDigits &&
    normalizedNumber.length <= maximumDigits
  );
}

export function joinCountryCodeAndNumber(countryDialCode, phoneNumber) {
  const dialCode = String(countryDialCode).replace(/\D/g, "");
  const normalizedNumber = normalizeSelectedNumber(phoneNumber).replace(/^\+/, "");

  if (!normalizedNumber) {
    return "";
  }

  return `${dialCode}${normalizedNumber}`;
}

export function applyPhoneMask(rawValue, mask) {
  if (!mask) return rawValue;
  const digits = String(rawValue).replace(/\D/g, "");
  const maxDigits = (mask.match(/\S/g) || []).length;
  const limited = digits.slice(0, maxDigits);
  if (!limited) return "";
  let result = "";
  let di = 0;
  for (let i = 0; i < mask.length && di < limited.length; i++) {
    result += mask[i] === " " ? " " : limited[di++];
  }
  return result.trimEnd();
}

export function getPhoneMaskPlaceholder(mask) {
  if (!mask) return "";
  return mask.replace(/\S/g, "_");
}

export function buildWhatsAppUrl(phoneNumber, message = "") {
  if (!isLikelyPhoneText(phoneNumber)) {
    return "";
  }
  const normalizedNumber = normalizeSelectedNumber(phoneNumber).replace(/^\+/, "");
  if (!isValidPhoneForSend(normalizedNumber)) {
    return "";
  }

  const baseUrl = `https://wa.me/${normalizedNumber}`;
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    return baseUrl;
  }

  return `${baseUrl}?text=${encodeURIComponent(trimmedMessage)}`;
}
