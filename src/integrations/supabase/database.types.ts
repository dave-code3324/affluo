export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          email_confirmed_at: string | null;
          role: Database["public"]["Enums"]["user_role"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          email_confirmed_at?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          email_confirmed_at?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          name: string;
          normalized_name: string;
          website: string | null;
          normalized_domain: string | null;
          city: string | null;
          department: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          normalized_name: string;
          website?: string | null;
          normalized_domain?: string | null;
          city?: string | null;
          department?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          normalized_name?: string;
          website?: string | null;
          normalized_domain?: string | null;
          city?: string | null;
          department?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      firms: {
        Row: {
          id: string;
          name: string;
          city: string;
          department: string;
          onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          city: string;
          department: string;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          city?: string;
          department?: string;
          onboarding_completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      firm_members: {
        Row: {
          id: string;
          firm_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          firm_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "firm_members_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "firm_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      firm_preferences: {
        Row: {
          firm_id: string;
          nationwide: boolean;
          prospecting_departments: string[];
          target_profiles: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          firm_id: string;
          nationwide?: boolean;
          prospecting_departments?: string[];
          target_profiles?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          nationwide?: boolean;
          prospecting_departments?: string[];
          target_profiles?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "firm_preferences_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: true;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
        ];
      };
      weekly_batches: {
        Row: {
          id: string;
          firm_id: string;
          week_start: string;
          week_end: string;
          status: Database["public"]["Enums"]["weekly_batch_status"];
          published_at: string | null;
          summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          firm_id: string;
          week_start: string;
          week_end: string;
          status?: Database["public"]["Enums"]["weekly_batch_status"];
          published_at?: string | null;
          summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          week_start?: string;
          week_end?: string;
          status?: Database["public"]["Enums"]["weekly_batch_status"];
          published_at?: string | null;
          summary?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "weekly_batches_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
        ];
      };
      prospects: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          job_title: string;
          company_name: string;
          city: string;
          department: string;
          linkedin_url: string | null;
          professional_email: string | null;
          email_verification_status: Database["public"]["Enums"]["verification_status"];
          professional_profile_summary: string | null;
          company_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          first_name: string;
          last_name: string;
          job_title: string;
          company_name: string;
          city: string;
          department: string;
          linkedin_url?: string | null;
          professional_email?: string | null;
          email_verification_status?: Database["public"]["Enums"]["verification_status"];
          professional_profile_summary?: string | null;
          company_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          first_name?: string;
          last_name?: string;
          job_title?: string;
          company_name?: string;
          city?: string;
          department?: string;
          linkedin_url?: string | null;
          professional_email?: string | null;
          email_verification_status?: Database["public"]["Enums"]["verification_status"];
          professional_profile_summary?: string | null;
          company_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prospects_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunities: {
        Row: {
          id: string;
          firm_id: string | null;
          weekly_batch_id: string | null;
          prospect_id: string;
          title: string;
          signal_type: string;
          signal_summary: string;
          why_now: string;
          relevance_score: number;
          contactability_status: Database["public"]["Enums"]["contactability_status"];
          status: Database["public"]["Enums"]["opportunity_status"];
          confidence_level: Database["public"]["Enums"]["confidence_level"];
          qualification_summary: string | null;
          potential_needs: string[];
          reviewed_at: string | null;
          reviewed_by: string | null;
          review_status: Database["public"]["Enums"]["opportunity_review_status"];
          rejection_reason:
            Database["public"]["Enums"]["opportunity_rejection_reason"] | null;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          firm_id?: string | null;
          weekly_batch_id?: string | null;
          prospect_id: string;
          title: string;
          signal_type: string;
          signal_summary: string;
          why_now: string;
          relevance_score: number;
          contactability_status?: Database["public"]["Enums"]["contactability_status"];
          status?: Database["public"]["Enums"]["opportunity_status"];
          confidence_level?: Database["public"]["Enums"]["confidence_level"];
          qualification_summary?: string | null;
          potential_needs?: string[];
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          review_status?: Database["public"]["Enums"]["opportunity_review_status"];
          rejection_reason?:
            Database["public"]["Enums"]["opportunity_rejection_reason"] | null;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          signal_type?: string;
          signal_summary?: string;
          why_now?: string;
          relevance_score?: number;
          contactability_status?: Database["public"]["Enums"]["contactability_status"];
          status?: Database["public"]["Enums"]["opportunity_status"];
          confidence_level?: Database["public"]["Enums"]["confidence_level"];
          qualification_summary?: string | null;
          potential_needs?: string[];
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          review_status?: Database["public"]["Enums"]["opportunity_review_status"];
          rejection_reason?:
            Database["public"]["Enums"]["opportunity_rejection_reason"] | null;
          internal_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunities_weekly_batch_id_fkey";
            columns: ["weekly_batch_id"];
            isOneToOne: false;
            referencedRelation: "weekly_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunities_prospect_id_fkey";
            columns: ["prospect_id"];
            isOneToOne: false;
            referencedRelation: "prospects";
            referencedColumns: ["id"];
          },
        ];
      };
      signals: {
        Row: {
          id: string;
          prospect_id: string;
          type: string;
          title: string;
          description: string;
          event_date: string | null;
          detected_at: string;
          source_url: string | null;
          source_name: string | null;
          source_published_at: string | null;
          verification_status: Database["public"]["Enums"]["signal_verification_status"];
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          prospect_id: string;
          type: string;
          title: string;
          description: string;
          event_date?: string | null;
          detected_at: string;
          source_url?: string | null;
          source_name?: string | null;
          source_published_at?: string | null;
          verification_status?: Database["public"]["Enums"]["signal_verification_status"];
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          type?: string;
          title?: string;
          description?: string;
          event_date?: string | null;
          detected_at?: string;
          source_url?: string | null;
          source_name?: string | null;
          source_published_at?: string | null;
          verification_status?: Database["public"]["Enums"]["signal_verification_status"];
          verified_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "signals_prospect_id_fkey";
            columns: ["prospect_id"];
            isOneToOne: false;
            referencedRelation: "prospects";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_signals: {
        Row: {
          opportunity_id: string;
          signal_id: string;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          opportunity_id: string;
          signal_id: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          is_primary?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_signals_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunity_signals_signal_id_fkey";
            columns: ["signal_id"];
            isOneToOne: false;
            referencedRelation: "signals";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_details: {
        Row: {
          id: string;
          prospect_id: string;
          type: Database["public"]["Enums"]["contact_detail_type"];
          value: string;
          verification_status: Database["public"]["Enums"]["verification_status"];
          verification_method: string | null;
          verified_at: string | null;
          verified_by_user_id: string | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          prospect_id: string;
          type: Database["public"]["Enums"]["contact_detail_type"];
          value: string;
          verification_status?: Database["public"]["Enums"]["verification_status"];
          verification_method?: string | null;
          verified_at?: string | null;
          verified_by_user_id?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          type?: Database["public"]["Enums"]["contact_detail_type"];
          value?: string;
          verification_status?: Database["public"]["Enums"]["verification_status"];
          verification_method?: string | null;
          verified_at?: string | null;
          verified_by_user_id?: string | null;
          is_primary?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_details_prospect_id_fkey";
            columns: ["prospect_id"];
            isOneToOne: false;
            referencedRelation: "prospects";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_feedback: {
        Row: {
          id: string;
          opportunity_id: string;
          firm_id: string;
          user_id: string;
          decision: Database["public"]["Enums"]["feedback_decision"];
          reason: Database["public"]["Enums"]["feedback_reason"] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          opportunity_id: string;
          firm_id: string;
          user_id: string;
          decision: Database["public"]["Enums"]["feedback_decision"];
          reason?: Database["public"]["Enums"]["feedback_reason"] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          decision?: Database["public"]["Enums"]["feedback_decision"];
          reason?: Database["public"]["Enums"]["feedback_reason"] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_feedback_opportunity_id_firm_id_fkey";
            columns: ["opportunity_id", "firm_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id", "firm_id"];
          },
          {
            foreignKeyName: "opportunity_feedback_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunity_feedback_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      imports: {
        Row: {
          id: string;
          created_by_user_id: string;
          filename: string;
          content_hash: string;
          status: Database["public"]["Enums"]["import_status"];
          failure_message: string | null;
          total_rows: number;
          valid_rows: number;
          invalid_rows: number;
          duplicate_rows: number;
          processed_rows: number;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          created_by_user_id: string;
          filename: string;
          content_hash: string;
          status?: Database["public"]["Enums"]["import_status"];
          failure_message?: string | null;
          total_rows?: number;
          valid_rows?: number;
          invalid_rows?: number;
          duplicate_rows?: number;
          processed_rows?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          filename?: string;
          content_hash?: string;
          status?: Database["public"]["Enums"]["import_status"];
          failure_message?: string | null;
          total_rows?: number;
          valid_rows?: number;
          invalid_rows?: number;
          duplicate_rows?: number;
          processed_rows?: number;
          started_at?: string | null;
          completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "imports_created_by_user_id_fkey";
            columns: ["created_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      import_rows: {
        Row: {
          id: string;
          import_id: string;
          row_number: number;
          raw_data: Json;
          normalized_data: Json | null;
          status: Database["public"]["Enums"]["import_row_status"];
          error_messages: Json;
          duplicate_of_prospect_id: string | null;
          duplicate_match_level:
            Database["public"]["Enums"]["duplicate_match_level"] | null;
          duplicate_resolution:
            Database["public"]["Enums"]["duplicate_resolution"] | null;
          created_prospect_id: string | null;
          created_opportunity_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          import_id: string;
          row_number: number;
          raw_data: Json;
          normalized_data?: Json | null;
          status?: Database["public"]["Enums"]["import_row_status"];
          error_messages?: Json;
          duplicate_of_prospect_id?: string | null;
          duplicate_match_level?:
            Database["public"]["Enums"]["duplicate_match_level"] | null;
          duplicate_resolution?:
            Database["public"]["Enums"]["duplicate_resolution"] | null;
          created_prospect_id?: string | null;
          created_opportunity_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          raw_data?: Json;
          normalized_data?: Json | null;
          status?: Database["public"]["Enums"]["import_row_status"];
          error_messages?: Json;
          duplicate_of_prospect_id?: string | null;
          duplicate_match_level?:
            Database["public"]["Enums"]["duplicate_match_level"] | null;
          duplicate_resolution?:
            Database["public"]["Enums"]["duplicate_resolution"] | null;
          created_prospect_id?: string | null;
          created_opportunity_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_rows_import_id_fkey";
            columns: ["import_id"];
            isOneToOne: false;
            referencedRelation: "imports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_rows_duplicate_of_prospect_id_fkey";
            columns: ["duplicate_of_prospect_id"];
            isOneToOne: false;
            referencedRelation: "prospects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_rows_created_prospect_id_fkey";
            columns: ["created_prospect_id"];
            isOneToOne: false;
            referencedRelation: "prospects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_rows_created_opportunity_id_fkey";
            columns: ["created_opportunity_id"];
            isOneToOne: true;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          previous_data: Json | null;
          new_data: Json | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          previous_data?: Json | null;
          new_data?: Json | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          action?: string;
          entity_type?: string;
          entity_id?: string;
          previous_data?: Json | null;
          new_data?: Json | null;
          metadata?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      complete_onboarding: {
        Args: {
          firm_name: string;
          firm_city: string;
          firm_department: string;
          is_nationwide: boolean;
          departments: string[];
          profiles: string[];
        };
        Returns: string;
      };
    };
    Enums: {
      user_role: "MEMBER" | "ADMIN";
      weekly_batch_status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      verification_status: "UNVERIFIED" | "LIKELY" | "VERIFIED" | "INVALID";
      contactability_status:
        "NOT_CONTACTABLE" | "PARTIALLY_VERIFIED" | "CONTACTABLE";
      opportunity_status: "DRAFT" | "PUBLISHED" | "DISMISSED";
      confidence_level: "LOW" | "MEDIUM" | "HIGH";
      signal_verification_status: "UNVERIFIED" | "VERIFIED" | "REJECTED";
      contact_detail_type:
        | "PROFESSIONAL_EMAIL"
        | "PROFESSIONAL_PHONE"
        | "LINKEDIN"
        | "COMPANY_WEBSITE";
      feedback_decision: "TO_CONTACT" | "TO_MONITOR" | "NOT_RELEVANT";
      feedback_reason:
        | "WRONG_PROFILE"
        | "WEAK_SIGNAL"
        | "WRONG_LOCATION"
        | "ALREADY_KNOWN"
        | "INSUFFICIENT_CONTACT_DETAILS"
        | "OTHER";
      import_status:
        | "UPLOADED"
        | "VALIDATING"
        | "READY"
        | "IMPORTING"
        | "COMPLETED"
        | "FAILED";
      import_row_status:
        "PENDING" | "VALID" | "INVALID" | "DUPLICATE" | "IMPORTED" | "SKIPPED";
      duplicate_resolution: "SKIP" | "UPDATE_EXISTING" | "CREATE_DISTINCT";
      duplicate_match_level: "STRONG" | "SECONDARY";
      opportunity_review_status:
        "TO_REVIEW" | "IN_REVIEW" | "NEEDS_CHANGES" | "APPROVED" | "REJECTED";
      opportunity_rejection_reason:
        | "OUT_OF_TARGET"
        | "INSUFFICIENT_SIGNAL"
        | "STALE_SIGNAL"
        | "UNRELIABLE_SOURCE"
        | "INSUFFICIENT_CONTACT_DETAILS"
        | "DUPLICATE"
        | "COMPLIANCE_RISK"
        | "OTHER";
    };
    CompositeTypes: Record<never, never>;
  };
};
