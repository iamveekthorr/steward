fn main() {
    use argon2::{Argon2, password_hash::{PasswordHasher, SaltString, rand_core::OsRng}};
    let pass = std::env::args().nth(1).unwrap_or_else(|| "Steward123!".to_string());
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default().hash_password(pass.as_bytes(), &salt).unwrap().to_string();
    println!("{hash}");
}
