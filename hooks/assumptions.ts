import type { Assumption } from '../types'

export const buildAssumePrompt = (answer: string): string =>
  [
    'List the assumptions this work silently made.',
    '',
    'The work:',
    answer,
    '',
    'Answer with a JSON array and nothing else:',
    '[{"text": "the assumption in one line", "because": "what it did because of it"}]',
  ].join('\n')

export const parseAssumptions = (text: string, limit: number): Assumption[] => {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end <= start) return []
  let value: unknown
  try {
    value = JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(value)) return []
  const out: Assumption[] = []
  for (const item of value) {
    if (out.length >= limit) break
    if (typeof item !== 'object' || item === null) continue
    const v = item as Record<string, unknown>
    const t = typeof v.text === 'string' ? v.text.trim() : ''
    if (t === '') continue
    const because = typeof v.because === 'string' ? v.because.trim() : ''
    out.push({ id: `${out.length}-${t}`, text: t, because, verdict: 'unmarked' })
  }
  return out
}