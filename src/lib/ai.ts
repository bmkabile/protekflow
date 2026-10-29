// src/lib/ai.ts - minimal Claude Messages API client (no SDK dependency)

const RETRYABLE = new Set([429, 500, 502, 503, 529])

export function aiModel() { return process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5' }

export async function callClaude(opts: { system: string; user: string; maxTokens?: number; timeoutMs?: number }): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set')
  let lastErr = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 2500))
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: aiModel(),
          max_tokens: opts.maxTokens ?? 2000,
          system: opts.system,
          messages: [{ role: 'user', content: opts.user }],
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
      })
      if (!res.ok) {
        const body = (await res.text()).slice(0, 200)
        lastErr = `Claude API ${res.status}: ${body}`
        if (RETRYABLE.has(res.status)) continue
        throw new Error(lastErr)
      }
      const json = await res.json()
      const text = (json.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
      if (!text.trim()) { lastErr = 'Claude API returned no text'; continue }
      return text
    } catch (err: any) {
      lastErr = err?.message ?? String(err)
      if (!/aborted|timeout|fetch failed|ECONN|Claude API (429|5)/i.test(lastErr)) throw err
    }
  }
  throw new Error(lastErr || 'Claude API failed')
}
