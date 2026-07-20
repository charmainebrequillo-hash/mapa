import { arg, readContract, writeContract } from "./soroban";
import { CONTRACTS } from "./contract-ids";

export enum RoomState {
  Waiting = 0,
  Ready = 1,
  Guessed1 = 2,
  Guessed2 = 3,
  Completed = 4,
  Claimed = 5,
}

export interface Room {
  player1: string;
  player2: string;
  location_id: number;
  stake: number;
  guess1_lat: number;
  guess1_lng: number;
  guess2_lat: number;
  guess2_lng: number;
  distance1: number;
  distance2: number;
  winner: string | null;
  state: RoomState;
  timestamp: number;
}

export interface Location {
  lat: number;
  lng: number;
  image_ref: string;
  active: boolean;
}

export async function getMinStake(): Promise<number> {
  const result = await readContract(CONTRACTS.mapaGame, "get_min_stake", []);
  return Number(result);
}

export async function findMatch(
  publicKey: string,
  stake: number,
  locationId: number,
  signTx: (tx: string) => Promise<string>
): Promise<number> {
  const result = await writeContract(
    CONTRACTS.mapaGame,
    "find_match",
    [arg.address(publicKey), arg.i128(stake), arg.u64(locationId)],
    publicKey,
    signTx
  );
  return Number(result);
}

export async function leaveQueue(
  publicKey: string,
  signTx: (tx: string) => Promise<string>
) {
  await writeContract(
    CONTRACTS.mapaGame,
    "leave_queue",
    [arg.address(publicKey)],
    publicKey,
    signTx
  );
}

export async function submitGuess(
  roomId: number,
  lat: number,
  lng: number,
  actualLat: number,
  actualLng: number,
  publicKey: string,
  signTx: (tx: string) => Promise<string>
) {
  const latVal = Math.round(lat * 1_000_000);
  const lngVal = Math.round(lng * 1_000_000);
  const actualLatVal = Math.round(actualLat * 1_000_000);
  const actualLngVal = Math.round(actualLng * 1_000_000);
  return writeContract(
    CONTRACTS.mapaGame,
    "submit_guess",
    [arg.address(publicKey), arg.u64(roomId), arg.i128(latVal), arg.i128(lngVal), arg.i128(actualLatVal), arg.i128(actualLngVal)],
    publicKey,
    signTx
  );
}

export async function getRoom(roomId: number): Promise<Room> {
  const result: any = await readContract(CONTRACTS.mapaGame, "get_room", [arg.u64(roomId)]);
  return {
    player1: result.player1.toString(),
    player2: result.player2.toString(),
    location_id: Number(result.location_id),
    stake: Number(result.stake),
    guess1_lat: Number(result.guess1_lat) / 1_000_000,
    guess1_lng: Number(result.guess1_lng) / 1_000_000,
    guess2_lat: Number(result.guess2_lat) / 1_000_000,
    guess2_lng: Number(result.guess2_lng) / 1_000_000,
    distance1: Number(result.distance1),
    distance2: Number(result.distance2),
    winner: result.winner ? result.winner.toString() : null,
    state: result.state as RoomState,
    timestamp: Number(result.timestamp),
  };
}

export async function getPlayerRooms(publicKey: string): Promise<number[]> {
  const result: any = await readContract(CONTRACTS.mapaGame, "get_player_rooms", [arg.address(publicKey)]);
  return result.map((id: any) => Number(id));
}

export async function getQueueCount(): Promise<number> {
  const result = await readContract(CONTRACTS.mapaGame, "get_queue_count", []);
  return Number(result);
}

export async function getLocation(locationId: number): Promise<Location> {
  const result: any = await readContract(CONTRACTS.mapaLocationVault, "get_location", [arg.u64(locationId)]);
  return {
    lat: Number(result.lat) / 1_000_000,
    lng: Number(result.lng) / 1_000_000,
    image_ref: result.image_ref.toString(),
    active: result.active,
  };
}

export async function getRandomLocation(): Promise<number> {
  const result = await readContract(CONTRACTS.mapaLocationVault, "get_random_location", []);
  return Number(result);
}

export async function claimPrize(
  roomId: number,
  publicKey: string,
  signTx: (tx: string) => Promise<string>
) {
  return writeContract(
    CONTRACTS.mapaGame,
    "claim_prize",
    [arg.address(publicKey), arg.u64(roomId)],
    publicKey,
    signTx
  );
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatScore(score: number): number {
  return Math.round((score / 1_000_000) * 100);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatStroops(stroops: number): string {
  return (stroops / 1_000_000).toFixed(2);
}
