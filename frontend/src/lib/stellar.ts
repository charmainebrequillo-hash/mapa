import { rpc, Contract } from "@stellar/stellar-sdk";

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "pubnet"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";

export function getRpc() {
  return new rpc.Server(RPC_URL);
}

export function getNetwork() {
  return NETWORK_PASSPHRASE;
}

export function getContract(address: string) {
  return new Contract(address);
}
