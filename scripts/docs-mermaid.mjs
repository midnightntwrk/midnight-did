#!/usr/bin/env node
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { existsSync, statSync } from "node:fs";
import process from "node:process";

const DEFAULT_SOURCES = ["README.md", "docs"];
const DEFAULT_OUT_DIR = "docs/assets/book-diagrams";
const DEFAULT_MANIFEST_PATH = "docs/assets/book-diagrams/manifest.json";
const USAGE = `Usage:
  node scripts/docs-mermaid.mjs <check|render> [options]

Modes:
  check   - validate Mermaid blocks by rendering to temporary files only
  render  - render Mermaid blocks to files under --out-dir

Options:
  --source <path>        Add a source file or directory (default: docs + README.md)
  --format <png|svg|both> (default: both for render, svg for check)
  --out-dir <path>       Directory for rendered outputs (default: ${DEFAULT_OUT_DIR})
  --manifest <path>      Manifest output path (default: ${DEFAULT_MANIFEST_PATH})
  --help                 Show this help text`;

const parseArgs = () => {
  const raw = process.argv.slice(2);
  const options = {
    mode: "check",
    sources: [],
    format: "svg",
    outDir: DEFAULT_OUT_DIR,
    manifestPath: DEFAULT_MANIFEST_PATH,
  };

  if (raw.length === 0 || raw[0] === "--help" || raw[0] === "-h") {
    console.log(USAGE);
    process.exit(0);
  }

  options.mode = raw[0];
  if (options.mode !== "check" && options.mode !== "render") {
    throw new Error(`Expected mode "check" or "render", got ${options.mode}`);
  }
  if (options.mode === "render") {
    options.format = "both";
  }

  for (let index = 1; index < raw.length; index += 1) {
    const arg = raw[index];
    const next = raw[index + 1];

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    if (arg === "--help") {
      console.log(USAGE);
      process.exit(0);
    }
    if (arg === "--source") {
      if (next == null || next.startsWith("--")) {
        throw new Error("--source requires a value");
      }
      options.sources.push(next);
      index += 1;
      continue;
    }
    if (arg === "--out-dir") {
      if (next == null || next.startsWith("--")) {
        throw new Error("--out-dir requires a value");
      }
      options.outDir = next;
      index += 1;
      continue;
    }
    if (arg === "--manifest") {
      if (next == null || next.startsWith("--")) {
        throw new Error("--manifest requires a value");
      }
      options.manifestPath = next;
      index += 1;
      continue;
    }
    if (arg === "--format") {
      if (next == null || next.startsWith("--")) {
        throw new Error("--format requires a value");
      }
      const value = next.toLowerCase();
      if (value !== "png" && value !== "svg" && value !== "both") {
        throw new Error("--format must be one of: png, svg, both");
      }
      options.format = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const toSha256Hex = (text) =>
  createHash("sha256")
    .update(text, "utf8")
    .digest("hex");

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/^[^a-z0-9]+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "diagram";

const listMarkdownFiles = (pathOrDir, result = []) => {
  const absPath = resolve(pathOrDir);
  if (!existsSync(absPath)) {
    return result;
  }

  const stat = statSync(absPath);
  if (stat.isFile()) {
    if (extname(absPath).toLowerCase() === ".md") {
      result.push(absPath);
    }
    return result;
  }

  if (!stat.isDirectory()) {
    return result;
  }

  for (const entry of readdirSync(absPath, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }

    const childPath = resolve(absPath, entry.name);
    if (entry.isDirectory()) {
      listMarkdownFiles(childPath, result);
      continue;
    }
    if (!entry.isFile() || !childPath.endsWith(".md")) {
      continue;
    }
    result.push(childPath);
  }

  return result;
};

const collectSources = (sources) => {
  const candidates = sources.length > 0 ? sources : DEFAULT_SOURCES;
  const files = [];
  for (const entry of candidates) {
    listMarkdownFiles(entry, files);
  }
  const unique = Array.from(new Set(files));
  unique.sort();
  return unique;
};

const extractMermaidBlocks = (content, sourcePath) => {
  const lines = content.split("\n");
  const blocks = [];
  let headingStack = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const headingMatch = line.match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      headingStack = headingStack.slice(0, level - 1);
      headingStack[level - 1] = headingMatch[2];
      continue;
    }

    if (line.trim() !== "```mermaid") {
      continue;
    }

    const startLine = index + 1;
    const body = [];
    let end = startLine;

    while (end < lines.length && lines[end].trim() !== "```") {
      body.push(lines[end]);
      end += 1;
    }

    if (end >= lines.length) {
      throw new Error(`Unclosed mermaid block in ${sourcePath}:${startLine}`);
    }

    const text = body.join("\n").trim();
    const firstToken = text
      .split("\n")
      .map((entry) => entry.trim())
      .find((entry) => entry.length > 0);
    const diagramType = firstToken == null ? "unknown" : firstToken.split(/\s+/)[0];
    const heading = headingStack.filter(Boolean).join(" / ");

    blocks.push({
      sourcePath,
      startLine,
      endLine: end + 1,
      diagramType,
      heading,
      text,
      textHash: toSha256Hex(text),
      lineCount: body.length,
      ordinal: blocks.length + 1,
    });

    index = end;
  }
  return blocks;
};

const renderSingle = (inputPath, outputPath, renderer, extraArgs = []) => {
  const args = [
    "-i",
    inputPath,
    "-o",
    outputPath,
    "--quiet",
    ...extraArgs,
  ];
  const result = spawnSync(renderer.cmd, [...renderer.args, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120000,
  });
  if (result.status !== 0) {
    throw new Error(
      `Mermaid rendering failed (${renderer.label}) for ${outputPath}: ${result.stderr || result.stdout}`,
    );
  }
};

const createRenderer = () => {
  const localBin = resolve(process.cwd(), "node_modules/.bin/mmdc");
  const candidates = [
    { label: "local", cmd: localBin, args: [] },
    { label: "path", cmd: "mmdc", args: [] },
    { label: "npx", cmd: "npx", args: ["-y", "@mermaid-js/mermaid-cli"] },
  ];

  for (const candidate of candidates) {
    const probe = spawnSync(candidate.cmd, [...candidate.args, "--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (probe.status === 0) {
      return candidate;
    }
  }

  throw new Error(
    "Mermaid renderer unavailable. Install @mermaid-js/mermaid-cli or ensure `mmdc` is on PATH.",
  );
};

const runRender = (options) => {
  const sources = collectSources(options.sources);
  if (sources.length === 0) {
    throw new Error("No markdown sources were found.");
  }

  const outDir = resolve(options.outDir);
  const manifestPath = resolve(options.manifestPath);
  mkdirSync(outDir, { recursive: true });

  const formatList = options.format === "both" ? ["svg", "png"] : [options.format];
  const renderer = createRenderer();
  const manifest = {
    generatedAt: new Date().toISOString(),
    sources,
    mode: options.mode,
    renderer: renderer.label,
    format: options.format,
    blocks: [],
  };

  for (const sourcePath of sources) {
    const content = readFileSync(sourcePath, "utf8");
    const blocks = extractMermaidBlocks(content, sourcePath);
    if (blocks.length === 0) {
      continue;
    }

    const sourceSlug = slugify(relative(process.cwd(), sourcePath));

    for (const block of blocks) {
      const safeHeading = slugify(block.heading || `block-${block.ordinal}`);
      const baseName = `${sourceSlug}-${safeHeading}-block-${String(block.ordinal).padStart(3, "0")}`;
      const tempDir = mkdtempSync(resolve(tmpdir(), "midnight-did-mermaid-"));
      const tempInput = resolve(tempDir, "diagram.mmd");
      writeFileSync(tempInput, block.text, "utf8");

      try {
        const blockEntry = {
          sourcePath,
          sourceHash: toSha256Hex(sourcePath),
          heading: block.heading,
          diagramType: block.diagramType,
          startLine: block.startLine,
          endLine: block.endLine,
          textHash: block.textHash,
          outputs: {},
        };
        for (const fmt of formatList) {
          const outputFile = resolve(outDir, `${baseName}.${fmt}`);
          renderSingle(tempInput, outputFile, renderer);
          const outputBytes = readFileSync(outputFile);
          if (outputBytes.length === 0) {
            throw new Error(`Rendered output is empty: ${outputFile}`);
          }
          blockEntry.outputs[fmt] = relative(process.cwd(), outputFile).replaceAll(
            sep,
            "/",
          );
          blockEntry.outputs[`${fmt}Hash`] = toSha256Hex(outputBytes.toString("base64"));
        }
        manifest.blocks.push(blockEntry);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }

  manifest.totalBlocks = manifest.blocks.length;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Rendered ${manifest.totalBlocks} Mermaid block(s) to ${relative(process.cwd(), outDir)}`);
};

const runCheck = (options) => {
  const sources = collectSources(options.sources);
  if (sources.length === 0) {
    throw new Error("No markdown sources were found.");
  }

  const renderer = createRenderer();
  const errors = [];
  let checked = 0;
  const tempDir = mkdtempSync(resolve(tmpdir(), "midnight-did-mermaid-check-"));
  try {
    for (const sourcePath of sources) {
      const content = readFileSync(sourcePath, "utf8");
      const blocks = extractMermaidBlocks(content, sourcePath);
      for (const block of blocks) {
        const verifyInput = resolve(tempDir, `${toSha256Hex(sourcePath + block.startLine).slice(0, 16)}.mmd`);
        const verifyOutput = resolve(tempDir, `${toSha256Hex(sourcePath + block.startLine).slice(0, 16)}.svg`);
        writeFileSync(verifyInput, block.text, "utf8");
        try {
          renderSingle(verifyInput, verifyOutput, renderer);
          checked += 1;
        } catch (error) {
          errors.push(`${sourcePath}:${block.startLine}-${block.endLine} (${block.diagramType}) => ${error.message}`);
        }
      }
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  if (errors.length > 0) {
    console.error("Mermaid check failures:");
    for (const error of errors) {
      console.error(` - ${error}`);
    }
    process.exit(1);
  }

  console.log(`Mermaid check passed (${checked} blocks validated).`);
};

const main = () => {
  const options = parseArgs();
  if (options.mode === "render") {
    runRender(options);
    return;
  }
  runCheck(options);
};

main();
