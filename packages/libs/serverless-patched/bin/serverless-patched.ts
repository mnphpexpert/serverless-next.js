#!/usr/bin/env node

import { execSync } from "child_process";
import { findUpSync } from "find-up";

console.info("Note: running patched serverless binary.");

const args = process.argv.slice(2).join(" ");
// This executes package-local serverless which uses a patched @serverless/cli
// Try to find the closest serverless binary which should be patched
const serverlessBin = findUpSync("node_modules/.bin/serverless");

execSync(`${serverlessBin} ${args}`, {
  stdio: "inherit"
});
