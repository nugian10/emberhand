// Boot and the one loop of EMBERHAND: input is read every frame, the battle
// rules advance on clicks and keys, and the renderer paints what is there.
// The game moves between five screens: title, battle, reward, victory, defeat.
//
// ?seed=N fixes the run's random source. ?shot=1..4 stages that screenshot
// scene by playing the real rules forward from a fresh run, paints it frozen
// and sets window.__shotReady. ?test=1 runs the in-page assertions instead
// of the game and sets window.__testDone.
import { defOf } from './cards.js';
import {
  canPlay,
  chooseReward,
  createRun,
  endTurn,
  playCard,
  startRun,
  tickFloaters,
} from './battle.js';
import { draw } from './render.js';
import { runTests, summarize } from './test.js';
import {
  ENEMY_POS,
  FIELD,
  endTurnRect,
  handCardRect,
  rewardCardRect,
  titleButtonRect,
} from './hud.js';
import {
  ensureAudio,
  isMuted,
  setMuted,
  soundBlock,
  soundClick,
  soundDefeat,
  soundEnemy,
  soundHit,
  soundPlayCard,
  soundReward,
  soundVictory,
} from './audio.js';

const BEST_KEY = 'emberhand.best';

const params = new URLSearchParams(window.location.search);
const shotParam = Number.parseInt(params.get('shot') ?? '', 10);
const testMode = params.get('test') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const debugEl = document.getElementById('debug');
const ctx = canvas.getContext('2d');
canvas.width = FIELD.width;
canvas.height = FIELD.height;

const state = createRun(seed);
state.best = readBest();

const hover = { card: -1, endTurn: false, reward: -1 };
let last = performance.now();
let painted = 0;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function announce(message) {
  statusEl.textContent = message;
}

