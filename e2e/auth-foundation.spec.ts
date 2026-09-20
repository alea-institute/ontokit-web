import { test, expect, loadSession } from "./fixtures/auth";

test("real owner and unrelated sessions authenticate protected API reads", async ({run, ownerApi, unrelatedApi}) => {
  const owner = await loadSession(run, "owner");
  const unrelated = await loadSession(run, "unrelated");
  expect(owner.user.id).not.toBe(unrelated.user.id);
  for (const api of [ownerApi, unrelatedApi]) {
    const response = await api.get("/api/v1/users/me/commit-identity");
    expect(response.status()).toBe(200);
    expect((await response.json()).effective_email).toBeTruthy();
  }
});

test("anonymous context has no identity and cannot access a protected API read", async ({anonymousApi}) => {
  expect((await anonymousApi.storageState()).cookies).toEqual([]);
  const response = await anonymousApi.get("/api/v1/users/me/commit-identity");
  expect(response.status()).toBe(401);
});
