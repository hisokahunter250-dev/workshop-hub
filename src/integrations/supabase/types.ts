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
      admin_config: {
        Row: {
          id: number
          master_password_hash: string
        }
        Insert: {
          id?: number
          master_password_hash: string
        }
        Update: {
          id?: number
          master_password_hash?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          permissions: string[]
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          permissions?: string[]
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          permissions?: string[]
          username?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: number
          notification_email: string | null
          theme: string
          updated_at: string
        }
        Insert: {
          id?: number
          notification_email?: string | null
          theme?: string
          updated_at?: string
        }
        Update: {
          id?: number
          notification_email?: string | null
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      field_configs: {
        Row: {
          created_at: string
          id: string
          is_builtin: boolean
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_builtin?: boolean
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_builtin?: boolean
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          delivered: number
          extra: Json
          id: string
          notes: string | null
          received: number
          repaired: number
          report_date: string
          workshop_id: string
        }
        Insert: {
          created_at?: string
          delivered?: number
          extra?: Json
          id?: string
          notes?: string | null
          received?: number
          repaired?: number
          report_date?: string
          workshop_id: string
        }
        Update: {
          created_at?: string
          delivered?: number
          extra?: Json
          id?: string
          notes?: string | null
          received?: number
          repaired?: number
          report_date?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          created_at: string
          id: string
          name: string
          password_hash: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          password_hash: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          password_hash?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_report:
        | {
            Args: {
              p_date: string
              p_delivered: number
              p_notes: string
              p_password: string
              p_received: number
              p_repaired: number
              p_workshop_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_date: string
              p_delivered: number
              p_extra?: Json
              p_notes: string
              p_password: string
              p_received: number
              p_repaired: number
              p_workshop_id: string
            }
            Returns: string
          }
      admin_add_admin: {
        Args: {
          p_admin_password: string
          p_password: string
          p_permissions: string[]
          p_username: string
        }
        Returns: string
      }
      admin_add_field: {
        Args: { p_admin_password: string; p_key: string; p_label: string }
        Returns: string
      }
      admin_add_workshop: {
        Args: { p_admin_password: string; p_name: string; p_password: string }
        Returns: string
      }
      admin_delete_admin: {
        Args: { p_admin_id: string; p_admin_password: string }
        Returns: boolean
      }
      admin_delete_field: {
        Args: { p_admin_password: string; p_field_id: string }
        Returns: boolean
      }
      admin_delete_report: {
        Args: { p_admin_password: string; p_report_id: string }
        Returns: boolean
      }
      admin_delete_workshop: {
        Args: { p_admin_password: string; p_workshop_id: string }
        Returns: boolean
      }
      admin_get_all: {
        Args: { p_admin_password: string }
        Returns: {
          last_report_at: string
          reports_count: number
          sort_order: number
          total_delivered: number
          total_received: number
          total_repaired: number
          workshop_id: string
          workshop_name: string
        }[]
      }
      admin_get_reports: {
        Args: { p_admin_password: string; p_workshop_id: string }
        Returns: {
          created_at: string
          delivered: number
          extra: Json
          id: string
          notes: string | null
          received: number
          repaired: number
          report_date: string
          workshop_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_import_report: {
        Args: {
          p_admin_password: string
          p_date: string
          p_delivered: number
          p_extra?: Json
          p_notes: string
          p_received: number
          p_repaired: number
          p_workshop_id: string
        }
        Returns: string
      }
      admin_list_admins: {
        Args: { p_admin_password: string }
        Returns: {
          created_at: string
          id: string
          permissions: string[]
          username: string
        }[]
      }
      admin_list_fields: {
        Args: { p_admin_password: string }
        Returns: {
          created_at: string
          id: string
          is_builtin: boolean
          key: string
          label: string
          sort_order: number
        }[]
        SetofOptions: {
          from: "*"
          to: "field_configs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_login: {
        Args: { p_password: string }
        Returns: {
          is_master: boolean
          permissions: string[]
          username: string
        }[]
      }
      admin_update_admin: {
        Args: {
          p_admin_id: string
          p_admin_password: string
          p_new_password: string
          p_permissions: string[]
        }
        Returns: boolean
      }
      admin_update_field_label: {
        Args: { p_admin_password: string; p_field_id: string; p_label: string }
        Returns: boolean
      }
      admin_update_master_password: {
        Args: { p_new: string; p_old: string }
        Returns: boolean
      }
      admin_update_report:
        | {
            Args: {
              p_admin_password: string
              p_date: string
              p_delivered: number
              p_notes: string
              p_received: number
              p_repaired: number
              p_report_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_admin_password: string
              p_date: string
              p_delivered: number
              p_extra?: Json
              p_notes: string
              p_received: number
              p_repaired: number
              p_report_id: string
            }
            Returns: boolean
          }
      admin_update_settings: {
        Args: {
          p_admin_password: string
          p_notification_email: string
          p_theme: string
        }
        Returns: boolean
      }
      admin_update_workshop_password: {
        Args: {
          p_admin_password: string
          p_new_password: string
          p_workshop_id: string
        }
        Returns: boolean
      }
      check_admin_perm: {
        Args: { p_password: string; p_perm: string }
        Returns: boolean
      }
      get_settings: {
        Args: never
        Returns: {
          notification_email: string
          theme: string
        }[]
      }
      get_workshop_reports: {
        Args: { p_password: string; p_workshop_id: string }
        Returns: {
          created_at: string
          delivered: number
          extra: Json
          id: string
          notes: string | null
          received: number
          repaired: number
          report_date: string
          workshop_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "reports"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      login_admin: { Args: { p_password: string }; Returns: boolean }
      login_workshop: {
        Args: { p_password: string; p_workshop_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      workshop_change_password: {
        Args: {
          p_new_password: string
          p_old_password: string
          p_workshop_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
