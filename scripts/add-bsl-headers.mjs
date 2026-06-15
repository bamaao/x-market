#!/usr/bin/env node
/**
 * One-shot script: prepend BSL 1.1 file headers to project source files.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "vendor",
  "cargokit",
  "build",
  "target",
  "__pycache__",
  "out",
  ".turbo",
  ".run",
  ".move",
]);

const SKIP_FILE_NAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.lock",
  "Move.lock",
  "pubspec.lock",
]);

const EXT_STYLE = {
  "//": new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".move",
    ".rs",
    ".dart",
    ".swift",
    ".go",
    ".java",
    ".kt",
    ".kts",
    ".cc",
    ".cpp",
    ".c",
    ".h",
    ".hpp",
  ]),
  "#": new Set([
    ".sh",
    ".bash",
    ".py",
    ".ps1",
    ".yaml",
    ".yml",
    ".toml",
    ".cmake",
    ".gradle",
    ".properties",
    ".dockerfile",
  ]),
  "/*": new Set([".css", ".scss"]),
  "--": new Set([".sql"]),
  "<!--": new Set([".html", ".xml", ".xib", ".plist", ".md"]),
};

const SPECIAL_NAMES = {
  Dockerfile: "#",
  "CMakeLists.txt": "#",
  "build.gradle.kts": "#",
  "settings.gradle.kts": "#",
};

const BSL_MARKER = "Business Source License 1.1 (BSL 1.1)";

function headerForStyle(style) {
  const lines = [
    "Copyright (c) 2026 zouyc zouyccq@gmail.com.",
    "All rights reserved.",
    "",
    "Licensed under the Business Source License 1.1 (BSL 1.1).",
    "You may not use this file except in compliance with the License.",
    "",
    "Change Date: 2031-01-01",
    "On the Change Date, or the fourth anniversary of the first publicly available",
    "distribution of the code under the BSL, whichever comes first, the code",
    "automatically becomes available under the Apache License 2.0.",
  ];

  switch (style) {
    case "//":
      return (
        lines.map((l) => (l === "" ? "//" : `// ${l}`)).join("\n") + "\n\n"
      );
    case "#":
      return (
        lines.map((l) => (l === "" ? "#" : `# ${l}`)).join("\n") + "\n\n"
      );
    case "/*":
      return (
        "/*\n" +
        lines.map((l) => (l === "" ? " *" : ` * ${l}`)).join("\n") +
        "\n */\n\n"
      );
    case "--":
      return (
        lines.map((l) => (l === "" ? "--" : `-- ${l}`)).join("\n") + "\n\n"
      );
    case "<!--":
      return (
        "<!--\n" +
        lines.map((l) => (l === "" ? "" : `  ${l}`)).join("\n") +
        "\n-->\n\n"
      );
    default:
      throw new Error(`Unknown style: ${style}`);
  }
}

function styleForFile(filePath) {
  const base = path.basename(filePath);
  if (base in SPECIAL_NAMES) return SPECIAL_NAMES[base];
  if (base.endsWith(".gradle.kts")) return "#";

  const ext = path.extname(filePath).toLowerCase();
  for (const [style, exts] of Object.entries(EXT_STYLE)) {
    if (exts.has(ext)) return style;
  }
  return null;
}

function shouldSkipDir(name) {
  return SKIP_DIRS.has(name);
}

function shouldSkipFile(filePath) {
  const base = path.basename(filePath);
  if (SKIP_FILE_NAMES.has(base)) return true;
  if (base.endsWith(".lock")) return true;
  if (base.endsWith(".min.js")) return true;
  if (base.endsWith(".d.ts") && base === "next-env.d.ts") return false;
  return false;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      walk(path.join(dir, entry.name), files);
      continue;
    }
    files.push(path.join(dir, entry.name));
  }
  return files;
}

function prependHeader(content, header, style) {
  if (content.includes(BSL_MARKER)) return content;

  if (style === "#" && content.startsWith("#!")) {
    const nl = content.indexOf("\n");
    if (nl === -1) return content;
    const shebang = content.slice(0, nl + 1);
    const rest = content.slice(nl + 1).replace(/^\n/, "");
    return shebang + header + rest;
  }

  return header + content;
}

const files = walk(ROOT);
let updated = 0;
let skipped = 0;
const noStyle = [];

for (const filePath of files) {
  if (shouldSkipFile(filePath)) {
    skipped++;
    continue;
  }

  const style = styleForFile(filePath);
  if (!style) continue;

  const content = fs.readFileSync(filePath, "utf8");
  if (content.includes(BSL_MARKER)) {
    skipped++;
    continue;
  }

  const header = headerForStyle(style);
  const next = prependHeader(content, header, style);
  if (next !== content) {
    fs.writeFileSync(filePath, next, "utf8");
    updated++;
  }
}

const processed = updated + skipped;
console.log(`BSL headers added to ${updated} files (${skipped} already had headers or were skipped).`);
if (noStyle.length) {
  console.log("Files without matching style:", noStyle.length);
}
