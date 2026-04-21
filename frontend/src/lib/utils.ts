import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns '#ffffff' or '#000000' depending on which gives better
 * contrast against the given hex background color.
 * Uses WCAG relative luminance formula.
 */
export function getContrastColor(hex: string): "#ffffff" | "#000000" {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return "#ffffff";
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  // Threshold 0.179 is the WCAG midpoint for 4.5:1 contrast ratio
  return L > 0.179 ? "#000000" : "#ffffff";
}
