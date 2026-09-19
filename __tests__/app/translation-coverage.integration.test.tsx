import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranslationBackfillStatus } from "@/lib/api/translations";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { accessToken: "route-token", user: { id: "reviewer", name: "Reviewer" } }, status: "authenticated" }),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-coverage" }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/projects/project-coverage/translations",
  useRouter: () => ({ push: vi.fn() }),
}));

import TranslationCoveragePage from "@/app/projects/[id]/translations/page";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const preview = { literal_count: 8, expected_cost_usd: 0.24, upper_bound_cost_usd: 0.48, batch_discount_applied: false };
let role: string;
let failCoverage: boolean;
let failPreview: boolean;
let launchStatus: number;
let empty: boolean;
let job: TranslationBackfillStatus | null;
let pendingPreview: Promise<Response> | undefined;
let requests: { url: URL; init: RequestInit }[];
let client: QueryClient;

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem("ontokit:branch:project-coverage", "release/fr");
  role = "admin";
  failCoverage = false;
  failPreview = false;
  launchStatus = 200;
  empty = false;
  job = null;
  pendingPreview = undefined;
  requests = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    if (url.pathname.endsWith("/branches")) return json({ items: [{ name: "main" }, { name: "release/fr" }], default_branch: "main", current_branch: "main" });
    if (url.pathname === "/api/v1/projects/project-coverage") return json({ id: "project-coverage", name: "Ontology", user_role: role });
    if (url.pathname.endsWith("/coverage")) {
      if (failCoverage) return json({ detail: "Coverage access expired" }, 403);
      return json({ branch: "release/fr", total_entities: empty ? 0 : 10, languages: empty ? [] : [{ language: "fr", verified: 2, provisional: 1, pending: 3, missing: 4, total: 10 }] });
    }
    if (url.pathname.endsWith("/backfill/status")) return json(job);
    if (url.pathname.endsWith("/backfill/preview")) {
      if (pendingPreview) return pendingPreview;
      return failPreview ? json({ detail: "Invalid language tag" }, 400) : json(preview);
    }
    if (url.pathname.endsWith("/backfill") && init.method === "POST") {
      if (launchStatus !== 200) return json({ detail: "Launch permission changed" }, launchStatus);
      job = { job_id: "job-1", status: "running", completed: 2, total: 8, error: null };
      return json({ job_id: "job-1" });
    }
    if (url.pathname.endsWith("/pr-party/me")) return json({ is_reviewer: false });
    if (url.pathname === "/api/v1/notifications") return json({ items: [], unread_count: 0 });
    throw new Error(`Unexpected route: ${url}`);
  }));
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); sessionStorage.clear(); });
const mount = () => render(<QueryClientProvider client={client}><TranslationCoveragePage /></QueryClientProvider>);
const launches = () => requests.filter(({ init }) => init.method === "POST");

 describe("translation coverage route through real providers and HTTP client", () => {
  it("renders server coverage with authenticated stored-branch requests", async () => {
    mount();
    expect(await screen.findByRole("cell", { name: "Pending: 3" })).toBeDefined();
    expect(screen.getByText("10 entities")).toBeDefined();
    expect(screen.getByRole("table", { name: "Translation coverage" }).getAttribute("tabindex")).toBe("0");
    const request = requests.find(({ url }) => url.pathname.endsWith("/coverage"))!;
    expect(request.url.searchParams.get("branch")).toBe("release/fr");
    expect(new Headers(request.init.headers).get("Authorization")).toBe("Bearer route-token");
  });

  it("snapshots all filters into the cost query and launch body, then fetches live job progress", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole("button", { name: "Preview cost" });
    expect((screen.getByRole("button", { name: "Confirm backfill" }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("Language"), "fr");
    fireEvent.change(screen.getByLabelText("Produced before"), { target: { value: "2026-09-01" } });
    await user.click(screen.getByLabelText("Never native-confirmed"));
    await user.click(screen.getByRole("button", { name: "Preview cost" }));
    await screen.findByText("8 literals · $0.24 expected");
    expect(screen.getByText(/no batch discount/)).toBeDefined();
    const request = requests.find(({ url }) => url.pathname.endsWith("/preview"))!;
    expect(Object.fromEntries(request.url.searchParams)).toEqual({ branch: "release/fr", language: "fr", era_before: "2026-09-01", never_confirmed: "true" });
    await user.click(screen.getByRole("button", { name: "Confirm backfill" }));
    expect((await screen.findByRole("status")).textContent).toContain("Backfill running: 2 of 8 literals (25%).");
    expect(JSON.parse(String(launches()[0].init.body))).toEqual({ branch: "release/fr", language: "fr", era_before: "2026-09-01", never_confirmed: true });
    expect(requests.filter(({ url }) => url.pathname.endsWith("/coverage")).length).toBeGreaterThan(1);
  });

  it("omits optional filters and invalidates a completed preview when a filter changes", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: "Preview cost" }));
    await screen.findByText("8 literals · $0.24 expected");
    expect(Object.fromEntries(requests.find(({ url }) => url.pathname.endsWith("/preview"))!.url.searchParams)).toEqual({ branch: "release/fr" });
    await user.type(screen.getByLabelText("Language"), "de");
    expect(screen.queryByText("8 literals · $0.24 expected")).toBeNull();
    expect((screen.getByRole("button", { name: "Confirm backfill" }) as HTMLButtonElement).disabled).toBe(true);
    expect(launches()).toHaveLength(0);
  });

  it("ignores a real in-flight preview response after the form changes", async () => {
    let resolve!: (response: Response) => void;
    pendingPreview = new Promise<Response>((done) => { resolve = done; });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: "Preview cost" }));
    await user.type(screen.getByLabelText("Language"), "de");
    await act(async () => { resolve(json(preview)); await pendingPreview; });
    await waitFor(() => expect((screen.getByRole("button", { name: "Preview cost" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByText("8 literals · $0.24 expected")).toBeNull();
    expect((screen.getByRole("button", { name: "Confirm backfill" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders a failed preview and clears the error when a corrected request succeeds", async () => {
    failPreview = true;
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: "Preview cost" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Invalid language tag");
    expect((screen.getByRole("button", { name: "Confirm backfill" }) as HTMLButtonElement).disabled).toBe(true);
    failPreview = false;
    await user.type(screen.getByLabelText("Language"), "fr");
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Preview cost" }));
    await screen.findByText("8 literals · $0.24 expected");
    expect(requests.filter(({ url }) => url.pathname.endsWith("/preview"))).toHaveLength(2);
  });

  it.each([409, 403])("renders launch HTTP %i and retries from the existing preview", async (status) => {
    launchStatus = status;
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: "Preview cost" }));
    await screen.findByText("8 literals · $0.24 expected");
    await user.click(screen.getByRole("button", { name: "Confirm backfill" }));
    expect((await screen.findByRole("alert")).textContent).toBe(status === 409 ? "A translation backfill is already active for this project." : "Launch permission changed");
    expect(launches()).toHaveLength(1);
    launchStatus = 200;
    await user.click(screen.getByRole("button", { name: "Confirm backfill" }));
    await screen.findByRole("status");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(launches()).toHaveLength(2);
  });

  it("shows a failed zero-total job safely to viewers without exposing launch controls", async () => {
    role = "viewer";
    job = { job_id: "job-empty", status: "failed", completed: 0, total: 0, error: "Source branch no longer exists" };
    mount();
    await screen.findByRole("cell", { name: "Pending: 3" });
    expect((await screen.findByRole("status")).textContent).toContain("0 of 0 literals (0%).");
    expect(screen.getByText("Source branch no longer exists")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Preview cost" })).toBeNull();
    expect(screen.getByText(/project administrator can launch/)).toBeDefined();
  });

  it("surfaces coverage API errors without substituting a misleading table", async () => {
    failCoverage = true;
    mount();
    expect((await screen.findByRole("alert")).textContent).toBe("Coverage access expired");
    expect(screen.queryByRole("table", { name: "Translation coverage" })).toBeNull();
  });

  it("renders an empty ontology as zero entities and an empty table", async () => {
    empty = true;
    mount();
    await screen.findByText("0 entities");
    const table = screen.getByRole("table", { name: "Translation coverage" });
    expect(table.querySelectorAll("tbody tr")).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
