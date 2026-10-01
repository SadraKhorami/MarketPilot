import { cpSync, existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const destination = process.argv[2];
if (!destination) throw new Error("Specify a deployed application directory.");
const sourceRequire = createRequire(resolve("packages/db/package.json"));
const sourceClientRequire = createRequire(sourceRequire.resolve("@prisma/client/package.json"));
const generated = dirname(sourceClientRequire.resolve(".prisma/client/default"));
if (!readdirSync(generated).some((name) => name.includes("query_engine") && name.endsWith(".so.node")))
  throw new Error("A generated Linux Prisma engine is required.");
const appRequire = createRequire(resolve(destination, "package.json"));
const dbRequire = createRequire(appRequire.resolve("@marketpilot/db"));
const clientDirectory = dirname(dbRequire.resolve("@prisma/client/package.json"));
// pnpm deploy installs a fresh @prisma/client package. Copy the client generated on this architecture.
cpSync(generated, resolve(clientDirectory, "../../.prisma/client"), { recursive: true });
if (!existsSync(createRequire(resolve(clientDirectory, "package.json")).resolve(".prisma/client/default")))
  throw new Error("Prisma client packaging failed.");
