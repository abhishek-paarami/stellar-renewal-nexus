<?php
declare(strict_types=1);

/**
 * AES-256-GCM encryption for credential blobs.
 * Key lives in config.php (vault.key_hex). Never in DB.
 *
 * Storage layout: [12-byte nonce] [ciphertext] [16-byte tag]   -- all binary
 * Stored in VARBINARY/BLOB columns (e.g. renewals.password_enc).
 */

function vault_key(): string {
    static $key = null;
    if ($key !== null) return $key;
    $hex = $GLOBALS['paarami_config']['vault']['key_hex'] ?? '';
    if (!preg_match('/^[0-9a-fA-F]{64}$/', $hex)) {
        throw new RuntimeException('vault.key_hex must be 64 hex chars (32 bytes). See config.sample.php.');
    }
    $key = hex2bin($hex);
    return $key;
}

function vault_encrypt(?string $plaintext): ?string {
    if ($plaintext === null || $plaintext === '') return null;
    $nonce = random_bytes(12);
    $tag = '';
    $ct = openssl_encrypt($plaintext, 'aes-256-gcm', vault_key(), OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    if ($ct === false) throw new RuntimeException('Vault encryption failed.');
    return $nonce . $ct . $tag;
}

function vault_decrypt(?string $blob): ?string {
    if ($blob === null || $blob === '') return null;
    if (strlen($blob) < 12 + 16 + 1) return null;
    $nonce = substr($blob, 0, 12);
    $tag   = substr($blob, -16);
    $ct    = substr($blob, 12, -16);
    $pt = openssl_decrypt($ct, 'aes-256-gcm', vault_key(), OPENSSL_RAW_DATA, $nonce, $tag);
    return $pt === false ? null : $pt;
}