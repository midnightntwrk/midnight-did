import { randomUUID } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  rmdirSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const outputRelativePath = "test-results/w3c-conformance";
const outputStagePrefix = ".w3c-output-stage-";
const cleanupStagePrefix = ".w3c-cleanup-stage-";

const fail = (detail) => {
  throw new Error(`Unsafe conformance output directory: ${detail}`);
};

const assertDirectoryIdentity = (path, identity) => {
  const stat = lstatSync(path);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    stat.dev !== identity.dev ||
    stat.ino !== identity.ino ||
    stat.uid !== identity.uid
  ) {
    fail(`owned directory identity changed: ${path}`);
  }
};

const directoryIdentity = (path) => {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    fail(`not a directory: ${path}`);
  if (typeof process.geteuid === "function" && stat.uid !== process.geteuid()) {
    fail(`unexpected owner: ${path}`);
  }
  return { dev: stat.dev, ino: stat.ino, uid: stat.uid };
};

const assertNoSymlinkComponents = (path) => {
  const absolute = resolve(path);
  let cursor = parse(absolute).root;
  for (const part of relative(cursor, absolute).split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    try {
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink())
        fail(`symlink component is forbidden: ${cursor}`);
      if (!stat.isDirectory())
        fail(`non-directory component is forbidden: ${cursor}`);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
  }
};

export const validateConformanceOutputPath = ({
  repositoryRoot = defaultRepositoryRoot,
} = {}) => {
  const root = resolve(repositoryRoot);
  assertNoSymlinkComponents(root);
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink())
    fail("repository root is invalid");
  const target = resolve(root, outputRelativePath);
  if (relative(root, target).split(sep).join("/") !== outputRelativePath) {
    fail("fixed output escaped the repository root");
  }
  assertNoSymlinkComponents(target);
  return target;
};

const removeCapturedEntry = (path, trustedParent, trustedParentIdentity) => {
  if (dirname(path) !== trustedParent)
    fail("captured entry escaped its trusted parent");
  assertDirectoryIdentity(trustedParent, trustedParentIdentity);
  const stat = lstatSync(path);
  if (typeof process.geteuid === "function" && stat.uid !== process.geteuid()) {
    fail(`captured entry has an unexpected owner: ${path}`);
  }
  if (stat.isSymbolicLink() || stat.isFile()) unlinkSync(path);
  else if (stat.isDirectory()) rmSync(path, { force: true, recursive: true });
  else fail(`captured entry has an unsupported type: ${path}`);
  assertDirectoryIdentity(trustedParent, trustedParentIdentity);
};

const quarantineTarget = (
  target,
  trustedParent,
  trustedParentIdentity,
  beforeRename,
) => {
  beforeRename?.({ targetPath: target, trustedParent });
  assertDirectoryIdentity(trustedParent, trustedParentIdentity);
  const quarantine = join(
    trustedParent,
    `${cleanupStagePrefix}${randomUUID()}`,
  );
  try {
    renameSync(target, quarantine);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  removeCapturedEntry(quarantine, trustedParent, trustedParentIdentity);
};

export const prepareConformanceOutputPath = ({
  repositoryRoot = defaultRepositoryRoot,
  beforeQuarantineRename,
} = {}) => {
  const target = validateConformanceOutputPath({ repositoryRoot });
  const trustedParent = dirname(target);
  mkdirSync(trustedParent, { recursive: true, mode: 0o700 });
  if (validateConformanceOutputPath({ repositoryRoot }) !== target)
    fail("fixed output identity drifted");
  const trustedParentIdentity = directoryIdentity(trustedParent);
  const stage = mkdtempSync(join(trustedParent, outputStagePrefix));
  const stageIdentity = directoryIdentity(stage);
  let reservationIdentity;
  let published = false;
  try {
    quarantineTarget(
      target,
      trustedParent,
      trustedParentIdentity,
      beforeQuarantineRename,
    );
    assertDirectoryIdentity(trustedParent, trustedParentIdentity);
    mkdirSync(target, { mode: 0o700 });
    reservationIdentity = directoryIdentity(target);
  } catch (error) {
    assertDirectoryIdentity(stage, stageIdentity);
    rmSync(stage, { force: true, recursive: true });
    throw error;
  }

  const cleanup = () => {
    if (published) return;
    assertDirectoryIdentity(stage, stageIdentity);
    rmSync(stage, { force: true, recursive: true });
    assertDirectoryIdentity(target, reservationIdentity);
    rmdirSync(target);
  };
  const publish = () => {
    if (published) throw new Error("Conformance output was already published");
    if (validateConformanceOutputPath({ repositoryRoot }) !== target)
      fail("fixed output identity drifted");
    assertDirectoryIdentity(trustedParent, trustedParentIdentity);
    assertDirectoryIdentity(stage, stageIdentity);
    assertDirectoryIdentity(target, reservationIdentity);
    renameSync(stage, target);
    published = true;
    return target;
  };
  return { cleanup, outputPath: stage, publish, targetPath: target };
};
