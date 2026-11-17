import { describe, expect, it, vi } from "vitest";
import type { WalletSummary } from "@gleam/core";
import type { CallerContext } from "@gleam/messaging/src/caller.ts";
import { createRuntime } from "./create-runtime";
import { createInMemoryPlatform } from "../testing/index";

const SECURE = "https://dapp.example";
const INSECURE = "http://dapp.example";
const EXTENSION: CallerContext = { tier: "extension" };
const SECURE_PAGE: CallerContext = { tier: "contentScript", origin: SECURE, tabId: 7 };
const INSECURE_PAGE: CallerContext = { tier: "contentScript", origin: INSECURE, tabId: 7 };

/**
 * A wallet plus a stored grant for `origin`, as a site that connected
 * before the secure-origin check existed would still hold.
 */
async function setupGranted(origin: string, permissions: string[]) {
  const platform = createInMemoryPlatform();
  const runtime = createRuntime(platform);
  const wallet = (await runtime.dispatch(
    "createWallet",
    { name: "Main", password: "correct horse" },
    EXTENSION,
  )) as WalletSummary;
  await platform.storage.set("local:grants", [
    { origin, walletId: wallet.id, permissions, createdAt: Date.now(), expiresAt: null, budget: null },
  ]);
  return { platform, runtime, wallet };
}

describe("provider calls from a plain-http origin holding an older grant", () => {
  it("refuses a grant-required read, even though the grant is stored", async () => {
    const { runtime } = await setupGranted(INSECURE, ["ACCESS_ADDRESS"]);

    // The refusal is synchronous: no async work starts for the call.
    expect(() =>
      runtime.dispatch("providerCall", { method: "getActiveAddress", params: undefined }, INSECURE_PAGE),
    ).toThrow("Gleam only works with secure (https) sites.");
  });

  it("refuses a signing call before any approval window opens", async () => {
    const { platform, runtime } = await setupGranted(INSECURE, ["ACCESS_ADDRESS", "SIGN_TRANSACTION"]);
    const present = vi.spyOn(platform.approvalPresenter, "present");

    expect(() =>
      runtime.dispatch(
        "providerCall",
        { method: "sign", params: { transaction: { data: "aGVsbG8" } } },
        INSECURE_PAGE,
      ),
    ).toThrow("Gleam only works with secure (https) sites.");
    expect(present).not.toHaveBeenCalled();
  });

  it("still lets the site disconnect, which drops the grant", async () => {
    const { platform, runtime } = await setupGranted(INSECURE, ["ACCESS_ADDRESS"]);

    await expect(
      runtime.dispatch("providerCall", { method: "disconnect", params: undefined }, INSECURE_PAGE),
    ).resolves.toBeUndefined();
    await expect(platform.storage.get("local:grants")).resolves.toEqual([]);
  });

  it("answers the same read from the https origin", async () => {
    const { runtime, wallet } = await setupGranted(SECURE, ["ACCESS_ADDRESS"]);

    await expect(
      runtime.dispatch("providerCall", { method: "getActiveAddress", params: undefined }, SECURE_PAGE),
    ).resolves.toBe(wallet.address);
  });
});
