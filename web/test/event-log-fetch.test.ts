import { describe, expect, test, vi } from "vitest";
import { fetchLogsInBlockRange } from "../lib/eventLogs";

interface TestLog {
  blockNumber: bigint;
  id: string;
}

describe("fetchLogsInBlockRange", () => {
  test("splits ranges over the RPC log limit into 9000-block chunks", async () => {
    const chunks: Array<{ from: bigint; to: bigint }> = [];

    const logs = await fetchLogsInBlockRange<TestLog>({
      fromBlock: 100n,
      getLogs: async (chunk) => {
        chunks.push(chunk);

        return [{ blockNumber: chunk.from, id: `${chunk.from.toString()}-${chunk.to.toString()}` }];
      },
      retryCount: 0,
      toBlock: 18_100n,
    });

    expect(chunks).toEqual([
      { from: 100n, to: 9_099n },
      { from: 9_100n, to: 18_099n },
      { from: 18_100n, to: 18_100n },
    ]);
    expect(chunks.every((chunk) => chunk.to - chunk.from + 1n <= 9_000n)).toBe(true);
    expect(logs).toHaveLength(3);
  });

  test("retries a failing chunk once and skips it when other chunks succeed", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const attempts = new Map<string, number>();

    const logs = await fetchLogsInBlockRange<TestLog>({
      concurrency: 2,
      fromBlock: 1n,
      getLogs: async (chunk) => {
        const key = `${chunk.from.toString()}-${chunk.to.toString()}`;
        attempts.set(key, (attempts.get(key) ?? 0) + 1);

        if (chunk.from === 9_001n) {
          throw new Error("RPC 413");
        }

        return [{ blockNumber: chunk.from, id: key }];
      },
      retryCount: 1,
      toBlock: 18_000n,
    });

    expect(logs).toEqual([{ blockNumber: 1n, id: "1-9000" }]);
    expect(attempts.get("9001-18000")).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to load market logs for block range 9001-18000; skipping.",
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});
