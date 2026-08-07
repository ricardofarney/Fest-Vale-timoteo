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
      event_staff: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          event_id: string
          id: string
          name: string | null
          user_id: string
          cargo: Database["public"]["Enums"]["staff_cargo"]
          pode_validar: boolean
          pode_vender: boolean
          pode_autorizar_cortesia: boolean
          pode_entregar: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          event_id: string
          id?: string
          name?: string | null
          user_id: string
          cargo?: Database["public"]["Enums"]["staff_cargo"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          event_id?: string
          id?: string
          name?: string | null
          user_id?: string
          cargo?: Database["public"]["Enums"]["staff_cargo"]
          pode_validar?: boolean
          pode_vender?: boolean
          pode_autorizar_cortesia?: boolean
          pode_entregar?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_emails: {
        Row: {
          created_at: string
          error: string | null
          id: string
          order_id: string
          provider_message_id: string | null
          status: string
          to_email: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          order_id: string
          provider_message_id?: string | null
          status?: string
          to_email: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string
          provider_message_id?: string | null
          status?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_emails_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount_cents: number
          authorized_by: string
          created_at: string
          event_id: string
          id: string
          operator_id: string | null
          reason: string
          station: string | null
        }
        Insert: {
          amount_cents: number
          authorized_by: string
          event_id: string
          operator_id?: string | null
          reason: string
          station?: string | null
        }
        Update: { reason?: string }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          category: string | null
          controla_estoque: boolean
          created_at: string
          event_id: string
          id: string
          image_url: string | null
          name: string
          price_cents: number
          sort_order: number
          stock_alert: number
          stock_qty: number
          unit: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          controla_estoque?: boolean
          created_at?: string
          event_id: string
          id?: string
          image_url?: string | null
          name: string
          price_cents?: number
          sort_order?: number
          stock_alert?: number
          stock_qty?: number
          unit?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          controla_estoque?: boolean
          event_id?: string
          id?: string
          image_url?: string | null
          name?: string
          price_cents?: number
          sort_order?: number
          stock_alert?: number
          stock_qty?: number
          unit?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["stock_kind"]
          product_id: string
          qty: number
          reason: string | null
          sale_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["stock_kind"]
          product_id: string
          qty: number
          reason?: string | null
          sale_id?: string | null
        }
        Update: {
          kind?: Database["public"]["Enums"]["stock_kind"]
          qty?: number
          reason?: string | null
        }
        Relationships: []
      }
      pos_sales: {
        Row: {
          authorized_by: string | null
          cancelled_at: string | null
          courtesy_reason: string | null
          created_at: string
          delivered_at: string | null
          delivered_by: string | null
          event_id: string
          external_payment_id: string | null
          id: string
          operator_id: string
          payment_method: Database["public"]["Enums"]["pos_payment"]
          station: string | null
          status: Database["public"]["Enums"]["pos_status"]
          ticket_token: string
          total_cents: number
        }
        Insert: {
          event_id: string
          operator_id: string
          payment_method: Database["public"]["Enums"]["pos_payment"]
          station?: string | null
          courtesy_reason?: string | null
          external_payment_id?: string | null
          total_cents?: number
        }
        Update: {
          status?: Database["public"]["Enums"]["pos_status"]
          delivered_at?: string | null
          delivered_by?: string | null
          cancelled_at?: string | null
          total_cents?: number
        }
        Relationships: []
      }
      pos_sale_items: {
        Row: {
          id: string
          name_snapshot: string
          product_id: string
          qty: number
          sale_id: string
          unit_price_cents: number
        }
        Insert: {
          id?: string
          name_snapshot: string
          product_id: string
          qty: number
          sale_id: string
          unit_price_cents: number
        }
        Update: {
          qty?: number
        }
        Relationships: []
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
          attendees: Json
          buyer_email: string | null
          buyer_id: string
          buyer_name: string | null
          coupon_id: string | null
          created_at: string
          event_id: string
          expires_at: string
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          paid_at: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["order_status"]
          stock_reserved: boolean
          total_cents: number
          origem: string
          sold_by: string | null
          station: string | null
        }
        Insert: {
          attendees?: Json
          buyer_email?: string | null
          buyer_id: string
          buyer_name?: string | null
          coupon_id?: string | null
          created_at?: string
          event_id: string
          expires_at?: string
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stock_reserved?: boolean
          total_cents?: number
        }
        Update: {
          attendees?: Json
          buyer_email?: string | null
          buyer_id?: string
          buyer_name?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          stock_reserved?: boolean
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
      wa_contatos: {
        Row: {
          bloqueado: boolean
          nao_lidas: number
          precisa_humano: boolean
          ultima_mensagem: string | null
          ultima_direcao: Database["public"]["Enums"]["wa_direcao"] | null
          dia_contador: string
          event_id: string
          humano_assumiu: boolean
          humano_ate: string | null
          id: string
          msgs_hoje: number
          nome: string | null
          primeira_em: string
          ultima_em: string
          wa_id: string
        }
        Insert: {
          bloqueado?: boolean
          nao_lidas?: number
          precisa_humano?: boolean
          ultima_mensagem?: string | null
          ultima_direcao?: Database["public"]["Enums"]["wa_direcao"] | null
          dia_contador?: string
          event_id: string
          humano_assumiu?: boolean
          humano_ate?: string | null
          id?: string
          msgs_hoje?: number
          nome?: string | null
          primeira_em?: string
          ultima_em?: string
          wa_id: string
        }
        Update: {
          bloqueado?: boolean
          nao_lidas?: number
          precisa_humano?: boolean
          ultima_mensagem?: string | null
          ultima_direcao?: Database["public"]["Enums"]["wa_direcao"] | null
          dia_contador?: string
          event_id?: string
          humano_assumiu?: boolean
          humano_ate?: string | null
          id?: string
          msgs_hoje?: number
          nome?: string | null
          primeira_em?: string
          ultima_em?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_contatos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_respostas_rapidas: {
        Row: {
          created_at: string
          event_id: string
          id: string
          ordem: number
          texto: string
          titulo: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          ordem?: number
          texto: string
          titulo: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          ordem?: number
          texto?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_respostas_rapidas_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_faq: {
        Row: {
          ativo: boolean
          created_at: string
          event_id: string
          id: string
          ordem: number
          pergunta: string
          resposta: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          event_id: string
          id?: string
          ordem?: number
          pergunta: string
          resposta: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          event_id?: string
          id?: string
          ordem?: number
          pergunta?: string
          resposta?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_faq_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_mensagens: {
        Row: {
          contato_id: string
          created_at: string
          direcao: Database["public"]["Enums"]["wa_direcao"]
          erro: string | null
          id: string
          meta_msg_id: string | null
          por_ia: boolean
          precisou_humano: boolean
          texto: string
        }
        Insert: {
          contato_id: string
          created_at?: string
          direcao: Database["public"]["Enums"]["wa_direcao"]
          erro?: string | null
          id?: string
          meta_msg_id?: string | null
          por_ia?: boolean
          precisou_humano?: boolean
          texto: string
        }
        Update: {
          contato_id?: string
          created_at?: string
          direcao?: Database["public"]["Enums"]["wa_direcao"]
          erro?: string | null
          id?: string
          meta_msg_id?: string | null
          por_ia?: boolean
          precisou_humano?: boolean
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_mensagens_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "wa_contatos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_usuarios: { Args: never; Returns: Json }
      admin_visao_geral: { Args: { _event_id: string }; Returns: Json }
      wa_marcar_lida: {
        Args: { _contato_id: string; _lida?: boolean }
        Returns: undefined
      }
      wa_pedidos_por_email: {
        Args: { _email: string; _event_id: string }
        Returns: Json
      }
      wa_resumo_ingressos: { Args: { _event_id: string }; Returns: Json }
      confirm_order_paid_admin: {
        Args: {
          _order_id: string
          _payment_id: string
          _payment_method: string
        }
        Returns: Json
      }
      event_checkin_stats: { Args: { _event_id: string }; Returns: Json }
      pode_vender: { Args: { _event_id: string; _user_id?: string }; Returns: boolean }
      pode_gerenciar_evento: { Args: { _event_id: string; _user_id?: string }; Returns: boolean }
      is_master: { Args: { _user_id?: string }; Returns: boolean }
      pos_sangria: {
        Args: {
          _event_id: string
          _amount_cents: number
          _reason: string
          _station?: string
          _operator_id?: string
        }
        Returns: Json
      }
      vender_ingresso_portaria: {
        Args: {
          _event_id: string
          _batch_id: string
          _qty: number
          _payment_method: Database["public"]["Enums"]["pos_payment"]
          _station?: string
        }
        Returns: Json
      }
      pode_autorizar_cortesia: { Args: { _event_id: string; _user_id?: string }; Returns: boolean }
      pos_registrar_venda: {
        Args: {
          _event_id: string
          _itens: Json
          _payment_method: Database["public"]["Enums"]["pos_payment"]
          _station?: string
          _courtesy_reason?: string
          _external_payment_id?: string
        }
        Returns: Json
      }
      pos_entrada_estoque: {
        Args: { _product_id: string; _qty: number; _reason?: string }
        Returns: Json
      }
      pos_cancelar_venda: { Args: { _sale_id: string; _motivo: string }; Returns: Json }
      pos_retirar: { Args: { _ticket_token: string }; Returns: Json }
      pos_relatorio: { Args: { _event_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_event_organizer: {
        Args: { _event_id: string; _user_id?: string }
        Returns: boolean
      }
      is_event_staff: {
        Args: { _event_id: string; _user_id?: string }
        Returns: boolean
      }
      release_expired_orders: { Args: never; Returns: number }
      reserve_order_stock: {
        Args: {
          _attendees?: Json
          _buyer_email?: string
          _buyer_name?: string
          _coupon_code?: string
          _hold_minutes?: number
          _order_id: string
        }
        Returns: Json
      }
      validate_ticket: {
        Args: { _device_id?: string; _event_id: string; _qr_token: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "organizer" | "attendee" | "staff" | "master" | "caixa"
      staff_cargo: "organizador" | "caixa" | "portaria"
      stock_kind: "entrada" | "venda" | "cortesia" | "perda" | "ajuste" | "estorno"
      pos_payment: "dinheiro" | "cartao" | "pix" | "cortesia"
      pos_status: "paga" | "cancelada"
      event_status: "draft" | "published" | "cancelled"
      order_status: "pending" | "paid" | "cancelled" | "expired"
      ticket_status: "valid" | "checked_in" | "cancelled"
      wa_direcao: "recebida" | "enviada"
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
      app_role: ["organizer", "attendee", "staff", "master", "caixa"],
      staff_cargo: ["organizador", "caixa", "portaria"],
      stock_kind: ["entrada", "venda", "cortesia", "perda", "ajuste", "estorno"],
      pos_payment: ["dinheiro", "cartao", "pix", "cortesia"],
      pos_status: ["paga", "cancelada"],
      event_status: ["draft", "published", "cancelled"],
      order_status: ["pending", "paid", "cancelled", "expired"],
      ticket_status: ["valid", "checked_in", "cancelled"],
      wa_direcao: ["recebida", "enviada"],
    },
  },
} as const
