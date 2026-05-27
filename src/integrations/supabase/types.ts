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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
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
      job_private_details: {
        Row: {
          alarm_instructions: string | null
          door_access_info: string | null
          door_code: string | null
          gate_code: string | null
          job_id: string
          lockbox_code: string | null
          owner_instructions: string | null
          parking_instructions: string | null
          payment_intent_id: string | null
          supply_code: string | null
        }
        Insert: {
          alarm_instructions?: string | null
          door_access_info?: string | null
          door_code?: string | null
          gate_code?: string | null
          job_id: string
          lockbox_code?: string | null
          owner_instructions?: string | null
          parking_instructions?: string | null
          payment_intent_id?: string | null
          supply_code?: string | null
        }
        Update: {
          alarm_instructions?: string | null
          door_access_info?: string | null
          door_code?: string | null
          gate_code?: string | null
          job_id?: string
          lockbox_code?: string | null
          owner_instructions?: string | null
          parking_instructions?: string | null
          payment_intent_id?: string | null
          supply_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_private_details_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address: string | null
          allow_solo_start: boolean
          bathrooms: number
          bedrooms: number
          city: string | null
          cleaner_earnings: number | null
          cleaners_required: number
          cleaning_type: string
          completion_notes: string | null
          completion_photos: string[] | null
          created_at: string
          date_time: string | null
          description: string | null
          door_access_info: string | null
          escrow_status: string
          guest_stay_length: number | null
          helpers_required: number
          hired_cleaner_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          main_property_photo: string | null
          number_of_guests: number | null
          owner_confirmed_completion: boolean | null
          owner_id: string
          owner_instructions: string | null
          parking_instructions: string | null
          pending_review_at: string | null
          platform_fee: number | null
          price: number
          property_photos: string[] | null
          status: string
          team_size_required: number
          title: string
          total_amount: number | null
          urgency: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          allow_solo_start?: boolean
          bathrooms?: number
          bedrooms?: number
          city?: string | null
          cleaner_earnings?: number | null
          cleaners_required?: number
          cleaning_type?: string
          completion_notes?: string | null
          completion_photos?: string[] | null
          created_at?: string
          date_time?: string | null
          description?: string | null
          door_access_info?: string | null
          escrow_status?: string
          guest_stay_length?: number | null
          helpers_required?: number
          hired_cleaner_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          main_property_photo?: string | null
          number_of_guests?: number | null
          owner_confirmed_completion?: boolean | null
          owner_id: string
          owner_instructions?: string | null
          parking_instructions?: string | null
          pending_review_at?: string | null
          platform_fee?: number | null
          price?: number
          property_photos?: string[] | null
          status?: string
          team_size_required?: number
          title: string
          total_amount?: number | null
          urgency?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          allow_solo_start?: boolean
          bathrooms?: number
          bedrooms?: number
          city?: string | null
          cleaner_earnings?: number | null
          cleaners_required?: number
          cleaning_type?: string
          completion_notes?: string | null
          completion_photos?: string[] | null
          created_at?: string
          date_time?: string | null
          description?: string | null
          door_access_info?: string | null
          escrow_status?: string
          guest_stay_length?: number | null
          helpers_required?: number
          hired_cleaner_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          main_property_photo?: string | null
          number_of_guests?: number | null
          owner_confirmed_completion?: boolean | null
          owner_id?: string
          owner_instructions?: string | null
          parking_instructions?: string | null
          pending_review_at?: string | null
          platform_fee?: number | null
          price?: number
          property_photos?: string[] | null
          status?: string
          team_size_required?: number
          title?: string
          total_amount?: number | null
          urgency?: string
          zip_code?: string | null
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
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_violations: {
        Row: {
          auto_penalty_applied: boolean
          context: string
          created_at: string
          id: string
          message_snippet: string | null
          user_id: string
          violation_type: string
        }
        Insert: {
          auto_penalty_applied?: boolean
          context?: string
          created_at?: string
          id?: string
          message_snippet?: string | null
          user_id: string
          violation_type: string
        }
        Update: {
          auto_penalty_applied?: boolean
          context?: string
          created_at?: string
          id?: string
          message_snippet?: string | null
          user_id?: string
          violation_type?: string
        }
        Relationships: []
      }
      point_history: {
        Row: {
          created_at: string
          id: string
          points: number
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string
          user_id?: string
        }
        Relationships: []
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
          identity_address_proof_url: string | null
          identity_document_url: string | null
          identity_reviewed_at: string | null
          identity_selfie_url: string | null
          identity_status: string
          identity_submitted_at: string | null
          is_available_now: boolean | null
          is_premium: boolean
          jobs_completed: number | null
          jobs_used_date: string | null
          jobs_used_today: number
          language: string | null
          languages: string[] | null
          phone: string | null
          plan_tier: string
          points: number
          premium_status: string | null
          regions: string[] | null
          role: Database["public"]["Enums"]["app_role"]
          schedules_unlocked: boolean
          specialties: string[] | null
          supplies: boolean | null
          suspension_until: string | null
          total_earnings: number | null
          transportation: string | null
          updated_at: string
          violation_score: number
          visibility_penalty: number
          wallet_balance: number
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
          identity_address_proof_url?: string | null
          identity_document_url?: string | null
          identity_reviewed_at?: string | null
          identity_selfie_url?: string | null
          identity_status?: string
          identity_submitted_at?: string | null
          is_available_now?: boolean | null
          is_premium?: boolean
          jobs_completed?: number | null
          jobs_used_date?: string | null
          jobs_used_today?: number
          language?: string | null
          languages?: string[] | null
          phone?: string | null
          plan_tier?: string
          points?: number
          premium_status?: string | null
          regions?: string[] | null
          role?: Database["public"]["Enums"]["app_role"]
          schedules_unlocked?: boolean
          specialties?: string[] | null
          supplies?: boolean | null
          suspension_until?: string | null
          total_earnings?: number | null
          transportation?: string | null
          updated_at?: string
          violation_score?: number
          visibility_penalty?: number
          wallet_balance?: number
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
          identity_address_proof_url?: string | null
          identity_document_url?: string | null
          identity_reviewed_at?: string | null
          identity_selfie_url?: string | null
          identity_status?: string
          identity_submitted_at?: string | null
          is_available_now?: boolean | null
          is_premium?: boolean
          jobs_completed?: number | null
          jobs_used_date?: string | null
          jobs_used_today?: number
          language?: string | null
          languages?: string[] | null
          phone?: string | null
          plan_tier?: string
          points?: number
          premium_status?: string | null
          regions?: string[] | null
          role?: Database["public"]["Enums"]["app_role"]
          schedules_unlocked?: boolean
          specialties?: string[] | null
          supplies?: boolean | null
          suspension_until?: string | null
          total_earnings?: number | null
          transportation?: string | null
          updated_at?: string
          violation_score?: number
          visibility_penalty?: number
          wallet_balance?: number
          worker_type?: string
          years_in_business?: number | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          created_at: string
          hidden_at: string | null
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          is_hidden: boolean
          job_id: string
          rating: number
          review_text: string | null
          reviewed_id: string
          reviewer_id: string
        }
        Insert: {
          created_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean
          job_id: string
          rating: number
          review_text?: string | null
          reviewed_id: string
          reviewer_id: string
        }
        Update: {
          created_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          job_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          job_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          job_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _caller_is_job_applicant: { Args: { p_job_id: string }; Returns: boolean }
      admin_adjust_wallet: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: number
      }
      admin_moderate_review: {
        Args: { _action: string; _reason?: string; _review_id: string }
        Returns: undefined
      }
      admin_override_subscription: {
        Args: {
          _action: string
          _days?: number
          _reason?: string
          _user_id: string
        }
        Returns: undefined
      }
      admin_reset_violations: {
        Args: { _reason?: string; _user_id: string }
        Returns: number
      }
      award_points: {
        Args: { p_points: number; p_reason: string; p_user_id: string }
        Returns: number
      }
      credit_wallet: {
        Args: {
          p_amount: number
          p_description: string
          p_job_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      debit_wallet: {
        Args: {
          p_amount: number
          p_description: string
          p_job_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_job_sensitive_details: {
        Args: { p_job_id: string }
        Returns: {
          alarm_instructions: string
          door_access_info: string
          door_code: string
          gate_code: string
          lockbox_code: string
          owner_instructions: string
          parking_instructions: string
          payment_intent_id: string
          supply_code: string
        }[]
      }
      get_schedule_contact: {
        Args: { p_schedule_id: string }
        Returns: {
          contact_name: string
          email: string
          phone: string
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_platform_fee: {
        Args: {
          p_amount: number
          p_description: string
          p_job_id: string
          p_owner_id: string
        }
        Returns: undefined
      }
      seed_sample_data: { Args: { p_user_id: string }; Returns: undefined }
      send_notification: {
        Args: {
          p_link?: string
          p_message: string
          p_related_id?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      unlock_schedule_contact: {
        Args: { p_schedule_id: string }
        Returns: {
          contact_name: string
          email: string
          phone: string
        }[]
      }
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
