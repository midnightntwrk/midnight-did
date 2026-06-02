#!/usr/bin/env node
const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);

if (Number.isNaN(major) || major < 24) {
  console.error(
    `[ensure-node-24] Node 24+ is required. Current: ${process.versions.node}. Run "nvm use 24".`,
  );
  process.exit(1);
}
