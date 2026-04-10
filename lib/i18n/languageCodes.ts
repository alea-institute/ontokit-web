/**
 * Curated list of BCP 47 language codes for the language picker.
 *
 * Codes are split into a "frequently used" group (shown first in the picker)
 * and a comprehensive list that covers ~100 codes including major regional
 * variants.
 */

export interface LanguageOption {
  /** BCP 47 language tag, e.g. "en", "pt-BR" */
  code: string;
  /** English name */
  name: string;
  /** Name in the language itself */
  nativeName: string;
}

/**
 * Languages shown at the top of the picker for quick access.
 * These are the most common ontology-authoring languages.
 */
export const FREQUENT_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "fr", name: "French", nativeName: "Fran\u00e7ais" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "es", name: "Spanish", nativeName: "Espa\u00f1ol" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "pt", name: "Portuguese", nativeName: "Portugu\u00eas" },
  { code: "la", name: "Latin", nativeName: "Latina" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "ru", name: "Russian", nativeName: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439" },
  { code: "zh", name: "Chinese", nativeName: "\u4e2d\u6587" },
  { code: "ja", name: "Japanese", nativeName: "\u65e5\u672c\u8a9e" },
  { code: "ko", name: "Korean", nativeName: "\ud55c\uad6d\uc5b4" },
  { code: "ar", name: "Arabic", nativeName: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" },
  { code: "pl", name: "Polish", nativeName: "Polski" },
];

const FREQUENT_CODES = new Set(FREQUENT_LANGUAGES.map((l) => l.code));

/**
 * Full list of supported languages (alphabetical by English name).
 * Includes regional variants like en-GB, pt-BR, zh-CN, etc.
 */
const ADDITIONAL_LANGUAGES: LanguageOption[] = [
  { code: "af", name: "Afrikaans", nativeName: "Afrikaans" },
  { code: "sq", name: "Albanian", nativeName: "Shqip" },
  { code: "am", name: "Amharic", nativeName: "\u12a0\u121b\u122d\u129b" },
  { code: "hy", name: "Armenian", nativeName: "\u0540\u0561\u0575\u0565\u0580\u0565\u0576" },
  { code: "az", name: "Azerbaijani", nativeName: "Az\u0259rbaycan" },
  { code: "eu", name: "Basque", nativeName: "Euskara" },
  { code: "be", name: "Belarusian", nativeName: "\u0411\u0435\u043b\u0430\u0440\u0443\u0441\u043a\u0430\u044f" },
  { code: "bn", name: "Bengali", nativeName: "\u09ac\u09be\u0982\u09b2\u09be" },
  { code: "bs", name: "Bosnian", nativeName: "Bosanski" },
  { code: "bg", name: "Bulgarian", nativeName: "\u0411\u044a\u043b\u0433\u0430\u0440\u0441\u043a\u0438" },
  { code: "my", name: "Burmese", nativeName: "\u1019\u103c\u1014\u103a\u1019\u102c" },
  { code: "ca", name: "Catalan", nativeName: "Catal\u00e0" },
  { code: "zh-CN", name: "Chinese (Simplified)", nativeName: "\u7b80\u4f53\u4e2d\u6587" },
  { code: "zh-TW", name: "Chinese (Traditional)", nativeName: "\u7e41\u9ad4\u4e2d\u6587" },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski" },
  { code: "cs", name: "Czech", nativeName: "\u010ce\u0161tina" },
  { code: "da", name: "Danish", nativeName: "Dansk" },
  { code: "en-AU", name: "English (Australia)", nativeName: "English (Australia)" },
  { code: "en-CA", name: "English (Canada)", nativeName: "English (Canada)" },
  { code: "en-GB", name: "English (UK)", nativeName: "English (UK)" },
  { code: "en-US", name: "English (US)", nativeName: "English (US)" },
  { code: "et", name: "Estonian", nativeName: "Eesti" },
  { code: "fi", name: "Finnish", nativeName: "Suomi" },
  { code: "fr-CA", name: "French (Canada)", nativeName: "Fran\u00e7ais (Canada)" },
  { code: "fr-FR", name: "French (France)", nativeName: "Fran\u00e7ais (France)" },
  { code: "gl", name: "Galician", nativeName: "Galego" },
  { code: "ka", name: "Georgian", nativeName: "\u10e5\u10d0\u10e0\u10d7\u10e3\u10da\u10d8" },
  { code: "de-AT", name: "German (Austria)", nativeName: "Deutsch (\u00d6sterreich)" },
  { code: "de-CH", name: "German (Switzerland)", nativeName: "Deutsch (Schweiz)" },
  { code: "el", name: "Greek", nativeName: "\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac" },
  { code: "gu", name: "Gujarati", nativeName: "\u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0" },
  { code: "ha", name: "Hausa", nativeName: "Hausa" },
  { code: "he", name: "Hebrew", nativeName: "\u05e2\u05d1\u05e8\u05d9\u05ea" },
  { code: "hi", name: "Hindi", nativeName: "\u0939\u093f\u0928\u094d\u0926\u0940" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar" },
  { code: "is", name: "Icelandic", nativeName: "\u00cdslenska" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "ga", name: "Irish", nativeName: "Gaeilge" },
  { code: "kn", name: "Kannada", nativeName: "\u0c95\u0ca8\u0ccd\u0ca8\u0ca1" },
  { code: "kk", name: "Kazakh", nativeName: "\u049a\u0430\u0437\u0430\u049b" },
  { code: "km", name: "Khmer", nativeName: "\u1781\u17d2\u1798\u17c2\u179a" },
  { code: "lv", name: "Latvian", nativeName: "Latvie\u0161u" },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvi\u0173" },
  { code: "mk", name: "Macedonian", nativeName: "\u041c\u0430\u043a\u0435\u0434\u043e\u043d\u0441\u043a\u0438" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu" },
  { code: "ml", name: "Malayalam", nativeName: "\u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02" },
  { code: "mt", name: "Maltese", nativeName: "Malti" },
  { code: "mr", name: "Marathi", nativeName: "\u092e\u0930\u093e\u0920\u0940" },
  { code: "mn", name: "Mongolian", nativeName: "\u041c\u043e\u043d\u0433\u043e\u043b" },
  { code: "ne", name: "Nepali", nativeName: "\u0928\u0947\u092a\u093e\u0932\u0940" },
  { code: "nb", name: "Norwegian Bokm\u00e5l", nativeName: "Norsk bokm\u00e5l" },
  { code: "nn", name: "Norwegian Nynorsk", nativeName: "Norsk nynorsk" },
  { code: "fa", name: "Persian", nativeName: "\u0641\u0627\u0631\u0633\u06cc" },
  { code: "pt-BR", name: "Portuguese (Brazil)", nativeName: "Portugu\u00eas (Brasil)" },
  { code: "pt-PT", name: "Portuguese (Portugal)", nativeName: "Portugu\u00eas (Portugal)" },
  { code: "pa", name: "Punjabi", nativeName: "\u0a2a\u0a70\u0a1c\u0a3e\u0a2c\u0a40" },
  { code: "ro", name: "Romanian", nativeName: "Rom\u00e2n\u0103" },
  { code: "gd", name: "Scottish Gaelic", nativeName: "G\u00e0idhlig" },
  { code: "sr", name: "Serbian", nativeName: "\u0421\u0440\u043f\u0441\u043a\u0438" },
  { code: "si", name: "Sinhala", nativeName: "\u0dc3\u0dd2\u0d82\u0dc4\u0dbd" },
  { code: "sk", name: "Slovak", nativeName: "Sloven\u010dina" },
  { code: "sl", name: "Slovenian", nativeName: "Sloven\u0161\u010dina" },
  { code: "es-MX", name: "Spanish (Mexico)", nativeName: "Espa\u00f1ol (M\u00e9xico)" },
  { code: "es-ES", name: "Spanish (Spain)", nativeName: "Espa\u00f1ol (Espa\u00f1a)" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili" },
  { code: "sv", name: "Swedish", nativeName: "Svenska" },
  { code: "tl", name: "Tagalog", nativeName: "Tagalog" },
  { code: "ta", name: "Tamil", nativeName: "\u0ba4\u0bae\u0bbf\u0bb4\u0bcd" },
  { code: "te", name: "Telugu", nativeName: "\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41" },
  { code: "th", name: "Thai", nativeName: "\u0e44\u0e17\u0e22" },
  { code: "tr", name: "Turkish", nativeName: "T\u00fcrk\u00e7e" },
  { code: "uk", name: "Ukrainian", nativeName: "\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430" },
  { code: "ur", name: "Urdu", nativeName: "\u0627\u0631\u062f\u0648" },
  { code: "uz", name: "Uzbek", nativeName: "O\u02bbzbek" },
  { code: "vi", name: "Vietnamese", nativeName: "Ti\u1ebfng Vi\u1ec7t" },
  { code: "cy", name: "Welsh", nativeName: "Cymraeg" },
  { code: "yi", name: "Yiddish", nativeName: "\u05d9\u05d9\u05d3\u05d9\u05e9" },
  { code: "zu", name: "Zulu", nativeName: "isiZulu" },
];

/** All available languages: frequent ones first, then the rest alphabetically. */
export const ALL_LANGUAGES: LanguageOption[] = [
  ...FREQUENT_LANGUAGES,
  ...ADDITIONAL_LANGUAGES.filter((l) => !FREQUENT_CODES.has(l.code)),
];

/** Look up a language option by its BCP 47 code (case-insensitive). */
export function findLanguageByCode(code: string): LanguageOption | undefined {
  const lower = code.toLowerCase();
  return ALL_LANGUAGES.find((l) => l.code.toLowerCase() === lower);
}
