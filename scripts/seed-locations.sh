#!/usr/bin/env bash
set -euo pipefail

echo "=== Mapa Seed Locations ==="

RPC_URL="${SOROBAN_RPC:-https://soroban-testnet.stellar.org}"
PASSPHRASE="${SOROBAN_PASSPHRASE:-Test SDF Network ; September 2015}"
SOURCE="${SOROBAN_SECRET_KEY:-richie}"
VAULT_ID="${VAULT_ID:-}"
ADMIN="${ADMIN:-GBHBOPW5AMW5J6RRR4YU2NLJI3HRX7SG4Q4ZZBJILLDR3644INLHMMZZ}"

if [ -z "$VAULT_ID" ]; then
  echo "Error: VAULT_ID not set"
  exit 1
fi

BASE="--source $SOURCE --rpc-url $RPC_URL --network-passphrase $PASSPHRASE --inclusion-fee 100000 --resource-fee 20000000 --instruction-leeway 100000000"

LOCATIONS=(
  "35767600:139703300:tokyo_shibuya"
  "48856600:2352200:paris_eiffel"
  "40712800:-74006000:nyc_times_square"
  "-33868800:151209300:sydney_opera"
  "51507400:-13100:london_bridge"
  "-23550500:-46633300:saopaulo"
  "19076000:72877700:mumbai"
  "55755800:37617300:moscow_red_square"
  "-1286400:36817200:nairobi"
  "13521000:103819800:singapore"
  "41902800:12496400:rome_colosseum"
  "52367600:4904100:amsterdam"
  "-34603700:-58381600:buenos_aires"
  "39904200:116407400:beijing"
  "-41286500:174768300:wellington"
)

echo "Seeding ${#LOCATIONS[@]} locations..."

for loc in "${LOCATIONS[@]}"; do
  IFS=":" read -r lat lng ref <<< "$loc"
  echo "  Adding $ref..."
  eval stellar contract invoke $BASE --id "$VAULT_ID" -- add_location --admin "$ADMIN" --lat "$lat" --lng "$lng" --image_ref "$ref"
  sleep 1
done

echo "=== Done ==="
