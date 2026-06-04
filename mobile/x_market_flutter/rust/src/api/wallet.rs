use blake2::digest::{consts::U32, Digest};
use blake2::Blake2b;
use ed25519_dalek::SigningKey;

type Blake2b256 = Blake2b<U32>;

#[flutter_rust_bridge::frb(sync)]
pub fn derive_sui_address_from_private_key_hex(private_key_hex: String) -> Result<String, String> {
    let bytes = decode_private_key_hex(&private_key_hex)?;
    let seed: [u8; 32] = bytes
        .try_into()
        .map_err(|_| "私钥必须是 32 字节（64 hex）".to_string())?;

    let signing_key = SigningKey::from_bytes(&seed);
    let public_key = signing_key.verifying_key().to_bytes();

    // Sui address = blake2b-256(flag || pubkey), flag(Ed25519)=0x00
    let mut input = Vec::with_capacity(33);
    input.push(0x00);
    input.extend_from_slice(&public_key);

    let mut hasher = Blake2b256::new();
    hasher.update(&input);
    let digest = hasher.finalize();
    Ok(format!("0x{}", hex::encode(digest)))
}

fn decode_private_key_hex(input: &str) -> Result<Vec<u8>, String> {
    let trimmed = input.trim().to_lowercase();
    let normalized = trimmed.strip_prefix("0x").unwrap_or(&trimmed);
    let decoded = hex::decode(normalized).map_err(|_| "私钥 hex 解码失败".to_string())?;

    // Accept 32-byte seed or 64-byte expanded key (seed+pubkey); for 64 bytes, use first 32 bytes.
    match decoded.len() {
        32 => Ok(decoded),
        64 => Ok(decoded[..32].to_vec()),
        _ => Err("私钥长度不合法，请输入 64 或 128 位 hex".to_string()),
    }
}
