<?php
declare(strict_types=1);

/**
 * Append an entry to activity_logs. Never throws — logging failures are silent.
 */
function log_activity(string $action_type, array $opts = []): void {
    try {
        $u = current_user();
        db_exec(
            'INSERT INTO activity_logs (id, user_id, action_type, entity_type, entity_id, description, metadata, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                uuidv4(),
                $u['id'] ?? null,
                $action_type,
                $opts['entity_type'] ?? null,
                $opts['entity_id']   ?? null,
                $opts['description'] ?? null,
                isset($opts['metadata']) ? json_col($opts['metadata']) : null,
                client_ip(),
            ]
        );
    } catch (Throwable) { /* ignore */ }
}