// src/instrument.ts
import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

Sentry.init({
  dsn: "https://b9a2e7a5491dfe96df2e3ab0c090e2b4@o4511139385573376.ingest.us.sentry.io/4511139390029824",
  
  debug: true, 

  integrations: [
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
    // 1. ADD THIS FOR PROFILING
    Sentry.browserProfilingIntegration(), 
    Sentry.replayIntegration(),
  ],
  
  // Performance Monitoring
  tracesSampleRate: 1.0, 
  
  // 2. ADD THIS (Must be > 0 to see profiling data)
  profilesSampleRate: 1.0,

  // Session Replay
  replaysSessionSampleRate: 0.1, 
  replaysOnErrorSampleRate: 1.0,
});