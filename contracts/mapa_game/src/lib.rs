#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Vec, log};

const DAY_IN_LEDGERS: u32 = 17280;
const BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const PLATFORM_FEE_BPS: i128 = 250;
const MIN_STAKE_DEFAULT: i128 = 1_000_000;
const MAX_OPEN_ROOMS: u32 = 20;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Room {
    pub player1: Address,
    pub player2: Option<Address>,
    pub location_id: u64,
    pub stake: i128,
    pub guess1_lat: i128,
    pub guess1_lng: i128,
    pub guess2_lat: i128,
    pub guess2_lng: i128,
    pub distance1: i128,
    pub distance2: i128,
    pub winner: Option<Address>,
    pub state: RoomState,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum RoomState {
    Waiting,
    Ready,
    Guessed1,
    Guessed2,
    Completed,
    Claimed,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DataKey {
    Admin,
    MinStake,
    Token,
    Vault,
    NextRoomId,
    Room(u64),
    PlayerRooms(Address),
    OpenRooms,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct OpenRoomInfo {
    pub room_id: u64,
    pub player1: Address,
    pub stake: i128,
    pub timestamp: u64,
}

#[contract]
pub struct MapaGame;

#[contractimpl]
impl MapaGame {
    pub fn initialize(env: Env, admin: Address, vault: Address, token: Address) {
        let stored: Option<Address> = env.storage().instance().get(&DataKey::Admin);
        if stored.is_some() {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Vault, &vault);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::MinStake, &MIN_STAKE_DEFAULT);
        env.storage().instance().set(&DataKey::NextRoomId, &1u64);
    }

    fn require_admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn set_min_stake(env: Env, admin: Address, min_stake: i128) {
        admin.require_auth();
        if Self::require_admin(&env) != admin {
            panic!("not authorized");
        }
        if min_stake < 0 {
            panic!("min stake must be non-negative");
        }
        env.storage().instance().set(&DataKey::MinStake, &min_stake);
    }

    pub fn auto_match(env: Env, player: Address, stake: i128, location_id: u64) -> u64 {
        player.require_auth();

        let min_stake: i128 = env.storage().instance().get(&DataKey::MinStake).unwrap();
        if stake < min_stake {
            panic!("stake below minimum");
        }

        let open_ids: Vec<u64> = env.storage().instance().get(&DataKey::OpenRooms).unwrap_or(Vec::new(&env));

        for i in 0..open_ids.len() {
            let rid = open_ids.get(i).unwrap();
            let room: Room = env.storage().persistent().get(&DataKey::Room(rid)).unwrap();

            if room.stake == stake && room.player2.is_none() && room.state == RoomState::Waiting {
                Self::join_room_inner(&env, player, rid, room);
                return rid;
            }
        }

        let room_id: u64 = env.storage().instance().get(&DataKey::NextRoomId).unwrap();
        env.storage().instance().set(&DataKey::NextRoomId, &(room_id + 1));

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token).transfer(&player, &env.current_contract_address(), &stake);

        let room = Room {
            player1: player.clone(),
            player2: None,
            location_id,
            stake,
            guess1_lat: 0,
            guess1_lng: 0,
            guess2_lat: 0,
            guess2_lng: 0,
            distance1: 0,
            distance2: 0,
            winner: None,
            state: RoomState::Waiting,
            timestamp: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&DataKey::Room(room_id), &room);
        env.storage().persistent().extend_ttl(&DataKey::Room(room_id), BUMP_AMOUNT, BUMP_AMOUNT);

        let mut new_open: Vec<u64> = open_ids;
        new_open.push_back(room_id);
        env.storage().instance().set(&DataKey::OpenRooms, &new_open);

        let mut rooms: Vec<u64> = env.storage().persistent().get(&DataKey::PlayerRooms(player.clone())).unwrap_or(Vec::new(&env));
        rooms.push_back(room_id);
        env.storage().persistent().set(&DataKey::PlayerRooms(player.clone()), &rooms);
        env.storage().persistent().extend_ttl(&DataKey::PlayerRooms(player.clone()), BUMP_AMOUNT, BUMP_AMOUNT);

        log!(&env, "room_created", room_id, player, stake, location_id);
        room_id
    }

    pub fn join_room(env: Env, player: Address, room_id: u64) {
        player.require_auth();
        let room: Room = env.storage().persistent().get(&DataKey::Room(room_id)).unwrap();
        Self::join_room_inner(&env, player, room_id, room);
    }

    fn join_room_inner(env: &Env, player: Address, room_id: u64, mut room: Room) {
        if room.state != RoomState::Waiting {
            panic!("room is not open");
        }
        if room.player1 == player {
            panic!("cannot join your own room");
        }

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token).transfer(&player, &env.current_contract_address(), &room.stake);

        room.player2 = Some(player.clone());
        room.state = RoomState::Ready;
        room.timestamp = env.ledger().timestamp();

        env.storage().persistent().set(&DataKey::Room(room_id), &room);
        env.storage().persistent().extend_ttl(&DataKey::Room(room_id), BUMP_AMOUNT, BUMP_AMOUNT);

        let open_ids: Vec<u64> = env.storage().instance().get(&DataKey::OpenRooms).unwrap_or(Vec::new(&env));
        let mut new_open: Vec<u64> = Vec::new(&env);
        for i in 0..open_ids.len() {
            let rid = open_ids.get(i).unwrap();
            if rid != room_id {
                new_open.push_back(rid);
            }
        }
        env.storage().instance().set(&DataKey::OpenRooms, &new_open);

        let mut rooms: Vec<u64> = env.storage().persistent().get(&DataKey::PlayerRooms(player.clone())).unwrap_or(Vec::new(&env));
        rooms.push_back(room_id);
        env.storage().persistent().set(&DataKey::PlayerRooms(player.clone()), &rooms);
        env.storage().persistent().extend_ttl(&DataKey::PlayerRooms(player.clone()), BUMP_AMOUNT, BUMP_AMOUNT);

        log!(&env, "room_joined", room_id, player, room.stake, room.location_id);
    }

    pub fn leave_room(env: Env, player: Address, room_id: u64) {
        player.require_auth();
        let room: Room = env.storage().persistent().get(&DataKey::Room(room_id)).unwrap();
        if room.state != RoomState::Waiting {
            panic!("room is not in waiting state");
        }
        if room.player1 != player {
            panic!("not your room");
        }

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token).transfer(&env.current_contract_address(), &player, &room.stake);

        let open_ids: Vec<u64> = env.storage().instance().get(&DataKey::OpenRooms).unwrap_or(Vec::new(&env));
        let mut new_open: Vec<u64> = Vec::new(&env);
        for i in 0..open_ids.len() {
            let rid = open_ids.get(i).unwrap();
            if rid != room_id {
                new_open.push_back(rid);
            }
        }
        env.storage().instance().set(&DataKey::OpenRooms, &new_open);

        env.storage().persistent().remove(&DataKey::Room(room_id));
        log!(&env, "room_cancelled", room_id, player);
    }

    pub fn submit_guess(env: Env, player: Address, room_id: u64, lat: i128, lng: i128, actual_lat: i128, actual_lng: i128) {
        player.require_auth();

        if lat < -90000000 || lat > 90000000 {
            panic!("latitude out of range");
        }
        if lng < -180000000 || lng > 180000000 {
            panic!("longitude out of range");
        }

        let mut room: Room = env.storage().persistent().get(&DataKey::Room(room_id)).unwrap();
        if room.state != RoomState::Ready && room.state != RoomState::Guessed1 && room.state != RoomState::Guessed2 {
            panic!("room not accepting guesses");
        }

        if room.player1 == player {
            if room.state == RoomState::Guessed1 {
                panic!("already guessed");
            }
            room.guess1_lat = lat;
            room.guess1_lng = lng;
            match room.state {
                RoomState::Ready => room.state = RoomState::Guessed1,
                RoomState::Guessed2 => {
                    room.state = RoomState::Completed;
                    Self::resolve(&env, &mut room, actual_lat, actual_lng);
                },
                _ => {},
            }
        } else if room.player2 == Some(player.clone()) {
            if room.state == RoomState::Guessed2 {
                panic!("already guessed");
            }
            room.guess2_lat = lat;
            room.guess2_lng = lng;
            match room.state {
                RoomState::Ready => room.state = RoomState::Guessed2,
                RoomState::Guessed1 => {
                    room.state = RoomState::Completed;
                    Self::resolve(&env, &mut room, actual_lat, actual_lng);
                },
                _ => {},
            }
        } else {
            panic!("not your room");
        }

        env.storage().persistent().set(&DataKey::Room(room_id), &room);
        env.storage().persistent().extend_ttl(&DataKey::Room(room_id), BUMP_AMOUNT, BUMP_AMOUNT);
        log!(&env, "guess_submitted", room_id, player, lat, lng);
    }

    fn resolve(env: &Env, room: &mut Room, actual_lat: i128, actual_lng: i128) {
        let d1 = Self::haversine_distance(actual_lat, actual_lng, room.guess1_lat, room.guess1_lng);
        let d2 = Self::haversine_distance(actual_lat, actual_lng, room.guess2_lat, room.guess2_lng);

        room.distance1 = d1;
        room.distance2 = d2;

        if d1 < d2 {
            room.winner = Some(room.player1.clone());
        } else if d2 < d1 {
            room.winner = Some(room.player2.clone().unwrap());
        }

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        if let Some(ref winner) = room.winner {
            let total_pot = room.stake * 2;
            let fee = total_pot * PLATFORM_FEE_BPS / 10000;
            let prize = total_pot - fee;
            token::Client::new(&env, &token).transfer(&env.current_contract_address(), winner, &prize);
            log!(&env, "winner", winner, prize, d1, d2);
        } else {
            token::Client::new(&env, &token).transfer(&env.current_contract_address(), &room.player1, &room.stake);
            let p2 = room.player2.clone().unwrap();
            token::Client::new(&env, &token).transfer(&env.current_contract_address(), &p2, &room.stake);
            log!(&env, "tie_refund", room.stake);
        }
    }

    pub fn claim_prize(env: Env, player: Address, room_id: u64) {
        player.require_auth();
        let mut room: Room = env.storage().persistent().get(&DataKey::Room(room_id)).unwrap();
        if room.state != RoomState::Completed {
            panic!("room not completed");
        }
        if room.winner != Some(player.clone()) {
            panic!("not the winner");
        }
        room.state = RoomState::Claimed;
        env.storage().persistent().set(&DataKey::Room(room_id), &room);
        env.storage().persistent().extend_ttl(&DataKey::Room(room_id), BUMP_AMOUNT, BUMP_AMOUNT);
        log!(&env, "prize_claimed", room_id, player);
    }

    pub fn withdraw(env: Env, admin: Address, amount: i128, to: Address) {
        admin.require_auth();
        if Self::require_admin(&env) != admin {
            panic!("not authorized");
        }
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token).transfer(&env.current_contract_address(), &to, &amount);
    }

    pub fn get_room(env: Env, room_id: u64) -> Room {
        env.storage().persistent().get(&DataKey::Room(room_id)).unwrap()
    }

    pub fn get_open_rooms(env: Env) -> Vec<OpenRoomInfo> {
        let open_ids: Vec<u64> = env.storage().instance().get(&DataKey::OpenRooms).unwrap_or(Vec::new(&env));
        let mut result: Vec<OpenRoomInfo> = Vec::new(&env);
        for i in 0..open_ids.len() {
            let rid = open_ids.get(i).unwrap();
            let room_exists: Option<Room> = env.storage().persistent().get(&DataKey::Room(rid));
            if let Some(room) = room_exists {
                if room.state == RoomState::Waiting && room.player2.is_none() {
                    result.push_back(OpenRoomInfo {
                        room_id: rid,
                        player1: room.player1,
                        stake: room.stake,
                        timestamp: room.timestamp,
                    });
                }
            }
        }
        result
    }

    pub fn get_player_rooms(env: Env, player: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::PlayerRooms(player))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_min_stake(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::MinStake).unwrap()
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn get_vault(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Vault).unwrap()
    }

    pub fn get_token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    fn haversine_distance(lat1: i128, lng1: i128, lat2: i128, lng2: i128) -> i128 {
        let r: i128 = 6371000;
        let d_lat_rad = (lat1 - lat2) * 1000000 / 57295779;
        let d_lng_rad = (lng1 - lng2) * 1000000 / 57295779;
        let lat1_rad = lat1 * 1000000 / 57295779;
        let lat2_rad = lat2 * 1000000 / 57295779;
        let sin_dlat = Self::sin_approx(d_lat_rad / 2);
        let sin_dlng = Self::sin_approx(d_lng_rad / 2);
        let cos_lat1 = Self::cos_approx(lat1_rad);
        let cos_lat2 = Self::cos_approx(lat2_rad);
        let sin2_hlat = sin_dlat * sin_dlat / 1000000;
        let sin2_hlng = sin_dlng * sin_dlng / 1000000;
        let a = sin2_hlat + cos_lat1 * cos_lat2 / 1000000 * sin2_hlng / 1000000;
        let a = a.min(1000000).max(0);
        let c = Self::asin_approx(Self::sqrt(a * 1000000)) * 2;
        let distance = (r * c / 1000000).abs();
        if distance > 40075000 { 40075000 } else { distance }
    }

    fn sin_approx(x: i128) -> i128 {
        let p = 2 * 3141592;
        let x = x % p;
        let x = if x > 3141592 { p - x } else if x < -3141592 { -p - x } else { x };
        let x2 = x * x / 1000000;
        let x3 = x2 * x / 1000000;
        let x5 = x3 * x2 / 1000000;
        let x7 = x5 * x2 / 1000000;
        x - x3 / 6 + x5 / 120 - x7 / 5040
    }

    fn cos_approx(x: i128) -> i128 {
        Self::sin_approx(1570796 - x.abs())
    }

    fn asin_approx(x: i128) -> i128 {
        if x <= 0 { return 0; }
        let x = x.min(1000000);
        let x2 = x * x / 1000000;
        let x3 = x2 * x / 1000000;
        let x5 = x3 * x2 / 1000000;
        let x7 = x5 * x2 / 1000000;
        let x9 = x7 * x2 / 1000000;
        x + x3 / 6 + x5 * 3 / 40 + x7 * 5 / 112 + x9 * 35 / 1152
    }

    fn sqrt(n: i128) -> i128 {
        if n <= 0 { return 0; }
        let mut x = n;
        let mut y = (x + 1) / 2;
        while y < x {
            x = y;
            y = (x + n / x) / 2;
        }
        x
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, token::StellarAssetClient};

    fn setup_test() -> (Env, MapaGameClient<'static>, Address, Address) {
        let env = Env::default();
        let admin = Address::generate(&env);
        let vault = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract(admin.clone());
        let token = Address::from_string(&token_id.to_string());
        let contract_id = env.register(MapaGame, ());
        let client = MapaGameClient::new(&env, &contract_id);
        client.initialize(&admin, &vault, &token);
        (env, client, token, contract_id)
    }

    #[test]
    fn auto_match_creates_and_joins_a_funded_room() {
        let (env, client, token, contract_id) = setup_test();
        let player1 = Address::generate(&env);
        let player2 = Address::generate(&env);
        env.mock_all_auths();

        let asset = StellarAssetClient::new(&env, &token);
        asset.mint(&player1, &MIN_STAKE_DEFAULT);
        asset.mint(&player2, &MIN_STAKE_DEFAULT);

        let room_id = client.auto_match(&player1, &MIN_STAKE_DEFAULT, &1);
        let joined_id = client.auto_match(&player2, &MIN_STAKE_DEFAULT, &99);
        assert_eq!(joined_id, room_id);

        let room = client.get_room(&room_id);
        assert_eq!(room.state, RoomState::Ready);
        assert_eq!(room.player1, player1);
        assert_eq!(room.player2, Some(player2));
        assert_eq!(room.location_id, 1);
        assert_eq!(asset.balance(&contract_id), MIN_STAKE_DEFAULT * 2);
        assert!(client.get_open_rooms().is_empty());
    }

    fn mint(env: &Env, token: &Address, player: &Address, amount: i128) {
        StellarAssetClient::new(env, token).mint(player, &amount);
    }

    fn funded_open_room(env: &Env, client: &MapaGameClient<'_>, token: &Address) -> (Address, u64) {
        let player = Address::generate(env);
        mint(env, token, &player, MIN_STAKE_DEFAULT);
        (player.clone(), client.auto_match(&player, &MIN_STAKE_DEFAULT, &7))
    }

    #[test]
    fn initialize_stores_configured_addresses_and_default_stake() {
        let (env, client, token, _) = setup_test();
        assert_eq!(client.get_token(), token);
        assert_eq!(client.get_min_stake(), MIN_STAKE_DEFAULT);
        assert_ne!(client.get_admin(), client.get_vault());
        let _ = env;
    }

    #[test]
    fn admin_can_change_minimum_stake() {
        let (env, client, _token, _) = setup_test();
        env.mock_all_auths();
        let admin = client.get_admin();
        client.set_min_stake(&admin, &42);
        assert_eq!(client.get_min_stake(), 42);
    }

    #[test]
    fn join_room_moves_the_room_from_open_to_ready() {
        let (env, client, token, _) = setup_test();
        env.mock_all_auths();
        let (owner, room_id) = funded_open_room(&env, &client, &token);
        let opponent = Address::generate(&env);
        mint(&env, &token, &opponent, MIN_STAKE_DEFAULT);
        client.join_room(&opponent, &room_id);
        let room = client.get_room(&room_id);
        assert_eq!(room.player1, owner);
        assert_eq!(room.player2, Some(opponent));
        assert_eq!(room.state, RoomState::Ready);
        assert!(client.get_open_rooms().is_empty());
    }

    #[test]
    fn leave_room_refunds_the_creator_and_removes_the_room() {
        let (env, client, token, contract_id) = setup_test();
        env.mock_all_auths();
        let (owner, room_id) = funded_open_room(&env, &client, &token);
        let asset = StellarAssetClient::new(&env, &token);
        assert_eq!(asset.balance(&contract_id), MIN_STAKE_DEFAULT);
        client.leave_room(&owner, &room_id);
        assert_eq!(asset.balance(&owner), MIN_STAKE_DEFAULT);
        assert_eq!(asset.balance(&contract_id), 0);
        assert!(client.get_open_rooms().is_empty());
        assert!(client.try_get_room(&room_id).is_err());
    }

    #[test]
    fn guesses_resolve_to_the_closest_player_and_pay_the_prize() {
        let (env, client, token, contract_id) = setup_test();
        env.mock_all_auths();
        let (p1, room_id) = funded_open_room(&env, &client, &token);
        let p2 = Address::generate(&env);
        mint(&env, &token, &p2, MIN_STAKE_DEFAULT);
        client.join_room(&p2, &room_id);
        client.submit_guess(&p1, &room_id, &40_748_000, &-74_006_000, &40_748_000, &-74_006_000);
        client.submit_guess(&p2, &room_id, &34_052_200, &-118_243_700, &40_748_000, &-74_006_000);
        let room = client.get_room(&room_id);
        assert_eq!(room.state, RoomState::Completed);
        assert_eq!(room.winner, Some(p1.clone()));
        assert_eq!(StellarAssetClient::new(&env, &token).balance(&p1), MIN_STAKE_DEFAULT * 2 - 50_000);
        assert_eq!(StellarAssetClient::new(&env, &token).balance(&contract_id), 50_000);
    }

    #[test]
    fn tied_guesses_refund_both_players() {
        let (env, client, token, contract_id) = setup_test();
        env.mock_all_auths();
        let (p1, room_id) = funded_open_room(&env, &client, &token);
        let p2 = Address::generate(&env);
        mint(&env, &token, &p2, MIN_STAKE_DEFAULT);
        client.join_room(&p2, &room_id);
        client.submit_guess(&p1, &room_id, &0, &0, &0, &0);
        client.submit_guess(&p2, &room_id, &0, &0, &0, &0);
        assert!(client.get_room(&room_id).winner.is_none());
        let asset = StellarAssetClient::new(&env, &token);
        assert_eq!(asset.balance(&p1), MIN_STAKE_DEFAULT);
        assert_eq!(asset.balance(&p2), MIN_STAKE_DEFAULT);
        assert_eq!(asset.balance(&contract_id), 0);
    }

    #[test]
    fn winner_can_mark_a_completed_room_as_claimed() {
        let (env, client, token, _) = setup_test();
        env.mock_all_auths();
        let (p1, room_id) = funded_open_room(&env, &client, &token);
        let p2 = Address::generate(&env);
        mint(&env, &token, &p2, MIN_STAKE_DEFAULT);
        client.join_room(&p2, &room_id);
        client.submit_guess(&p1, &room_id, &0, &0, &0, &0);
        client.submit_guess(&p2, &room_id, &1_000_000, &1_000_000, &0, &0);
        client.claim_prize(&p1, &room_id);
        assert_eq!(client.get_room(&room_id).state, RoomState::Claimed);
    }

    #[test]
    fn player_rooms_tracks_joined_rooms() {
        let (env, client, token, _) = setup_test();
        env.mock_all_auths();
        let (p1, room_id) = funded_open_room(&env, &client, &token);
        let p2 = Address::generate(&env);
        mint(&env, &token, &p2, MIN_STAKE_DEFAULT);
        client.join_room(&p2, &room_id);
        let p1_rooms = client.get_player_rooms(&p1);
        let p2_rooms = client.get_player_rooms(&p2);
        assert_eq!(p1_rooms.len(), 1);
        assert_eq!(p1_rooms.get(0), Some(room_id));
        assert_eq!(p2_rooms.get(0), Some(room_id));
    }

    #[test]
    #[should_panic(expected = "stake below minimum")]
    fn auto_match_rejects_a_stake_below_the_minimum() {
        let (env, client, token, _) = setup_test();
        env.mock_all_auths();
        let player = Address::generate(&env);
        mint(&env, &token, &player, MIN_STAKE_DEFAULT);
        client.auto_match(&player, &(MIN_STAKE_DEFAULT - 1), &1);
    }
}
