import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Skeleton } from "../components/ui/Skeleton";

describe("motion system", () => {
  test("marks skeletons with the shimmer animation hook", () => {
    const html = renderToStaticMarkup(<Skeleton className="h-4 w-24" />);

    expect(html).toContain("hadron-skeleton");
    expect(html).toContain("before:animate-[hadron-skeleton_1.8s_ease-in-out_infinite]");
  });

  test("defines page fade and static reduced-motion fallbacks", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

    expect(css).toContain("@keyframes hadron-page-fade");
    expect(css).toContain(".hadron-page-transition");
    expect(css).toContain("animation: hadron-page-fade 180ms ease-out");
    expect(css).toContain(".hadron-skeleton::before");
    expect(css).toContain(".hadron-page-transition");
    expect(css).toContain("animation: none");
    expect(css).toContain("transition: none");
  });

  test("adds an app template wrapper for route-level fade-in", () => {
    expect(existsSync(join(process.cwd(), "app/template.tsx"))).toBe(true);
  });
});
