const url = process.argv[2];
if (!url) process.exit(1);
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: "error" });
  process.exit(response.ok ? 0 : 1);
} catch {
  process.exit(1);
}
