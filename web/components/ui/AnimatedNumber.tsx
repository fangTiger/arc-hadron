"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const NUMBER_TOKEN = /[\d,]+(?:\.\d+)?/g;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function numberValue(token: string) {
  return Number(token.replaceAll(",", ""));
}

function decimalLength(token: string) {
  return token.includes(".") ? token.split(".")[1].length : 0;
}

function formatToken(value: number, targetToken: string) {
  const digits = decimalLength(targetToken);
  const fixed = value.toFixed(digits);

  if (!targetToken.includes(",")) {
    return fixed;
  }

  const [whole, fractional] = fixed.split(".");
  const grouped = Number(whole).toLocaleString("en-US");

  return fractional ? `${grouped}.${fractional}` : grouped;
}

function interpolateValue(target: string, progress: number, previous?: string) {
  const previousTokens = Array.from(previous?.matchAll(NUMBER_TOKEN) ?? []);
  let tokenIndex = 0;

  return target.replace(NUMBER_TOKEN, (token) => {
    const from = numberValue(previousTokens[tokenIndex]?.[0] ?? "0");
    const to = numberValue(token);
    tokenIndex += 1;

    return formatToken(from + (to - from) * progress, token);
  });
}

export function AnimatedNumber({ value }: { value: string }) {
  const previousValue = useRef<string | undefined>(undefined);
  const initialValue = useMemo(() => interpolateValue(value, 0), [value]);
  const [display, setDisplay] = useState(initialValue);

  useEffect(() => {
    if (prefersReducedMotion()) {
      const frame = requestAnimationFrame(() => {
        setDisplay(value);
        previousValue.current = value;
      });

      return () => cancelAnimationFrame(frame);
    }

    const startedAt = performance.now();
    const from = previousValue.current;
    let frame = 0;

    function tick(now: number) {
      const elapsed = Math.min((now - startedAt) / 720, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setDisplay(interpolateValue(value, eased, from));

      if (elapsed < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }

      previousValue.current = value;
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className="font-mono tabular-nums">{display}</span>;
}
