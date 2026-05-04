import { describe, expect, it, beforeEach } from "vitest";
import {
  mockFetch,
  mockOk,
  mockEmpty,
  resetFetch,
} from "@/__tests__/helpers/mockFetch";
import { embeddingsApi } from "@/lib/api/embeddings";

describe("embeddingsApi", () => {
  beforeEach(() => {
    resetFetch();
  });

  describe("getConfig", () => {
    it("fetches embedding config", async () => {
      const data = {
        provider: "local",
        model_name: "all-MiniLM-L6-v2",
        api_key_set: false,
        dimensions: 384,
        auto_embed_on_save: true,
      };
      mockOk(data);

      const result = await embeddingsApi.getConfig("proj-1", "tok");
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/embeddings/config");
      expect(options.method).toBe("GET");
    });
  });

  describe("updateConfig", () => {
    it("updates embedding config", async () => {
      const config = {
        provider: "openai" as const,
        model_name: "text-embedding-3-small",
        auto_embed_on_save: false,
      };
      mockOk({ ...config, api_key_set: false, dimensions: 1536 });

      const result = await embeddingsApi.updateConfig("proj-1", config, "tok");
      expect(result.provider).toBe("openai");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/embeddings/config");
      expect(options.method).toBe("PUT");
      expect(JSON.parse(options.body)).toEqual(config);
    });
  });

  describe("triggerGeneration", () => {
    it("triggers embedding generation", async () => {
      const data = { job_id: "job-1" };
      mockOk(data);

      const result = await embeddingsApi.triggerGeneration("proj-1", "tok");
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/embeddings/generate");
      expect(options.method).toBe("POST");
    });

    it("includes branch param", async () => {
      mockOk({ job_id: "job-1" });

      await embeddingsApi.triggerGeneration("proj-1", "tok", "dev");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("branch=dev");
    });
  });

  describe("getStatus", () => {
    it("fetches embedding status", async () => {
      const data = {
        total_entities: 100,
        embedded_entities: 50,
        coverage_percent: 50,
        provider: "local",
        model_name: "all-MiniLM-L6-v2",
        job_in_progress: false,
      };
      mockOk(data);

      const result = await embeddingsApi.getStatus("proj-1", "tok");
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/embeddings/status");
    });
  });

  describe("clear", () => {
    it("clears embeddings", async () => {
      mockEmpty();

      await embeddingsApi.clear("proj-1", "tok");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/embeddings");
      expect(options.method).toBe("DELETE");
    });
  });

  describe("semanticSearch", () => {
    it("performs semantic search with defaults", async () => {
      const data = { results: [], search_mode: "semantic" };
      mockOk(data);

      const result = await embeddingsApi.semanticSearch(
        "proj-1",
        "animal"
      );
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/search/semantic");
      expect(url).toContain("q=animal");
      expect(url).toContain("limit=20");
      expect(url).toContain("threshold=0.3");
    });

    it("passes all optional params", async () => {
      mockOk({ results: [], search_mode: "hybrid" });

      await embeddingsApi.semanticSearch(
        "proj-1",
        "animal",
        "tok",
        "dev",
        10,
        0.5
      );

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("branch=dev");
      expect(url).toContain("limit=10");
      expect(url).toContain("threshold=0.5");
    });
  });

  describe("getSimilarEntities", () => {
    it("fetches similar entities", async () => {
      const data = [{ iri: "http://example.org/Cat", score: 0.9 }];
      mockOk(data);

      const result = await embeddingsApi.getSimilarEntities(
        "proj-1",
        "http://example.org/Dog"
      );
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain(
        "/api/v1/projects/proj-1/entities/" +
          encodeURIComponent("http://example.org/Dog") +
          "/similar"
      );
      expect(url).toContain("limit=10");
      expect(url).toContain("threshold=0.5");
    });
  });

  describe("rankSuggestions", () => {
    it("ranks suggestion candidates", async () => {
      const body = {
        context_iri: "http://example.org/Dog",
        candidates: ["http://example.org/Animal"],
        relationship: "parent" as const,
      };
      const data = [
        { iri: "http://example.org/Animal", label: "Animal", score: 0.95 },
      ];
      mockOk(data);

      const result = await embeddingsApi.rankSuggestions("proj-1", body, "tok");
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain(
        "/api/v1/projects/proj-1/entities/rank-suggestions"
      );
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual(body);
    });
  });
});
