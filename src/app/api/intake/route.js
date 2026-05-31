export async function POST(req) {
  try {
    const body = await req.json()
    const { name, discord, market, experience, livetrading, struggle, baddays, referral, commitment, notes } = body

    const required = { name, discord, market, experience, livetrading, struggle, baddays, referral, commitment }
    for (const [key, val] of Object.entries(required)) {
      if (!val || !val.toString().trim()) {
        return Response.json({ error: `Missing field: ${key}` }, { status: 400 })
      }
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
      console.error('DISCORD_WEBHOOK_URL is not set')
      return Response.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const embed = {
      title: '📋 New 1-on-1 Application',
      color: 0x2563eb,
      fields: [
        { name: '👤 Name',             value: name,        inline: true  },
        { name: '💬 Discord',          value: discord,     inline: true  },
        { name: '📈 Market',           value: market,      inline: true  },
        { name: '⏱ Experience',        value: experience,  inline: true  },
        { name: '💵 Trading Live',     value: livetrading, inline: true  },
        { name: '⚠️ Biggest Struggle', value: struggle,    inline: false },
        { name: '📉 Bad Day Causes',   value: baddays,     inline: false },
        { name: '📣 Found Me Via',     value: referral,    inline: true  },
        { name: '🔥 Commitment',       value: commitment,  inline: true  },
        ...(notes?.trim() ? [{ name: '📝 Notes', value: notes, inline: false }] : []),
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'JHP Trades · 1-on-1 Application' },
    }

    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })

    if (!webhookRes.ok) {
      console.error('Discord webhook error:', webhookRes.status)
      throw new Error('Webhook delivery failed')
    }

    return Response.json({ success: true })
  } catch (e) {
    console.error('Intake API error:', e)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
