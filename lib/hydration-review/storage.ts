/**
 * Durable review state in the browser, keyed by bundle SHA-256 so a review can
 * never attach to a different bundle. IndexedDB when present; an in-memory store
 * otherwise (tests, private windows that block storage). Export remains the
 * hand-off to generative-folio either way.
 */

import type { Review, Sample } from "./reviews";

export interface ReviewStore {
  readonly durable: boolean;
  load(bundleSha: string): Promise<{ reviews: Review[]; samples: Sample[] }>;
  putReview(bundleSha: string, review: Review): Promise<void>;
  putReviews(bundleSha: string, reviews: Review[]): Promise<void>;
  putSample(bundleSha: string, sample: Sample): Promise<void>;
}

export function createMemoryStore(): ReviewStore {
  const reviews = new Map<string, Map<string, Review>>();
  const samples = new Map<string, Map<string, Sample>>();
  const bucket = <T>(m: Map<string, Map<string, T>>, k: string) => {
    let b = m.get(k);
    if (!b) m.set(k, (b = new Map()));
    return b;
  };
  return {
    durable: false,
    async load(sha) {
      return { reviews: [...bucket(reviews, sha).values()], samples: [...bucket(samples, sha).values()] };
    },
    async putReview(sha, r) {
      bucket(reviews, sha).set(r.row_id, r);
    },
    async putReviews(sha, rs) {
      const b = bucket(reviews, sha);
      for (const r of rs) b.set(r.row_id, r);
    },
    async putSample(sha, s) {
      bucket(samples, sha).set(s.sample_id, s);
    },
  };
}

const DB_NAME = "ontokit-hydration-review";
const DB_VERSION = 1;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  const req = factory.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    for (const name of ["reviews", "samples"]) {
      const store = db.createObjectStore(name, { keyPath: ["bundle", "id"] });
      store.createIndex("bundle", "bundle");
    }
  };
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab"));
  });
}

export function createIndexedDbStore(factory: IDBFactory): ReviewStore {
  const db = openDb(factory);
  const put = async (name: string, ...values: object[]) => {
    const tx = (await db).transaction(name, "readwrite");
    const store = tx.objectStore(name);
    for (const value of values) store.put(value);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  const all = async <T>(name: string, sha: string): Promise<T[]> => {
    const tx = (await db).transaction(name, "readonly");
    const recs = await request(tx.objectStore(name).index("bundle").getAll(sha));
    return recs.map((r: { value: T }) => r.value);
  };
  return {
    durable: true,
    async load(sha) {
      return { reviews: await all<Review>("reviews", sha), samples: await all<Sample>("samples", sha) };
    },
    putReview: (sha, r) => put("reviews", { bundle: sha, id: r.row_id, value: r }),
    putReviews: (sha, rs) => put("reviews", ...rs.map((r) => ({ bundle: sha, id: r.row_id, value: r }))),
    putSample: (sha, s) => put("samples", { bundle: sha, id: s.sample_id, value: s }),
  };
}

/**
 * Use `primary` if it opens; otherwise fall back to memory. Opening IndexedDB
 * can fail asynchronously (blocked storage, some private windows), so the
 * choice is made on first use, and `durable` reports the store actually in use.
 */
export function createFallbackStore(primary: () => ReviewStore): ReviewStore {
  const memory = createMemoryStore();
  let active: Promise<ReviewStore> | null = null;
  let chosen: ReviewStore | null = null;
  const pick = () =>
    (active ??= (async () => {
      try {
        const p = primary();
        await p.load("");
        return (chosen = p);
      } catch {
        return (chosen = memory);
      }
    })());
  return {
    get durable() {
      return chosen ? chosen.durable : false;
    },
    load: async (sha) => (await pick()).load(sha),
    putReview: async (sha, r) => (await pick()).putReview(sha, r),
    putReviews: async (sha, rs) => (await pick()).putReviews(sha, rs),
    putSample: async (sha, smp) => (await pick()).putSample(sha, smp),
  };
}

export function createDefaultStore(): ReviewStore {
  if (typeof indexedDB === "undefined") return createMemoryStore();
  return createFallbackStore(() => createIndexedDbStore(indexedDB));
}
