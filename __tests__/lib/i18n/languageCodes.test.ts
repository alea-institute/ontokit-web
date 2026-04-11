import { describe, expect, it } from "vitest";
import {
  FREQUENT_LANGUAGES,
  ALL_LANGUAGES,
  findLanguageByCode,
} from "@/lib/i18n/languageCodes";

describe("languageCodes", () => {
  it("exports a non-empty FREQUENT_LANGUAGES array", () => {
    expect(FREQUENT_LANGUAGES.length).toBeGreaterThan(0);
  });

  it("ALL_LANGUAGES includes all frequent languages", () => {
    const allCodes = new Set(ALL_LANGUAGES.map((l) => l.code));
    for (const lang of FREQUENT_LANGUAGES) {
      expect(allCodes.has(lang.code)).toBe(true);
    }
  });

  it("ALL_LANGUAGES has no duplicate codes (case-insensitive)", () => {
    const codes = ALL_LANGUAGES.map((l) => l.code.toLowerCase());
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every entry has code, name, and nativeName", () => {
    for (const lang of ALL_LANGUAGES) {
      expect(lang.code).toBeTruthy();
      expect(lang.name).toBeTruthy();
      expect(lang.nativeName).toBeTruthy();
    }
  });

  describe("findLanguageByCode", () => {
    it("finds 'en' case-insensitively", () => {
      expect(findLanguageByCode("en")?.name).toBe("English");
      expect(findLanguageByCode("EN")?.name).toBe("English");
    });

    it("finds regional variants like 'pt-BR'", () => {
      expect(findLanguageByCode("pt-BR")?.name).toBe("Portuguese (Brazil)");
    });

    it("returns undefined for unknown codes", () => {
      expect(findLanguageByCode("xyz")).toBeUndefined();
    });
  });
});
