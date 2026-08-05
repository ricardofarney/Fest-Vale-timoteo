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
      check_in_log: {
        Row: {
          device_id: string | null
          id: string
          result: string
          scanned_at: string
          scanned_by: string | null
          ticket_id: string | null
        }
        Insert: {
          device_id?: string | null
          id?: string
          result: string
          scanned_at?: string
          scanned_by?: string | null
          ticket_id: string | null
        }
        Update: {
          device_id?: string | null
          id?: string
          result?: string
          scanned_at?: string
          scanned_by?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_in_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_cents: number | null
          discount_pct: number | null
          event_id: string
          expires_at: string | null
          id: string
          max_uses: number | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_cents?: number | null
          discount_pct?: number | null
          event_id: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_cents?: number | null
          discount_pct?: number | null
          event_id?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          name: string
          organizer_id: string
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
          venue: string | null
        }
        Insert: {
          address?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          organizer_id: string
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue?: string | null
        }
        Update: {
          address?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          organizer_id?: string
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          batch_id: string
          id: string
          order_id: string
          qty: number
          unit_price_cents: number
        }
        Insert: {
          batch_id: string
          id?: string
          order_id: string
          qty: number
          unit_price_cents: number
        }
        Update: {
          batch_id?: string
          id?: string
          order_id?: string
          qty?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ticket_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          coupon_id: string | null
          created_at: string
          event_id: string
          expires_at: string
          id: string
          paid_at: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_cents: number
        }
        Insert: {
          buyer_id: string
          coupon_id?: string | null
          created_at?: string
          event_id: string
          expires_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number
        }
        Update: {
          buyer_id?: string
          coupon_id?: string | null
          created_at?: string
          event_id?: string
          expires_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ticket_batches: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          name: string
          price_cents: number
          quantity_sold: number
          quantity_total: number
          sort_order: number
          starts_at: string | null
          ticket_type_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          name: string
          price_cents?: number
          quantity_sold?: number
          quantity_total?: number
          sort_order?: number
          starts_at?: string | null
          ticket_type_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          name?: string
          price_cents?: number
          quantity_sold?: number
          quantity_total?: number
          sort_order?: number
          starts_at?: string | null
          ticket_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_batches_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_types: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          is_half_price: boolean
          is_solidary: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          is_half_price?: boolean
          is_solidary?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          is_half_price?: boolean
          is_solidary?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          attendee_doc: string | null
          attendee_name: string | null
          batch_id: string
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          id: string
          order_id: string
          qr_token: string
          status: Database["public"]["Enums"]["ticket_status"]
        }
        Insert: {
          attendee_doc?: string | null
          attendee_name?: string | null
          batch_id: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          id?: string
          order_id: string
          qr_token?: string
          status?: Database["public"]["Enums"]["ticket_status"]
        }
        Update: {
          attendee_doc?: string | null
          attendee_name?: string | null
          batch_id?: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          id?: string
          order_id?: string
          qr_token?: string
          status?: Database["public"]["Enums"]["ticket_status"]
        }
        Relationships: [
          {
            foreignKeyName: "tickets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ticket_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      confirm_order_payment: {
        Args: {
          _attendees?: Json
          _coupon_code?: string
          _order_id: string
          _payment_method: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      validate_ticket: {
        Args: { _device_id?: string; _event_id: string; _qr_token: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "organizer" | "attendee" | "staff"
      event_status: "draft" | "published" | "cancelled"
      order_status: "pending" | "paid" | "cancelled" | "expired"
      ticket_status: "valid" | "checked_in" | "cancelled"
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
      app_role: ["organizer", "attendee", "staff"],
      event_status: ["draft", "published", "cancelled"],
      order_status: ["pending", "paid", "cancelled", "expired"],
      ticket_status: ["valid", "checked_in", "cancelled"],
    },
  },
} as const
