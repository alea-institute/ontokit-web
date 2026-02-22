import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

const SUPPORTED_LOCALES = ["en"] as const;
const DEFAULT_LOCALE = "en";
const LOCALE_COOKIE = "NEXT_LOCALE";

function parseAcceptLanguage(header: string): string | null {
  const languages = header
    .split(",")
    .map((part) => {
      const [lang, quality] = part.trim().split(";q=");
      return {
        lang: lang.trim().split("-")[0].toLowerCase(),
        quality: quality ? parseFloat(quality) : 1.0,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { lang } of languages) {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(lang)) {
      return lang;
    }
  }
  return null;
}

export default getRequestConfig(async () => {
  // 1. Check cookie for persisted preference
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && (SUPPORTED_LOCALES as readonly string[]).includes(cookieLocale)) {
    return {
      locale: cookieLocale,
      messages: (await import(`@/messages/${cookieLocale}.json`)).default,
    };
  }

  // 2. Check Accept-Language header
  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  if (acceptLanguage) {
    const detected = parseAcceptLanguage(acceptLanguage);
    if (detected) {
      return {
        locale: detected,
        messages: (await import(`@/messages/${detected}.json`)).default,
      };
    }
  }

  // 3. Fall back to default
  return {
    locale: DEFAULT_LOCALE,
    messages: (await import(`@/messages/${DEFAULT_LOCALE}.json`)).default,
  };
});
