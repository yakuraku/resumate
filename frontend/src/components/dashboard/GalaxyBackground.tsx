"use client";

import { useMemo } from "react";
import { useTheme, type Theme } from "@/components/theme-provider";
import dynamic from "next/dynamic";

// Dynamic import — WebGL can't run on the server
const Galaxy = dynamic(() => import("@/components/Galaxy"), { ssr: false });

interface GalaxyConfig {
  /** Center of the hue band (0–1). Derived from each theme's primary hex. */
  hueCenter: number;
  /**
   * Width of the hue band (0–1).
   * 0.08 ≈ ±29° — gives clearly different shades without leaving the accent family.
   * 0.06 ≈ ±22° — tighter, useful for colors with less adjacent contrast.
   */
  hueRange: number;
  /** Chroma/vividness of stars. Higher = more saturated colours. */
  saturation: number;
  density: number;
  glowIntensity: number;
  speed: number;
  twinkleIntensity: number;
  rotationSpeed: number;
  /** CSS opacity of the whole canvas layer — keep low enough for text legibility. */
  opacity: number;
  /**
   * Alpha threshold for the transparent render path (0–1).
   * Pixels where length(col) < threshold get alpha=0, eliminating the dim grey
   * halos that appear when low-alpha dark-glow pixels composite on light backgrounds.
   * Use 0 for dark themes (preserve full glow), ~0.1 for light themes.
   */
  alphaThreshold: number;
}

/**
 * Per-theme config.
 *
 * hueCenter values are computed from the primary hex of each theme:
 *   light    #0d9488 → H ≈ 175° → 175/360 = 0.486
 *   dark     #2dd4bf → H ≈ 172° → 172/360 = 0.478   (target: rgb(82,254,227) and darker teal shades)
 *   pastel   #7c3aed → H ≈ 262° → 262/360 = 0.728
 *   neutral  #b45309 → H ≈  26° →  26/360 = 0.072
 *   midnight #60a5fa → H ≈ 213° → 213/360 = 0.592
 */
const THEME_CONFIGS: Record<string, GalaxyConfig> = {
  light: {
    hueCenter: 0.486,
    hueRange: 0.07,
    saturation: 2.2,      // high saturation → glow pixels are vivid teal, not grey
    density: 1.4,
    glowIntensity: 0.45,  // brighter cores so stars survive the higher threshold
    speed: 0.45,
    twinkleIntensity: 0.4,
    rotationSpeed: 0.06,
    opacity: 0.55,
    alphaThreshold: 0.2,  // clip everything below 0.2 — eliminates dim grey halos
  },
  dark: {
    hueCenter: 0.478,
    hueRange: 0.20,      // ±0.10 = ±36° → green-teal → teal → cyan → blue, same perceptual spread as midnight
    saturation: 2.0,     // match midnight richness — more stars stay vivid rather than washing out
    density: 1.8,        // match midnight — more stars = more visible color variety
    glowIntensity: 0.48, // match midnight — brighter halos bring out the color differences
    speed: 0.85,
    twinkleIntensity: 0.6,
    rotationSpeed: 0.09,
    opacity: 0.65,
    alphaThreshold: 0.0,
  },
  pastel: {
    hueCenter: 0.728,
    hueRange: 0.07,
    saturation: 2.0,      // vivid violet so glow is purple-colored, not grey
    density: 1.3,
    glowIntensity: 0.4,
    speed: 0.5,
    twinkleIntensity: 0.45,
    rotationSpeed: 0.06,
    opacity: 0.52,
    alphaThreshold: 0.2,  // clip dim halos on lavender/white background
  },
  neutral: {
    hueCenter: 0.072,
    hueRange: 0.06,
    saturation: 2.0,      // vivid amber so glow is warm-colored, not grey
    density: 1.2,
    glowIntensity: 0.38,
    speed: 0.45,
    twinkleIntensity: 0.35,
    rotationSpeed: 0.05,
    opacity: 0.48,
    alphaThreshold: 0.2,  // clip dim halos on warm stone background
  },
  midnight: {
    hueCenter: 0.592,
    hueRange: 0.08,
    saturation: 1.8,
    density: 1.8,
    glowIntensity: 0.48,
    speed: 0.95,
    twinkleIntensity: 0.6,
    rotationSpeed: 0.1,
    opacity: 0.68,
    alphaThreshold: 0.0,
  },
};

function getConfig(theme: Theme): GalaxyConfig {
  if (theme === "system") {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return THEME_CONFIGS.dark;
    }
    return THEME_CONFIGS.light;
  }
  return THEME_CONFIGS[theme] ?? THEME_CONFIGS.light;
}

export function GalaxyBackground() {
  const { theme } = useTheme();
  const cfg = useMemo(() => getConfig(theme), [theme]);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ opacity: cfg.opacity }}
      aria-hidden="true"
    >
      <Galaxy
        hueCenter={cfg.hueCenter}
        hueRange={cfg.hueRange}
        hueShift={0}
        saturation={cfg.saturation}
        density={cfg.density}
        glowIntensity={cfg.glowIntensity}
        speed={cfg.speed}
        twinkleIntensity={cfg.twinkleIntensity}
        rotationSpeed={cfg.rotationSpeed}
        alphaThreshold={cfg.alphaThreshold}
        transparent
        mouseInteraction={false}
      />
    </div>
  );
}
