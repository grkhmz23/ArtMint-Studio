#!/usr/bin/env node
/**
 * Vercel build wrapper.
 *
 * Ensures Prisma migrations are applied for production deployments before
 * the Next.js build runs, preventing runtime P2021 errors from missing tables.
 *
 * Preview/dev builds skip migrations by default.
 *
 * Usage:
 *   pnpm run vercel:build
 *   pnpm run vercel:build -- --dry-run
 */

const { spawnSync } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const vercelEnv = process.env.VERCEL_ENV || "unknown";
const forceMigrations = process.env.RUN_DB_MIGRATIONS === "1";
const shouldRunMigrations = vercelEnv === "production" || forceMigrations;

function run(cmd, args) {
  const pretty = [cmd, ...args].join(" ");
  console.log(`[vercel-build] ${dryRun ? "DRY RUN " : ""}running: ${pretty}`);

  if (dryRun) return;

  const result = spawnSync(cmd, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
  });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    console.error(`[vercel-build] Failed to run: ${pretty}`);
    console.error(result.error.message);
    process.exit(1);
  }
}

console.log(`[vercel-build] VERCEL_ENV=${vercelEnv}`);

if (shouldRunMigrations) {
  run("npx", ["prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"]);
} else {
  console.log(
    "[vercel-build] Skipping prisma migrate deploy (non-production build). Set RUN_DB_MIGRATIONS=1 to override."
  );
}

run("pnpm", ["build"]);
