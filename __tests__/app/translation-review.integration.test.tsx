import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProvisionalTranslationRecord } from "@/lib/api/translations";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { accessToken: "route-token", user: { id: "reviewer", name: "Reviewer" } }, status: "authenticated" }),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-review" }),
  useSearchParams: () => new URLSearchParams("classIri=https%3A%2F%2Fexample.test%2FThing"),
  usePathname: () => "/projects/project-review/translations/review",
  useRouter: () => ({ push: vi.fn() }),
}));

import TranslationReviewPage from "@/app/projects/[id]/translations/review/page";

const record = (id: string, language: string, proposed: string): ProvisionalTranslationRecord => ({
  record_id: id, entity_iri: "https://example.test/Thing", predicate: "rdfs:label", language,
  source_value: "Thing", proposed_value: proposed, model_name: "fixture-model", method: "consensus", score: 0.91,
  created_at: "2026-09-01T12:00:00Z",
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
let role: string;
let languages: string[];
let records: ProvisionalTranslationRecord[];
let failQueue: boolean;
let actionFailure: boolean;
let bulkPartial: boolean;
let requests: { url: URL; init: RequestInit }[];
let client: QueryClient;

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem("ontokit:branch:project-review", "release/fr");
  role = "admin";
  languages = ["fr"];
  records = [record("fr-1", "fr", "Objet"), record("fr-2", "fr", "Entité"), record("de-1", "de", "Ding")];
  failQueue = false;
  actionFailure = false;
  bulkPartial = false;
  requests = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    if (url.pathname.endsWith("/branches")) return json({ items: [{ name: "main" }, { name: "release/fr" }], default_branch: "main", current_branch: "main" });
    if (url.pathname === "/api/v1/projects/project-review") return json({ id: "project-review", name: "Ontology", user_role: role });
    if (url.pathname.endsWith("/my-reviewer-languages")) return json({ languages });
    if (url.pathname.endsWith("/provisional")) {
      if (failQueue) return json({ detail: "Review queue is unavailable" }, 403);
      const language = url.searchParams.get("language");
      return json(language ? records.filter((item) => item.language === language) : records);
    }
    if (url.pathname.endsWith("/confirm-bulk")) {
      if (actionFailure) return json({ detail: "Review permission changed" }, 403);
      const ids = (JSON.parse(String(init.body)) as { record_ids: string[] }).record_ids;
      const results = ids.map((id, index) => ({ record_id: id, ok: !bulkPartial || index === 0, error: bulkPartial && index > 0 ? "Changed upstream" : null }));
      records = records.filter((item) => !results.some((result) => result.ok && result.record_id === item.record_id));
      return json({ results });
    }
    const action = url.pathname.match(/\/records\/([^/]+)\/(confirm|reject)$/);
    if (action) {
      if (actionFailure) return json({ detail: "Record was changed upstream" }, 409);
      records = records.filter((item) => item.record_id !== action[1]);
      return json({ id: action[1], state: action[2] === "confirm" ? "verified" : "rejected" });
    }
    if (url.pathname.endsWith("/pr-party/me")) return json({ is_reviewer: false });
    if (url.pathname === "/api/v1/notifications") return json({ items: [], unread_count: 0 });
    throw new Error(`Unexpected route: ${url}`);
  }));
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); sessionStorage.clear(); });
const mount = () => render(<QueryClientProvider client={client}><TranslationReviewPage /></QueryClientProvider>);
const actions = () => requests.filter(({ init }) => init.method === "POST");

 describe("translation review route through real providers and HTTP client", () => {
  it("filters an admin queue by language and reviewer eligibility while preserving branch and selection", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText("Ding");
    expect((screen.getByLabelText("Select Ding") as HTMLInputElement).disabled).toBe(true);
    await user.selectOptions(screen.getByLabelText("Language"), "de");
    expect(screen.queryByText("Objet")).toBeNull();
    await user.selectOptions(screen.getByLabelText("Status"), "confirmable");
    expect(screen.getByText(/No provisional translations/)).toBeDefined();
    await user.selectOptions(screen.getByLabelText("Language"), "all");
    expect(screen.getByText("Objet")).toBeDefined();
    expect(screen.queryByText("Ding")).toBeNull();
    const queues = requests.filter(({ url }) => url.pathname.endsWith("/provisional"));
    expect(queues.length).toBeGreaterThan(0);
    expect(queues.every(({ url }) => url.searchParams.get("branch") === "release/fr")).toBe(true);
    expect(new Headers(queues[0].init.headers).get("Authorization")).toBe("Bearer route-token");
    expect(screen.getByRole("link", { name: "Back to project" }).getAttribute("href")).toContain("classIri=https%3A%2F%2Fexample.test%2FThing");
  });

  it("fetches only a tagged viewer's language and sends nothing when confirmation is cancelled", async () => {
    role = "viewer";
    const user = userEvent.setup();
    mount();
    await screen.findByText("Objet");
    expect(screen.queryByText("Ding")).toBeNull();
    expect(requests.filter(({ url }) => url.pathname.endsWith("/provisional")).every(({ url }) => url.searchParams.get("language") === "fr")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Confirm Objet" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(actions()).toHaveLength(0);
    expect(screen.getByText("Objet")).toBeDefined();
  });

  it.each(["confirm", "reject"] as const)("%s sends the stored branch and removes only the successful row", async (kind) => {
    const user = userEvent.setup();
    mount();
    await screen.findByText("Objet");
    const label = kind === "confirm" ? "Confirm" : "Reject";
    await user.click(screen.getByRole("button", { name: `${label} Objet` }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: `${label} translation` }));
    await waitFor(() => expect(screen.queryByText("Objet")).toBeNull());
    expect(screen.getByText("Entité")).toBeDefined();
    expect(actions()).toHaveLength(1);
    expect(actions()[0].url.pathname).toContain(`/fr-1/${kind}`);
    expect(JSON.parse(String(actions()[0].init.body))).toEqual({ branch: "release/fr" });
    expect(screen.getByRole("status").textContent).toContain(kind === "confirm" ? "confirmed" : "rejected");
  });

  it("excludes a deselected translation from bulk confirmation and leaves it reviewable", async () => {
    const user = userEvent.setup();
    mount(); await screen.findByText("Objet");
    await user.click(screen.getByLabelText("Select Objet"));
    await user.click(screen.getByLabelText("Select Entité"));
    await user.click(screen.getByLabelText("Select Entité"));
    expect(screen.getByText("1 selected")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Confirm selected" }));
    await user.click(screen.getByRole("button", { name: "Confirm translations" }));
    await waitFor(() => expect(screen.queryByText("Objet")).toBeNull());
    expect(screen.getByText("Entité")).toBeDefined();
    expect((screen.getByLabelText("Select Entité") as HTMLInputElement).checked).toBe(false);
    expect(actions()).toHaveLength(1);
    expect(JSON.parse(String(actions()[0].init.body))).toEqual({ branch: "release/fr", record_ids: ["fr-1"] });
    expect(screen.getByRole("status").textContent).toBe("1 confirmed; 0 failed.");
  });

  it("retains partial bulk failures, removes successes and retries only the remaining selection", async () => {
    bulkPartial = true;
    const user = userEvent.setup();
    mount();
    await screen.findByText("Objet");
    await user.click(screen.getByLabelText("Select Objet"));
    await user.click(screen.getByLabelText("Select Entité"));
    await user.click(screen.getByRole("button", { name: "Confirm selected" }));
    await user.click(screen.getByRole("button", { name: "Confirm translations" }));
    await waitFor(() => expect(screen.queryByText("Objet")).toBeNull());
    expect(screen.getByText("Changed upstream")).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("1 confirmed; 1 failed.");
    expect(screen.getByText("1 selected")).toBeDefined();
    bulkPartial = false;
    await user.click(screen.getByRole("button", { name: "Confirm selected" }));
    await user.click(screen.getByRole("button", { name: "Confirm translations" }));
    await waitFor(() => expect(screen.queryByText("Entité")).toBeNull());
    expect(JSON.parse(String(actions()[1].init.body))).toEqual({ branch: "release/fr", record_ids: ["fr-2"] });
  });

  it("keeps a failed confirmation open and permits retry against the real mutation", async () => {
    actionFailure = true;
    const user = userEvent.setup();
    mount();
    await screen.findByText("Objet");
    await user.click(screen.getByRole("button", { name: "Confirm Objet" }));
    await user.click(screen.getByRole("button", { name: "Confirm translation" }));
    await within(screen.getByRole("dialog")).findByText("Record was changed upstream");
    expect(screen.getByRole("dialog")).toBeDefined();
    actionFailure = false;
    await user.click(screen.getByRole("button", { name: "Confirm translation" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText("Objet")).toBeNull();
    expect(actions()).toHaveLength(2);
  });

  it("reports a whole bulk-request failure without dropping any selected records", async () => {
    actionFailure = true;
    const user = userEvent.setup();
    mount();
    await screen.findByText("Objet");
    await user.click(screen.getByLabelText("Select Objet"));
    await user.click(screen.getByLabelText("Select Entité"));
    await user.click(screen.getByRole("button", { name: "Confirm selected" }));
    await user.click(screen.getByRole("button", { name: "Confirm translations" }));
    await within(screen.getByRole("dialog")).findByText("Review permission changed");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getAllByText("Review permission changed")).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toBe("0 confirmed; 2 failed.");
    expect(screen.getByText("2 selected")).toBeDefined();
    expect((screen.getByLabelText("Select Entité") as HTMLInputElement).checked).toBe(true);
  });

  it("denies an untagged viewer without making any queue requests", async () => {
    role = "viewer"; languages = [];
    mount();
    expect((await screen.findByRole("alert")).textContent).toContain("limited to project admins");
    expect(requests.filter(({ url }) => url.pathname.endsWith("/provisional"))).toHaveLength(0);
  });

  it("surfaces a JSON API queue error instead of an empty queue", async () => {
    failQueue = true;
    mount();
    expect((await screen.findByRole("alert")).textContent).toBe("Review queue is unavailable");
    expect(screen.queryByText(/No provisional translations/)).toBeNull();
  });
});
