#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec, log};

const DAY_IN_LEDGERS: u32 = 17280;
const BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Location {
    pub lat: i128,
    pub lng: i128,
    pub image_ref: String,
    pub active: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DataKey {
    Admin,
    NextLocationId,
    Location(u64),
    ActiveLocations,
}

#[contract]
pub struct MapaLocationVault;

#[contractimpl]
impl MapaLocationVault {
    pub fn initialize(env: Env, admin: Address) {
        let stored_admin: Option<Address> = env.storage().instance().get(&DataKey::Admin);
        if stored_admin.is_some() {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextLocationId, &1u64);
    }

    pub fn add_location(env: Env, admin: Address, lat: i128, lng: i128, image_ref: String) -> u64 {
        admin.require_auth();
        if env.storage().instance().get::<_, Address>(&DataKey::Admin).unwrap() != admin {
            panic!("not authorized");
        }

        let id: u64 = env.storage().instance().get(&DataKey::NextLocationId).unwrap();
        env.storage().instance().set(&DataKey::NextLocationId, &(id + 1));

        let location = Location {
            lat,
            lng,
            image_ref,
            active: true,
        };
        env.storage().persistent().set(&DataKey::Location(id), &location);
        env.storage().persistent().extend_ttl(&DataKey::Location(id), BUMP_AMOUNT, BUMP_AMOUNT);

        let mut active: Vec<u64> = env.storage().persistent().get(&DataKey::ActiveLocations).unwrap_or(Vec::new(&env));
        active.push_back(id);
        env.storage().persistent().set(&DataKey::ActiveLocations, &active);
        env.storage().persistent().extend_ttl(&DataKey::ActiveLocations, BUMP_AMOUNT, BUMP_AMOUNT);

        log!(&env, "location_added", id, lat, lng);
        id
    }

    pub fn remove_location(env: Env, admin: Address, location_id: u64) {
        admin.require_auth();
        if env.storage().instance().get::<_, Address>(&DataKey::Admin).unwrap() != admin {
            panic!("not authorized");
        }

        let mut location: Location = env.storage().persistent().get(&DataKey::Location(location_id)).unwrap();
        location.active = false;
        env.storage().persistent().set(&DataKey::Location(location_id), &location);
        env.storage().persistent().extend_ttl(&DataKey::Location(location_id), BUMP_AMOUNT, BUMP_AMOUNT);

        let mut active: Vec<u64> = env.storage().persistent().get(&DataKey::ActiveLocations).unwrap_or(Vec::new(&env));
        let mut i = 0;
        while i < active.len() {
            if active.get(i).unwrap() == location_id {
                active.remove(i);
                break;
            }
            i += 1;
        }
        env.storage().persistent().set(&DataKey::ActiveLocations, &active);
        env.storage().persistent().extend_ttl(&DataKey::ActiveLocations, BUMP_AMOUNT, BUMP_AMOUNT);
    }

    pub fn get_random_location(env: Env) -> u64 {
        let active: Vec<u64> = env.storage().persistent().get(&DataKey::ActiveLocations).unwrap_or(Vec::new(&env));
        if active.is_empty() {
            panic!("no active locations");
        }
        let idx: u64 = env.prng().gen_range(0u64..active.len() as u64);
        active.get(idx as u32).unwrap()
    }

    pub fn get_location(env: Env, location_id: u64) -> Location {
        env.storage().persistent().get(&DataKey::Location(location_id)).unwrap()
    }

    pub fn get_location_count(env: Env) -> u32 {
        let active: Vec<u64> = env.storage().persistent().get(&DataKey::ActiveLocations).unwrap_or(Vec::new(&env));
        active.len()
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn setup_test() -> (Env, MapaLocationVaultClient<'static>, Address) {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(MapaLocationVault, ());
        let client = MapaLocationVaultClient::new(&env, &contract_id);
        client.initialize(&admin);
        (env, client, admin)
    }

    #[test]
    fn add_then_remove_location_updates_active_index() {
        let (env, client, admin) = setup_test();
        env.mock_all_auths();
        let image_ref = String::from_str(&env, "nyc_times_square");
        let id = client.add_location(&admin, &40_748_000, &-74_006_000, &image_ref);
        assert_eq!(id, 1);
        assert_eq!(client.get_location_count(), 1);
        let location = client.get_location(&id);
        assert_eq!(location.lat, 40_748_000);
        assert_eq!(location.lng, -74_006_000);
        assert!(location.active);
        client.remove_location(&admin, &id);
        let location = client.get_location(&id);
        assert!(!location.active);
        assert_eq!(client.get_location_count(), 0);
    }

    #[test]
    fn initialize_sets_the_admin_and_empty_index() {
        let (env, client, admin) = setup_test();
        assert_eq!(client.get_admin(), admin);
        assert_eq!(client.get_location_count(), 0);
        assert!(client.try_get_random_location().is_err());
        let _ = env;
    }

    #[test]
    fn add_location_assigns_sequential_ids() {
        let (env, client, admin) = setup_test();
        env.mock_all_auths();
        let first = client.add_location(&admin, &1, &2, &String::from_str(&env, "first"));
        let second = client.add_location(&admin, &3, &4, &String::from_str(&env, "second"));
        assert_eq!(first, 1);
        assert_eq!(second, 2);
        assert_eq!(client.get_location_count(), 2);
    }

    #[test]
    fn add_location_persists_all_location_fields() {
        let (env, client, admin) = setup_test();
        env.mock_all_auths();
        let image_ref = String::from_str(&env, "manila_intramuros");
        let id = client.add_location(&admin, &14_589_600, &120_974_700, &image_ref);
        assert_eq!(
            client.get_location(&id),
            Location { lat: 14_589_600, lng: 120_974_700, image_ref, active: true }
        );
    }

    #[test]
    fn remove_location_keeps_other_locations_active() {
        let (env, client, admin) = setup_test();
        env.mock_all_auths();
        let first = client.add_location(&admin, &1, &1, &String::from_str(&env, "one"));
        let second = client.add_location(&admin, &2, &2, &String::from_str(&env, "two"));
        client.remove_location(&admin, &first);
        assert_eq!(client.get_location_count(), 1);
        assert!(client.get_location(&second).active);
        assert_eq!(client.get_random_location(), second);
    }

    #[test]
    fn random_location_is_an_active_location() {
        let (env, client, admin) = setup_test();
        env.mock_all_auths();
        let first = client.add_location(&admin, &1, &1, &String::from_str(&env, "one"));
        let second = client.add_location(&admin, &2, &2, &String::from_str(&env, "two"));
        let selected = client.get_random_location();
        assert!(selected == first || selected == second);
        assert!(client.get_location(&selected).active);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn initialize_cannot_run_twice() {
        let (env, client, admin) = setup_test();
        client.initialize(&admin);
        let _ = env;
    }

    #[test]
    #[should_panic(expected = "not authorized")]
    fn add_location_rejects_non_admin() {
        let (env, client, _admin) = setup_test();
        env.mock_all_auths();
        let other = Address::generate(&env);
        client.add_location(&other, &0, &0, &String::from_str(&env, "blocked"));
    }

    #[test]
    #[should_panic(expected = "not authorized")]
    fn remove_location_rejects_non_admin() {
        let (env, client, admin) = setup_test();
        env.mock_all_auths();
        let id = client.add_location(&admin, &0, &0, &String::from_str(&env, "owned"));
        client.remove_location(&Address::generate(&env), &id);
    }

    #[test]
    #[should_panic(expected = "no active locations")]
    fn random_location_rejects_an_empty_vault() {
        let (_env, client, _admin) = setup_test();
        client.get_random_location();
    }
}
