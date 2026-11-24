import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { registerRoutes } from "./routes";
import { log } from "./logger";
import { recordError, recordRequest, routeOf } from "./monitoring";

/**
 * Builds the Express app with everything both runtimes share: body parsing,
 * request logging, auth, the API, and the error handler.
 *
 * Deliberately free of vite and of `listen()` so it can be imported by the
 * Vercel serverless function without dragging the dev server into the bundle.
 */
export async function createApp(): Promise<Express> {
  const app = express();
  // B8.7: do not advertise the framework.
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    // B8.7 security headers: no MIME sniffing, no framing by other sites (clickjacking),
    // no referrer to other origins, no powerful browser features, HTTPS remembered in production.
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });
  // The default 100 KB body limit everywhere, except the logo upload (B4.7),
  // which carries an image of up to 300 KB as base64.
  const json = express.json();
  const logoJson = express.json({ limit: "512kb" });
  app.use((req, res, next) => (req.path === "/api/settings/logo" ? logoJson : json)(req, res, next));
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      // B8.4: every API request's time, by route pattern (no ids, no bodies).
      recordRequest(req, res.statusCode, Date.now() - start);
      if (!path.startsWith("/api")) return;
      let logLine = `${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`;
      // B8.7: a successful response carries patients' data — it does not go to the log.
      // Only a refusal's message does, to tell what went wrong.
      if (res.statusCode >= 400 && capturedJsonResponse && typeof capturedJsonResponse.message === "string") logLine += ` :: ${capturedJsonResponse.message}`;
      if (logLine.length > 120) logLine = logLine.slice(0, 119) + "…";
      log(logLine);
    });

    next();
  });

  await registerRoutes(app);

  // Last-resort handler. It logs rather than rethrows: rethrowing here would
  // take down the whole process (and, on serverless, the running instance).
  app.use(async (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const status =
      typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
    console.error("[error]", err);
    // B8.7: an unexpected failure's own text (a stack's message, a driver's error) stays in the log.
    const code = status || 500;
    if (code >= 500) await recordError({ source: "server", where: `${req.method} ${routeOf(req)}`, err, status: code, role: req.user?.role ?? null });
    const message = code < 500 && err instanceof Error ? err.message : "Ichki xatolik. Keyinroq urinib ko'ring";
    if (!res.headersSent) res.status(code).json({ message });
  });

  return app;
}
