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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          pod_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          pod_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          pod_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notes_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          created_at: string
          event_label: string | null
          event_type: string
          id: string
          module_type: Database["public"]["Enums"]["automation_module_type"]
          payload: Json | null
          pod_id: string
          status: Database["public"]["Enums"]["automation_event_status"]
        }
        Insert: {
          created_at?: string
          event_label?: string | null
          event_type: string
          id?: string
          module_type: Database["public"]["Enums"]["automation_module_type"]
          payload?: Json | null
          pod_id: string
          status?: Database["public"]["Enums"]["automation_event_status"]
        }
        Update: {
          created_at?: string
          event_label?: string | null
          event_type?: string
          id?: string
          module_type?: Database["public"]["Enums"]["automation_module_type"]
          payload?: Json | null
          pod_id?: string
          status?: Database["public"]["Enums"]["automation_event_status"]
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_modules: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          module_type: Database["public"]["Enums"]["automation_module_type"]
          pod_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          module_type: Database["public"]["Enums"]["automation_module_type"]
          pod_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          module_type?: Database["public"]["Enums"]["automation_module_type"]
          pod_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_modules_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          call_started_at: string | null
          call_status: Database["public"]["Enums"]["call_status"] | null
          called_number: string | null
          caller_number: string | null
          created_at: string
          direction: Database["public"]["Enums"]["call_direction"] | null
          duration_seconds: number | null
          id: string
          metadata: Json | null
          pod_id: string
          recording_url: string | null
          retell_account_id: string | null
          retell_call_id: string | null
          summary: string | null
          transcript: string | null
        }
        Insert: {
          call_started_at?: string | null
          call_status?: Database["public"]["Enums"]["call_status"] | null
          called_number?: string | null
          caller_number?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["call_direction"] | null
          duration_seconds?: number | null
          id?: string
          metadata?: Json | null
          pod_id: string
          recording_url?: string | null
          retell_account_id?: string | null
          retell_call_id?: string | null
          summary?: string | null
          transcript?: string | null
        }
        Update: {
          call_started_at?: string | null
          call_status?: Database["public"]["Enums"]["call_status"] | null
          called_number?: string | null
          caller_number?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["call_direction"] | null
          duration_seconds?: number | null
          id?: string
          metadata?: Json | null
          pod_id?: string
          recording_url?: string | null
          retell_account_id?: string | null
          retell_call_id?: string | null
          summary?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_retell_account_id_fkey"
            columns: ["retell_account_id"]
            isOneToOne: false
            referencedRelation: "retell_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          invoice_date: string | null
          invoice_url: string | null
          pod_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          stripe_invoice_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          invoice_date?: string | null
          invoice_url?: string | null
          pod_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_invoice_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          invoice_date?: string | null
          invoice_url?: string | null
          pod_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_members: {
        Row: {
          accepted_at: string | null
          id: string
          invited_at: string
          pod_id: string
          role: Database["public"]["Enums"]["pod_member_role"]
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          pod_id: string
          role?: Database["public"]["Enums"]["pod_member_role"]
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          pod_id?: string
          role?: Database["public"]["Enums"]["pod_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_members_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_settings: {
        Row: {
          automations_enabled: boolean
          billing_enabled: boolean
          created_at: string
          id: string
          pod_id: string
          updated_at: string
          visible_modules: Json | null
          voice_enabled: boolean
        }
        Insert: {
          automations_enabled?: boolean
          billing_enabled?: boolean
          created_at?: string
          id?: string
          pod_id: string
          updated_at?: string
          visible_modules?: Json | null
          voice_enabled?: boolean
        }
        Update: {
          automations_enabled?: boolean
          billing_enabled?: boolean
          created_at?: string
          id?: string
          pod_id?: string
          updated_at?: string
          visible_modules?: Json | null
          voice_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pod_settings_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: true
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
        ]
      }
      pods: {
        Row: {
          address: string | null
          branding_label: string | null
          company_name: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          retell_agent_id: string | null
          retell_api_key: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          branding_label?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          retell_agent_id?: string | null
          retell_api_key?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          branding_label?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          retell_agent_id?: string | null
          retell_api_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      retell_accounts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          last_synced_at: string | null
          pod_id: string
          retell_agent_id: string
          retell_api_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          last_synced_at?: string | null
          pod_id: string
          retell_agent_id: string
          retell_api_key: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          last_synced_at?: string | null
          pod_id?: string
          retell_agent_id?: string
          retell_api_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "retell_accounts_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number | null
          billing_cycle: Database["public"]["Enums"]["billing_cycle"] | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_name: string | null
          pod_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_name?: string | null
          pod_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_name?: string | null
          pod_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_pod: {
        Args: { _pod_id: string; _user_id: string }
        Returns: boolean
      }
      get_user_pod_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_pod_member: {
        Args: { _pod_id: string; _user_id: string }
        Returns: boolean
      }
      is_pod_owner: {
        Args: { _pod_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client" | "member"
      automation_event_status: "success" | "failed" | "pending"
      automation_module_type:
        | "leads"
        | "sms"
        | "bookings"
        | "workflow"
        | "custom"
      billing_cycle: "monthly" | "yearly"
      call_direction: "inbound" | "outbound"
      call_status: "completed" | "missed" | "failed" | "voicemail"
      invoice_status: "paid" | "open" | "failed" | "void"
      pod_member_role: "owner" | "member"
      subscription_status:
        | "active"
        | "past_due"
        | "canceled"
        | "trialing"
        | "unpaid"
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
      app_role: ["admin", "client", "member"],
      automation_event_status: ["success", "failed", "pending"],
      automation_module_type: [
        "leads",
        "sms",
        "bookings",
        "workflow",
        "custom",
      ],
      billing_cycle: ["monthly", "yearly"],
      call_direction: ["inbound", "outbound"],
      call_status: ["completed", "missed", "failed", "voicemail"],
      invoice_status: ["paid", "open", "failed", "void"],
      pod_member_role: ["owner", "member"],
      subscription_status: [
        "active",
        "past_due",
        "canceled",
        "trialing",
        "unpaid",
      ],
    },
  },
} as const
