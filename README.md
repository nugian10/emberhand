# Emberhand — Roguelike Card Battler

[![make.fun](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/nugian10/emberhand/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/nugian10/emberhand/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826)

**Emberhand** is an original roguelike card battler, built for make.fun's
[Make the best card game](https://make.fun/bounty/best-card-game-20261122-1826)
bounty. No libraries, no network: pure HTML, canvas and vanilla JavaScript,
with sounds synthesized in WebAudio.

## How to play

You are the Ember Knight, with 60 HP and a 10-card deck. Fight four ember
creatures in a row — Cinder Imp, Ash Wolf, Smoke Wraith, and the Pyre Titan —
and take the Titan's crown.

- **Energy:** you get 3 energy each turn. Every card costs energy to play.
- **Read the intent:** the badge above the enemy shows what it will do next —
  attack, block, or grow stronger. Play around it.
- **Cards combine:** Burn ticks at the start of the enemy's turn, Weak cuts its
  next attack, and draw and energy cards let you chain a big turn.
- **Rewards:** after each battle, pick 1 of 3 cards to add to your deck.
- **Score:** damage dealt + health remaining + a bonus for finishing quickly.

## Controls

- Click a card to select it, click the enemy to play it — or press `1`–`5` to
  play a card straight away.
- `E` (or `Enter`) ends the turn. `M` mutes the sound. `R` starts a new run
  after victory or defeat.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Self-test

```sh
# open http://localhost:8080/?test=1 — 20 in-page assertions, all must pass
```

## Screenshots

Staged deterministically with `?shot=1..4` (see `shots.json`): mid-battle,
a card being played, the boss fight, and the reward screen.

## Layout

- `game/index.html`, `game/styles.css` — the page
- `game/src/main.js` — boot, the loop, input, screenshot staging
- `game/src/cards.js` — every card definition and the deck
- `game/src/enemies.js` — the four creatures and their intents
- `game/src/battle.js` — turns, energy, damage, block, burn, weak, score
- `game/src/render.js` — the table, the creatures, the cards, the screens
- `game/src/hud.js` — health, energy, score, piles, buttons, intent badge
- `game/src/audio.js` — synthesized WebAudio sound effects
- `game/src/test.js` — the in-page self-test
- `main.ts` — hands game/ and screenshots/ to make.fun with a dossier
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
