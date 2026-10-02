import { printSnapshot, snapshot } from "./runtime.mjs";
try {
  printSnapshot(await snapshot());
} catch {
  console.error("Could not inspect local services. Check .env and run pnpm dev:full.");
  process.exitCode = 1;
}
