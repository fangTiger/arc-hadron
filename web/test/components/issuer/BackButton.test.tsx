import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { BackButton } from "../../../components/issuer/BackButton";
import { IssuerHeader } from "../../../components/issuer/IssuerHeader";
import type { Issuer } from "../../../lib/issuers";

const routerBackMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: routerBackMock,
    push: routerPushMock,
  }),
}));

interface ButtonProps {
  children?: ReactNode;
  onClick?: () => void;
}

function buttons(node: ReactNode): ReactElement<ButtonProps>[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => buttons(child));
  }

  if (!isValidElement(node)) {
    return [];
  }

  const props = node.props as ButtonProps;

  if (typeof node.type === "function") {
    const render = node.type as (componentProps: ButtonProps) => ReactNode;

    return buttons(render(props));
  }

  const matches = node.type === "button" ? [node as ReactElement<ButtonProps>] : [];

  return [...matches, ...buttons(props.children)];
}

function issuer(overrides: Partial<Issuer> = {}): Issuer {
  return {
    assetIds: ["asset-a"],
    description: "Illustrative issuer profile for receivables exposure.",
    displayName: "Atlas Receivables",
    docs: [],
    establishedYear: 2011,
    externalLinks: [],
    focus: "Receivables",
    jurisdiction: "Singapore",
    shortName: "ATLAS",
    slug: "atlas-receivables",
    ...overrides,
  };
}

describe("BackButton", () => {
  beforeEach(() => {
    routerBackMock.mockClear();
    routerPushMock.mockClear();
    vi.unstubAllGlobals();
  });

  test("appears in the issuer header", () => {
    const html = renderToStaticMarkup(<IssuerHeader issuer={issuer()} />);

    expect(html).toContain("Back");
  });

  test("navigates back when browser history is available", () => {
    vi.stubGlobal("window", { history: { length: 2 } });

    buttons(<BackButton />)[0].props.onClick?.();

    expect(routerBackMock).toHaveBeenCalledTimes(1);
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  test("returns to the market page when there is no previous history entry", () => {
    vi.stubGlobal("window", { history: { length: 1 } });

    buttons(<BackButton />)[0].props.onClick?.();

    expect(routerBackMock).not.toHaveBeenCalled();
    expect(routerPushMock).toHaveBeenCalledWith("/");
  });
});
