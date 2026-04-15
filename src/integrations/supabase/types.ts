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
      conversations: {
        Row: {
          cleaner_id: string
          created_at: string
          id: string
          job_id: string | null
          owner_id: string
        }
        Insert: {
          cleaner_id: string
          created_at?: string
          id?: string
          job_id?: string | null
          owner_id: string
        }
        Update: {
          cleaner_id?: string
          created_at?: string
          id?: string
          job_id?: string | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_decision: string | null
          admin_notes: string | null
          created_at: string
          id: string
          job_id: string
          reason: string
          reported_id: string
          reporter_id: string
          reporter_type: string
          response: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_decision?: string | null
          admin_notes?: string | null
          created_at?: string
          id?: string
          job_id: string
          reason: string
          reported_id: string
          reporter_id: string
          reporter_type?: string
          response?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_decision?: string | null
          admin_notes?: string | null
          created_at?: string
          id?: string
          job_id?: string
          reason?: string
          reported_id?: string
          reporter_id?: string
          reporter_type?: string
          response?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          cleaner_id: string
          created_at: string
          id: string
          job_id: string
          status: string
        }
        Insert: {
          cleaner_id: string
          created_at?: string
          id?: string
          job_id: string
          status?: string
        }
        Update: {
          cleaner_id?: string
          created_at?: string
          id?: string
          job_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cancellations: {
        Row: {
          cancelled_by: string
          created_at: string
          id: string
          is_late_cancellation: boolean | null
          job_id: string
          penalty_applied: boolean | null
          reason: string | null
        }
        Insert: {
          cancelled_by: string
          created_at?: string
          id?: string
          is_late_cancellation?: boolean | null
          job_id: string
          penalty_applied?: boolean | null
          reason?: string | null
        }
        Update: {
          cancelled_by?: string
          created_at?: string
          id?: string
          is_late_cancellation?: boolean | null
          job_id?: string
          penalty_applied?: boolean | null
          reason?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          address: string | null
          bathrooms: number
          bedrooms: number
          city: string | null
          cleaner_earnings: number | null
          cleaning_type: string
          completion_notes: string | null
          completion_photos: string[] | null
          created_at: string
          date_time: string | null
          description: string | null
          door_access_info: string | null
          escrow_status: string
          hired_cleaner_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          owner_confirmed_completion: boolean | null
          owner_id: string
          owner_instructions: string | null
          payment_intent_id: string | null
          pending_review_at: string | null
          platform_fee: number | null
          price: number
          property_photos: string[] | null
          status: string
          team_size_required: number
          title: string
          total_amount: number | null
          urgency: string
        }
        Insert: {
          address?: string | null
          bathrooms?: number
          bedrooms?: number
          city?: string | null
          cleaner_earnings?: number | null
          cleaning_type?: string
          completion_notes?: string | null
          completion_photos?: string[] | null
          created_at?: string
          date_time?: string | null
          description?: string | null
          door_access_info?: string | null
          escrow_status?: string
          hired_cleaner_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          owner_confirmed_completion?: boolean | null
          owner_id: string
          owner_instructions?: string | null
          payment_intent_id?: string | null
          pending_review_at?: string | null
          platform_fee?: number | null
          price?: number
          property_photos?: string[] | null
          status?: string
          team_size_required?: number
          title: string
          total_amount?: number | null
          urgency?: string
        }
        Update: {
          address?: string | null
          bathrooms?: number
          bedrooms?: number
          city?: string | null
          cleaner_earnings?: number | null
          cleaning_type?: string
          completion_notes?: string | null
          completion_photos?: string[] | null
          created_at?: string
          date_time?: string | null
          description?: string | null
          door_access_info?: string | null
          escrow_status?: string
          hired_cleaner_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          owner_confirmed_completion?: boolean | null
          owner_id?: string
          owner_instructions?: string | null
          payment_intent_id?: string | null
          pending_review_at?: string | null
          platform_fee?: number | null
          price?: number
          property_photos?: string[] | null
          status?: string
          team_size_required?: number
          title?: string
          total_amount?: number | null
          urgency?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message_text: string
          sender_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message_text: string
          sender_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message_text?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          photo_url: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_url: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_url?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          availability: string | null
          avatar_url: string | null
          bio: string | null
          business_type: string | null
          cancellation_violations: number | null
          city: string | null
          company_name: string | null
          created_at: string
          email: string | null
          experience_years: number | null
          free_contacts_used: number
          free_trial_ends_at: string | null
          free_trial_started_at: string | null
          full_name: string | null
          has_transportation: boolean | null
          id: string
          is_available_now: boolean | null
          is_premium: boolean
          jobs_completed: number | null
          jobs_used_date: string | null
          jobs_used_today: number
          language: string | null
          languages: string[] | null
          phone: string | null
          plan_tier: string
          premium_status: string | null
          regions: string[] | null
          role: Database["public"]["Enums"]["app_role"]
          specialties: string[] | null
          supplies: boolean | null
          suspension_until: string | null
          total_earnings: number | null
          transportation: string | null
          updated_at: string
          worker_type: string
          years_in_business: number | null
        }
        Insert: {
          availability?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_type?: string | null
          cancellation_violations?: number | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          experience_years?: number | null
          free_contacts_used?: number
          free_trial_ends_at?: string | null
          free_trial_started_at?: string | null
          full_name?: string | null
          has_transportation?: boolean | null
          id: string
          is_available_now?: boolean | null
          is_premium?: boolean
          jobs_completed?: number | null
          jobs_used_date?: string | null
          jobs_used_today?: number
          language?: string | null
          languages?: string[] | null
          phone?: string | null
          plan_tier?: string
          premium_status?: string | null
          regions?: string[] | null
          role?: Database["public"]["Enums"]["app_role"]
          specialties?: string[] | null
          supplies?: boolean | null
          suspension_until?: string | null
          total_earnings?: number | null
          transportation?: string | null
          updated_at?: string
          worker_type?: string
          years_in_business?: number | null
        }
        Update: {
          availability?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_type?: string | null
          cancellation_violations?: number | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          experience_years?: number | null
          free_contacts_used?: number
          free_trial_ends_at?: string | null
          free_trial_started_at?: string | null
          full_name?: string | null
          has_transportation?: boolean | null
          id?: string
          is_available_now?: boolean | null
          is_premium?: boolean
          jobs_completed?: number | null
          jobs_used_date?: string | null
          jobs_used_today?: number
          language?: string | null
          languages?: string[] | null
          phone?: string | null
          plan_tier?: string
          premium_status?: string | null
          regions?: string[] | null
          role?: Database["public"]["Enums"]["app_role"]
          specialties?: string[] | null
          supplies?: boolean | null
          suspension_until?: string | null
          total_earnings?: number | null
          transportation?: string | null
          updated_at?: string
          worker_type?: string
          years_in_business?: number | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          created_at: string
          id: string
          job_id: string
          rating: number
          review_text: string | null
          reviewed_id: string
          reviewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          rating: number
          review_text?: string | null
          reviewed_id: string
          reviewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          rating?: number
          review_text?: string | null
          reviewed_id?: string
          reviewer_id?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          badge_name: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_name: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_name?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          asking_price: number | null
          city: string
          contact_name: string | null
          created_at: string
          description: string | null
          email: string | null
          frequency: string
          id: string
          monthly_income_estimate: number | null
          number_of_houses: number
          owner_id: string
          phone: string | null
        }
        Insert: {
          asking_price?: number | null
          city: string
          contact_name?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          frequency?: string
          id?: string
          monthly_income_estimate?: number | null
          number_of_houses?: number
          owner_id: string
          phone?: string | null
        }
        Update: {
          asking_price?: number | null
          city?: string
          contact_name?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          frequency?: string
          id?: string
          monthly_income_estimate?: number | null
          number_of_houses?: number
          owner_id?: string
          phone?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          plan_name: string | null
          price_id: string | null
          product_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          trial_start: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          plan_name?: string | null
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          plan_name?: string | null
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          user_id?: string
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          cleaner_id: string
          created_at: string
          helper_id: string
          id: string
          job_id: string
          status: string
        }
        Insert: {
          cleaner_id: string
          created_at?: string
          helper_id: string
          id?: string
          job_id: string
          status?: string
        }
        Update: {
          cleaner_id?: string
          created_at?: string
          helper_id?: string
          id?: string
          job_id?: string
          status?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          cleaner_id: string
          created_at: string
          helper_id: string
          id: string
        }
        Insert: {
          cleaner_id: string
          created_at?: string
          helper_id: string
          id?: string
        }
        Update: {
          cleaner_id?: string
          created_at?: string
          helper_id?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      seed_sample_data: { Args: { p_user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "cleaner" | "owner" | "admin"
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
      app_role: ["cleaner", "owner", "admin"],
    },
  },
} as const
