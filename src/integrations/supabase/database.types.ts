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
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
