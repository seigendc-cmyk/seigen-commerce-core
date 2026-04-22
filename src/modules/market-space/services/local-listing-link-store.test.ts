import { beforeEach, describe, expect, it } from "vitest";
import { readLocalListingIdForProduct, writeLocalListingLink } from "./local-listing-link-store";

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
  (globalThis as any).window = { localStorage, dispatchEvent: () => {}, addEventListener: () => {}, removeEventListener: () => {} };
}

describe("local listing link store", () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  it("writes and reads listingId by branch+product", () => {
    expect(readLocalListingIdForProduct({ branchId: "b1", productId: "p1" })).toBe(null);
    writeLocalListingLink({ branchId: "b1", productId: "p1", listingId: "l1" });
    expect(readLocalListingIdForProduct({ branchId: "b1", productId: "p1" })).toBe("l1");
  });
});

