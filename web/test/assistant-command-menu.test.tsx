import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { CommandMenu } from "../components/assistant/CommandMenu";
import { filterCommands } from "../lib/assistant/commands";

interface TestElementProps {
  children?: ReactNode;
  "data-command"?: string;
  onClick?: () => void;
  role?: string;
}

function collectElements(node: ReactNode, predicate: (props: TestElementProps) => boolean): ReactElement[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectElements(child, predicate));
  }

  if (!isValidElement(node)) {
    return [];
  }

  const props = node.props as TestElementProps;

  if (typeof node.type === "function") {
    const render = node.type as (componentProps: TestElementProps) => ReactNode;

    return collectElements(render(props), predicate);
  }

  const matches = predicate(props) ? [node] : [];

  return [...matches, ...collectElements(props.children, predicate)];
}

describe("CommandMenu", () => {
  test("renders filtered commands with the highlighted option selected", () => {
    const html = renderToStaticMarkup(
      <CommandMenu
        highlightedIndex={0}
        items={filterCommands("/se")}
        onSelect={() => undefined}
      />,
    );

    expect(html).toContain("role=\"listbox\"");
    expect(html).toContain("/sell");
    expect(html).toContain("list shares for sale");
    expect(html).toContain("aria-selected=\"true\"");
    expect(html).not.toContain("/buy");
  });

  test("clicking an option selects that command template", () => {
    const onSelect = vi.fn();
    const element = (
      <CommandMenu
        highlightedIndex={1}
        items={filterCommands("/")}
        onSelect={onSelect}
      />
    );
    const sellButton = collectElements(
      element,
      (props) => props.role === "option" && props["data-command"] === "sell",
    )[0];

    sellButton.props.onClick();

    expect(onSelect).toHaveBeenCalledWith("sell <qty> <asset> at <price>");
  });
});
