import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const hookSource = readFileSync(
  new URL("../lib/hooks/useMarketSnapshot.ts", import.meta.url),
  "utf8",
);
const homeViewSource = readFileSync(
  new URL("../app/HomeView.tsx", import.meta.url),
  "utf8",
);

describe("market snapshot hydration", () => {
  test("restores browser storage after hydration instead of during the initial render", () => {
    expect(hookSource).not.toContain("useState");
    expect(hookSource).toContain("useEffect");
    expect(hookSource).toContain("setQueryData");
  });

  test("keeps independently cached stats hydration-stable until mount", () => {
    expect(homeViewSource).toContain("hasHydrated");
    expect(homeViewSource).toContain("useSyncExternalStore");
    expect(homeViewSource).not.toContain("setHasHydrated");
    expect(homeViewSource).toContain("!hasHydrated || isAssetsLoading");
    expect(homeViewSource).toContain("!hasHydrated || isEventsLoading");
  });
});
