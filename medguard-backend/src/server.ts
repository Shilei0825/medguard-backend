import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";

import { env } from "./config/env";

// Import routes
import healthRoutes from "./routes/healthRoutes";
import scanRoutes from "./routes/scanRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import vendorRoutes from "./routes/vendorRoutes";
import alertRoutes from "./routes/alertRoutes";
import complianceRoutes from "./routes/complianceRoutes";
import redactionRoutes from "./routes/redactionRoutes";
import datasetRoutes from "./routes/datasetRoutes";
import reportRoutes from "./routes/reportRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";

// Initialize Express app
const app: Express = express();

/**
 * ============================================================================
 * CORS (single source of truth)
 * - Allows Lovable preview domains (*.lovableproject.com)
 * - Allows local dev (http://localhost:xxxx)
 * - Allows explicit production domains via env FRONTEND_ORIGINS
 *
 * NOTE: Keep credentials=false unless you are using cookies/sessions.
 * ============================================================================
 */

// Optional: comma-separated list of allowed origins from env
// Example:
// FRONTEND_ORIGINS="https://app.medguard.com,https://staging.medguard.com"
const extraAllowedOrigins = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOriginPatterns: RegExp[] = [
  /^https:\/\/.*\.lovableproject\.com$/i, // Lovable preview
  /^http:\/\/localhost:\d+$/i,            // local dev
  /^http:\/\/127\.0\.0\.1:\d+$/i,         // local dev
];

function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true; // allow curl/server-to-server
  if (extraAllowedOrigins.includes(origin)) return true;
  return allowedOriginPatterns.some((re) => re.test(origin));
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    maxAge: 86400,
  })
);

// Ensure preflight always succeeds
app.options("*", cors());

/**
 * ============================================================================
 * Middleware
 * ============================================================================
 */

// JSON body parser
app.use(express.json({ limit: "50mb" }));

// URL-encoded body parser (for form data)
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

/**
 * ============================================================================
 * Routes
 * ============================================================================
 */

app.use("/api/health", healthRoutes);

app.use("/api/scans", scanRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/redacted-files", redactionRoutes);
app.use("/api/safe-datasets", datasetRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/analytics", analyticsRoutes);

// Root endpoint
app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "MedGuard Backend API",
    version: "1.0.0",
    status: "running",
    documentation: "/api/health",
    endpoints: {
      health: "/api/health",
      scans: "/api/scans",
      dashboard: "/api/dashboard",
      vendors: "/api/vendors",
      alerts: "/api/alerts",
      compliance: "/api/compliance",
      redactedFiles: "/api/redacted-files",
      safeDatasets: "/api/safe-datasets",
      reports: "/api/reports",
      analytics: "/api/analytics",
    },
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist",
  });
});

/**
 * ============================================================================
 * Error Handling
 * ============================================================================
 */

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);

  const isDev = env.NODE_ENV === "development";

  // If CORS blocks an origin, it will throw here — we want a clean error response.
  res.status(500).json({
    error: "Internal Server Error",
    message: isDev ? err.message : "An unexpected error occurred",
    ...(isDev && { stack: err.stack }),
  });
});

/**
 * ============================================================================
 * Server Startup
 * ============================================================================
 */

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log("MedGuard Backend API");
  console.log("=".repeat(60));
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log("=".repeat(60));
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

export default app;
