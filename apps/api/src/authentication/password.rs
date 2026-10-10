use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
};
use rand::rngs::OsRng;

pub fn hash_password(plain: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    match Argon2::default().hash_password(plain.as_bytes(), &salt) {
        Ok(hash) => Ok(hash.to_string()),
        Err(e) => Err(e),
    }
}

pub fn verify_password(plain: &str, hash: &str) -> Result<bool, argon2::password_hash::Error> {
    #[allow(clippy::question_mark)] // Allowing this rule allows us to handle the errors where they
    // actually happen instead of propagating them.
    let parsed = match PasswordHash::new(hash) {
        Ok(h) => h,
        Err(e) => return Err(e),
    };
    match Argon2::default().verify_password(plain.as_bytes(), &parsed) {
        Ok(()) => Ok(true),
        Err(argon2::password_hash::Error::Password) => Ok(false),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::{hash_password, verify_password};

    #[test]
    fn hash_produces_argon2id_string() {
        let hash = hash_password("secret").unwrap();
        assert!(hash.starts_with("$argon2id$"));
    }

    #[test]
    fn hash_is_not_plaintext() {
        let hash = hash_password("secret").unwrap();
        assert_ne!(hash, "secret");
    }

    #[test]
    fn verify_correct_password_returns_true() {
        let hash = hash_password("correct_horse").unwrap();
        assert!(verify_password("correct_horse", &hash).unwrap());
    }

    #[test]
    fn verify_wrong_password_returns_false() {
        let hash = hash_password("correct_horse").unwrap();
        assert!(verify_password("wrong_horse", &hash).unwrap());
    }

    #[test]
    fn verify_corrupted_hash_returns_err() {
        assert!(verify_password("any", "not-a-valid-argon2-hash").is_err());
    }

    #[test]
    fn two_hashes_of_same_password_differ() {
        // Salt is random — identical inputs must not produce identical hashes
        let h1 = hash_password("same_password").unwrap();
        let h2 = hash_password("same_password").unwrap();
        assert_ne!(h1, h2);
    }
}
