import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Assumption, TurnRecord, Verdict } from '../types'
import { buildAssumePrompt, parseAssumptions } from './assumptions'

const record = atom({ plugin: 'assumption-check', key: 'record' } as const, null)

const setting = async ($: any, key: string): Promise<unknown> => {
  const rows = await $.config.list()
  return rows.find(r => r.key === key)?.value
}

const buildCorrections = (assumptions: Assumption[]): string =>
  assumptions
    .filter(a => a.verdict === 'wrong')
    .map(a => (a.because === '' ? `- ${a.text}` : `- ${a.text} (it did: ${a.because})`))
    .join('\n')

const mark = async ($: any, turnId: string, id: string, verdict: Verdict) => {
  await update($, record, rec => {
    if (rec === null || rec.turnId !== turnId) return rec
    return { ...rec, assumptions: rec.assumptions.map(a => (a.id === id ? { ...a, verdict } : a)) }
  })
}

const send = async ($: any, turnId: string) => {
  const rec: TurnRecord | null = await read($, record)
  if (rec === null || rec.turnId !== turnId) return
  const corrections = buildCorrections(rec.assumptions)
  if (corrections === '') {
    $.ui.status('assumption-check: nothing is marked wrong yet')
    return
  }
  await $.prompt.submit({
    text: ['Some assumptions behind that last turn were wrong. Redo the work with these corrected:', '', corrections, '', 'Say what you changed and why.'].join('\n'),
  })
  await update($, record, r => (r === null ? r : { ...r, assumptions: [], corrections: '' }))
  $.ui.status('assumption-check: corrections sent')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'assumption-check', description: 'Show the assumptions from the last turn.' })
    return next(e)
  })

  on('command.run', { command: 'assumption-check' }, async $ => {
    const rec: TurnRecord | null = await read($, record)
    return { text: rec === null ? 'No turn has been checked yet.' : `${rec.assumptions.length} assumptions.` }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    if (e.isAborted || e.answer.trim() === '') return result
    if ((await setting($, 'assumption-check.enabled')) === false) return result
    const limit = Number((await setting($, 'assumption-check.maxAssumptions')) ?? 5)
    const completion = await $.model.complete({
      model: 'haiku',
      prompt: buildAssumePrompt(e.answer),
      system: 'You list assumptions as JSON. You answer with a JSON array only.',
      // Without this the call has no deadline of its own and a stalled provider
      // holds the whole turn open. It resolves `aborted` instead of hanging.
      timeoutMs: 15_000,
    })
    if (!completion.isAnswered) return result
    const parsed: Assumption[] = parseAssumptions(completion.text, Number.isFinite(limit) ? limit : 5)
    await update($, record, () => ({ turnId: e.turnId, assumptions: parsed, corrections: '' }))
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
    if (e.props.hasSurvey) return null
    const rec: TurnRecord | null = await read($, record)
    if (rec === null || rec.assumptions.length === 0) return null
    const { Box, Text, Button } = $.ui.resolve(e)
    const wrong = rec.assumptions.filter(a => a.verdict === 'wrong').length
    return (
      <Box flexDirection="column">
        <Text dimColor>Assumption Check — {rec.assumptions.length} found, {wrong} wrong</Text>
        {rec.assumptions.map(a => (
          <Box key={a.id}>
            <Text>{a.text}</Text>
            <Button key={`right-${a.id}`} label="Right" onPress={() => { void mark($, rec.turnId, a.id, 'right') }} />
            <Button key={`wrong-${a.id}`} label="Wrong" onPress={() => { void mark($, rec.turnId, a.id, 'wrong') }} />
          </Box>
        ))}
        {wrong > 0 ? <Button key="send" label="Send corrections" onPress={() => { void send($, rec.turnId) }} /> : null}
      </Box>
    )
  })
}