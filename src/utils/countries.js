function flagFromIso2(iso2) {
  const normalized = String(iso2 || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return "🏳";
  }

  return String.fromCodePoint(
    normalized.charCodeAt(0) + 127397,
    normalized.charCodeAt(1) + 127397
  );
}

function country(code, iso2, name, dialCode, phoneMask) {
  return { code, iso2, name, dialCode, flag: flagFromIso2(iso2), phoneMask: phoneMask || "" };
}

export const COUNTRIES = [
  country("AF", "AF", "Afeganistao", "93", "99 999 9999"),
  country("ZA", "ZA", "Africa do Sul", "27", "99 999 9999"),
  country("AL", "AL", "Albania", "355", "99 999 9999"),
  country("DE", "DE", "Alemanha", "49", "999 99999999"),
  country("AD", "AD", "Andorra", "376", "999 999"),
  country("AO", "AO", "Angola", "244", "999 999 999"),
  country("AG", "AG", "Antigua e Barbuda", "1-268", "999 999 9999"),
  country("SA", "SA", "Arabia Saudita", "966", "99 999 9999"),
  country("DZ", "DZ", "Argelia", "213", "999 99 99 99"),
  country("AR", "AR", "Argentina", "54", "99 9999 9999"),
  country("AM", "AM", "Armenia", "374", "99 999 999"),
  country("AU", "AU", "Australia", "61", "9999 9999"),
  country("AT", "AT", "Austria", "43", "999 9999999"),
  country("AZ", "AZ", "Azerbaijao", "994", "99 999 99 99"),
  country("BS", "BS", "Bahamas", "1-242", "999 999 9999"),
  country("BH", "BH", "Bahrein", "973", "9999 9999"),
  country("BD", "BD", "Bangladesh", "880", "99999 99999"),
  country("BB", "BB", "Barbados", "1-246", "999 999 9999"),
  country("BE", "BE", "Belgica", "32", "999 99 99 99"),
  country("BZ", "BZ", "Belize", "501", "999 9999"),
  country("BJ", "BJ", "Benim", "229", "99 99 99 99"),
  country("BM", "BM", "Bermudas", "1-441", "999 999 9999"),
  country("BY", "BY", "Bielorrussia", "375", "99 999 99 99"),
  country("BO", "BO", "Bolivia", "591", "9 999 9999"),
  country("BA", "BA", "Bosnia e Herzegovina", "387", "99 999 999"),
  country("BW", "BW", "Botsuana", "267", "99 999 999"),
  country("BR", "BR", "Brasil", "55", "11 99999 9999"),
  country("BN", "BN", "Brunei", "673", "999 9999"),
  country("BG", "BG", "Bulgaria", "359", "999 999 999"),
  country("BF", "BF", "Burquina Faso", "226", "99 99 99 99"),
  country("BI", "BI", "Burundi", "257", "99 99 99 99"),
  country("BT", "BT", "Butao", "975", "17 999 999"),
  country("CV", "CV", "Cabo Verde", "238", "999 9999"),
  country("CM", "CM", "Camaroes", "237", "6 99 99 99 99"),
  country("KH", "KH", "Camboja", "855", "99 999 999"),
  country("CA", "CA", "Canada", "1", "999 999 9999"),
  country("QA", "QA", "Catar", "974", "9999 9999"),
  country("KZ", "KZ", "Cazaquistao", "7", "999 999 9999"),
  country("TD", "TD", "Chade", "235", "99 99 99 99"),
  country("CL", "CL", "Chile", "56", "9 9999 9999"),
  country("CN", "CN", "China", "86", "999 9999 9999"),
  country("CY", "CY", "Chipre", "357", "99 999999"),
  country("CO", "CO", "Colombia", "57", "999 999 9999"),
  country("KM", "KM", "Comores", "269", "999 99 99"),
  country("CG", "CG", "Congo-Brazzaville", "242", "999 999 999"),
  country("CD", "CD", "Congo-Kinshasa", "243", "999 999 999"),
  country("KP", "KP", "Coreia do Norte", "850", "999 999 999"),
  country("KR", "KR", "Coreia do Sul", "82", "99 9999 9999"),
  country("CI", "CI", "Costa do Marfim", "225", "99 99 99 99 99"),
  country("CR", "CR", "Costa Rica", "506", "9999 9999"),
  country("HR", "HR", "Croacia", "385", "99 999 9999"),
  country("CU", "CU", "Cuba", "53", "99 999999"),
  country("DK", "DK", "Dinamarca", "45", "99 99 99 99"),
  country("DJ", "DJ", "Djibuti", "253", "99 99 99 99"),
  country("DM", "DM", "Dominica", "1-767", "999 999 9999"),
  country("EG", "EG", "Egito", "20", "99 999 9999"),
  country("SV", "SV", "El Salvador", "503", "9999 9999"),
  country("AE", "AE", "Emirados Arabes Unidos", "971", "99 999 9999"),
  country("EC", "EC", "Equador", "593", "99 999 9999"),
  country("ER", "ER", "Eritreia", "291", "1 999 999"),
  country("SK", "SK", "Eslovaquia", "421", "999 999 999"),
  country("SI", "SI", "Eslovenia", "386", "99 999 999"),
  country("ES", "ES", "Espanha", "34", "999 999 999"),
  country("US", "US", "Estados Unidos", "1", "999 999 9999"),
  country("EE", "EE", "Estonia", "372", "9999 9999"),
  country("ET", "ET", "Etiopia", "251", "99 999 9999"),
  country("FJ", "FJ", "Fiji", "679", "999 9999"),
  country("PH", "PH", "Filipinas", "63", "999 999 9999"),
  country("FI", "FI", "Finlandia", "358", "99 999 9999"),
  country("FR", "FR", "Franca", "33", "9 99 99 99 99"),
  country("GA", "GA", "Gabao", "241", "99 99 99 99"),
  country("GM", "GM", "Gambia", "220", "999 9999"),
  country("GH", "GH", "Gana", "233", "99 999 9999"),
  country("GE", "GE", "Georgia", "995", "999 99 99 99"),
  country("GI", "GI", "Gibraltar", "350", "999 99999"),
  country("GD", "GD", "Granada", "1-473", "999 999 9999"),
  country("GR", "GR", "Grecia", "30", "999 999 9999"),
  country("GL", "GL", "Groenlandia", "299", "99 99 99"),
  country("GP", "GP", "Guadalupe", "590", "999 99 99 99"),
  country("GU", "GU", "Guam", "1-671", "999 999 9999"),
  country("GT", "GT", "Guatemala", "502", "9999 9999"),
  country("GY", "GY", "Guiana", "592", "999 9999"),
  country("GF", "GF", "Guiana Francesa", "594", "999 99 99 99"),
  country("GN", "GN", "Guine", "224", "999 99 99 99"),
  country("GQ", "GQ", "Guine Equatorial", "240", "999 999 999"),
  country("GW", "GW", "Guine-Bissau", "245", "999 9999"),
  country("HT", "HT", "Haiti", "509", "9999 9999"),
  country("HN", "HN", "Honduras", "504", "9999 9999"),
  country("HK", "HK", "Hong Kong", "852", "9999 9999"),
  country("HU", "HU", "Hungria", "36", "99 999 9999"),
  country("YE", "YE", "Iemen", "967", "999 999 999"),
  country("KY", "KY", "Ilhas Cayman", "1-345", "999 999 9999"),
  country("CK", "CK", "Ilhas Cook", "682", "99 999"),
  country("FO", "FO", "Ilhas Faroe", "298", "999 999"),
  country("FK", "FK", "Ilhas Malvinas", "500", "99999"),
  country("MH", "MH", "Ilhas Marshall", "692", "999 9999"),
  country("SB", "SB", "Ilhas Salomao", "677", "999 9999"),
  country("IN", "IN", "India", "91", "99999 99999"),
  country("ID", "ID", "Indonesia", "62", "999 9999 9999"),
  country("IR", "IR", "Ira", "98", "999 999 9999"),
  country("IQ", "IQ", "Iraque", "964", "999 999 9999"),
  country("IE", "IE", "Irlanda", "353", "99 999 9999"),
  country("IS", "IS", "Islandia", "354", "999 9999"),
  country("IL", "IL", "Israel", "972", "99 999 9999"),
  country("IT", "IT", "Italia", "39", "999 999 9999"),
  country("JM", "JM", "Jamaica", "1-876", "999 999 9999"),
  country("JP", "JP", "Japao", "81", "99 9999 9999"),
  country("JO", "JO", "Jordania", "962", "99 999 9999"),
  country("KI", "KI", "Kiribati", "686", "9999 9999"),
  country("KW", "KW", "Kuwait", "965", "9999 9999"),
  country("LA", "LA", "Laos", "856", "99 999 9999"),
  country("LS", "LS", "Lesoto", "266", "9999 9999"),
  country("LV", "LV", "Letonia", "371", "99 999 999"),
  country("LB", "LB", "Libano", "961", "99 999 999"),
  country("LR", "LR", "Liberia", "231", "99 999 999"),
  country("LY", "LY", "Libia", "218", "99 999 9999"),
  country("LI", "LI", "Liechtenstein", "423", "999 9999"),
  country("LT", "LT", "Lituania", "370", "999 99999"),
  country("LU", "LU", "Luxemburgo", "352", "999 999 999"),
  country("MO", "MO", "Macau", "853", "9999 9999"),
  country("MK", "MK", "Macedonia do Norte", "389", "99 999 999"),
  country("MG", "MG", "Madagascar", "261", "99 99 999 99"),
  country("MY", "MY", "Malasia", "60", "99 9999 9999"),
  country("MW", "MW", "Malaui", "265", "9999 9999"),
  country("MV", "MV", "Maldivas", "960", "999 9999"),
  country("ML", "ML", "Mali", "223", "99 99 99 99"),
  country("MT", "MT", "Malta", "356", "9999 9999"),
  country("MA", "MA", "Marrocos", "212", "999 999 999"),
  country("MQ", "MQ", "Martinica", "596", "999 99 99 99"),
  country("MU", "MU", "Mauricia", "230", "9999 9999"),
  country("MR", "MR", "Mauritania", "222", "99 99 99 99"),
  country("MX", "MX", "Mexico", "52", "999 999 9999"),
  country("MM", "MM", "Mianmar", "95", "99 999 999"),
  country("FM", "FM", "Micronesia", "691", "999 9999"),
  country("MZ", "MZ", "Mocambique", "258", "99 999 9999"),
  country("MD", "MD", "Moldavia", "373", "99 999 999"),
  country("MC", "MC", "Monaco", "377", "99 99 99 99"),
  country("MN", "MN", "Mongolia", "976", "99 99 9999"),
  country("ME", "ME", "Montenegro", "382", "99 999 999"),
  country("NA", "NA", "Namibia", "264", "99 999 9999"),
  country("NR", "NR", "Nauru", "674", "444 4444"),
  country("NP", "NP", "Nepal", "977", "99 999 99999"),
  country("NI", "NI", "Nicaragua", "505", "9999 9999"),
  country("NE", "NE", "Niger", "227", "99 99 99 99"),
  country("NG", "NG", "Nigeria", "234", "999 999 9999"),
  country("NU", "NU", "Niue", "683", "9999"),
  country("NO", "NO", "Noruega", "47", "99 99 99 99"),
  country("NC", "NC", "Nova Caledonia", "687", "99 99 99"),
  country("NZ", "NZ", "Nova Zelandia", "64", "99 999 999"),
  country("OM", "OM", "Oma", "968", "9999 9999"),
  country("NL", "NL", "Países Baixos", "31", "9 99 99 99 99"),
  country("PW", "PW", "Palau", "680", "999 9999"),
  country("PA", "PA", "Panama", "507", "9999 9999"),
  country("PG", "PG", "Papua-Nova Guine", "675", "999 99999"),
  country("PK", "PK", "Paquistao", "92", "999 9999999"),
  country("PY", "PY", "Paraguai", "595", "999 999999"),
  country("PE", "PE", "Peru", "51", "999 999 999"),
  country("PF", "PF", "Polinesia Francesa", "689", "99 99 99 99"),
  country("PL", "PL", "Polonia", "48", "999 999 999"),
  country("PR-787", "PR", "Porto Rico", "1-787", "999 999 9999"),
  country("PR-939", "PR", "Porto Rico", "1-939", "999 999 9999"),
  country("PT", "PT", "Portugal", "351", "999 999 999"),
  country("KE", "KE", "Quenia", "254", "999 999999"),
  country("KG", "KG", "Quirguistao", "996", "999 999 999"),
  country("GB", "GB", "Reino Unido", "44", "9999 999 9999"),
  country("CF", "CF", "Republica Centro-Africana", "236", "99 99 99 99"),
  country("CZ", "CZ", "Republica Checa", "420", "999 999 999"),
  country("DO-809", "DO", "Republica Dominicana", "1-809", "999 999 9999"),
  country("DO-829", "DO", "Republica Dominicana", "1-829", "999 999 9999"),
  country("DO-849", "DO", "Republica Dominicana", "1-849", "999 999 9999"),
  country("RE", "RE", "Reuniao", "262", "999 99 99 99"),
  country("RO", "RO", "Romenia", "40", "9999 999 999"),
  country("RW", "RW", "Ruanda", "250", "999 999 999"),
  country("RU", "RU", "Russia", "7", "999 999 99 99"),
  country("WS", "WS", "Samoa", "685", "999 9999"),
  country("AS", "AS", "Samoa Americana", "1-684", "999 999 9999"),
  country("LC", "LC", "Santa Lucia", "1-758", "999 999 9999"),
  country("KN", "KN", "Sao Cristovao e Nevis", "1-869", "999 999 9999"),
  country("SM", "SM", "Sao Marinho", "378", "9999 999999"),
  country("ST", "ST", "Sao Tome e Principe", "239", "999 9999"),
  country("VC", "VC", "Sao Vicente e Granadinas", "1-784", "999 999 9999"),
  country("SN", "SN", "Senegal", "221", "99 999 99 99"),
  country("SL", "SL", "Serra Leoa", "232", "99 999999"),
  country("RS", "RS", "Servia", "381", "99 999 9999"),
  country("SC", "SC", "Seychelles", "248", "999 9999"),
  country("SG", "SG", "Singapura", "65", "9999 9999"),
  country("SY", "SY", "Siria", "963", "99 999 9999"),
  country("SO", "SO", "Somalia", "252", "99 999 999"),
  country("LK", "LK", "Sri Lanka", "94", "99 999 9999"),
  country("SD", "SD", "Sudao", "249", "99 999 9999"),
  country("SS", "SS", "Sudao do Sul", "211", "99 999 9999"),
  country("SE", "SE", "Suecia", "46", "99 999 9999"),
  country("CH", "CH", "Suica", "41", "99 999 99 99"),
  country("SR", "SR", "Suriname", "597", "999 9999"),
  country("TH", "TH", "Tailandia", "66", "99 999 9999"),
  country("TW", "TW", "Taiwan", "886", "9 9999 9999"),
  country("TJ", "TJ", "Tajiquistao", "992", "99 999 9999"),
  country("TZ", "TZ", "Tanzania", "255", "99 999 9999"),
  country("TL", "TL", "Timor-Leste", "670", "999 9999"),
  country("TG", "TG", "Togo", "228", "99 99 99 99"),
  country("TO", "TO", "Tonga", "676", "999 9999"),
  country("TT", "TT", "Trindade e Tobago", "1-868", "999 999 9999"),
  country("TN", "TN", "Tunisia", "216", "99 999 999"),
  country("TM", "TM", "Turquemenistao", "993", "99 999 999"),
  country("TR", "TR", "Turquia", "90", "999 999 9999"),
  country("TV", "TV", "Tuvalu", "688", "999 9999"),
  country("UA", "UA", "Ucrania", "380", "99 999 9999"),
  country("UG", "UG", "Uganda", "256", "999 999 999"),
  country("UY", "UY", "Uruguai", "598", "9 999 9999"),
  country("UZ", "UZ", "Uzbequistao", "998", "99 999 9999"),
  country("VU", "VU", "Vanuatu", "678", "999 9999"),
  country("VA-3906", "VA", "Vaticano", "39-06", "06 698 99999"),
  country("VE", "VE", "Venezuela", "58", "999 999 9999"),
  country("VN", "VN", "Vietna", "84", "999 999 9999"),
  country("ZM", "ZM", "Zambia", "260", "99 999 9999"),
  country("ZW", "ZW", "Zimbabue", "263", "99 999 9999")
];

