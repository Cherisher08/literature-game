/** Runtime configuration. All durations live in constants (§54). */

const num = (v: string | undefined, fallback: number): number => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  port: num(process.env["PORT"], 3001),
  /** Comma-separated allowed origins; "*" in development. */
  corsOrigins: (process.env["CORS_ORIGINS"] ?? "*").split(",").map((s) => s.trim()),
  sweepIntervalMs: num(process.env["SWEEP_INTERVAL_MS"], 60_000),
  isProduction: process.env["NODE_ENV"] === "production",
};
