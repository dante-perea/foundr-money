import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Service-role Supabase client — server-only, bypasses RLS. All access is
// scoped by owner_id in the query helpers, never by RLS in v1.
let _client: SupabaseClient | null = null

export function db(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase service-role env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }
  _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return _client
}
