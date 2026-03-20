"use client";

import { useBackgroundAnimation } from "@/hooks/useBackgroundAnimation";
import { ParticlesBackground } from "./ParticlesBackground";
import { GalaxyBackground } from "./GalaxyBackground";

/**
 * Reads the user's background animation preference from localStorage
 * and renders the correct animation (or nothing if disabled).
 */
export function DashboardBackground() {
  const { enabled, animationType } = useBackgroundAnimation();

  if (!enabled) return null;
  if (animationType === "galaxy") return <GalaxyBackground />;
  return <ParticlesBackground />;
}
