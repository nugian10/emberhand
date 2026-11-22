// The enemies of EMBERHAND: four original ember creatures, one per battle.
// An enemy is data: hit points, a body colour, a silhouette kind the renderer
// draws, and a weighted list of intents it may show each turn. An intent is
// what the enemy will do on its turn, shown to the player a turn ahead so
// every hand is a decision about what is coming.
export const ENEMY_DEFS = [
  {
    id: 'imp',
    name: 'Cinder Imp',
    title: 'Battle 1 of 4',
    hp: 26,
    color: '#e07840',
    dark: '#7a3a1c',
    glow: '#ffb347',
    shape: 'imp',
    intents: [
      { kind: 'attack', value: 6, weight: 5 },
      { kind: 'attack', value: 8, weight: 2 },
      { kind: 'block', value: 6, weight: 3 },
    ],
  },
  {
    id: 'wolf',
    name: 'Ash Wolf',
    title: 'Battle 2 of 4',
    hp: 36,
    color: '#9a8f7a',
    dark: '#4a4238',
    glow: '#e8dcc0',
    shape: 'wolf',
    intents: [
      { kind: 'attack', value: 8, weight: 5 },
      { kind: 'attack', value: 10, weight: 2 },
      { kind: 'block', value: 8, weight: 2 },
      { kind: 'strength', value: 2, weight: 1 },
    ],
  },
  {
    id: 'wraith',
    name: 'Smoke Wraith',
    title: 'Battle 3 of 4',
    hp: 46,
    color: '#8f7fd8',
    dark: '#3d3470',
    glow: '#c9b8ff',
    shape: 'wraith',
    intents: [
      { kind: 'attack', value: 9, weight: 4 },
      { kind: 'attack', value: 12, weight: 2 },
      { kind: 'block', value: 10, weight: 2 },
      { kind: 'strength', value: 2, weight: 2 },
    ],
  },
  {
    id: 'titan',
    name: 'Pyre Titan',
    title: 'BOSS — Battle 4 of 4',
    hp: 72,
    color: '#d83a2e',
    dark: '#6e130c',
    glow: '#ff6b4a',
    shape: 'titan',
    intents: [
      { kind: 'attack', value: 12, weight: 4 },
      { kind: 'attack', value: 15, weight: 2 },
      { kind: 'block', value: 12, weight: 2 },
      { kind: 'strength', value: 3, weight: 2 },
    ],
  },
];

/** A live enemy: its definition plus the mutable numbers of the fight. */
export function makeEnemy(defIndex) {
  const def = ENEMY_DEFS[defIndex];
  return {
    defIndex,
    id: def.id,
    name: def.name,
    title: def.title,
    hp: def.hp,
    maxHp: def.hp,
    color: def.color,
    dark: def.dark,
    glow: def.glow,
    shape: def.shape,
    block: 0,
    strength: 0,
    burn: 0,
    weak: 0,
    intent: null,
  };
}

/** Roll the enemy's next intent from its weighted list, with the run's random source. */
export function rollIntent(enemy, rng) {
  const def = ENEMY_DEFS[enemy.defIndex];
  let total = 0;
  for (const intent of def.intents) total += intent.weight;
  let pick = rng() * total;
  for (const intent of def.intents) {
    pick -= intent.weight;
    if (pick <= 0) {
      enemy.intent = { kind: intent.kind, value: intent.value };
      return enemy.intent;
    }
  }
  const last = def.intents[def.intents.length - 1];
  enemy.intent = { kind: last.kind, value: last.value };
  return enemy.intent;
}

/** One-line text for an intent, used by the HUD and the screen reader line. */
export function intentText(intent) {
  if (!intent) return '';
  if (intent.kind === 'attack') return `Attacks for ${intent.value}`;
  if (intent.kind === 'block') return `Blocks ${intent.value}`;
  if (intent.kind === 'strength') return `Gains +${intent.value} Strength`;
  return '';
}
