// Card definitions for EMBERHAND: every card the game can deal, draw or offer.
// A card is pure data: its effect is a small descriptor that battle.js interprets,
// so the rules live in one place and the tests can check them without a canvas.
export const CARD_TYPES = {
  attack: { label: 'ATTACK', color: '#e2574c', dark: '#8e2f27' },
  block: { label: 'GUARD', color: '#3fa7a0', dark: '#1f5f5a' },
  skill: { label: 'SKILL', color: '#7a68d8', dark: '#463a86' },
};

// id: name, cost in energy, type, short rules text, effect descriptor.
// damage: dealt to the enemy. block: gained by the player. draw: cards drawn.
// energy: energy gained this turn. burn: burn stacks put on the enemy.
// heal: hit points restored to the player. weak: weak stacks put on the enemy
// (each stack cuts the enemy's next attack by 2, then one stack is spent).
export const CARD_DEFS = {
  strike: { name: 'Ember Strike', cost: 1, type: 'attack', text: 'Deal 6 damage.', damage: 6 },
  guard: { name: 'Ash Guard', cost: 1, type: 'block', text: 'Gain 6 Block.', block: 6 },
  spark: { name: 'Spark', cost: 0, type: 'attack', text: 'Deal 3 damage.', damage: 3 },
  flame: { name: 'Flame Lash', cost: 2, type: 'attack', text: 'Deal 10 damage. Apply 3 Burn.', damage: 10, burn: 3 },
  kindle: { name: 'Kindle', cost: 0, type: 'skill', text: 'Draw 2 cards.', draw: 2 },
  smash: { name: 'Cinder Smash', cost: 2, type: 'attack', text: 'Deal 12 damage.', damage: 12 },
  ward: { name: 'Ember Ward', cost: 1, type: 'block', text: 'Gain 9 Block.', block: 9 },
  leech: { name: 'Ember Leech', cost: 1, type: 'attack', text: 'Deal 4 damage. Heal 4.', damage: 4, heal: 4 },
  inner: { name: 'Inner Fire', cost: 1, type: 'skill', text: 'Gain 2 Energy.', energy: 2 },
  veil: { name: 'Smoke Veil', cost: 1, type: 'skill', text: 'Apply 2 Weak to the enemy.', weak: 2 },
  wildfire: { name: 'Wildfire', cost: 2, type: 'attack', text: 'Deal 8 damage. Apply 5 Burn.', damage: 8, burn: 5 },
  rally: { name: 'Rally Cry', cost: 0, type: 'skill', text: 'Gain 4 Block. Draw 1 card.', block: 4, draw: 1 },
};

// The deck a fresh run starts with: 10 cards, a mix that can attack and defend.
export const STARTER_DECK = [
  'strike', 'strike', 'strike', 'strike',
  'guard', 'guard', 'guard',
  'spark', 'flame', 'kindle',
];

// Cards the reward screen may offer, in the order they are weighted for the draw.
export const REWARD_POOL = [
  'strike', 'guard', 'spark', 'flame', 'kindle', 'smash',
  'ward', 'leech', 'inner', 'veil', 'wildfire', 'rally',
];

let nextUid = 1;

/** A live card: its definition id plus a unique id so two copies stay distinct. */
export function makeCard(defId) {
  return { uid: nextUid, defId };
}

/** The starter deck, shuffled with the run's own random source. */
export function buildStarterDeck(rng) {
  const deck = STARTER_DECK.map(makeCard);
  shuffle(deck, rng);
  return deck;
}

/** Three distinct reward offers, drawn from the pool with the run's random source. */
export function rollRewardChoices(rng) {
  const pool = REWARD_POOL.slice();
  shuffle(pool, rng);
  return pool.slice(0, 3).map(makeCard);
}

/** Fisher-Yates, in place, using the supplied random source. */
export function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

/** The definition behind a live card. */
export function defOf(card) {
  return CARD_DEFS[card.defId];
}
