import { supabase as client } from '../supabase'

export const supabase = client

export type SiteVisit = {
  id: string
  visit_date: string
  in_time?: string | null
  out_time?: string | null
  engineer?: string | null
  visited_by?: string | null
  purpose?: string | null
  site_address?: string | null
  location_url?: string | null
  measurements?: string | null
  discussion?: string | null
  follow_up_date?: string | null
  next_step?: string | null
  status: string
  postponed_reason?: string | null
  created_by?: string | null
  created_at?: string | null
  client_id?: string | null
  project_id?: string | null
}

export type Project = {
  id: string
  name?: string | null
  project_name?: string | null
  client_id?: string | null
}

export type Client = {
  id: string
  name?: string | null
  client_name?: string | null
}
