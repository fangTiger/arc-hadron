import type { KeyboardEvent, MouseEvent } from "react";

export function navigateToHref(href: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.location.href = href;
}

export function stopRowNavigation(event: MouseEvent<HTMLElement>): void {
  event.stopPropagation();
}

export function handleRowNavigationKeyDown(
  event: KeyboardEvent<HTMLElement>,
  href: string,
  navigate: (href: string) => void = navigateToHref,
): void {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  navigate(href);
}