function fitCanvas() {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
  canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// ---------------------------------------------------------------------------
// Staging: play the real rules forward, with a fixed seed, until the scene
// a screenshot needs. No state is ever hand-written; every frame below is a
// position a real game reaches.
// ---------------------------------------------------------------------------

function cardPriority(def, runState, policy) {
  if (policy === 'reckless') {
    return def.type === 'attack' ? def.damage || 0 : -100;
  }
  if (def.type === 'attack') return 50 + (def.damage || 0);
  if (def.type === 'block') {
    return runState.enemy && runState.enemy.intent && runState.enemy.intent.kind === 'attack'
      ? 40 + (def.block || 0)
      : 5;
  }
  if (def.draw) return 30 + def.draw * 5;
  if (def.energy) return 25;
  return 20;
}

function playHandPolicy(runState, policy) {
  for (let guard = 0; guard < 14; guard += 1) {
    let bestUid = null;
    let bestPri = -Infinity;
    for (const card of runState.hand) {
      const def = defOf(card);
      if (def.cost > runState.player.energy) continue;
      if (policy === 'reckless' && def.type !== 'attack') continue;
      const p = cardPriority(def, runState, policy);
      if (p > bestPri) {
        bestPri = p;
        bestUid = card.uid;
      }
    }
    if (bestUid === null) return;
    const index = runState.hand.findIndex((card) => card.uid === bestUid);
    if (index < 0) return;
    playCard(runState, index);
    if (runState.phase !== 'battle') return;
  }
}

function autoPickReward(runState) {
  let best = 0;
  let bestScore = -1;
  runState.rewardChoices.forEach((card, i) => {
    const def = defOf(card);
    const score = (def.damage || 0) * 2 + (def.block || 0) + (def.draw || 0) * 2;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  chooseReward(runState, best);
}

function simulateRun(runSeed, policy, opts = {}) {
  const runState = createRun(runSeed);
  startRun(runState);
  const stopAt = opts.stopAt || null;
  const autoReward = opts.autoReward !== false;
  let guard = 0;
  while (runState.phase === 'battle' && guard < 80) {
    guard += 1;
    if (stopAt && stopAt(runState)) break;
    playHandPolicy(runState, policy);
    // Time passes between plays, as it does for a real player: the numbers
    // from this turn rise and fade instead of piling up on one spot.
    tickFloaters(runState, 0.5);
    if (runState.phase === 'reward') {
      if (!autoReward) break;
      autoPickReward(runState);
      continue;
    }
    if (runState.phase !== 'battle') break;
    endTurn(runState);
    tickFloaters(runState, 0.8);
    if (runState.phase === 'reward') {
      if (!autoReward) break;
      autoPickReward(runState);
      continue;
    }
    if (stopAt && stopAt(runState)) break;
  }
  return runState;
}

function stageShot(n) {
  if (n === 1) {
    // Cover: mid-battle, a few turns in, both sides already hurt.
    return simulateRun(11, 'balanced', { stopAt: (s) => s.totalTurns >= 3 });
  }
  if (n === 2) {
    // A card being played: freeze a real strike mid-flight, damage number up.
    const runState = createRun(22);
    startRun(runState);
    const index = runState.hand.findIndex(
      (card) => defOf(card).type === 'attack' && defOf(card).cost <= runState.player.energy,
    );
    if (index >= 0) {
      playCard(runState, index);
      if (runState.playedAnim) runState.playedAnim.t = 0.3;
      for (const floater of runState.floaters) floater.t = 0.35;
    }
    return runState;
  }
  if (n === 3) {
    // Boss battle, player health low, a full hand: try seeds until one lands.
    for (let runSeed = 33; runSeed < 64; runSeed += 1) {
      const runState = simulateRun(runSeed, 'reckless', {
        stopAt: (s) => s.battleIndex === 3 && s.player.hp <= 26,
      });
      if (
        runState.phase === 'battle'
        && runState.battleIndex === 3
        && runState.player.hp > 0
        && runState.player.hp <= 26
        && runState.hand.length === 5
      ) {
        return runState;
      }
    }
    // Fallback: the first seed's boss fight, whatever the health.
    return simulateRun(33, 'reckless', { stopAt: (s) => s.battleIndex === 3 });
  }
  // Reward screen: win the first battle and freeze on the three offers.
  return simulateRun(44, 'balanced', { autoReward: false });
}

function shotSummary(runState, n) {
  return {
    shot: n,
    phase: runState.phase,
    battleIndex: runState.battleIndex,
    enemy: runState.enemy ? runState.enemy.name : null,
    playerHp: runState.player.hp,
    enemyHp: runState.enemy ? runState.enemy.hp : null,
    enemyMaxHp: runState.enemy ? runState.enemy.maxHp : null,
    hand: runState.hand.map((card) => card.defId),
    energy: runState.player.energy,
    score: runState.score,
    floaters: runState.floaters.length,
    floaterDetail: runState.floaters.map((f) => ({ text: f.text, t: f.t, x: f.x, y: f.y })),
    playedAnim: runState.playedAnim ? { defId: runState.playedAnim.card.defId, t: runState.playedAnim.t } : null,
    rewardChoices: runState.rewardChoices.map((card) => card.defId),
  };
}

// ---------------------------------------------------------------------------
// Test mode: ?test=1 runs the assertions and reports them on the page.
// ---------------------------------------------------------------------------

function runTestMode() {
  const results = runTests();
  const summary = summarize(results);
  document.title = `EMBERHAND tests: ${summary}`;
  debugEl.textContent = JSON.stringify({ summary, results }, null, 2);
  announce(`Self-test finished. ${summary}.`);
  // Paint the results on the canvas as well.
  ctx.fillStyle = '#14100c';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`EMBERHAND self-test — ${summary}`, 40, 48);
  ctx.font = '16px system-ui, sans-serif';
  let y = 92;
  for (const result of results) {
    ctx.fillStyle = result.pass ? '#8be28b' : '#ff6b5e';
    ctx.fillText(result.pass ? 'PASS' : 'FAIL', 40, y);
    ctx.fillStyle = '#e8e2d4';
    ctx.fillText(result.name, 110, y);
    if (result.detail) {
      ctx.fillStyle = '#9aa3ad';
      ctx.fillText(result.detail, 110, y + 18);
      y += 18;
    }
    y += 26;
  }
  window.__testDone = true;
  window.__testResults = results;
}

// ---------------------------------------------------------------------------
// Input: mouse and keyboard, in logical 1280x720 coordinates.
// ---------------------------------------------------------------------------

function logicalPos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * FIELD.width,
    y: ((event.clientY - rect.top) / rect.height) * FIELD.height,
  };
}

function inside(pos, rect) {
  return pos.x >= rect.x && pos.x <= rect.x + rect.w && pos.y >= rect.y && pos.y <= rect.y + rect.h;
}

function updateHover(pos) {
  hover.card = -1;
  hover.endTurn = false;
  hover.reward = -1;
  if (state.phase === 'battle') {
    for (let i = 0; i < state.hand.length; i += 1) {
      if (inside(pos, handCardRect(i, state.hand.length, state.selected, -1))) hover.card = i;
    }
    if (inside(pos, endTurnRect())) hover.endTurn = true;
  } else if (state.phase === 'reward') {
    for (let i = 0; i < state.rewardChoices.length; i += 1) {
      if (inside(pos, rewardCardRect(i))) hover.reward = i;
    }
  }
}

