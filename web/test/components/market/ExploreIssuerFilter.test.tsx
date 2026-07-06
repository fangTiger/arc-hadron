import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { ExploreIssuerFilter } from "../../../components/market/ExploreIssuerFilter";

interface TestElementProps {
  children?: ReactNode;
  onChange?: (event: { target: { value: string } }) => void;
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

describe("ExploreIssuerFilter", () => {
  const issuers = [
    { assetsCount: 2, displayName: "US Treasury Desk (Demo)", slug: "us-treasury-desk" },
    { assetsCount: 1, displayName: "Meridian Credit Management LP", slug: "meridian-credit" },
  ];

  test("renders All Issuers and every issuer option with asset counts", () => {
    const html = renderToStaticMarkup(
      <ExploreIssuerFilter issuers={issuers} onChange={() => undefined} selectedSlug={null} />,
    );

    expect(html).toContain("All Issuers");
    expect(html).toContain("US Treasury Desk (Demo) (2)");
    expect(html).toContain("Meridian Credit Management LP (1)");
  });

  test("selecting an issuer emits its slug and All Issuers emits null", () => {
    const onChange = vi.fn();
    const element = (
      <ExploreIssuerFilter issuers={issuers} onChange={onChange} selectedSlug={null} />
    );
    const select = collectElements(element, (props) => typeof props.onChange === "function")[0];

    select.props.onChange({ target: { value: "meridian-credit" } });
    select.props.onChange({ target: { value: "" } });

    expect(onChange).toHaveBeenNthCalledWith(1, "meridian-credit");
    expect(onChange).toHaveBeenNthCalledWith(2, null);
  });
});
