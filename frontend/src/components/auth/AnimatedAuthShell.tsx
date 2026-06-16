'use client';

import { useRef, useEffect } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';

// ─── Particle field ───────────────────────────────────────────────────────────

// Deterministic positions via golden-angle distribution — no hydration mismatch.
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: (i * 137.508) % 100,
  y: (i * 97.3) % 100,
  size: 1.5 + (i % 3) * 0.5,
  duration: 8 + (i % 5) * 3,
  delay: (i * 0.7) % 5,
  driftY: -(40 + (i % 3) * 20),
}));

function ParticleField({ reduced }: { reduced: boolean }) {
  return (
    <div className="absolute inset-0">
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[#2dd4bf]"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={reduced ? {} : { y: [0, p.driftY, 0], opacity: [0.3, 0.7, 0.3] }}
          transition={
            reduced
              ? {}
              : { duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }
          }
        />
      ))}
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

// The inset highlight is baked into every animate keyframe so it stays static
// while Framer Motion interpolates only the outer colored shadow.
const GLOW_SHADOW_DIM = 'inset 0 1px 0 rgba(255,255,255,0.18), 0 0 40px rgba(45,212,191,0.10)';
const GLOW_SHADOW_BRIGHT = 'inset 0 1px 0 rgba(255,255,255,0.18), 0 0 70px rgba(45,212,191,0.22)';
const GLOW_SHADOW_STATIC = 'inset 0 1px 0 rgba(255,255,255,0.18)';

export default function AnimatedAuthShell({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion() ?? false;
  const videoRef = useRef<HTMLVideoElement>(null);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 50, damping: 20 });
  const sy = useSpring(my, { stiffness: 50, damping: 20 });

  const videoX = useTransform(sx, (v) => v * 18);
  const videoY = useTransform(sy, (v) => v * 18);
  const particleX = useTransform(sx, (v) => v * 38);
  const particleY = useTransform(sy, (v) => v * 38);
  const cardRotateY = useTransform(sx, (v) => v * 6);
  const cardRotateX = useTransform(sy, (v) => v * -6);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (reduced) {
      vid.pause();
    } else {
      vid.play().catch(() => {});
    }
  }, [reduced]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (reduced) return;
    mx.set(e.clientX / window.innerWidth - 0.5);
    my.set(e.clientY / window.innerHeight - 0.5);
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#0a0a0a]"
      onMouseMove={handleMouseMove}
    >
      {/* Layer 0: Video — scaled 110% so parallax shift never exposes edges */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0"
        aria-hidden="true"
        style={reduced ? {} : { x: videoX, y: videoY }}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full scale-110 object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        >
          {/* bg_loop.mp4 is the ffmpeg-baked seamless loop; bg_video.mp4 is the fallback */}
          <source src="/bg_loop.mp4" type="video/mp4" />
          <source src="/bg_video.mp4" type="video/mp4" />
        </video>
      </motion.div>

      {/* Layer 1: Dark overlays — vignette + flat scrim */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.45) 100%)',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-black/25"
        aria-hidden="true"
      />

      {/* Layer 2: Particle field */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-20"
        aria-hidden="true"
        style={reduced ? {} : { x: particleX, y: particleY }}
      >
        <ParticleField reduced={reduced} />
      </motion.div>

      {/* Layer 3: Liquid glass card — breathing outer glow + 3-D tilt on desktop */}
      <div className="relative z-30 flex min-h-screen items-center justify-center px-4 py-12">
        <motion.div
          animate={
            reduced
              ? {}
              : { boxShadow: [GLOW_SHADOW_DIM, GLOW_SHADOW_BRIGHT, GLOW_SHADOW_DIM] }
          }
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={
            reduced
              ? { background: 'rgba(19,24,29,0.32)', boxShadow: GLOW_SHADOW_STATIC }
              : { background: 'rgba(19,24,29,0.32)', transformPerspective: 800, rotateY: cardRotateY, rotateX: cardRotateX }
          }
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/20 backdrop-blur-3xl backdrop-saturate-[180%]"
        >

          {/* Specular sheen — soft top-left gradient highlight */}
          <div
            className="pointer-events-none absolute inset-0 z-10 rounded-3xl"
            aria-hidden="true"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.13), transparent 45%)',
            }}
          />

          {/* Card content */}
          <div className="relative z-20">
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
