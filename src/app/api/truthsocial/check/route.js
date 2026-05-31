import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim()
}

export async function GET(request) {
  const supabase = getSupabase()
  if (!supabase) {
    return Response.json({ error: 'Truth Social storage not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret') || request.headers.get('x-cron-secret')

  if (!secret || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const username = process.env.TRUTH_SOCIAL_USERNAME || 'realDonaldTrump'
  const errors = []
  let checked = 0
  let sent = 0
  let duplicates = 0

  try {
    console.log(`[TruthSocial] Looking up @${username}`)

    const lookupRes = await fetch(
      `https://truthsocial.com/api/v1/accounts/lookup?acct=${username}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NoctiqBot/1.0)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      }
    )

    if (!lookupRes.ok) {
      const snippet = (await lookupRes.text()).slice(0, 200)
      const msg = `Account lookup failed: HTTP ${lookupRes.status} — ${snippet}`
      console.error(`[TruthSocial] ${msg}`)
      return Response.json({ ok: false, error: msg, checked: 0, sent: 0, duplicates: 0, errors: [msg] }, { status: 502 })
    }

    const account = await lookupRes.json()
    const accountId = account.id
    console.log(`[TruthSocial] Account found: ${accountId} (${account.display_name})`)

    const statusRes = await fetch(
      `https://truthsocial.com/api/v1/accounts/${accountId}/statuses?exclude_replies=true&only_media=false&limit=10`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NoctiqBot/1.0)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      }
    )

    if (!statusRes.ok) {
      const snippet = (await statusRes.text()).slice(0, 200)
      const msg = `Status fetch failed: HTTP ${statusRes.status} — ${snippet}`
      console.error(`[TruthSocial] ${msg}`)
      return Response.json({ ok: false, error: msg, checked: 0, sent: 0, duplicates: 0, errors: [msg] }, { status: 502 })
    }

    const posts = await statusRes.json()
    checked = Array.isArray(posts) ? posts.length : 0
    console.log(`[TruthSocial] Fetched ${checked} posts`)

    for (const post of posts) {
      const postId = String(post.id)

      // Duplicate check
      const { data: existing } = await supabase
        .from('truthsocial_alerts')
        .select('id')
        .eq('id', postId)
        .maybeSingle()

      if (existing) {
        duplicates++
        continue
      }

      const content = stripHtml(post.content)
      const postUrl = post.url || `https://truthsocial.com/@${username}/posts/${postId}`
      const mediaUrl = post.media_attachments?.[0]?.url || null

      // Insert before sending to prevent duplicate sends on retry
      const { error: insertError } = await supabase
        .from('truthsocial_alerts')
        .insert({
          id: postId,
          username,
          content,
          url: postUrl,
          raw: post,
          created_at: post.created_at,
          sent_to_discord_at: new Date().toISOString(),
        })

      if (insertError) {
        // Unique constraint violation = already sent
        if (insertError.code === '23505') {
          duplicates++
          continue
        }
        const msg = `Supabase insert error for ${postId}: ${insertError.message}`
        console.error(`[TruthSocial] ${msg}`)
        errors.push(msg)
        continue
      }

      const webhookUrl = process.env.DISCORD_TRUTH_WEBHOOK_URL
      if (!webhookUrl) {
        const msg = 'DISCORD_TRUTH_WEBHOOK_URL not configured'
        console.error(`[TruthSocial] ${msg}`)
        errors.push(msg)
        continue
      }

      const discordPayload = {
        content: `🚨 **Trump Truth Social Post**\n\n${content}\n\n${postUrl}`,
      }

      if (mediaUrl) {
        discordPayload.embeds = [{ image: { url: mediaUrl }, color: 0xff0000 }]
      }

      const discordRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload),
        signal: AbortSignal.timeout(10000),
      })

      if (!discordRes.ok) {
        const snippet = (await discordRes.text()).slice(0, 200)
        const msg = `Discord send failed for ${postId}: HTTP ${discordRes.status} — ${snippet}`
        console.error(`[TruthSocial] ${msg}`)
        errors.push(msg)
        continue
      }

      sent++
      console.log(`[TruthSocial] Sent post ${postId} to Discord`)
    }

    return Response.json({ ok: true, checked, sent, duplicates, errors })
  } catch (err) {
    const msg = `Unexpected error: ${err.message}`
    console.error(`[TruthSocial] ${msg}`)
    return Response.json(
      { ok: false, checked, sent, duplicates, errors: [msg, ...errors] },
      { status: 500 }
    )
  }
}
