// src/types/supabase.ts
// Auto-generated Supabase type stub.
// Replace with real types by running: npm run db:types
// (requires SUPABASE_PROJECT_ID in your environment)

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
      profiles: {
        Row: {
          id:           string
          role:         'contractor' | 'consultant' | 'admin'
          full_name:    string
          phone:        string | null
          company_name: string | null
          created_at:   string
          updated_at:   string
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string; full_name: string }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      contractors: {
        Row: {
          id:          string
          cidb_number: string | null
          cidb_grade:  number | null
          city:        string | null
          province:    string | null
          total_files: number
          created_at:  string
        }
        Insert: Partial<Database['public']['Tables']['contractors']['Row']> & { id: string }
        Update: Partial<Database['public']['Tables']['contractors']['Row']>
      }
      consultants: {
        Row: {
          id:                  string
          sacpcmp_number:      string
          sacpcmp_category:    string | null
          sacpcmp_expiry:      string | null
          verification_status: 'pending' | 'verified' | 'rejected' | 'suspended'
          tier:                'free' | 'pro'
          bio:                 string | null
          city:                string | null
          province:            string | null
          rating_avg:          number
          rating_count:        number
          files_completed:     number
          files_this_month:    number
          is_available:        boolean
          created_at:          string
        }
        Insert: Partial<Database['public']['Tables']['consultants']['Row']> & { id: string; sacpcmp_number: string }
        Update: Partial<Database['public']['Tables']['consultants']['Row']>
      }
      she_files: {
        Row: {
          id:                     string
          file_number:            string
          contractor_id:          string
          consultant_id:          string | null
          project_name:           string
          project_address:        string
          project_value:          number | null
          project_start_date:     string | null
          project_end_date:       string | null
          principal_contractor:   string | null
          client_name:            string | null
          site_agent:             string | null
          price_zar:              number
          volume_tier:            string
          status:                 string
          sla_deadline:           string | null
          matched_at:             string | null
          review_started_at:      string | null
          completed_at:           string | null
          docuseal_submission_id: string | null
          docuseal_document_url:  string | null
          docuseal_status:        string | null
          payfast_payment_id:     string | null
          paid_at:                string | null
          project_type_id:        number | null
          template_id:            number | null
          wizard_data:            Json | null
          generated_draft:        string | null
          is_complex:             boolean
          notes:                  string | null
          created_at:             string
          updated_at:             string
        }
        Insert: Partial<Database['public']['Tables']['she_files']['Row']> & {
          contractor_id: string
          project_name:  string
          project_address: string
        }
        Update: Partial<Database['public']['Tables']['she_files']['Row']>
      }
      transactions: {
        Row: {
          id:                    string
          she_file_id:           string
          contractor_id:         string
          consultant_id:         string | null
          gross_amount:          number
          platform_fee_pct:      number
          platform_fee_amount:   number
          consultant_amount:     number
          payfast_payment_id:    string | null
          payout_status:         'pending' | 'processing' | 'paid' | 'failed'
          payout_reference:      string | null
          paid_to_consultant_at: string | null
          created_at:            string
        }
        Insert: Partial<Database['public']['Tables']['transactions']['Row']> & {
          she_file_id:          string
          contractor_id:        string
          gross_amount:         number
          platform_fee_pct:     number
          platform_fee_amount:  number
          consultant_amount:    number
        }
        Update: Partial<Database['public']['Tables']['transactions']['Row']>
      }
      project_types: {
        Row: {
          id:             number
          code:           string
          label:          string
          description:    string | null
          requires_chsm:  boolean
          high_risk:      boolean
          price_standard: number
          price_complex:  number
          created_at:     string
        }
        Insert: Partial<Database['public']['Tables']['project_types']['Row']>
        Update: Partial<Database['public']['Tables']['project_types']['Row']>
      }
      she_templates: {
        Row: {
          id:                        number
          project_type_id:           number | null
          version:                   string
          content:                   string
          section_count:             number | null
          customisation_minutes_min: number | null
          customisation_minutes_max: number | null
          is_active:                 boolean
          created_at:                string
          updated_at:                string
        }
        Insert: Partial<Database['public']['Tables']['she_templates']['Row']>
        Update: Partial<Database['public']['Tables']['she_templates']['Row']>
      }
      platform_config: {
        Row:    { key: string; value: string; note: string | null }
        Insert: { key: string; value: string; note?: string | null }
        Update: Partial<{ key: string; value: string; note: string | null }>
      }
    }
    Views: {
      v_file_summary: {
        Row: {
          id:                  string
          file_number:         string
          status:              string
          price_zar:           number
          volume_tier:         string
          sla_deadline:        string | null
          completed_at:        string | null
          docuseal_document_url: string | null
          created_at:          string
          contractor_name:     string
          contractor_company:  string | null
          consultant_name:     string | null
          consultant_sacpcmp:  string | null
          consultant_tier:     string | null
          project_name:        string
          project_address:     string
          project_value:       number | null
        }
      }
    }
    Functions: {
      increment_consultant_files: {
        Args: { consultant_uuid: string }
        Returns: void
      }
    }
    Enums: {
      user_role:           'contractor' | 'consultant' | 'admin'
      consultant_tier:     'free' | 'pro'
      file_status:         'draft' | 'payment_pending' | 'paid' | 'matched' | 'in_review' | 'awaiting_sign' | 'signed' | 'completed' | 'cancelled' | 'overdue'
      payout_status:       'pending' | 'processing' | 'paid' | 'failed'
      verification_status: 'pending' | 'verified' | 'rejected' | 'suspended'
    }
  }
}
