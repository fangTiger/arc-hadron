import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { ExploreYieldFilter } from "../../../components/market/ExploreYieldFilter";

interface TestElementProps {
  children?: ReactNode;
  onClick?: () => void;
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

describe("ExploreYieldFilter", () => {
  test("renders the four yield buckets", () => {
    const html = renderToStaticMarkup(
      <ExploreYieldFilter onChange={() => undefined} selected={null} />,
    );

    expect(html).toContain("&lt;4%");
    expect(html).toContain("4-6%");
    expect(html).toContain("6-10%");
    expect(html).toContain("&gt;10%");
  });

  test("clicking an unselected chip emits its bucket", () => {
    const onChange = vi.fn();
    const element = <ExploreYieldFilter onChange={onChange} selected={null} />;
    const buttons = collectElements(element, (props) => typeof props.onClick === "function");

    buttons[2].props.onClick();

    expect(onChange).toHaveBeenCalledWith("6to10");
  });

  test("clicking the selected chip emits null", () => {
    const onChange = vi.fn();
    const element = <ExploreYieldFilter onChange={onChange} selected="6to10" />;
    const buttons = collectElements(element, (props) => typeof props.onClick === "function");

    buttons[2].props.onClick();

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
