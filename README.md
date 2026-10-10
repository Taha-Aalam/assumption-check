# Assumption Check

Shows the small guesses Claude made during a turn, so you can correct the ones it got wrong.

A [Claude Code plugin](https://docs.claude.com/en/docs/claude-code/plugins).

## Install

At the prompt of a Claude Code session, run:

```
/plugin install assumption-check --marketplace Taha-Aalam/assumption-check
```

Answer `y` to add the marketplace, then choose the user scope.

## Use

  1. Ask a question that requires some judgement.
  2. When the turn ends the band above your prompt lists each guess.
  3. Press the buttons on the ones it got wrong — they go back to Claude as a correction.

## How it works

`.claude-plugin/plugin.json` declares the plugin and points at its hooks module.
`hooks/hooks.json` names `register.tsx`, which exports `register` — a set of hooks that run
alongside Claude Code's own. A hook that returns without calling `next` answers for itself;
one that returns `next(e)` lets the engine carry on.

Anything the mod keeps between events lives in `$.state`, and every key it uses is declared in
`types/index.d.ts` so `claude plugin validate` can check them.

## Limits worth knowing

- It can only show assumptions in a turn whose final text names them. There is no API that reveals what a model decided silently.

## Development

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

The tests run through the plugin engine's own test harness: they load this module, stand in for the
events it hooks, and assert on what it drew and returned. That proves the module loads, that its
hooks fire, and that its trees and answers are shaped correctly. It is not the same as a live
session — anything that reaches the model, the network or the filesystem has to be tried in one.
