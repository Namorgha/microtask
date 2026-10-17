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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payee_id: string
          payer_id: string
          platform_fee: number
          status: string
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payee_id: string
          payer_id: string
          platform_fee: number
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payee_id?: string
          payer_id?: string
          platform_fee?: number
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_verified: boolean
          address_verified_at: string | null
          avatar_url: string | null
          banned_at: string | null
          bio: string | null
          completed_tasks_count: number | null
          created_at: string
          full_name: string | null
          headline: string | null
          id: string
          identity_verified: boolean
          identity_verified_at: string | null
          lat: number | null
          lng: number | null
          location: string | null
          reputation_score: number | null
          skills: string[] | null
          total_reviews_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_verified?: boolean
          address_verified_at?: string | null
          avatar_url?: string | null
          banned_at?: string | null
          bio?: string | null
          completed_tasks_count?: number | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          id?: string
          identity_verified?: boolean
          identity_verified_at?: string | null
          lat?: number | null
          lng?: number | null
          location?: string | null
          reputation_score?: number | null
          skills?: string[] | null
          total_reviews_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_verified?: boolean
          address_verified_at?: string | null
          avatar_url?: string | null
          banned_at?: string | null
          bio?: string | null
          completed_tasks_count?: number | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          id?: string
          identity_verified?: boolean
          identity_verified_at?: string | null
          lat?: number | null
          lng?: number | null
          location?: string | null
          reputation_score?: number | null
          skills?: string[] | null
          total_reviews_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          created_at: string
          id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          task_id: string
          text: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          task_id: string
          text?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
          task_id?: string
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_applications: {
        Row: {
          created_at: string
          doer_id: string
          id: string
          message: string | null
          status: string
          task_id: string
        }
        Insert: {
          created_at?: string
          doer_id: string
          id?: string
          message?: string | null
          status?: string
          task_id: string
        }
        Update: {
          created_at?: string
          doer_id?: string
          id?: string
          message?: string | null
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_applications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string
          task_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id: string
          task_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category: Database["public"]["Enums"]["task_category"]
          created_at: string
          description: string
          doer_id: string | null
          duration: number
          flag_reason: string | null
          flagged: boolean
          id: string
          images: string[] | null
          lat: number
          lng: number
          location: string
          poster_id: string
          price: number
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["task_category"]
          created_at?: string
          description: string
          doer_id?: string | null
          duration: number
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          images?: string[] | null
          lat: number
          lng: number
          location: string
          poster_id: string
          price: number
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["task_category"]
          created_at?: string
          description?: string
          doer_id?: string | null
          duration?: number
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          images?: string[] | null
          lat?: number
          lng?: number
          location?: string
          poster_id?: string
          price?: number
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_doer_id_profiles_fkey"
            columns: ["doer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_poster_id_profiles_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
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
      verification_requests: {
        Row: {
          address_document_url: string | null
          admin_notes: string | null
          created_at: string
          document_url: string | null
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string
          user_id: string
          verification_type: Database["public"]["Enums"]["verification_type"]
        }
        Insert: {
          address_document_url?: string | null
          admin_notes?: string | null
          created_at?: string
          document_url?: string | null
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          user_id: string
          verification_type: Database["public"]["Enums"]["verification_type"]
        }
        Update: {
          address_document_url?: string | null
          admin_notes?: string | null
          created_at?: string
          document_url?: string | null
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          user_id?: string
          verification_type?: Database["public"]["Enums"]["verification_type"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_completed_tasks: {
        Args: { _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      task_category:
        | "delivery"
        | "cleaning"
        | "repair"
        | "shopping"
        | "tech"
        | "tutoring"
        | "moving"
        | "other"
      task_status:
        | "open"
        | "accepted"
        | "funded"
        | "in_progress"
        | "completed"
        | "paid"
        | "cancelled"
      verification_status:
        | "pending"
        | "approved"
        | "rejected"
        | "needs_more_info"
        | "revoked"
      verification_type: "identity" | "address"
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
      app_role: ["admin", "moderator", "user"],
      task_category: [
        "delivery",
        "cleaning",
        "repair",
        "shopping",
        "tech",
        "tutoring",
        "moving",
        "other",
      ],
      task_status: [
        "open",
        "accepted",
        "funded",
        "in_progress",
        "completed",
        "paid",
        "cancelled",
      ],
      verification_status: [
        "pending",
        "approved",
        "rejected",
        "needs_more_info",
        "revoked",
      ],
      verification_type: ["identity", "address"],
    },
  },
} as const
