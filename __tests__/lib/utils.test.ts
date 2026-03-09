import { describe, expect, it } from "vitest";
import {
  getLocalName,
  getNamespace,
  getPreferredLabel,
  formatDate,
  formatDateTime,
  debounce,
  generateId,
} from "@/lib/utils";

describe("getLocalName", () => {
  it("extracts name after hash", () => {
    expect(getLocalName("http://example.org/ontology#Person")).toBe("Person");
  });

  it("extracts name after last slash", () => {
    expect(getLocalName("http://example.org/ontology/Person")).toBe("Person");
  });

  it("returns full string when no delimiter", () => {
    expect(getLocalName("Person")).toBe("Person");
  });

  it("handles hash with empty local name", () => {
    expect(getLocalName("http://example.org/ontology#")).toBe("");
  });

  it("prefers hash over slash", () => {
    expect(getLocalName("http://example.org/ontology#ns/Person")).toBe("ns/Person");
  });
});

describe("getNamespace", () => {
  it("extracts namespace with hash", () => {
    expect(getNamespace("http://example.org/ontology#Person")).toBe(
      "http://example.org/ontology#"
    );
  });

  it("extracts namespace with slash", () => {
    expect(getNamespace("http://example.org/ontology/Person")).toBe(
      "http://example.org/ontology/"
    );
  });

  it("returns empty for no delimiter", () => {
    expect(getNamespace("Person")).toBe("");
  });
});

describe("getPreferredLabel", () => {
  it("returns preferred language label", () => {
    const labels = [
      { value: "Persona", lang: "it" },
      { value: "Person", lang: "en" },
    ];
    expect(getPreferredLabel(labels, "en")).toBe("Person");
  });

  it("falls back to first label", () => {
    const labels = [
      { value: "Persona", lang: "it" },
      { value: "Personne", lang: "fr" },
    ];
    expect(getPreferredLabel(labels, "en")).toBe("Persona");
  });

  it("returns empty string for empty array", () => {
    expect(getPreferredLabel([])).toBe("");
  });

  it("uses en as default language", () => {
    const labels = [
      { value: "Persona", lang: "it" },
      { value: "Person", lang: "en" },
    ];
    expect(getPreferredLabel(labels)).toBe("Person");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2024-01-15T10:30:00Z");
    expect(result).toContain("2024");
    expect(result).toContain("15");
  });
});

describe("formatDateTime", () => {
  it("formats a date string with time", () => {
    const result = formatDateTime("2024-01-15T10:30:00Z");
    expect(result).toContain("2024");
  });
});

describe("generateId", () => {
  it("returns a string", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique values", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });
});

describe("debounce", () => {
  it("delays function execution", async () => {
    let callCount = 0;
    const fn = debounce(() => {
      callCount++;
    }, 50);

    fn();
    fn();
    fn();

    expect(callCount).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(callCount).toBe(1);
  });
});
