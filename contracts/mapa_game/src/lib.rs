#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Vec, log};

const DAY_IN_LEDGERS: u32 = 17280;
const BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const PLATFORM_FEE_BPS: i128 = 250;
const MIN_STAKE_DEFAULT: i128 = 1_000_000;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Room {
    pub player1: Address,
    pub player2: Address,
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
pub struct QueueEntry {
    pub player: Address,
    pub stake: i128,
    pub location_id: u64,
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
    Queue,
    PlayerRooms(Address),
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

    pub fn find_match(env: Env, player: Address, stake: i128, location_id: u64) -> u64 {
        player.require_auth();

        let min_stake: i128 = env.storage().instance().get(&DataKey::MinStake).unwrap();
        if stake < min_stake {
            panic!("stake below minimum");
        }

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let queue: Vec<QueueEntry> = env.storage().instance().get(&DataKey::Queue).unwrap_or(Vec::new(&env));

        for entry in queue.iter() {
            if entry.player == player {
                panic!("player already in queue");
            }
        }

        for i in 0..queue.len() {
            let entry = queue.get(i).unwrap();
            if entry.player != player && entry.stake == stake && entry.location_id == location_id {
                let mut new_queue: Vec<QueueEntry> = Vec::new(&env);
                for j in 0..queue.len() {
                    if j != i {
                        new_queue.push_back(queue.get(j).unwrap());
                    }
                }
                env.storage().instance().set(&DataKey::Queue, &new_queue);

                token::Client::new(&env, &token).transfer(&player, &env.current_contract_address(), &stake);

                let room_id: u64 = env.storage().instance().get(&DataKey::NextRoomId).unwrap();
                env.storage().instance().set(&DataKey::NextRoomId, &(room_id + 1));

                let room = Room {
                    player1: entry.player.clone(),
                    player2: player.clone(),
                    location_id,
                    stake,
                    guess1_lat: 0,
                    guess1_lng: 0,
                    guess2_lat: 0,
                    guess2_lng: 0,
                    distance1: 0,
                    distance2: 0,
                    winner: None,
                    state: RoomState::Ready,
                    timestamp: env.ledger().timestamp(),
                };
                env.storage().persistent().set(&DataKey::Room(room_id), &room);
                env.storage().persistent().extend_ttl(&DataKey::Room(room_id), BUMP_AMOUNT, BUMP_AMOUNT);

                for p in [entry.player.clone(), player.clone()] {
                    let mut rooms: Vec<u64> = env.storage().persistent().get(&DataKey::PlayerRooms(p.clone())).unwrap_or(Vec::new(&env));
                    rooms.push_back(room_id);
                    env.storage().persistent().set(&DataKey::PlayerRooms(p.clone()), &rooms);
                    env.storage().persistent().extend_ttl(&DataKey::PlayerRooms(p.clone()), BUMP_AMOUNT, BUMP_AMOUNT);
                }

                log!(&env, "match_found", room_id, entry.player, player, stake, location_id);
                return room_id;
            }
        }

        token::Client::new(&env, &token).transfer(&player, &env.current_contract_address(), &stake);

        let mut new_queue: Vec<QueueEntry> = queue;
        new_queue.push_back(QueueEntry { player: player.clone(), stake, location_id });
        env.storage().instance().set(&DataKey::Queue, &new_queue);

        log!(&env, "queued", player, stake, location_id);
        0
    }

    pub fn leave_queue(env: Env, player: Address) {
        player.require_auth();
        let queue: Vec<QueueEntry> = env.storage().instance().get(&DataKey::Queue).unwrap_or(Vec::new(&env));
        let mut new_queue: Vec<QueueEntry> = Vec::new(&env);
        let mut found = false;
        for i in 0..queue.len() {
            let entry = queue.get(i).unwrap();
            if entry.player == player {
                found = true;
                let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
                token::Client::new(&env, &token).transfer(&env.current_contract_address(), &player, &entry.stake);
            } else {
                new_queue.push_back(entry);
            }
        }
        if !found {
            panic!("not in queue");
        }
        env.storage().instance().set(&DataKey::Queue, &new_queue);
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
        } else if room.player2 == player {
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
            room.winner = Some(room.player2.clone());
        }

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        if let Some(ref winner) = room.winner {
            let total_pot = room.stake * 2;
            let fee = total_pot * PLATFORM_FEE_BPS / 10000;
            let prize = total_pot - fee;
            token::Client::new(env, &token).transfer(&env.current_contract_address(), winner, &prize);
            log!(env, "winner", winner, prize, d1, d2);
        } else {
            token::Client::new(env, &token).transfer(&env.current_contract_address(), &room.player1, &room.stake);
            token::Client::new(env, &token).transfer(&env.current_contract_address(), &room.player2, &room.stake);
            log!(env, "tie_refund", room.stake);
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

    pub fn get_queue_count(env: Env) -> u32 {
        let queue: Vec<QueueEntry> = env.storage().instance().get(&DataKey::Queue).unwrap_or(Vec::new(&env));
        queue.len()
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
        let sin_dlat = Self::sin_approx(d_lat_rad);
        let sin_dlng = Self::sin_approx(d_lng_rad);
        let cos_lat1 = Self::cos_approx(lat1_rad);
        let cos_lat2 = Self::cos_approx(lat2_rad);
        let a = sin_dlat * sin_dlat / 1000000
            + cos_lat1 * cos_lat2 / 1000000 * sin_dlng * sin_dlng / 1000000 / 1000000;
        let c = Self::asin_approx(a) * 2;
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
        let neg = x < 0;
        let x = x.abs();
        let mut result = 1570796i128;
        let mut term = x;
        let mut i = 1;
        while i < 20 && term > 100 {
            result = result - term / (2 * i - 1);
            term = term * x * x * (2 * i - 1) * (2 * i - 1) / (1000000 * 2 * i * (2 * i + 1));
            i += 1;
        }
        result = 1570796 - Self::sqrt(1570796i128 * 1570796 - result * result);
        if neg { -result } else { result }
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
    use soroban_sdk::{testutils::Address as _, vec, Env, IntoVal, Symbol};

    fn setup_test() -> (Env, Address, Address, Address) {
        let env = Env::default();
        let admin = Address::generate(&env);
        let vault = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract(admin.clone());
        let token = Address::from_string(&token_id.to_string());
        MapaGame::initialize(&env, admin.clone(), vault.clone(), token.clone());
        (env, admin, vault, token)
    }

    #[test]
    fn test_initialize() {
        let (env, admin, vault, token) = setup_test();
        assert_eq!(MapaGame::get_admin(&env), admin);
        assert_eq!(MapaGame::get_vault(&env), vault);
        assert_eq!(MapaGame::get_token(&env), token);
        assert_eq!(MapaGame::get_min_stake(&env), MIN_STAKE_DEFAULT);
    }

    #[test]
    fn test_find_match_and_submit() {
        let (env, _admin, _vault, _token) = setup_test();
        let player1 = Address::generate(&env);
        let player2 = Address::generate(&env);

        env.mock_all_auths();

        let room_id = MapaGame::find_match(&env, player1.clone(), MIN_STAKE_DEFAULT, 1);
        assert_eq!(room_id, 0, "should queue player1");

        let room_id = MapaGame::find_match(&env, player2.clone(), MIN_STAKE_DEFAULT, 1);
        assert!(room_id > 0, "should match player2");

        let room = MapaGame::get_room(&env, room_id);
        assert_eq!(room.state, RoomState::Ready);
        assert_eq!(room.player1, player1);
        assert_eq!(room.player2, player2);
    }

    #[test]
    fn test_submit_guess_and_resolve() {
        let (env, _admin, _vault, _token) = setup_test();
        let player1 = Address::generate(&env);
        let player2 = Address::generate(&env);

        env.mock_all_auths();
        MapaGame::find_match(&env, player1.clone(), MIN_STAKE_DEFAULT, 1);
        let room_id = MapaGame::find_match(&env, player2.clone(), MIN_STAKE_DEFAULT, 1);

        MapaGame::submit_guess(&env, player1.clone(), room_id, 40000000, -74000000, 40748000, -74006000);
        let room = MapaGame::get_room(&env, room_id);
        assert_eq!(room.state, RoomState::Guessed1);

        MapaGame::submit_guess(&env, player2.clone(), room_id, 34000000, -118000000, 40748000, -74006000);
        let room = MapaGame::get_room(&env, room_id);
        assert_eq!(room.state, RoomState::Completed);
        assert_eq!(room.winner, Some(player1.clone()));
    }

    #[test]
    #[should_panic(expected = "already guessed")]
    fn test_double_guess() {
        let (env, _admin, _vault, _token) = setup_test();
        let player1 = Address::generate(&env);
        let player2 = Address::generate(&env);
        env.mock_all_auths();
        MapaGame::find_match(&env, player1.clone(), MIN_STAKE_DEFAULT, 1);
        let room_id = MapaGame::find_match(&env, player2.clone(), MIN_STAKE_DEFAULT, 1);
        MapaGame::submit_guess(&env, player1.clone(), room_id, 40000000, -74000000, 40748000, -74006000);
        MapaGame::submit_guess(&env, player1.clone(), room_id, 41000000, -75000000, 40748000, -74006000);
    }

    #[test]
    fn test_leave_queue() {
        let (env, _admin, _vault, _token) = setup_test();
        let player = Address::generate(&env);
        env.mock_all_auths();
        MapaGame::find_match(&env, player.clone(), MIN_STAKE_DEFAULT, 1);
        assert_eq!(MapaGame::get_queue_count(&env), 1);
        MapaGame::leave_queue(&env, player.clone());
        assert_eq!(MapaGame::get_queue_count(&env), 0);
    }

    #[test]
    fn test_haversine_same_point() {
        let distance = MapaGame::haversine_distance(40748000, -74006000, 40748000, -74006000);
        assert!(distance < 1000, "distance should be near 0, got {}", distance);
    }

    #[test]
    fn test_haversine_nyc_to_la() {
        let distance = MapaGame::haversine_distance(40712800, -74006000, 34052200, -118243700);
        assert!(distance > 3000000 && distance < 5000000, "got {}m", distance);
    }
}
