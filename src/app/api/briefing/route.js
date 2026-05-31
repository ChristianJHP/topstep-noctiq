import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET() {
  const supabase = getSupabase()
  if (!supabase) {
    return Response.json({ error: 'Briefing storage not configured' }, { status: 503 })
  }

  const { data, error } = await supabase
    .from('daily_briefings')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return Response.json({ error: 'No briefing yet — hit /api/briefing/generate first' }, { status: 404 })
  return Response.json(data[0])
}
