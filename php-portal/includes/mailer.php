<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

/**
 * Send a transactional email using the SMTP config saved in app_settings
 * (falls back to config.php['smtp']).
 *
 * Mirrors the Lovable supabase/functions/_shared/smtp.ts behaviour for
 * subject/body composition (HTML emails, multiple To/Cc).
 *
 * @param string[] $to
 * @param string[] $cc
 * @return array{ok:bool,error?:string,smtp?:string}
 */
function send_mail(array $to, array $cc, string $subject, string $html, array $opts = []): array {
    $smtp = load_smtp_config();
    $mail = new PHPMailer(true);
    $trace = [];
    try {
        $mail->isSMTP();
        $mail->Host       = $smtp['host'];
        $mail->Port       = (int)$smtp['port'];
        $mail->SMTPAuth   = true;
        $mail->Username   = $smtp['username'];
        $mail->Password   = $smtp['password'];
        if ($smtp['encryption'] === 'ssl') {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        } elseif ($smtp['encryption'] === 'tls') {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        }
        $mail->CharSet  = 'UTF-8';
        $mail->setFrom($smtp['from_email'], $smtp['from_name'] ?: '');
        foreach ($to as $a) if ($a) $mail->addAddress($a);
        foreach ($cc as $a) if ($a) $mail->addCC($a);
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $html;
        $mail->AltBody = trim(strip_tags(preg_replace('/<br\s*\/?>/i', "\n", $html)));
        $mail->SMTPDebug = 0;
        $mail->Debugoutput = function ($s) use (&$trace) { $trace[] = $s; };
        $mail->send();
        log_email_send($opts, $to, $cc, $subject, 'sent', implode("\n", $trace), null);
        return ['ok' => true, 'smtp' => implode("\n", $trace)];
    } catch (MailException $e) {
        log_email_send($opts, $to, $cc, $subject, 'failed', implode("\n", $trace), $e->getMessage());
        return ['ok' => false, 'error' => $e->getMessage(), 'smtp' => implode("\n", $trace)];
    }
}

function load_smtp_config(): array {
    $base = $GLOBALS['paarami_config']['smtp'];
    $row = db_one('SELECT value FROM app_settings WHERE `key` = ?', ['smtp']);
    if ($row) {
        $saved = from_json_col($row['value'], []);
        foreach (['host','port','encryption','username','password','from_email','from_name'] as $k) {
            if (isset($saved[$k]) && $saved[$k] !== '') $base[$k] = $saved[$k];
        }
    }
    return $base;
}

function log_email_send(array $opts, array $to, array $cc, string $subject, string $status, ?string $smtp, ?string $err): void {
    try {
        db_exec(
            'INSERT INTO email_logs (id, email_type, to_addresses, cc_addresses, subject, status, smtp_response, error_message, related_entity, related_id, triggered_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [uuidv4(), $opts['type'] ?? 'manual', json_col($to), json_col($cc), $subject, $status, $smtp, $err, $opts['entity'] ?? null, $opts['related_id'] ?? null, $opts['triggered_by'] ?? (current_user()['id'] ?? null)]
        );
    } catch (Throwable) { /* never block the send */ }
}