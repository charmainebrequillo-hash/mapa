#!/usr/bin/env bash
set -euo pipefail

echo "=== Mapa Deploy to Testnet ==="

RPC_URL="${SOROBAN_RPC:-https://soroban-testnet.stellar.org}"
PASSPHRASE="${SOROBAN_PASSPHRASE:-Test SDF Network ; September 2015}"
SOURCE="${SOROBAN_SECRET_KEY:-richie}"
TOKEN_ADDRESS="${TOKEN_ADDRESS:-}"

if [ -z "$TOKEN_ADDRESS" ]; then
  echo "Error: TOKEN_ADDRESS not set (use native XLM or a Stellar asset contract)"
  exit 1
fi

BASE="--source $SOURCE --rpc-url $RPC_URL --network-passphrase $PASSPHRASE --inclusion-fee 100000 --resource-fee 20000000 --instruction-leeway 100000000"

echo ""
echo "Building contracts..."
cd "$(dirname "$0")/.."

for contract in mapa_game mapa_location_vault; do
  cargo build --release --target wasm32v1-none --manifest-path contracts/$contract/Cargo.toml
done

echo ""
echo "Deploying mapa_location_vault..."
VAULT_WASM=$(find contracts/target/wasm32v1-none/release -name "mapa_location_vault.wasm" | head -1)
VAULT_ID=$(stellar contract deploy $BASE --wasm "$VAULT_WASM")
echo "LocationVault deployed: $VAULT_ID"

echo ""
echo "Deploying mapa_game..."
GAME_WASM=$(find contracts/target/wasm32v1-none/release -name "mapa_game.wasm" | head -1)
GAME_ID=$(stellar contract deploy $BASE --wasm "$GAME_WASM")
echo "MapaGame deployed: $GAME_ID"

echo ""
echo "Initializing contracts..."

VAULT_ADMIN=$(stellar keys address richie)

eval stellar contract invoke $BASE --id "$VAULT_ID" -- initialize --admin "$VAULT_ADMIN"

eval stellar contract invoke $BASE --id "$GAME_ID" -- initialize --admin "$VAULT_ADMIN" --vault "$VAULT_ID" --token "$TOKEN_ADDRESS"

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Add to frontend/.env.local:"
echo "NEXT_PUBLIC_CONTRACT_MAPA_GAME=$GAME_ID"
echo "NEXT_PUBLIC_CONTRACT_MAPA_LOCATION_VAULT=$VAULT_ID"
