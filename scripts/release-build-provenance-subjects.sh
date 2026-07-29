#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

output_file="${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
subjects_file="${SUBJECTS_FILE:-dist/release/provenance-subjects.txt}"
mkdir -p "$(dirname "${subjects_file}")"

subject_paths=()

if [[ -n "${NPM_ASSETS_DIR:-}" ]]; then
  while IFS= read -r npm_asset; do
    subject_paths+=("${npm_asset}")
  done < <(find "${NPM_ASSETS_DIR}" -maxdepth 1 -type f -name '*.tgz' | sort)
fi

if [[ -n "${SIGNATURE_ASSETS_DIR:-}" ]]; then
  while IFS= read -r signature_asset; do
    subject_paths+=("${signature_asset}")
  done < <(find "${SIGNATURE_ASSETS_DIR}" -maxdepth 1 -type f \( -name '*.sig' -o -name '*.pem' \) | sort)
fi

for release_asset in "${ZK_ARCHIVE:-}" "${ZK_MANIFEST:-}" "${ZK_SHA256:-}"; do
  if [[ -n "${release_asset}" ]]; then
    subject_paths+=("${release_asset}")
  fi
done

if [[ "${#subject_paths[@]}" -eq 0 ]]; then
  echo "::error::No release assets were provided for SLSA provenance subjects."
  exit 1
fi

for subject_path in "${subject_paths[@]}"; do
  if [[ ! -f "${subject_path}" ]]; then
    echo "::error::Release asset not found for SLSA provenance subject: ${subject_path}"
    exit 1
  fi
done

: > "${subjects_file}"
for subject_path in "${subject_paths[@]}"; do
  digest="$(sha256sum "${subject_path}" | awk '{print $1}')"
  printf '%s  %s\n' "${digest}" "$(basename "${subject_path}")" >> "${subjects_file}"
done

subjects_b64="$(base64 -w0 "${subjects_file}" 2>/dev/null || base64 "${subjects_file}" | tr -d '\n')"

cat "${subjects_file}"
{
  echo "subjects_file=${subjects_file}"
  echo "base64_subjects=${subjects_b64}"
} >> "${output_file}"
