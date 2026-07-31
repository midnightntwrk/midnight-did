#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

assets_dir=""
while (($# > 0)); do
  case "$1" in
    --assets-dir)
      assets_dir="${2:?--assets-dir requires a value}"
      shift 2
      ;;
    *)
      echo "Usage: $0 --assets-dir DIR" >&2
      exit 2
      ;;
  esac
done

assets_dir="${assets_dir:?--assets-dir is required}"
identity="${COSIGN_CERTIFICATE_IDENTITY:?COSIGN_CERTIFICATE_IDENTITY is required}"
issuer="${COSIGN_CERTIFICATE_OIDC_ISSUER:-https://token.actions.githubusercontent.com}"
work_dir="$(mktemp -d)"
verified_count=0

cleanup() {
  rm -rf "${work_dir}"
}
trap cleanup EXIT

while IFS= read -r signature; do
  asset="${signature%.sig}"
  certificate="${asset}.pem"
  if [[ ! -f "${asset}" || ! -f "${certificate}" ]]; then
    echo "::error::Signature pair is incomplete for $(basename "${asset}")" >&2
    exit 1
  fi

  decoded_certificate="${work_dir}/$(basename "${certificate}")"
  if grep -q -- '-----BEGIN CERTIFICATE-----' "${certificate}"; then
    cp "${certificate}" "${decoded_certificate}"
  else
    base64 -d "${certificate}" > "${decoded_certificate}" 2>/dev/null || base64 --decode "${certificate}" > "${decoded_certificate}"
  fi

  echo "[verify-release-signatures] Verifying $(basename "${asset}")"
  cosign verify-blob \
    --certificate "${decoded_certificate}" \
    --signature "${signature}" \
    --certificate-identity "${identity}" \
    --certificate-oidc-issuer "${issuer}" \
    "${asset}"
  verified_count=$((verified_count + 1))
done < <(find "${assets_dir}" -maxdepth 1 -type f -name '*.sig' | sort)

if (( verified_count == 0 )); then
  echo "::error::No Cosign signature assets found in ${assets_dir}." >&2
  exit 1
fi

echo "[verify-release-signatures] Verified ${verified_count} Cosign signatures"
