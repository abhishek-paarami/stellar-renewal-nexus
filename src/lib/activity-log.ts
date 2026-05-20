// Centralized helper for writing user actions into activity_logs.
// RLS requires user_id = auth.uid(), so we always populate it from the current session.
// Failures are swallowed so logging never breaks the user-facing action.
import { supabase } from "@/integrations/supabase/client";

export type ActivityAction =
  | "create"
  | "update"
  | "delete"
  | "view"
  | "import"
  | "export"
  | "login"
  | "logout"
  | "credential_access"
  | "send_email"
  | "user_invite"
  | "user_reset_password"
  | "user_delete"
  | "user_toggle_active";

export type EntityType =
  | "client"
  | "renewal"
  | "amc_client"
  | "time_entry"
  | "user"
  | "email_template"
  | "settings"
  | "import_export";

export async function logActivity(input: {
  action: ActivityAction;
  entity?: EntityType;
  entityId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activity_logs").insert([{
      user_id: user.id,
      action_type: input.action,
      entity_type: input.entity ?? null,
      entity_id: input.entityId ?? null,
      description: input.description,
      metadata: (input.metadata ?? null) as never,
    }]);
  } catch {
    /* swallow */
  }
}