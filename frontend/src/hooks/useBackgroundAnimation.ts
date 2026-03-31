"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";

export type BackgroundAnimationType = "particles" | "galaxy";

const ENABLED_KEY = "bg-animation-enabled";
const TYPE_KEY = "bg-animation-type";

function readEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const v = localStorage.getItem(ENABLED_KEY);
  return v === null ? true : v === "true"; // default on
}

function readType(): BackgroundAnimationType {
  if (typeof window === "undefined") return "particles";
  const v = localStorage.getItem(TYPE_KEY);
  return v === "galaxy" ? "galaxy" : "particles"; // default particles
}

export function useBackgroundAnimation() {
  const [enabled, setEnabledState] = useState<boolean>(false);
  const [animationType, setAnimationTypeState] = useState<BackgroundAnimationType>("particles");

  // Hydrate: localStorage first (fast), then backend (reliable/persistent)
  useEffect(() => {
    // Fast path: localStorage cache
    setEnabledState(readEnabled());
    setAnimationTypeState(readType());

    // Reliable path: backend (source of truth)
    apiClient.get("/settings").then((res) => {
      const data = res.data;
      if (data.bg_animation_enabled !== undefined) {
        localStorage.setItem(ENABLED_KEY, String(data.bg_animation_enabled));
        setEnabledState(data.bg_animation_enabled);
      }
      if (data.bg_animation_type) {
        const type: BackgroundAnimationType = data.bg_animation_type === "galaxy" ? "galaxy" : "particles";
        localStorage.setItem(TYPE_KEY, type);
        setAnimationTypeState(type);
      }
    }).catch(() => {
      // Backend unavailable — localStorage values already set above
    });
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    localStorage.setItem(ENABLED_KEY, String(value));
    setEnabledState(value);
    apiClient.put("/settings", { bg_animation_enabled: value }).catch(() => {});
  }, []);

  const setAnimationType = useCallback((value: BackgroundAnimationType) => {
    localStorage.setItem(TYPE_KEY, value);
    setAnimationTypeState(value);
    apiClient.put("/settings", { bg_animation_type: value }).catch(() => {});
  }, []);

  return { enabled, animationType, setEnabled, setAnimationType };
}
