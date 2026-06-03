export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      amc_clients: {
        Row: {
          allocated_hours: number
          bd_person: string | null
          client_id: string | null
          consumed_hours: number
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          is_active: boolean
          notes: string | null
          notify_emails: string[] | null
          reminder_100_sent: boolean
          reminder_55_sent: boolean
          reminder_85_sent: boolean
          reminder_expired_sent: boolean
          sent_thresholds: Json
          start_date: string
          triggers_disabled: boolean
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          allocated_hours?: number
          bd_person?: string | null
          client_id?: string | null
          consumed_hours?: number
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          notes?: string | null
          notify_emails?: string[] | null
          reminder_100_sent?: boolean
          reminder_55_sent?: boolean
          reminder_85_sent?: boolean
          reminder_expired_sent?: boolean
          sent_thresholds?: Json
          start_date: string
          triggers_disabled?: boolean
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          allocated_hours?: number
          bd_person?: string | null
          client_id?: string | null
          consumed_hours?: number
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          notify_emails?: string[] | null
          reminder_100_sent?: boolean
          reminder_55_sent?: boolean
          reminder_85_sent?: boolean
          reminder_expired_sent?: boolean
          sent_thresholds?: Json
          start_date?: string
          triggers_disabled?: boolean
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amc_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amc_clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amc_clients_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_persons: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          billing_contact: string | null
          billing_email: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          company_name: string
          contacts: Json
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          primary_contact: string | null
          primary_email: string | null
          primary_phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          billing_contact?: string | null
          billing_email?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_name: string
          contacts?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          primary_contact?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          billing_contact?: string | null
          billing_email?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_name?: string
          contacts?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          primary_contact?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_access_logs: {
        Row: {
          accessed_at: string
          accessed_by: string
          id: string
          ip_address: string | null
          renewal_id: string
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          accessed_by: string
          id?: string
          ip_address?: string | null
          renewal_id: string
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          accessed_by?: string
          id?: string
          ip_address?: string | null
          renewal_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credential_access_logs_accessed_by_fkey"
            columns: ["accessed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_access_logs_renewal_id_fkey"
            columns: ["renewal_id"]
            isOneToOne: false
            referencedRelation: "renewals"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_role_members: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          role_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          role_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_role_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          name?: string
        }
        Relationships: []
      }
      developers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          cc_addresses: string[]
          email_type: string
          error_message: string | null
          id: string
          related_entity: string | null
          related_id: string | null
          sent_at: string
          smtp_response: string | null
          status: string
          subject: string | null
          to_addresses: string[]
          triggered_by: string | null
        }
        Insert: {
          cc_addresses?: string[]
          email_type: string
          error_message?: string | null
          id?: string
          related_entity?: string | null
          related_id?: string | null
          sent_at?: string
          smtp_response?: string | null
          status: string
          subject?: string | null
          to_addresses?: string[]
          triggered_by?: string | null
        }
        Update: {
          cc_addresses?: string[]
          email_type?: string
          error_message?: string | null
          id?: string
          related_entity?: string | null
          related_id?: string | null
          sent_at?: string
          smtp_response?: string | null
          status?: string
          subject?: string | null
          to_addresses?: string[]
          triggered_by?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          html_body: string
          id: string
          subject: string
          template_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          html_body: string
          id?: string
          subject: string
          template_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          html_body?: string
          id?: string
          subject?: string
          template_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_logs: {
        Row: {
          error_message: string | null
          expiry_kind: string | null
          id: string
          reminder_type: string
          renewal_id: string | null
          sent_at: string
          sent_to: string[]
          status: string
        }
        Insert: {
          error_message?: string | null
          expiry_kind?: string | null
          id?: string
          reminder_type: string
          renewal_id?: string | null
          sent_at?: string
          sent_to?: string[]
          status: string
        }
        Update: {
          error_message?: string | null
          expiry_kind?: string | null
          id?: string
          reminder_type?: string
          renewal_id?: string | null
          sent_at?: string
          sent_to?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_renewal_id_fkey"
            columns: ["renewal_id"]
            isOneToOne: false
            referencedRelation: "renewals"
            referencedColumns: ["id"]
          },
        ]
      }
      renewals: {
        Row: {
          admin_url: string | null
          client_id: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          contact_emails: string[]
          contact_person: string | null
          created_at: string
          created_by: string | null
          domain: string
          domain_expiry: string | null
          email_count: number | null
          ftp_host: string | null
          ftp_password_enc: string | null
          ftp_port: number | null
          ftp_username_enc: string | null
          ga_expiry: string | null
          hosting_expiry: string | null
          hosting_provider: string | null
          id: string
          mail_type: string | null
          notes: string | null
          ownership: string | null
          panel_type: string | null
          password_enc: string | null
          phone_1: string | null
          phone_2: string | null
          registrar: string | null
          reminder_1_sent: boolean
          reminder_30_sent: boolean
          reminder_7_sent: boolean
          reminder_expired_sent: boolean
          sent_thresholds: Json
          service_type: string | null
          triggers_disabled: boolean
          updated_at: string
          updated_by: string | null
          username_enc: string | null
        }
        Insert: {
          admin_url?: string | null
          client_id?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          contact_emails?: string[]
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          domain: string
          domain_expiry?: string | null
          email_count?: number | null
          ftp_host?: string | null
          ftp_password_enc?: string | null
          ftp_port?: number | null
          ftp_username_enc?: string | null
          ga_expiry?: string | null
          hosting_expiry?: string | null
          hosting_provider?: string | null
          id?: string
          mail_type?: string | null
          notes?: string | null
          ownership?: string | null
          panel_type?: string | null
          password_enc?: string | null
          phone_1?: string | null
          phone_2?: string | null
          registrar?: string | null
          reminder_1_sent?: boolean
          reminder_30_sent?: boolean
          reminder_7_sent?: boolean
          reminder_expired_sent?: boolean
          sent_thresholds?: Json
          service_type?: string | null
          triggers_disabled?: boolean
          updated_at?: string
          updated_by?: string | null
          username_enc?: string | null
        }
        Update: {
          admin_url?: string | null
          client_id?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          contact_emails?: string[]
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          domain?: string
          domain_expiry?: string | null
          email_count?: number | null
          ftp_host?: string | null
          ftp_password_enc?: string | null
          ftp_port?: number | null
          ftp_username_enc?: string | null
          ga_expiry?: string | null
          hosting_expiry?: string | null
          hosting_provider?: string | null
          id?: string
          mail_type?: string | null
          notes?: string | null
          ownership?: string | null
          panel_type?: string | null
          password_enc?: string | null
          phone_1?: string | null
          phone_2?: string | null
          registrar?: string | null
          reminder_1_sent?: boolean
          reminder_30_sent?: boolean
          reminder_7_sent?: boolean
          reminder_expired_sent?: boolean
          sent_thresholds?: Json
          service_type?: string | null
          triggers_disabled?: boolean
          updated_at?: string
          updated_by?: string | null
          username_enc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "renewals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewals_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          amc_client_id: string
          created_at: string
          created_by: string | null
          developer_name: string
          entry_date: string
          hours: number
          id: string
          is_billable: boolean
          minutes: number
          status: Database["public"]["Enums"]["time_entry_status"]
          updated_at: string
          updated_by: string | null
          work_description: string
        }
        Insert: {
          amc_client_id: string
          created_at?: string
          created_by?: string | null
          developer_name: string
          entry_date?: string
          hours?: number
          id?: string
          is_billable?: boolean
          minutes?: number
          status?: Database["public"]["Enums"]["time_entry_status"]
          updated_at?: string
          updated_by?: string | null
          work_description: string
        }
        Update: {
          amc_client_id?: string
          created_at?: string
          created_by?: string | null
          developer_name?: string
          entry_date?: string
          hours?: number
          id?: string
          is_billable?: boolean
          minutes?: number
          status?: Database["public"]["Enums"]["time_entry_status"]
          updated_at?: string
          updated_by?: string | null
          work_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_amc_client_id_fkey"
            columns: ["amc_client_id"]
            isOneToOne: false
            referencedRelation: "amc_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          custom_role_id: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_role_id?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          last_login?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_role_id?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      dec_text: { Args: { cipher: string }; Returns: string }
      enc_text: { Args: { plain: string }; Returns: string }
      export_renewal_credentials: {
        Args: never
        Returns: {
          ftp_password: string
          ftp_username: string
          id: string
          password: string
          username: string
        }[]
      }
      get_crypto_key: { Args: never; Returns: string }
      get_renewal_credentials: {
        Args: { _renewal_id: string }
        Returns: {
          admin_url: string
          ftp_host: string
          ftp_password: string
          ftp_port: number
          ftp_username: string
          panel_type: string
          password: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
      set_renewal_credentials: {
        Args: {
          _admin_url: string
          _ftp_host: string
          _ftp_password: string
          _ftp_port: number
          _ftp_username: string
          _panel_type: string
          _password: string
          _renewal_id: string
          _username: string
        }
        Returns: undefined
      }
    }
    Enums: {
      amc_status: "active" | "inactive" | "expired" | "hours_exhausted"
      app_role: "super_admin" | "manager"
      client_type: "internal" | "external"
      renewal_status:
        | "active"
        | "expiring_soon"
        | "expiring_critical"
        | "expired"
      time_entry_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      amc_status: ["active", "inactive", "expired", "hours_exhausted"],
      app_role: ["super_admin", "manager"],
      client_type: ["internal", "external"],
      renewal_status: [
        "active",
        "expiring_soon",
        "expiring_critical",
        "expired",
      ],
      time_entry_status: ["pending", "approved", "rejected"],
    },
  },
} as const
