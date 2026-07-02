import carbon from "../content/assets/verra-carbon-9.json";
import gold from "../content/assets/gold-ounce-4.json";
import marina from "../content/assets/marina-tower-12f.json";
import tBill from "../content/assets/t-bill-2026-q3.json";

export interface AssetMeta {
  slug: string;
  nameZh: string;
  description: string;
  issuer: string;
  apyBps: number | null;
  docs: { label: string; note: string }[];
}

const UNKNOWN_META: AssetMeta = {
  slug: "unknown",
  nameZh: "未知资产",
  description:
    "该资产尚未登记静态披露信息。前端将继续展示链上基础数据，并等待后续元数据补录。",
  issuer: "HADRON Metadata Registry",
  apyBps: null,
  docs: [
    {
      label: "资产占位说明",
      note: "演示文档，非真实法律文件；用于说明未知资产的兜底展示策略。",
    },
    {
      label: "链上数据优先声明",
      note: "演示文档，非真实法律文件；资产份额与交易状态以合约读取结果为准。",
    },
  ],
};

const ASSET_META_BY_SLUG = new Map<string, AssetMeta>(
  [tBill, gold, marina, carbon].map((meta) => [meta.slug, meta as AssetMeta]),
);

function normalizeSlug(input: string): string {
  const prefix = "hadron://assets/";

  if (input.startsWith(prefix)) {
    return input.slice(prefix.length);
  }

  return input;
}

export function metaBySlug(slug: string): AssetMeta {
  return ASSET_META_BY_SLUG.get(normalizeSlug(slug)) ?? UNKNOWN_META;
}
