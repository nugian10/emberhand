// The battle rules of EMBERHAND: turns, energy, damage and block, burn and
// weak, drawing and discarding, rewards and the score. Everything here is
// plain state and pure functions of it, so the in-page tests and the screenshot
// staging play the exact same rules a player does.
import { buildStarterDeck, defOf, makeCard, rollRewardChoices, shuffle } from './cards.js';
import { makeEnemy, rollIntent } from './enemies.js';

export const PLAYER_MAX_HP = 60;
export const ENERGY_PER_TURN = 3;
export const CARDS_PER_TURN = 5;
export const TURN_BONUS_TURNS = 30;
export const TURN_BONUS_POINTS = 10;

/** Deterministic random source (mulberry32) so a seed replays a whole run. */
export function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh run: title screen, a new deck, full health, no score yet. */
export function createRun(seed) {
  const rng = createRng(seed);
  return {
    seed,
    rng,
    phase: 'title',
    battleIndex: 0,
    player: { hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, block: 0, energy: 0 },
    enemy: null,
    deck: buildStarterDeck(rng),
    hand: [],
    discard: [],
    turn: 0,
    totalTurns: 0,
    damageDealt: 0,
    score: 0,
    rewardChoices: [],
    floaters: [],
    playedAnim: null,
    selected: -1,
    hovered: -1,
    log: 'Welcome, Ember Knight.',
    best: 0,
  };
}

/** Start the run's first battle (from the title screen). */
export function startRun(state) {
  state.phase = 'battle';
  state.battleIndex = 0;
  state.turn = 0;
  state.totalTurns = 0;
  state.damageDealt = 0;
  state.score = 0;
  state.hand = [];
  state.discard = [];
  state.rewardChoices = [];
  state.floaters = [];
  state.playedAnim = null;
  startBattle(state, 0);
}

/** Open battle `index`: a fresh enemy, a fresh hand, the player's block kept. */
export function startBattle(state, index) {
  state.battleIndex = index;
  state.enemy = makeEnemy(index);
  state.turn = 0;
  state.hand = [];
  state.floaters = [];
  state.playedAnim = null;
  state.selected = -1;
  rollIntent(state.enemy, state.rng);
  startTurn(state);
  state.log = `${state.enemy.name} appears — ${state.enemy.title}.`;
}

/** Open a player turn: energy refills, block fades, five cards are drawn. */
export function startTurn(state) {
  state.turn += 1;
  state.totalTurns += 1;
  state.player.block = 0;
  state.player.energy = ENERGY_PER_TURN;
  drawCards(state, CARDS_PER_TURN);
}

/** Draw `count` cards, reshuffling the discard pile when the deck runs out. */
export function drawCards(state, count) {
  for (let i = 0; i < count; i += 1) {
    if (state.deck.length === 0) {
      if (state.discard.length === 0) return;
      state.deck = shuffle(state.discard.splice(0), state.rng);
    }
    state.hand.push(state.deck.pop());
  }
}

/** Can this card be played right now? Energy is the only gate. */
export function canPlay(state, handIndex) {
  const card = state.hand[handIndex];
  if (!card) return false;
  return defOf(card).cost <= state.player.energy;
}

/**
 * Play the card at `handIndex` against the enemy. Returns false when the card
 * cannot be played; otherwise applies its effect, moves it to the discard pile
 * and, when the enemy falls, opens the reward screen (or the victory screen
 * after the boss).
 */
export function playCard(state, handIndex) {
  if (state.phase !== 'battle' || !state.enemy) return false;
  const card = state.hand[handIndex];
  if (!card) return false;
  const def = defOf(card);
  if (def.cost > state.player.energy) return false;
  state.player.energy -= def.cost;
  state.hand.splice(handIndex, 1);
  state.discard.push(card);
  state.selected = -1;
  state.playedAnim = { card, t: 0 };

  if (def.damage) dealDamageToEnemy(state, def.damage);
  if (def.block) {
    state.player.block += def.block;
    addFloater(state, 640, 440, `+${def.block} Block`, '#7fd8cf');
  }
  if (def.draw) drawCards(state, def.draw);
  if (def.energy) state.player.energy += def.energy;
  if (def.burn) {
    state.enemy.burn += def.burn;
    addFloater(state, 640, 300, `Burn ${def.burn}`, '#ff9a3c');
  }
  if (def.heal) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + def.heal);
    addFloater(state, 640, 440, `+${def.heal} HP`, '#8be28b');
  }
  if (def.weak) {
    state.enemy.weak += def.weak;
    addFloater(state, 640, 300, `Weak ${def.weak}`, '#c9b8ff');
  }
  state.log = `Played ${def.name}.`;
  if (state.enemy.hp <= 0) winBattle(state);
  return true;
}

/** Damage to the enemy, reduced by its block; burn and score are tracked here. */
export function dealDamageToEnemy(state, amount) {
  const enemy = state.enemy;
  const absorbed = Math.min(enemy.block, amount);
  enemy.block -= absorbed;
  const dealt = amount - absorbed;
  enemy.hp = Math.max(0, enemy.hp - dealt);
  state.damageDealt += dealt;
  addFloater(state, 640, 260, `-${dealt}`, dealt > 0 ? '#ffd94d' : '#9aa3ad');
  return dealt;
}

