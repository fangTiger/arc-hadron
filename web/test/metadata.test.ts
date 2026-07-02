import { describe, expect, test } from "vitest";
import { metaBySlug, type AssetMeta } from "../lib/metadata";

const slugs = [
  "t-bill-2026-q3",
  "gold-ounce-4",
  "marina-tower-12f",
  "verra-carbon-9",
] as const;

const expectedApy: Record<(typeof slugs)[number], number | null> = {
  "t-bill-2026-q3": 510,
  "gold-ounce-4": null,
  "marina-tower-12f": 620,
  "verra-carbon-9": null,
};

function expectCompleteMeta(meta: AssetMeta) {
  expect(meta.slug).toBeTruthy();
  expect(meta.nameZh).toBeTruthy();
  expect(meta.description).toBeTruthy();
  expect(meta.issuer).toBeTruthy();
  expect(meta.apyBps === null || typeof meta.apyBps === "number").toBe(true);
  expect(meta.docs.length).toBeGreaterThanOrEqual(2);

  for (const doc of meta.docs) {
    expect(doc.label).toBeTruthy();
    expect(doc.note).toContain("演示文档，非真实法律文件");
  }
}

describe("静态资产元数据", () => {
  test("4 个链上 slug 均可解析且字段完整", () => {
    for (const slug of slugs) {
      const meta = metaBySlug(slug);

      expect(meta.slug).toBe(slug);
      expect(meta.apyBps).toBe(expectedApy[slug]);
      expectCompleteMeta(meta);
    }
  });

  test("支持 hadron://assets/<slug> metadataURI", () => {
    expect(metaBySlug("hadron://assets/verra-carbon-9").slug).toBe("verra-carbon-9");
  });

  test("未知 slug 返回兜底资产", () => {
    const meta = metaBySlug("missing-asset");

    expect(meta.slug).toBe("unknown");
    expect(meta.nameZh).toBe("未知资产");
    expectCompleteMeta(meta);
  });
});
