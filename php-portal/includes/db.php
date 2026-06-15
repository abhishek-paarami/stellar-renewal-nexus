<?php
declare(strict_types=1);

/**
 * PDO singleton for MySQL.
 */
function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $c = $GLOBALS['paarami_config']['db'];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $c['host'], (int)$c['port'], $c['name'], $c['charset']
    );
    $pdo = new PDO($dsn, $c['user'], $c['pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone='+00:00', sql_mode='STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION'",
    ]);
    return $pdo;
}

/** Run a SELECT and return all rows. */
function db_all(string $sql, array $params = []): array {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

/** Run a SELECT and return one row or null. */
function db_one(string $sql, array $params = []): ?array {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

/** Run an INSERT/UPDATE/DELETE; returns affected row count. */
function db_exec(string $sql, array $params = []): int {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}

/** Generate a v4 UUID (RFC 4122). */
function uuidv4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

/** Encode a PHP value as JSON for storage in a JSON column. */
function json_col(mixed $v): string {
    return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/** Decode a JSON column value safely (returns [] on null/invalid). */
function from_json_col(?string $s, mixed $default = []): mixed {
    if ($s === null || $s === '') return $default;
    $d = json_decode($s, true);
    return $d === null ? $default : $d;
}