function playCardAt(index) {
  if (!canPlay(state, index)) {
    soundBlock();
    return;
  }
  const def = defOf(state.hand[index]);
  playCard(state, index);
  if (def.damage) soundHit();
  else soundPlayCard();
  if (state.phase === 'reward') {
    soundReward();
    announce('Battle cleared! Choose a card.');
  } else if (state.phase === 'victory') {
    soundVictory();
    announce(`Victory! Score ${state.score}.`);
    if (state.score > state.best) {
      state.best = state.score;
      saveBest(state.best);
    }
  }
}

function doEndTurn() {
  endTurn(state);
  if (state.phase === 'battle') {
    soundEnemy();
    announce(`Turn ${state.turn}. ${state.enemy ? state.enemy.name : ''} intends: ${state.enemy && state.enemy.intent ? state.enemy.intent.kind : ''}.`);
  } else if (state.phase === 'reward') {
    soundReward();
    announce('Battle cleared! Choose a card.');
  } else if (state.phase === 'defeat') {
    soundDefeat();
    announce(`Defeat. Score ${state.score}.`);
    if (state.score > state.best) {
      state.best = state.score;
      saveBest(state.best);
    }
  }
}

function beginRun() {
  ensureAudio();
  startRun(state);
  announce(`Battle 1: ${state.enemy.name}. Your turn.`);
  soundClick();
}

canvas.addEventListener('mousemove', (event) => {
  updateHover(logicalPos(event));
});

canvas.addEventListener('click', (event) => {
  ensureAudio();
  const pos = logicalPos(event);
  if (state.phase === 'title') {
    if (inside(pos, titleButtonRect())) beginRun();
    return;
  }
  if (state.phase === 'battle') {
    if (inside(pos, endTurnRect())) {
      doEndTurn();
      return;
    }
    for (let i = 0; i < state.hand.length; i += 1) {
      if (inside(pos, handCardRect(i, state.hand.length, state.selected, -1))) {
        if (state.selected === i) playCardAt(i);
        else {
          state.selected = i;
          soundClick();
        }
        return;
      }
    }
    // Clicking the enemy plays the selected card.
    const dx = pos.x - ENEMY_POS.x;
    const dy = pos.y - ENEMY_POS.y;
    if (dx * dx + dy * dy <= ENEMY_POS.r * ENEMY_POS.r && state.selected >= 0) {
      playCardAt(state.selected);
    }
    return;
  }
  if (state.phase === 'reward') {
    for (let i = 0; i < state.rewardChoices.length; i += 1) {
      if (inside(pos, rewardCardRect(i))) {
        chooseReward(state, i);
        soundClick();
        announce(`Battle ${state.battleIndex + 1}: ${state.enemy.name}. Your turn.`);
        return;
      }
    }
    return;
  }
  if (state.phase === 'victory' || state.phase === 'defeat') {
    beginRun();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  const key = event.key.toLowerCase();
  if (key === 'm') {
    setMuted(!isMuted());
    announce(isMuted() ? 'Muted.' : 'Sound on.');
    return;
  }
  if (state.phase === 'title' && (key === 'enter' || key === ' ')) {
    beginRun();
    return;
  }
  if (state.phase === 'battle') {
    if (key >= '1' && key <= '5') {
      const index = Number.parseInt(key, 10) - 1;
      if (index < state.hand.length) {
        ensureAudio();
        playCardAt(index);
      }
      return;
    }
    if (key === 'e' || key === 'enter' || key === ' ') {
      ensureAudio();
      doEndTurn();
    }
    return;
  }
  if (state.phase === 'reward' && key >= '1' && key <= '3') {
    const index = Number.parseInt(key, 10) - 1;
    if (index < state.rewardChoices.length) {
      ensureAudio();
      chooseReward(state, index);
      soundClick();
    }
    return;
  }
  if ((state.phase === 'victory' || state.phase === 'defeat') && (key === 'r' || key === 'enter' || key === ' ')) {
    beginRun();
  }
});

// ---------------------------------------------------------------------------
// The loop.
// ---------------------------------------------------------------------------

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  tickFloaters(state, dt);
  draw(ctx, state, now / 1000, hover);
}

if (testMode) {
  runTestMode();
} else if (Number.isInteger(shotParam) && shotParam >= 1 && shotParam <= 4) {
  const staged = stageShot(shotParam);
  Object.assign(state, staged);
  state.best = readBest();
  const summary = shotSummary(state, shotParam);
  debugEl.textContent = JSON.stringify(summary, null, 2);
  document.title = `EMBERHAND shot ${shotParam}: ${summary.phase} ${summary.enemy || ''} HP ${summary.playerHp}`;
  announce(`Screenshot scene ${shotParam}: ${summary.phase}.`);
  // Frozen frame: paint a few times so fonts and layout settle, then signal.
  function paintShot() {
    draw(ctx, state, 1.2, hover);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paintShot);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paintShot);
} else {
  announce('Emberhand. Press Enter or click Begin the Run.');
  requestAnimationFrame(frame);
}
