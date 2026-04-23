import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://ca73d0feb71633c073ee67d14d3b71c3@o4511241673310208.ingest.de.sentry.io/4511244548112464",
  environment: process.env.NODE_ENV,
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
