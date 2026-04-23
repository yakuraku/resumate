import * as Sentry from "@sentry/nextjs";

// DSN is hardcoded because Next.js Turbopack does not run the @sentry/nextjs
// webpack plugin, so NEXT_PUBLIC_SENTRY_DSN is never inlined into the bundle.
// The DSN is intentionally public -- it is the browser-facing ingest endpoint.
Sentry.init({
  dsn: "https://ca73d0feb71633c073ee67d14d3b71c3@o4511241673310208.ingest.de.sentry.io/4511244548112464",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],
});

// Captures Sentry trace on every client-side route transition.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
