import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  // For now, default to English
  // TODO: Implement locale detection from headers/cookies
  const locale = "en";

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
