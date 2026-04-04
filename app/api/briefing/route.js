import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET() {
  const { data, error } = await supabase
    .from('daily_briefings')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return Response.json({ error: 'No briefing yet — hit /api/briefing/generate first' }, { status: 404 })
  return Response.json(data[0])
}
