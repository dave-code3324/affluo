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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          email_confirmed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          email_confirmed_at?: string | null;
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
          email_verification_status: Database["public"]["Enums"]["email_verification_status"];
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
          email_verification_status?: Database["public"]["Enums"]["email_verification_status"];
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
          email_verification_status?: Database["public"]["Enums"]["email_verification_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      opportunities: {
        Row: {
          id: string;
          firm_id: string;
          weekly_batch_id: string;
          prospect_id: string;
          title: string;
          signal_type: string;
          signal_summary: string;
          why_now: string;
          relevance_score: number;
          contactability_status: Database["public"]["Enums"]["contactability_status"];
          status: Database["public"]["Enums"]["opportunity_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          firm_id: string;
          weekly_batch_id: string;
          prospect_id: string;
          title: string;
          signal_type: string;
          signal_summary: string;
          why_now: string;
          relevance_score: number;
          contactability_status?: Database["public"]["Enums"]["contactability_status"];
          status?: Database["public"]["Enums"]["opportunity_status"];
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
      weekly_batch_status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      email_verification_status:
        "UNVERIFIED" | "LIKELY" | "VERIFIED" | "INVALID";
      contactability_status:
        "NOT_CONTACTABLE" | "PARTIALLY_VERIFIED" | "CONTACTABLE";
      opportunity_status: "DRAFT" | "PUBLISHED" | "DISMISSED";
    };
    CompositeTypes: Record<never, never>;
  };
};
