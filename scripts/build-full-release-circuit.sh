#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
circuits_root="$repo_root/circuits"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

cd "$circuits_root"
crs_path="${BB_CRS_PATH:-$stage/crs}"

build_circuit() {
  local package="$1"
  local output_name="$2"
  local artifact="$circuits_root/target/${package}.json"
  local sdk_artifact="$repo_root/packages/sdk/circuits/${output_name}.json"
  local sdk_vk="$repo_root/packages/sdk/circuits/vks/${output_name}.vk.bin"
  local vk_stage="$stage/$output_name"

  mkdir -p "$vk_stage"
  nargo compile --package "$package"
  cp "$artifact" "$sdk_artifact"

  bb write_vk -s ultra_honk -b "$artifact" -o "$vk_stage" -c "$crs_path"
  if [ "$(wc -c < "$vk_stage/vk")" -ne 1764 ]; then
    echo "unexpected bb verification-key length for $output_name" >&2
    exit 1
  fi

  # Soroban verifier layout omits bb's 4-byte user-public-input count.
  head -c 32 "$vk_stage/vk" > "$sdk_vk"
  tail -c +37 "$vk_stage/vk" >> "$sdk_vk"

  if [ "$(wc -c < "$sdk_vk")" -ne 1760 ]; then
    echo "unexpected packed verification-key length for $output_name" >&2
    exit 1
  fi

  echo "wrote $sdk_artifact"
  echo "wrote $sdk_vk"
}

build_circuit "circuit_set_spender" "set_spender"
build_circuit "circuit_spender_transfer_full_release" "spender_transfer_full_release"
