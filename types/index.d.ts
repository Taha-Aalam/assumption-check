export type Verdict = 'unmarked' | 'right' | 'wrong'

export type Assumption = {
  id: string
  text: string
  because: string
  verdict: Verdict
}

export type TurnRecord = {
  turnId: string
  assumptions: Assumption[]
  corrections: string
}

declare module 'claude-code' {
  interface PluginState {
    'assumption-check': {
      record: TurnRecord | null
    }
  }
}