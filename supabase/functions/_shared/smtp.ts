// Minimal SMTP client (Deno) supporting STARTTLS (587) and implicit TLS (465).
// Designed for transactional reminder emails — no third-party deps.

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean; // true -> implicit TLS (465)
  username: string;
  password: string;
  from_email: string;
  from_name?: string;
}

export interface MailMessage {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function readLine(reader: ReadableStreamDefaultReader<Uint8Array>, buf: { data: string }): Promise<string> {
  while (true) {
    const idx = buf.data.indexOf("\r\n");
    if (idx >= 0) {
      const line = buf.data.slice(0, idx);
      buf.data = buf.data.slice(idx + 2);
      return line;
    }
    const { value, done } = await reader.read();
    if (done) {
      const line = buf.data;
      buf.data = "";
      return line;
    }
    buf.data += dec.decode(value, { stream: true });
  }
}

async function readResponse(reader: ReadableStreamDefaultReader<Uint8Array>, buf: { data: string }): Promise<{ code: number; text: string }> {
  let text = "";
  let code = 0;
  while (true) {
    const line = await readLine(reader, buf);
    if (!line) break;
    code = parseInt(line.slice(0, 3), 10);
    text += line + "\n";
    if (line[3] !== "-") break;
  }
  return { code, text };
}

function b64(s: string) {
  return btoa(s);
}

export async function sendMail(cfg: SmtpConfig, msg: MailMessage): Promise<void> {
  let conn: Deno.Conn | Deno.TlsConn = cfg.secure
    ? await Deno.connectTls({ hostname: cfg.host, port: cfg.port })
    : await Deno.connect({ hostname: cfg.host, port: cfg.port });

  const buf = { data: "" };
  let reader = conn.readable.getReader();
  let writer = conn.writable.getWriter();

  const expect = async (codes: number[]) => {
    const r = await readResponse(reader, buf);
    if (!codes.includes(r.code)) {
      try { conn.close(); } catch (_) { /* noop */ }
      throw new Error(`SMTP ${r.code}: ${r.text.trim()}`);
    }
    return r;
  };
  const cmd = async (s: string, codes: number[]) => {
    await writer.write(enc.encode(s + "\r\n"));
    return expect(codes);
  };

  await expect([220]);
  await cmd(`EHLO ${cfg.host}`, [250]);

  if (!cfg.secure) {
    await cmd("STARTTLS", [220]);
    // Upgrade
    reader.releaseLock();
    writer.releaseLock();
    conn = await Deno.startTls(conn as Deno.Conn, { hostname: cfg.host });
    reader = conn.readable.getReader();
    writer = conn.writable.getWriter();
    await cmd(`EHLO ${cfg.host}`, [250]);
  }

  await cmd("AUTH LOGIN", [334]);
  await cmd(b64(cfg.username), [334]);
  await cmd(b64(cfg.password), [235]);

  await cmd(`MAIL FROM:<${cfg.from_email}>`, [250]);
  for (const to of msg.to) await cmd(`RCPT TO:<${to}>`, [250, 251]);
  for (const cc of msg.cc || []) await cmd(`RCPT TO:<${cc}>`, [250, 251]);

  await cmd("DATA", [354]);

  const fromHeader = cfg.from_name ? `${cfg.from_name} <${cfg.from_email}>` : cfg.from_email;
  const headers = [
    `From: ${fromHeader}`,
    `To: ${msg.to.join(", ")}`,
    msg.cc && msg.cc.length ? `Cc: ${msg.cc.join(", ")}` : "",
    `Subject: ${msg.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Date: ${new Date().toUTCString()}`,
  ].filter(Boolean).join("\r\n");

  // Dot-stuff: lines starting with "." must be doubled.
  const body = msg.html.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
  await writer.write(enc.encode(headers + "\r\n\r\n" + body + "\r\n.\r\n"));
  await expect([250]);

  try { await cmd("QUIT", [221]); } catch (_) { /* noop */ }
  try { conn.close(); } catch (_) { /* noop */ }
}