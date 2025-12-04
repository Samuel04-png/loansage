export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      agencies: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          primary_color: string
          secondary_color: string
          theme_mode: 'light' | 'dark' | 'auto'
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          theme_mode?: 'light' | 'dark' | 'auto'
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          theme_mode?: 'light' | 'dark' | 'auto'
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          role: 'admin' | 'employee' | 'customer'
          employee_category: string | null
          agency_id: string | null
          is_active: boolean
          last_login: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          phone?: string | null
          role: 'admin' | 'employee' | 'customer'
          employee_category?: string | null
          agency_id?: string | null
          is_active?: boolean
          last_login?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          phone?: string | null
          role?: 'admin' | 'employee' | 'customer'
          employee_category?: string | null
          agency_id?: string | null
          is_active?: boolean
          last_login?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          user_id: string | null
          agency_id: string
          customer_id: string
          nrc_number: string | null
          date_of_birth: string | null
          address: Json
          employment_status: string | null
          monthly_income: number | null
          risk_score: number
          kyc_status: 'pending' | 'verified' | 'rejected'
          assigned_officer_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          agency_id: string
          customer_id: string
          nrc_number?: string | null
          date_of_birth?: string | null
          address?: Json
          employment_status?: string | null
          monthly_income?: number | null
          risk_score?: number
          kyc_status?: 'pending' | 'verified' | 'rejected'
          assigned_officer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          agency_id?: string
          customer_id?: string
          nrc_number?: string | null
          date_of_birth?: string | null
          address?: Json
          employment_status?: string | null
          monthly_income?: number | null
          risk_score?: number
          kyc_status?: 'pending' | 'verified' | 'rejected'
          assigned_officer_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      loans: {
        Row: {
          id: string
          loan_number: string
          agency_id: string
          customer_id: string
          loan_type: 'personal' | 'business' | 'agriculture' | 'vehicle' | 'property'
          amount: number
          currency: string
          interest_rate: number
          duration_months: number
          start_date: string | null
          end_date: string | null
          status: 'draft' | 'pending' | 'approved' | 'active' | 'rejected' | 'paid' | 'defaulted'
          repayment_frequency: 'weekly' | 'biweekly' | 'monthly'
          created_by: string | null
          approved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          loan_number: string
          agency_id: string
          customer_id: string
          loan_type: 'personal' | 'business' | 'agriculture' | 'vehicle' | 'property'
          amount: number
          currency?: string
          interest_rate: number
          duration_months: number
          start_date?: string | null
          end_date?: string | null
          status?: 'draft' | 'pending' | 'approved' | 'active' | 'rejected' | 'paid' | 'defaulted'
          repayment_frequency?: 'weekly' | 'biweekly' | 'monthly'
          created_by?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          loan_number?: string
          agency_id?: string
          customer_id?: string
          loan_type?: 'personal' | 'business' | 'agriculture' | 'vehicle' | 'property'
          amount?: number
          currency?: string
          interest_rate?: number
          duration_months?: number
          start_date?: string | null
          end_date?: string | null
          status?: 'draft' | 'pending' | 'approved' | 'active' | 'rejected' | 'paid' | 'defaulted'
          repayment_frequency?: 'weekly' | 'biweekly' | 'monthly'
          created_by?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

