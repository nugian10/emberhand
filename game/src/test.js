// The in-page self-test of EMBERHAND, run with ?test=1. It plays the real
// battle rules headlessly — deck, draw, energy, damage, block, burn, weak,
// intents, win and loss, rewards — and reports every assertion on the page,
// so a failure is visible before any screenshot or submission.
import { CARD_DEFS, buildStarterDeck } from './cards.js';
import { ENEMY_DEFS, makeEnemy, rollIntent } from './enemies.js';
import {
  canPlay,
  computeScore,
  createRun,
  dealDamageToEnemy,
  drawCards,
  enemyAct,
  endTurn,
  playCard,
  startBattle,
  startRun,
  chooseReward,
} from './battle.js';

function check(results, name, pass, detail) {
  results.push({ name, pass: Boolean(pass), detail: detail || '' });
}

function findInHand(state, defId) {
  return state.hand.findIndex((card) => card.defId === defId);
}

function giveCard(state, defId) {
  const card = { uid: 10000 + state.hand.length, defId };
  state.hand.push(card);
  return state.hand.length - 1;
}

/** Run every assertion against fresh states. Returns the results list. */
export function runTests() {
  const results = [];

  // 1. Deck composition: the starter deck is 10 cards with the right mix.
  {
    const run = createRun(7);
    const counts = {};
    for (const card of run.deck) counts[card.defId] = (counts[card.defId] || 0) + 1;
    check(results, 'deck composition is 4 strike / 3 guard / 1 spark / 1 flame / 1 kindle',
      run.deck.length === 10 && counts.strike === 4 && counts.guard === 3
      && counts.spark === 1 && counts.flame === 1 && counts.kindle === 1,
      `deck=${run.deck.length} strike=${counts.strike} guard=${counts.guard}`);
  }

  // 2. A run starts on the title screen with full health and no enemy.
  {
    const run = createRun(7);
    check(results, 'fresh run is on the title screen with 60 HP',
      run.phase === 'title' && run.player.hp === 60 && run.enemy === null,
      `phase=${run.phase} hp=${run.player.hp}`);
  }

  // 3. Starting a run opens battle 1 with a hand of 5 and 3 energy.
  {
    const run = createRun(7);
    startRun(run);
    check(results, 'run start draws 5 cards and refills 3 energy',
      run.phase === 'battle' && run.hand.length === 5 && run.player.energy === 3
      && run.enemy && run.enemy.name === 'Cinder Imp',
      `hand=${run.hand.length} energy=${run.player.energy} enemy=${run.enemy && run.enemy.name}`);
  }

  // 4. Draw and discard: ending a turn discards the hand and draws a fresh 5.
  {
    const run = createRun(7);
    startRun(run);
    const deckBefore = run.deck.length;
    endTurn(run);
    check(results, 'end turn discards the hand and draws 5 new cards',
      run.hand.length === 5 && run.discard.length === 5 && run.deck.length === deckBefore - 5,
      `hand=${run.hand.length} discard=${run.discard.length} deck=${run.deck.length} (was ${deckBefore})`);
  }

  // 5. Reshuffle: an empty deck is rebuilt from the discard pile.
  {
    const run = createRun(7);
    startRun(run);
    run.deck = [];
    run.discard = [{ uid: 1, defId: 'strike' }, { uid: 2, defId: 'guard' }];
    run.hand = [];
    drawCards(run, 2);
    check(results, 'empty deck reshuffles the discard pile to draw',
      run.hand.length === 2 && run.deck.length === 0,
      `hand=${run.hand.length} deck=${run.deck.length}`);
  }

  // 6. Energy rules: a card costing more than the energy left cannot be played.
  {
    const run = createRun(7);
    startRun(run);
    run.player.energy = 1;
    const index = giveCard(run, 'smash');
    const played = playCard(run, index);
    check(results, 'a 2-cost card cannot be played with 1 energy',
      played === false && run.player.energy === 1,
      `played=${played} energy=${run.player.energy}`);
  }

  // 7. Energy rules: playing a card spends exactly its cost.
  {
    const run = createRun(7);
    startRun(run);
    run.player.energy = 3;
    const index = giveCard(run, 'flame');
    const played = playCard(run, index);
    check(results, 'playing a 2-cost card spends 2 energy',
      played === true && run.player.energy === 1,
      `played=${played} energy=${run.player.energy}`);
  }

  // 8. Damage and block math: block absorbs first, the rest hits health.
  {
    const run = createRun(7);
    startRun(run);
    run.enemy.block = 4;
    const dealt = dealDamageToEnemy(run, 6);
    check(results, 'damage is reduced by enemy block first',
      dealt === 2 && run.enemy.hp === run.enemy.maxHp - 2 && run.enemy.block === 0,
      `dealt=${dealt} hp=${run.enemy.hp} block=${run.enemy.block}`);
  }

  // 9. Player block absorbs an enemy attack.
  {
    const run = createRun(7);
    startRun(run);
    run.player.block = 5;
    run.enemy.intent = { kind: 'attack', value: 8 };
    run.enemy.strength = 0;
    run.enemy.weak = 0;
    run.enemy.burn = 0;
    enemyAct(run);
    check(results, 'player block absorbs the enemy attack',
      run.player.hp === 57 && run.player.block === 0,
      `hp=${run.player.hp} block=${run.player.block}`);
  }

  // 10. Burn ticks at the start of the enemy turn and then fades by one.
  {
    const run = createRun(7);
    startRun(run);
    run.enemy.burn = 3;
    run.enemy.intent = { kind: 'block', value: 5 };
    const hpBefore = run.enemy.hp;
    enemyAct(run);
    check(results, 'burn deals its damage, then loses one stack',
      run.enemy.hp === hpBefore - 3 && run.enemy.burn === 2,
      `hp=${run.enemy.hp} (was ${hpBefore}) burn=${run.enemy.burn}`);
  }

  // 11. Weak cuts the enemy attack by 2 per stack and spends one stack.
  {
    const run = createRun(7);
    startRun(run);
    run.enemy.intent = { kind: 'attack', value: 10 };
    run.enemy.weak = 2;
    run.enemy.burn = 0;
    run.enemy.strength = 0;
    enemyAct(run);
    check(results, 'weak reduces the attack by 2 per stack',
      run.player.hp === 60 - 6 && run.enemy.weak === 1,
      `hp=${run.player.hp} weak=${run.enemy.weak}`);
  }

  // 12. Enemy intent execution: a block intent grants block, strength raises power.
  {
    const run = createRun(7);
    startRun(run);
    run.enemy.intent = { kind: 'block', value: 7 };
    run.enemy.burn = 0;
    enemyAct(run);
    const blocked = run.enemy.block === 7;
    run.enemy.intent = { kind: 'strength', value: 3 };
    enemyAct(run);
    check(results, 'block and strength intents execute as shown',
      blocked && run.enemy.strength === 3,
      `block=${run.enemy.block} strength=${run.enemy.strength}`);
  }

  // 13. Intent rolling: every enemy always shows a valid next intent.
  {
    const run = createRun(7);
    let ok = true;
    for (let i = 0; i < ENEMY_DEFS.length; i += 1) {
      const enemy = makeEnemy(i);
      rollIntent(enemy, run.rng);
      if (!enemy.intent || !['attack', 'block', 'strength'].includes(enemy.intent.kind)) ok = false;
    }
    check(results, 'every enemy rolls a valid intent', ok, '');
  }

  // 14. Win transition: killing the imp opens the reward screen with 3 choices.
  {
    const run = createRun(7);
    startRun(run);
    run.enemy.hp = 1;
    const index = giveCard(run, 'spark');
    playCard(run, index);
    check(results, 'killing battle 1 opens the reward screen with 3 cards',
      run.phase === 'reward' && run.rewardChoices.length === 3,
      `phase=${run.phase} choices=${run.rewardChoices.length}`);
  }

  // 15. Reward pick: choosing a card adds exactly one card to the deck.
  {
    const run = createRun(7);
    startRun(run);
    run.enemy.hp = 1;
    playCard(run, giveCard(run, 'spark'));
    const totalBefore = run.deck.length + run.hand.length + run.discard.length;
    const picked = run.rewardChoices[0].defId;
    const ok = chooseReward(run, 0);
    const totalAfter = run.deck.length + run.hand.length + run.discard.length;
    const hasIt = run.deck.concat(run.hand, run.discard).some((card) => card.defId === picked);
    check(results, 'reward pick adds the chosen card and opens battle 2',
      ok === true && totalAfter === totalBefore + 1 && hasIt
      && run.phase === 'battle' && run.battleIndex === 1,
      `cards=${totalAfter} (was ${totalBefore}) battle=${run.battleIndex + 1}`);
  }

  // 16. Lose transition: a lethal attack ends the run on the defeat screen.
  {
    const run = createRun(7);
    startRun(run);
    run.player.hp = 3;
    run.enemy.intent = { kind: 'attack', value: 20 };
    run.enemy.burn = 0;
    run.enemy.weak = 0;
    enemyAct(run);
    check(results, 'lethal damage ends the run on the defeat screen',
      run.phase === 'defeat' && run.player.hp === 0,
      `phase=${run.phase} hp=${run.player.hp}`);
  }

  // 17. Victory: killing the boss ends the run with a positive score.
  {
    const run = createRun(7);
    startBattle(run, 3);
    run.phase = 'battle';
    run.enemy.hp = 1;
    playCard(run, giveCard(run, 'spark'));
    check(results, 'killing the boss ends the run in victory with a score',
      run.phase === 'victory' && run.score > 0,
      `phase=${run.phase} score=${run.score}`);
  }

  // 18. Score: damage dealt plus health left plus the speed bonus.
  {
    const run = createRun(7);
    run.damageDealt = 40;
    run.player.hp = 25;
    run.totalTurns = 10;
    const score = computeScore(run);
    check(results, 'score is damage + health + speed bonus',
      score === 40 + 25 + (30 - 10) * 10,
      `score=${score}`);
  }

  // 19. Card data: every definition has a name, a cost and a type the renderer knows.
  {
    const ok = Object.values(CARD_DEFS).every((def) => def.name && def.cost >= 0 && def.type in { attack: 1, block: 1, skill: 1 });
    check(results, 'every card definition is complete', ok, `cards=${Object.keys(CARD_DEFS).length}`);
  }

  // 20. A full turn cycle never leaves the hand empty or the energy negative.
  {
    const run = createRun(11);
    startRun(run);
    let ok = true;
    for (let t = 0; t < 6 && run.phase === 'battle'; t += 1) {
      for (let i = run.hand.length - 1; i >= 0; i -= 1) {
        if (run.hand[i] && run.hand[i].defId === 'strike' && run.player.energy >= 1) playCard(run, i);
      }
      if (run.phase !== 'battle') break;
      endTurn(run);
      if (run.hand.length !== 5 || run.player.energy < 0) ok = false;
    }
    check(results, 'six autopilot turns keep a 5-card hand and non-negative energy',
      ok, `phase=${run.phase} hand=${run.hand.length} energy=${run.player.energy}`);
  }

  return results;
}

/** One-line summary, for the page title and the debug output. */
export function summarize(results) {
  const passed = results.filter((r) => r.pass).length;
  return `${passed}/${results.length} assertions passed`;
}
