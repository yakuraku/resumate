"use client";

import { useMemo } from "react";
import { useTheme, type Theme } from "@/components/theme-provider";
import dynamic from "next/dynamic";

// Dynamic import — WebGL can't run on the server
const Particles = dynamic(() => import("@/components/Particles"), { ssr: false });

interface ParticleConfig {
  colors: string[];
  opacity: number;
  count: number;
  speed: number;
  baseSize: number;
  spread: number;
}

/**
 * Particle colors and density tuned per theme.
 * Light themes: muted, low-opacity particles so text stays crisp.
 * Dark themes: more luminous particles at slightly higher opacity.
 */
const THEME_CONFIGS: Record<string, ParticleConfig> = {
  light: {
    // Teal family — echoes the primary hue on a white/near-white bg
    colors: ["#0d9488", "#14b8a6", "#0f766e", "#5eead4", "#0e7490"],
    opacity: 0.28,
    count: 960,
    speed: 0.055,
    baseSize: 170,
    spread: 11,
  },
  dark: {
    // Vivid teal/cyan against near-black
    colors: ["#2dd4bf", "#14b8a6", "#5eead4", "#a5f3fc", "#0891b2"],
    opacity: 0.5,
    count: 1200,
    speed: 0.07,
    baseSize: 180,
    spread: 12,
  },
  pastel: {
    // Violet / indigo palette to match the lavender theme
    colors: ["#7c3aed", "#8b5cf6", "#a78bfa", "#6d28d9", "#c4b5fd"],
    opacity: 0.3,
    count: 1000,
    speed: 0.05,
    baseSize: 170,
    spread: 11,
  },
  neutral: {
    // Warm amber / bronze tones to complement the stone palette
    colors: ["#b45309", "#d97706", "#f59e0b", "#92400e", "#ca8a04"],
    opacity: 0.28,
    count: 920,
    speed: 0.05,
    baseSize: 160,
    spread: 10,
  },
  midnight: {
    // Cool blues against the deep navy background — most dramatic
    colors: ["#60a5fa", "#3b82f6", "#93c5fd", "#2563eb", "#bfdbfe"],
    opacity: 0.55,
    count: 1280,
    speed: 0.08,
    baseSize: 190,
    spread: 13,
  },
};

function getConfig(theme: Theme): ParticleConfig {
  if (theme === "system") {
    // "system" is handled by the provider but fall back gracefully
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return THEME_CONFIGS.dark;
    }
    return THEME_CONFIGS.light;
  }
  return THEME_CONFIGS[theme] ?? THEME_CONFIGS.light;
}

export function ParticlesBackground() {
  const { theme } = useTheme();
  const cfg = useMemo(() => getConfig(theme), [theme]);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ opacity: cfg.opacity }}
      aria-hidden="true"
    >
      <Particles
        className="w-full h-full"
        particleCount={cfg.count}
        particleColors={cfg.colors}
        particleSpread={cfg.spread}
        speed={cfg.speed}
        particleBaseSize={cfg.baseSize}
        sizeRandomness={0.9}
        alphaParticles
        moveParticlesOnHover={false}
        cameraDistance={22}
        disableRotation={false}
      />
    </div>
  );
}
