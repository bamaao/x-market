use blake2::digest::{consts::U32, Digest};
use blake2::Blake2b;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use rand::RngCore;
use serde_json::json;
use x25519_dalek::{PublicKey as X25519PublicKey, StaticSecret};
use xsalsa20poly1305::{
    aead::{Aead, KeyInit},
    Key, Nonce, XSalsa20Poly1305,
};

type Blake2b256 = Blake2b<U32>;

#[flutter_rust_bridge::frb(sync)]
pub fn phantom_generate_dapp_encryption_keypair() -> Result<String, String> {
    let mut secret_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut secret_bytes);
    let secret = StaticSecret::from(secret_bytes);
    let public = X25519PublicKey::from(&secret);

    Ok(json!({
        "public_key_b58": bs58::encode(public.as_bytes()).into_string(),
        "secret_key_b58": bs58::encode(secret.to_bytes()).into_string()
    })
    .to_string())
}

#[flutter_rust_bridge::frb(sync)]
pub fn phantom_encrypt_sign_transaction_payload(
    dapp_secret_key_b58: String,
    phantom_wallet_pubkey_b58: String,
    session: String,
    transaction_bytes_base64: String,
) -> Result<String, String> {
    let tx_bytes = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        transaction_bytes_base64.trim(),
    )
    .map_err(|_| "transaction base64 解码失败".to_string())?;
    if tx_bytes.is_empty() {
        return Err("transaction bytes 为空".to_string());
    }

    let transaction_b58 = bs58::encode(&tx_bytes).into_string();
    let payload = json!({
        "session": session,
        "transaction": transaction_b58
    })
    .to_string();

    let secret = decode_32_b58(&dapp_secret_key_b58, "dapp secret")?;
    let wallet_pk = decode_32_b58(&phantom_wallet_pubkey_b58, "phantom wallet pubkey")?;
    let shared = derive_shared_secret(secret, wallet_pk);

    let (nonce_b58, data_b58) = encrypt_payload(&shared, payload.as_bytes())?;
    Ok(json!({
        "nonce_b58": nonce_b58,
        "data_b58": data_b58
    })
    .to_string())
}

#[flutter_rust_bridge::frb(sync)]
pub fn base58_to_base64(input_b58: String) -> Result<String, String> {
    let raw = bs58::decode(input_b58.trim())
        .into_vec()
        .map_err(|_| "base58 解码失败".to_string())?;
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        raw,
    ))
}

#[flutter_rust_bridge::frb(sync)]
pub fn phantom_encrypt_sign_message_payload(
    dapp_secret_key_b58: String,
    phantom_wallet_pubkey_b58: String,
    session: String,
    message_utf8: String,
) -> Result<String, String> {
    let secret = decode_32_b58(&dapp_secret_key_b58, "dapp secret")?;
    let wallet_pk = decode_32_b58(&phantom_wallet_pubkey_b58, "phantom wallet pubkey")?;
    let shared = derive_shared_secret(secret, wallet_pk);

    let message_b58 = bs58::encode(message_utf8.as_bytes()).into_string();
    let payload = json!({
        "session": session,
        "message": message_b58,
        "display": "utf8"
    })
    .to_string();

    let (nonce_b58, data_b58) = encrypt_payload(&shared, payload.as_bytes())?;
    Ok(json!({
        "nonce_b58": nonce_b58,
        "data_b58": data_b58
    })
    .to_string())
}

#[flutter_rust_bridge::frb(sync)]
pub fn phantom_decrypt_payload(
    dapp_secret_key_b58: String,
    phantom_wallet_pubkey_b58: String,
    nonce_b58: String,
    data_b58: String,
) -> Result<String, String> {
    let secret = decode_32_b58(&dapp_secret_key_b58, "dapp secret")?;
    let wallet_pk = decode_32_b58(&phantom_wallet_pubkey_b58, "phantom wallet pubkey")?;
    let nonce = decode_nonce(&nonce_b58)?;
    let data = bs58::decode(data_b58)
        .into_vec()
        .map_err(|_| "data base58 解码失败".to_string())?;

    let shared = derive_shared_secret(secret, wallet_pk);
    let cipher = XSalsa20Poly1305::new(Key::from_slice(&shared));
    let plain = cipher
        .decrypt(Nonce::from_slice(&nonce), data.as_ref())
        .map_err(|_| "payload 解密失败".to_string())?;
    String::from_utf8(plain).map_err(|_| "payload 不是有效 UTF-8".to_string())
}

#[flutter_rust_bridge::frb(sync)]
pub fn phantom_public_key_to_sui_address(pubkey_b58: String) -> Result<String, String> {
    let pubkey = decode_32_b58(&pubkey_b58, "phantom pubkey")?;
    let mut input = Vec::with_capacity(33);
    input.push(0x00); // Ed25519 flag
    input.extend_from_slice(&pubkey);

    let mut hasher = Blake2b256::new();
    hasher.update(&input);
    let digest = hasher.finalize();
    Ok(format!("0x{}", hex::encode(digest)))
}

#[flutter_rust_bridge::frb(sync)]
pub fn phantom_verify_sign_message(
    pubkey_b58: String,
    message_utf8: String,
    signature_b58: String,
) -> Result<bool, String> {
    let pubkey = decode_32_b58(&pubkey_b58, "phantom pubkey")?;
    let signature_bytes = bs58::decode(signature_b58)
        .into_vec()
        .map_err(|_| "signature base58 解码失败".to_string())?;
    if signature_bytes.len() != 64 {
        return Err("signature 长度不是 64 字节".to_string());
    }
    let vk = VerifyingKey::from_bytes(&pubkey).map_err(|_| "pubkey 非法".to_string())?;
    let signature =
        Signature::from_slice(&signature_bytes).map_err(|_| "signature 非法".to_string())?;
    Ok(vk.verify(message_utf8.as_bytes(), &signature).is_ok())
}

fn derive_shared_secret(dapp_secret: [u8; 32], wallet_pubkey: [u8; 32]) -> [u8; 32] {
    let sk = StaticSecret::from(dapp_secret);
    let pk = X25519PublicKey::from(wallet_pubkey);
    sk.diffie_hellman(&pk).to_bytes()
}

fn encrypt_payload(shared_key: &[u8; 32], payload: &[u8]) -> Result<(String, String), String> {
    let mut nonce = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut nonce);
    let cipher = XSalsa20Poly1305::new(Key::from_slice(shared_key));
    let encrypted = cipher
        .encrypt(Nonce::from_slice(&nonce), payload)
        .map_err(|_| "payload 加密失败".to_string())?;
    Ok((
        bs58::encode(nonce).into_string(),
        bs58::encode(encrypted).into_string(),
    ))
}

fn decode_32_b58(input: &str, field_name: &str) -> Result<[u8; 32], String> {
    let raw = bs58::decode(input)
        .into_vec()
        .map_err(|_| format!("{field_name} base58 解码失败"))?;
    raw.try_into()
        .map_err(|_| format!("{field_name} 需要 32 字节"))
}

fn decode_nonce(input: &str) -> Result<[u8; 24], String> {
    let raw = bs58::decode(input)
        .into_vec()
        .map_err(|_| "nonce base58 解码失败".to_string())?;
    raw.try_into()
        .map_err(|_| "nonce 需要 24 字节".to_string())
}
