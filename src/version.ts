import { readFileSync } from "node:fs";

/** The version in package.json, so the server can never report a stale number. */
export function packageVersion(): string {
  return (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;
}
