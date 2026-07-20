#!/usr/bin/env node
import { SorobanRpc, nativeToScVal, xdr, Contract, Address } from "@stellar/stellar-sdk";
import { execSync } from "child_process";

const RPC_URL = process.env.RPC_URL || "https://soroban-testnet.stellar.org";
const PASSPHRASE = "Test SDF Network ; September 2015";
const SOURCE = process.env.SOURCE || "richie";
const VAULT_ID = process.env.VAULT_ID;

if (!VAULT_ID) {
  console.error("Set VAULT_ID");
  process.exit(1);
}

const LOCATIONS = [
  { lat: 35.6767, lng: 139.7033, ref: "tokyo_shibuya" },
  { lat: 48.8566, lng: 2.3522, ref: "paris_eiffel" },
  { lat: 40.7128, lng: -74.0060, ref: "nyc_times_square" },
  { lat: -33.8688, lng: 151.2093, ref: "sydney_opera" },
  { lat: 51.5074, lng: -0.1278, ref: "london_bridge" },
  { lat: -23.5505, lng: -46.6333, ref: "saopaulo" },
  { lat: 19.0760, lng: 72.8777, ref: "mumbai" },
  { lat: 55.7558, lng: 37.6173, ref: "moscow_red_square" },
  { lat: -1.2864, lng: 36.8172, ref: "nairobi" },
  { lat: 1.3521, lng: 103.8198, ref: "singapore" },
  { lat: 41.9028, lng: 12.4964, ref: "rome_colosseum" },
  { lat: 52.3676, lng: 4.9041, ref: "amsterdam" },
  { lat: -34.6037, lng: -58.3816, ref: "buenos_aires" },
  { lat: 39.9042, lng: 116.4074, ref: "beijing" },
  { lat: -41.2865, lng: 174.7683, ref: "wellington" },
];

const BASE = `stellar contract invoke --id ${VAULT_ID} --source ${SOURCE} --rpc-url ${RPC_URL} --network-passphrase "${PASSPHRASE}" --inclusion-fee 100000 --resource-fee 5000000`;

for (const loc of LOCATIONS) {
  const latVal = Math.round(loc.lat * 1_000_000);
  const lngVal = Math.round(loc.lng * 1_000_000);
  const cmd = `${BASE} -- add_location --admin GBHBOPW5AMW5J6RRR4YU2NLJI3HRX7SG4Q4ZZBJILLDR3644INLHMMZZ --lat ${latVal} --lng ${lngVal} --image_ref "${loc.ref}"`;
  try {
    const out = execSync(cmd, { timeout: 120000, shell: "zsh" });
    console.log(`✅ ${loc.ref}: ${out.toString().trim()}`);
  } catch (e) {
    console.error(`❌ ${loc.ref}: ${e.message}`);
  }
  // wait between calls
  await new Promise(r => setTimeout(r, 2000));
}
