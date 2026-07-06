import { describe, expect, test } from "vitest";
import { commandRegistry, filterCommands } from "../lib/assistant/commands";

describe("assistant command registry", () => {
  test("returns all commands for a slash-only query in menu order", () => {
    expect(filterCommands("/").map((item) => item.command)).toEqual([
      "price",
      "depth",
      "holdings",
      "yield",
      "buy",
      "sell",
      "cancel",
      "claim",
    ]);
  });

  test("filters commands by slash query without case sensitivity", () => {
    expect(filterCommands("/se").map((item) => item.command)).toEqual(["sell"]);
    expect(filterCommands("/SE").map((item) => item.command)).toEqual(["sell"]);
    expect(filterCommands("/not-a-command")).toEqual([]);
  });

  test("maps every command to the template inserted into the assistant input", () => {
    const templates = Object.fromEntries(
      commandRegistry.map((item) => [item.command, item.template]),
    );

    expect(templates).toEqual({
      price: "price <asset>",
      depth: "depth <asset>",
      holdings: "my <asset> holdings",
      yield: "my yield",
      buy: "buy <qty> <asset>",
      sell: "sell <qty> <asset> at <price>",
      cancel: "cancel my <asset> order",
      claim: "claim my yield",
    });
  });
});
