import { afterEach, describe, expect, test } from "vitest";
import { visibleRefetch } from "../lib/hooks/visibilityAware";

const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");

function restoreDocument() {
  if (originalDocumentDescriptor) {
    Object.defineProperty(globalThis, "document", originalDocumentDescriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, "document");
}

function clearDocument() {
  Reflect.deleteProperty(globalThis, "document");
}

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { hidden },
  });
}

describe("visibleRefetch", () => {
  afterEach(() => {
    restoreDocument();
  });

  test("returns the interval during SSR (no document)", () => {
    clearDocument();

    const interval = visibleRefetch(20_000);
    expect(interval()).toBe(20_000);
  });

  test("returns false when the document is hidden", () => {
    setDocumentHidden(true);

    const interval = visibleRefetch(40_000);
    expect(interval()).toBe(false);
  });

  test("returns the interval when the document is visible", () => {
    setDocumentHidden(false);

    const interval = visibleRefetch(90_000);
    expect(interval()).toBe(90_000);
  });

  test("re-evaluates visibility on each call (not cached at creation)", () => {
    // 关键：helper 生成一次后，运行时切换 hidden 状态时必须能感知到
    setDocumentHidden(false);
    const interval = visibleRefetch(20_000);
    expect(interval()).toBe(20_000);

    setDocumentHidden(true);
    expect(interval()).toBe(false);

    setDocumentHidden(false);
    expect(interval()).toBe(20_000);
  });
});
