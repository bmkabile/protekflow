// Run: npx tsx scripts/test-ai-client.ts  - checks request shape, retry on overload, and failure on 4xx (mocked fetch)
import assert from 'assert'
process.env.ANTHROPIC_API_KEY = 'test-key'
import { callClaude } from '../src/lib/ai'
const calls: any[] = []
let mode = 'retry'
;(globalThis as any).fetch = async (url: string, init: any) => {
  calls.push({ url, init })
  if (mode === 'retry' && calls.length === 1) return new Response('overloaded', { status: 529 })
  if (mode === 'bad') return new Response('{"error":"invalid"}', { status: 400 })
  return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }] }), { status: 200 })
}
;(async () => {
  const out = await callClaude({ system: 's', user: 'u', maxTokens: 50 })
  assert.equal(out, 'Hello world'); assert.equal(calls.length, 2)
  const h = calls[1].init.headers; assert.equal(h['x-api-key'], 'test-key'); assert.equal(h['anthropic-version'], '2023-06-01')
  const body = JSON.parse(calls[1].init.body); assert.equal(body.model, 'claude-sonnet-5-5'); assert.equal(body.max_tokens, 50); assert.equal(body.system, 's')
  calls.length = 0; mode = 'bad'
  await assert.rejects(() => callClaude({ system: 's', user: 'u' }), /Claude API 400/); assert.equal(calls.length, 1)
  console.log('ai client ok')
})()