/** The enemy's turn: burn ticks, its shown intent executes, a new one is rolled. */
export function enemyAct(state) {
  const enemy = state.enemy;
  if (!enemy) return;
  enemy.block = 0;
  if (enemy.burn > 0) {
    enemy.hp = Math.max(0, enemy.hp - enemy.burn);
    state.damageDealt += enemy.burn;
    addFloater(state, 640, 260, `-${enemy.burn} Burn`, '#ff9a3c');
    enemy.burn = Math.max(0, enemy.burn - 1);
    if (enemy.hp <= 0) {
      winBattle(state);
      return;
    }
  }
  const intent = enemy.intent;
  if (intent && intent.kind === 'attack') {
    let damage = intent.value + enemy.strength;
    if (enemy.weak > 0) {
      damage = Math.max(0, damage - 2 * enemy.weak);
      enemy.weak = Math.max(0, enemy.weak - 1);
    }
    const absorbed = Math.min(state.player.block, damage);
    state.player.block -= absorbed;
    const dealt = damage - absorbed;
    state.player.hp = Math.max(0, state.player.hp - dealt);
    addFloater(state, 640, 440, dealt > 0 ? `-${dealt}` : 'Blocked!', dealt > 0 ? '#ff6b5e' : '#7fd8cf');
    state.log = `${enemy.name} attacks for ${dealt}.`;
  } else if (intent && intent.kind === 'block') {
    enemy.block += intent.value;
    addFloater(state, 640, 300, `+${intent.value} Block`, '#7fd8cf');
    state.log = `${enemy.name} raises a guard.`;
  } else if (intent && intent.kind === 'strength') {
    enemy.strength += intent.value;
    addFloater(state, 640, 300, `+${intent.value} Strength`, '#ffb347');
    state.log = `${enemy.name} grows stronger.`;
  }
  if (state.player.hp <= 0) {
    loseRun(state);
    return;
  }
  rollIntent(enemy, state.rng);
}

/** End the player's turn: discard the hand, let the enemy act, draw anew. */
export function endTurn(state) {
  if (state.phase !== 'battle' || !state.enemy) return;
  while (state.hand.length > 0) state.discard.push(state.hand.pop());
  state.playedAnim = null;
  state.selected = -1;
  enemyAct(state);
  if (state.phase === 'battle') startTurn(state);
}

/** The enemy fell: a reward after battles 1-3, the victory screen after the boss. */
export function winBattle(state) {
  while (state.hand.length > 0) state.discard.push(state.hand.pop());
  state.playedAnim = null;
  state.selected = -1;
  if (state.battleIndex >= 3) {
    state.phase = 'victory';
    state.score = computeScore(state);
    state.log = 'The Pyre Titan falls. The ember is yours.';
  } else {
    state.phase = 'reward';
    state.rewardChoices = rollRewardChoices(state.rng);
    state.log = 'Battle cleared! Choose a card to add to your deck.';
  }
}

/** The player's health reached zero: the run ends on the defeat screen. */
export function loseRun(state) {
  state.phase = 'defeat';
  state.score = computeScore(state);
  state.log = 'The ember fades...';
}

/** Take a reward card into the deck, then open the next battle. */
export function chooseReward(state, choiceIndex) {
  if (state.phase !== 'reward') return false;
  const card = state.rewardChoices[choiceIndex];
  if (!card) return false;
  state.deck.push(card);
  state.rewardChoices = [];
  state.phase = 'battle';
  startBattle(state, state.battleIndex + 1);
  return true;
}

/**
 * The score: all damage dealt, plus the health left standing, plus a bonus
 * for finishing quickly. Shown live during play and broken down on victory.
 */
export function computeScore(state) {
  const turnsBonus = Math.max(0, TURN_BONUS_TURNS - state.totalTurns) * TURN_BONUS_POINTS;
  return state.damageDealt + state.player.hp + turnsBonus;
}

/** The live score during play: damage dealt plus health left, no speed bonus yet. */
export function liveScore(state) {
  return state.damageDealt + state.player.hp;
}

/** A floating combat number, drawn over the table until it fades. */
export function addFloater(state, x, y, text, color) {
  // A small jitter so numbers from one turn never print on top of each other.
  const jx = (state.rng() - 0.5) * 64;
  const jy = (state.rng() - 0.5) * 18;
  state.floaters.push({ x: x + jx, y: y + jy, text, color, t: 0, life: 1.1 });
}

/** Advance the floating numbers and the played-card animation by `dt` seconds. */
export function tickFloaters(state, dt) {
  for (const floater of state.floaters) floater.t += dt;
  state.floaters = state.floaters.filter((floater) => floater.t < floater.life);
  if (state.playedAnim) {
    state.playedAnim.t += dt;
    if (state.playedAnim.t > 0.55) state.playedAnim = null;
  }
}

/** Rebuild a deck from the discard pile (used by the tests). */
export function reshuffleDiscard(state) {
  state.deck = shuffle(state.discard.splice(0), state.rng);
  return state.deck.length;
}

export { makeCard };
