#!/usr/bin/env python3
"""Patch package-lock.json to add resolved URLs and integrity hashes for
packages missing them. npm lockfile v3 omits these fields for hoisted and
deduplicated packages, but fetchNpmDeps requires them to pre-fetch
dependencies for offline Nix sandbox builds.

Usage:
  python3 patch-lockfile.py <package-lock.json> [--fetch-integrity]

Without --fetch-integrity, only resolved URLs are computed (no registry calls).
With --fetch-integrity, the npm registry is queried for integrity hashes.
"""
import json
import sys
import urllib.request
import urllib.error
import time


def extract_package_name(path):
    """Extract the npm package name from a lockfile v3 path.
    Uses the LAST 'node_modules' occurrence for nested packages."""
    if not path or "node_modules" not in path:
        return None
    idx = path.rfind("node_modules")
    if idx == -1:
        return None
    remaining = path[idx + len("node_modules") + 1 :].split("/")
    if remaining[0].startswith("@"):
        if len(remaining) >= 2:
            return remaining[0] + "/" + remaining[1]
        else:
            return remaining[0]
    else:
        return remaining[0]


def compute_resolved_url(name, version):
    """Compute the npm registry tarball URL for a package.

    For -cjs alias packages (e.g., string-width-cjs), the tarball is
    served under the base package name (e.g., string-width), so the
    resolved URL must use the base name.
    """
    # npm -cjs packages are aliases — tarball is under the base name
    resolved_name = name
    if name.endswith("-cjs") and not name.startswith("@"):
        resolved_name = name[:-4]

    if "/" in resolved_name and resolved_name.startswith("@"):
        parts = resolved_name.split("/")
        pkg = parts[1]
        return f"https://registry.npmjs.org/{resolved_name}/-/{pkg}-{version}.tgz"
    else:
        return f"https://registry.npmjs.org/{resolved_name}/-/{resolved_name}-{version}.tgz"


def fetch_integrity(name, version, cache=None):
    """Fetch integrity hash from the npm registry API."""
    if cache and (name, version) in cache:
        return cache[(name, version)]

    def _try_fetch(pkg_name):
        encoded_name = urllib.request.quote(pkg_name, safe="/")
        url = f"https://registry.npmjs.org/{encoded_name}/{version}"
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                dist = data.get("dist", {})
                integrity = dist.get("integrity")
                shasum = dist.get("shasum")
                return integrity, shasum
        except (urllib.error.URLError, json.JSONDecodeError, KeyError) as e:
            return None, None

    integrity, shasum = _try_fetch(name)

    # Fallback: npm -cjs packages are often aliases for the base package
    if integrity is None and shasum is None and name.endswith("-cjs"):
        base_name = name[:-4]  # strip -cjs
        integrity, shasum = _try_fetch(base_name)
        if integrity or shasum:
            print(f"  Note: {name}@{version} resolved via alias {base_name}", file=sys.stderr)

    if cache is not None:
        cache[(name, version)] = (integrity, shasum)

    if integrity is None and shasum is None:
        print(f"  Warning: Failed to fetch {name}@{version}", file=sys.stderr)

    return integrity, shasum


def main():
    fetch_integrity_flag = "--fetch-integrity" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    if len(args) != 1:
        print(f"Usage: {sys.argv[0]} <package-lock.json> [--fetch-integrity]", file=sys.stderr)
        sys.exit(1)

    lockfile_path = args[0]

    with open(lockfile_path) as f:
        data = json.load(f)

    added_resolved = 0
    added_integrity = 0
    skipped = 0
    cache = {} if fetch_integrity_flag else None

    for path, info in data.get("packages", {}).items():
        if not path:
            continue
        if info.get("link", False):
            continue
        if "version" not in info:
            continue

        name = extract_package_name(path)
        if name is None:
            skipped += 1
            continue

        # Skip workspace-internal packages (they resolve to local paths)
        if name.startswith("@midnight-ntwrk/midnight-did"):
            skipped += 1
            continue

        # Skip workspace path references
        if info.get("resolved", "").startswith("packages/"):
            skipped += 1
            continue

        version = info["version"]

        # Add resolved URL if missing
        if "resolved" not in info:
            info["resolved"] = compute_resolved_url(name, version)
            added_resolved += 1

        # Add integrity hash if missing
        if "integrity" not in info and fetch_integrity_flag:
            integrity, shasum = fetch_integrity(name, version, cache)
            if integrity:
                info["integrity"] = integrity
                added_integrity += 1
            elif shasum:
                info["integrity"] = f"sha1-{shasum}"
                added_integrity += 1

    with open(lockfile_path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

    print(
        f"patch-lockfile: added {added_resolved} resolved URLs, "
        f"{added_integrity} integrity hashes, skipped {skipped}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()