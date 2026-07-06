export interface AssistantCommand {
  command: string;
  label: string;
  hint: string;
  template: string;
}

export const commandRegistry: AssistantCommand[] = [
  {
    command: "price",
    label: "Price",
    hint: "lowest ask / best bid",
    template: "price <asset>",
  },
  {
    command: "depth",
    label: "Depth",
    hint: "order book depth",
    template: "depth <asset>",
  },
  {
    command: "holdings",
    label: "Holdings",
    hint: "your position",
    template: "my <asset> holdings",
  },
  {
    command: "yield",
    label: "Yield",
    hint: "unclaimed yield",
    template: "my yield",
  },
  {
    command: "buy",
    label: "Buy",
    hint: "buy shares",
    template: "buy <qty> <asset>",
  },
  {
    command: "sell",
    label: "Sell",
    hint: "list shares for sale",
    template: "sell <qty> <asset> at <price>",
  },
  {
    command: "cancel",
    label: "Cancel",
    hint: "cancel an open order",
    template: "cancel my <asset> order",
  },
  {
    command: "claim",
    label: "Claim",
    hint: "claim yield",
    template: "claim my yield",
  },
];

export function filterCommands(input: string): AssistantCommand[] {
  if (!input.startsWith("/")) {
    return [];
  }

  const query = input.slice(1).toLowerCase();

  if (!query) {
    return commandRegistry;
  }

  return commandRegistry.filter((item) => item.command.includes(query));
}
