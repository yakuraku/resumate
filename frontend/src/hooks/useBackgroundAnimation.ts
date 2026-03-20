"use client";

import { useState, useEffect, useCallback } from "react";

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

  // Hydrate from localStorage on mount
  useEffect(() => {
    setEnabledState(readEnabled());
    setAnimationTypeState(readType());
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    localStorage.setItem(ENABLED_KEY, String(value));
    setEnabledState(value);
  }, []);

  const setAnimationType = useCallback((value: BackgroundAnimationType) => {
    localStorage.setItem(TYPE_KEY, value);
    setAnimationTypeState(value);
  }, []);

  return { enabled, animationType, setEnabled, setAnimationType };
}
