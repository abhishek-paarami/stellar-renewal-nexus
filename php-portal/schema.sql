-- =====================================================================
-- Paarami Internal Operations Portal — MySQL 8 schema
-- Mirrors the live Supabase/Postgres schema (15 tables + 5 enums) AS-IS.
-- UUIDs are stored as CHAR(36); jsonb -> JSON; bytea -> VARBINARY/BLOB;
-- text[] -> JSON (array of strings); timestamptz -> DATETIME(6).
-- =====================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------- ENUMS (modelled as ENUM columns where used) ----------
-- app_role:        super_admin | manager
-- client_type:     internal | external
-- amc_status:      active | inactive | expired | hours_exhausted
-- renewal_status:  active | expiring_soon | expiring_critical | expired
-- time_entry_status: pending | approved | rejected

-- ---------- user_profiles ----------
CREATE TABLE user_profiles (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  full_name       VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,                  -- replaces Supabase Auth
  role            ENUM('super_admin','manager') NOT NULL DEFAULT 'manager',
  custom_role_id  CHAR(36)     NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  last_login      DATETIME(6)  NULL,
  created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- custom_roles + members ----------
CREATE TABLE custom_roles (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  name        VARCHAR(64)  NOT NULL UNIQUE,
  label       VARCHAR(128) NOT NULL,
  created_by  CHAR(36)     NULL,
  created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE custom_role_members (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  role_id     CHAR(36)     NOT NULL,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_crm_role FOREIGN KEY (role_id) REFERENCES custom_roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- developers (legacy list) ----------
CREATE TABLE developers (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- bd_persons (legacy list) ----------
CREATE TABLE bd_persons (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- clients ----------
CREATE TABLE clients (
  id               CHAR(36)     NOT NULL PRIMARY KEY,
  company_name     VARCHAR(255) NOT NULL,
  primary_contact  VARCHAR(255) NULL,
  primary_email    VARCHAR(255) NULL,
  primary_phone    VARCHAR(64)  NULL,
  contacts         JSON         NOT NULL,
  billing_contact  VARCHAR(255) NULL,
  billing_email    VARCHAR(255) NULL,
  address          TEXT         NULL,
  client_type      ENUM('internal','external') NOT NULL DEFAULT 'external',
  notes            TEXT         NULL,
  created_by       CHAR(36)     NULL,
  updated_by       CHAR(36)     NULL,
  created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- renewals (with encrypted credential blobs) ----------
CREATE TABLE renewals (
  id                    CHAR(36)     NOT NULL PRIMARY KEY,
  client_id             CHAR(36)     NULL,
  domain                VARCHAR(255) NOT NULL,
  service_type          VARCHAR(64)  NULL,
  ownership             VARCHAR(64)  NULL,
  registrar             VARCHAR(255) NULL,
  hosting_provider      VARCHAR(255) NULL,
  domain_expiry         DATE         NULL,
  hosting_expiry        DATE         NULL,
  ga_expiry             DATE         NULL,
  mail_type             VARCHAR(64)  NULL,
  email_count           INT          NULL,
  contact_person        VARCHAR(255) NULL,
  contact_emails        JSON         NOT NULL,
  phone_1               VARCHAR(64)  NULL,
  phone_2               VARCHAR(64)  NULL,
  client_type           ENUM('internal','external') NOT NULL DEFAULT 'external',
  notes                 TEXT         NULL,
  admin_url             VARCHAR(500) NULL,
  username_enc          VARBINARY(2048) NULL,
  password_enc          VARBINARY(2048) NULL,
  panel_type            VARCHAR(64)  NULL,
  platform_type         VARCHAR(64)  NULL,
  ftp_host              VARCHAR(255) NULL,
  ftp_username_enc      VARBINARY(2048) NULL,
  ftp_password_enc      VARBINARY(2048) NULL,
  ftp_port              INT          NULL,
  extra_creds_enc       BLOB         NULL,
  reminder_30_sent      TINYINT(1)   NOT NULL DEFAULT 0,
  reminder_7_sent       TINYINT(1)   NOT NULL DEFAULT 0,
  reminder_1_sent       TINYINT(1)   NOT NULL DEFAULT 0,
  reminder_expired_sent TINYINT(1)   NOT NULL DEFAULT 0,
  triggers_disabled     TINYINT(1)   NOT NULL DEFAULT 0,
  sent_thresholds       JSON         NOT NULL,
  created_by            CHAR(36)     NULL,
  updated_by            CHAR(36)     NULL,
  created_at            DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_renewals_client (client_id),
  INDEX idx_renewals_dom_exp (domain_expiry),
  INDEX idx_renewals_host_exp (hosting_expiry)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- amc_clients ----------
CREATE TABLE amc_clients (
  id                    CHAR(36)     NOT NULL PRIMARY KEY,
  client_id             CHAR(36)     NULL,
  website               VARCHAR(255) NULL,
  bd_person             VARCHAR(255) NULL,
  start_date            DATE         NOT NULL,
  end_date              DATE         NOT NULL,
  allocated_hours       DECIMAL(10,2) NOT NULL DEFAULT 0,
  consumed_hours        DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active             TINYINT(1)   NOT NULL DEFAULT 1,
  notes                 TEXT         NULL,
  notify_emails         JSON         NOT NULL,
  reminder_55_sent      TINYINT(1)   NOT NULL DEFAULT 0,
  reminder_85_sent      TINYINT(1)   NOT NULL DEFAULT 0,
  reminder_100_sent     TINYINT(1)   NOT NULL DEFAULT 0,
  reminder_expired_sent TINYINT(1)   NOT NULL DEFAULT 0,
  triggers_disabled     TINYINT(1)   NOT NULL DEFAULT 0,
  sent_thresholds       JSON         NOT NULL,
  sent_date_thresholds  JSON         NOT NULL,
  created_by            CHAR(36)     NULL,
  updated_by            CHAR(36)     NULL,
  created_at            DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_amc_client (client_id),
  INDEX idx_amc_end (end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- time_entries ----------
CREATE TABLE time_entries (
  id                CHAR(36)     NOT NULL PRIMARY KEY,
  amc_client_id     CHAR(36)     NOT NULL,
  developer_name    VARCHAR(255) NOT NULL,
  entry_date        DATE         NOT NULL,
  work_description  TEXT         NOT NULL,
  hours             INT          NOT NULL DEFAULT 0,
  minutes           INT          NOT NULL DEFAULT 0,
  is_billable       TINYINT(1)   NOT NULL DEFAULT 1,
  status            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  created_by        CHAR(36)     NULL,
  updated_by        CHAR(36)     NULL,
  created_at        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_te_amc (amc_client_id),
  CONSTRAINT fk_te_amc FOREIGN KEY (amc_client_id) REFERENCES amc_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- email_templates ----------
CREATE TABLE email_templates (
  id           CHAR(36)     NOT NULL PRIMARY KEY,
  template_key VARCHAR(128) NOT NULL UNIQUE,
  subject      VARCHAR(500) NOT NULL,
  html_body    MEDIUMTEXT   NOT NULL,
  updated_by   CHAR(36)     NULL,
  updated_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- email_logs ----------
CREATE TABLE email_logs (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  sent_at         DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  email_type      VARCHAR(64)  NOT NULL,
  to_addresses    JSON         NOT NULL,
  cc_addresses    JSON         NOT NULL,
  subject         VARCHAR(500) NULL,
  status          VARCHAR(32)  NOT NULL,
  smtp_response   TEXT         NULL,
  error_message   TEXT         NULL,
  related_entity  VARCHAR(64)  NULL,
  related_id      CHAR(36)     NULL,
  triggered_by    CHAR(36)     NULL,
  INDEX idx_email_logs_sent (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- reminder_logs ----------
CREATE TABLE reminder_logs (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  renewal_id    CHAR(36)     NULL,
  reminder_type VARCHAR(64)  NOT NULL,
  sent_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  sent_to       JSON         NOT NULL,
  status        VARCHAR(32)  NOT NULL,
  error_message TEXT         NULL,
  expiry_kind   VARCHAR(32)  NULL,
  INDEX idx_reminder_logs_sent (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- activity_logs ----------
CREATE TABLE activity_logs (
  id           CHAR(36)     NOT NULL PRIMARY KEY,
  user_id      CHAR(36)     NULL,
  action_type  VARCHAR(64)  NOT NULL,
  entity_type  VARCHAR(64)  NULL,
  entity_id    CHAR(36)     NULL,
  description  TEXT         NULL,
  metadata     JSON         NULL,
  ip_address   VARCHAR(64)  NULL,
  created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_act_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- credential_access_logs ----------
CREATE TABLE credential_access_logs (
  id           CHAR(36)     NOT NULL PRIMARY KEY,
  renewal_id   CHAR(36)     NOT NULL,
  accessed_by  CHAR(36)     NOT NULL,
  accessed_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  ip_address   VARCHAR(64)  NULL,
  user_agent   VARCHAR(500) NULL,
  INDEX idx_cal_accessed (accessed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- app_settings (key/value JSON) ----------
CREATE TABLE app_settings (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  `key`       VARCHAR(128) NOT NULL UNIQUE,
  value       JSON         NOT NULL,
  updated_by  CHAR(36)     NULL,
  updated_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- Bootstrap: create the first super admin manually after import.
-- Replace the email/name/password before running.
--
-- SET @uid := UUID();
-- INSERT INTO user_profiles (id, full_name, email, password_hash, role)
-- VALUES (@uid, 'Super Admin', 'admin@paaramidigital.com',
--         '$2y$12$REPLACE_WITH_password_hash_OUTPUT', 'super_admin');
--
-- Generate the hash with:  php -r "echo password_hash('YourPass', PASSWORD_BCRYPT);"
-- =====================================================================