export const DEFAULT_COUNTRY_CODE = "US";

export function getCountryByCode(code) {
  return COUNTRIES.find((countryItem) => countryItem.code === code) ?? COUNTRIES[0];
}

export function getCountryByIso2(iso2) {
  const normalizedIso2 = String(iso2 || "").toUpperCase();
  return COUNTRIES.find((countryItem) => countryItem.iso2 === normalizedIso2) ?? null;
}

export function getDefaultCountryCodeForLanguage(language = "en-US") {
  const normalized = String(language || "").toLowerCase();
  if (normalized === "pt-br") {
    return "BR";
  }
  if (normalized === "es-es") {
    return "ES";
  }
  return "US";
}

export function getTwemojiAssetName(emoji) {
  const codePoints = Array.from(String(emoji || ""))
    .map((character) => character.codePointAt(0))
    .filter((codePoint) => codePoint !== 0xfe0f)
    .map((codePoint) => codePoint.toString(16));
  return codePoints.length ? `${codePoints.join("-")}.svg` : "";
}

export function renderEmojiHtml(emoji) {
  const assetName = getTwemojiAssetName(emoji);
  if (!/^[a-f0-9-]+\.svg$/.test(assetName)) {
    return "";
  }
  const assetPath = `assets/twemoji/${assetName}`;
  const runtime = globalThis.chrome?.runtime;
  const assetUrl = typeof runtime?.getURL === "function"
    ? runtime.getURL(assetPath)
    : `../../${assetPath}`;
  return `<img class="country-picker__flag-img" src="${assetUrl}" alt="" aria-hidden="true" draggable="false" />`;
}

export function renderCountryFlagHtml(country) {
  const flagEmoji = flagFromIso2(country?.iso2);
  return renderEmojiHtml(flagEmoji);
}
