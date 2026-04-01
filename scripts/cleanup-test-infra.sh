#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_compose_down() {
  local cwd="$1"
  local compose_file="$2"

  if [[ -f "$cwd/$compose_file" ]]; then
    docker compose -f "$compose_file" down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
}

remove_named_containers() {
  local names=("$@")
  local existing=()
  local name
  local current_names

  current_names="$(docker ps -a --format '{{.Names}}')"

  for name in "${names[@]}"; do
    if grep -Fxq "$name" <<<"$current_names"; then
      existing+=("$name")
    fi
  done

  if [[ "${#existing[@]}" -gt 0 ]]; then
    docker rm -f "${existing[@]}" >/dev/null 2>&1 || true
  fi
}

remove_matching_container_ids() {
  local ids
  ids="$1"
  if [[ -n "$ids" ]]; then
    # shellcheck disable=SC2086
    docker rm -f $ids >/dev/null 2>&1 || true
  fi
}

remove_compose_project_containers() {
  local ids
  ids="$(
    docker ps -a --format '{{.ID}} {{.Label "com.docker.compose.project"}}' \
      | awk '
        $2 ~ /^did-api-test-/ ||
        $2 ~ /^did-cli-test-/ ||
        $2 ~ /^did-resolver-int-/ ||
        $2 ~ /^did-resolver-e2e-/ {
          print $1
        }
      '
  )"
  remove_matching_container_ids "$ids"
}

remove_ryuk_containers() {
  local ids
  ids="$(
    docker ps -a --format '{{.ID}} {{.Names}}' \
      | awk '$2 ~ /^testcontainers-ryuk-/ { print $1 }'
  )"
  remove_matching_container_ids "$ids"
}

main() {
  run_compose_down "$ROOT_DIR/api" "standalone.yml"
  run_compose_down "$ROOT_DIR/cli" "proof-server.yml"

  remove_named_containers \
    "did-node" \
    "did-indexer" \
    "did-proof-server" \
    "cli-proof-server-1"

  remove_compose_project_containers
  remove_ryuk_containers
}

main "$@"
