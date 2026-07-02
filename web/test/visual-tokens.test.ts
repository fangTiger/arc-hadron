import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function cssToken(css: string, name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6});`));

  if (!match) {
    throw new Error(`缺少 CSS token --${name}`);
  }

  return match[1];
}

describe("A+ 视觉 token", () => {
  test("muted 小字号文本在主背景与面板上满足 WCAG AA 对比度", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const muted = cssToken(css, "muted");

    expect(contrastRatio(muted, cssToken(css, "bg"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(muted, cssToken(css, "panel"))).toBeGreaterThanOrEqual(4.5);
  });
});
