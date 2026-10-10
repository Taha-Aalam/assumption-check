import { expect, test } from 'claude-code/testing'

import { register } from './register'
import { buildAssumePrompt, parseAssumptions } from './assumptions'

const draw = ($: any) => $.ui.render({ component: 'AbovePrompt', surface: 'terminal', props: {} as any })
const press = ($: any, key: string) => $.ui.press({ plugin: 'assumption-check', key })

const TURN = (answer: string, turnId: string) => ({ answer, isAborted: false, turnId }) as any

test('the prompt asks for JSON only', async () => {
  expect(buildAssumePrompt('I added a login page.')).toContain('I added a login page.')
})

test('a well-formed answer parses', async () => {
  const parsed = parseAssumptions(JSON.stringify([
    { text: 'The app has no existing login.', because: 'I added a login page.' },
  ]), 5)
  expect(parsed).toHaveLength(1)
  expect(parsed[0].verdict).toBe('unmarked')
})

test('ids are unique when text repeats', async () => {
  const parsed = parseAssumptions(JSON.stringify([{ text: 'same', because: 'a' }, { text: 'same', because: 'b' }]), 5)
  expect(parsed[0].id).not.toBe(parsed[1].id)
})

test('the limit is honoured', async () => {
  const many = JSON.stringify(Array.from({ length: 20 }, (_, i) => ({ text: `a${i}`, because: 'b' })))
  expect(parseAssumptions(many, 3)).toHaveLength(3)
})

test('a non-JSON answer yields nothing', async () => {
  expect(parseAssumptions('I could not find any.', 5)).toHaveLength(0)
})

const TWO = JSON.stringify([
  { text: 'first guess', because: 'a' },
  { text: 'second guess', because: 'b' },
])

const setupTwo = async ($, on, sent: string[]) => {
  on('prompt.submit', ($, e) => { sent.push(e.text); return { text: e.text } })
  on('ui.render', () => ({ type: 'Box', children: [] }))
  on('turn.complete', () => ({ text: 'I did two things.' }))
  on('model.complete', () => ({ value: { isAnswered: true, text: TWO } }))
  on('config.list', () => ({ value: [] as any }))
  on('ui.status', () => ({ value: undefined }))
  await $.turn.complete(TURN('I did two things.', 't4'))
}

test('an assumption is drawn with Right and Wrong', async ($, on) => {
  await setupTwo($, on, [])
  const tree = JSON.stringify(await draw($, on))
  expect(tree).toContain('first guess')
  expect(tree).toContain('"label":"Right"')
  expect(tree).toContain('"label":"Wrong"')
})

test('sending produces exactly one prompt carrying every wrong row', async ($, on) => {
  const sent: string[] = []
  await setupTwo($, on, sent)
  await draw($, on)
  await press($, 'wrong-0-first guess')
  await press($, 'wrong-1-second guess')
  await draw($, on)
  await press($, 'send')
  expect(sent).toHaveLength(1)
  expect(sent[0]).toContain('first guess')
  expect(sent[0]).toContain('second guess')
})

test('an aborted turn collects nothing', async ($, on) => {
  on('ui.render', () => ({ type: 'Box', children: [] }))
  on('turn.complete', () => ({ text: 'x' }))
  on('model.complete', () => ({ value: { isAnswered: true, text: TWO } }))
  on('config.list', () => ({ value: [] as any }))
  await $.turn.complete({ answer: 'x', isAborted: true, turnId: 't5' } as any)
  expect(JSON.stringify(await draw($, on))).not.toContain('"label":"Right"')
})