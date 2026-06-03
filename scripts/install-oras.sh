#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

oras_version="${ORAS_VERSION:-1.2.3}"
asset_name="oras_${oras_version}_linux_amd64.tar.gz"
download_root="https://github.com/oras-project/oras/releases/download/v${oras_version}"
work_dir="$(mktemp -d)"

cleanup() {
  rm -rf "${work_dir}"
}
trap cleanup EXIT

curl --fail --silent --show-error --location \
  "${download_root}/${asset_name}" \
  --output "${work_dir}/${asset_name}"
curl --fail --silent --show-error --location \
  "${download_root}/oras_${oras_version}_checksums.txt" \
  --output "${work_dir}/checksums.txt"

(
  cd "${work_dir}"
  grep " ${asset_name}$" checksums.txt | sha256sum --check -
)

tar -xzf "${work_dir}/${asset_name}" -C "${work_dir}" oras
sudo install -m 0755 "${work_dir}/oras" /usr/local/bin/oras
oras version
