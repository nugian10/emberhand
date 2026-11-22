// The HUD of EMBERHAND: the table furniture around the fight — the top bar
// with the battle and the score, the player's health and energy, the deck and
// discard piles, the End Turn button, and the enemy's intent badge. The layout
// numbers live here so the renderer and the input code agree on every rect.
import { intentText } from './enemies.js';
import { liveScore } from './battle.js';

export const FIELD = { width: 1280, height: 720 };

export const CARD_W = 150;
export const CARD_H = 205;
export const CARD_GAP = 12;
export const HAND_Y = 500;

export const ENEMY_POS = { x: 640, y: 235, r: 118 };

/** Rect of the hand card at `index` of `count`, lifted when selected/hovered. */
export function handCardRect(index, count, selected, hovered) {
  const total = count * CARD_W + (count - 1) * CARD_GAP;
  const x = (FIELD.width - total) / 2 + index * (CARD_W + CARD_GAP);
  let y = HAND_Y;
  if (index === selected) y -= 28;
  else if (index === hovered) y -= 12;
  return { x, y, w: CARD_W, h: CARD_H };
}

/** Rect of a reward card on the reward screen. */
export function rewardCardRect(index) {
  const w = 172;
  const h = 234;
  const gap = 28;
  const total = 3 * w + 2 * gap;
  const x = (FIELD.width - total) / 2 + index * (w + gap);
  return { x, y: 268, w, h };
}

/** The End Turn button, top right under the top bar. */
export function endTurnRect() {
  return { x: 1104, y: 60, w: 140, h: 48 };
}

export function titleButtonRect() {
  return { x: 490, y: 520, w: 300, h: 56 };
}

/** The whole top bar: battle progress on the left, score on the right. */
export function drawTopBar(ctx, state) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, FIELD.width, 46);
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const battle = state.enemy ? state.enemy.title : 'Emberhand';
  ctx.fillText(battle.toUpperCase(), 20, 24);
  ctx.fillStyle = '#e8e2d4';
  ctx.textAlign = 'right';
  ctx.fillText(`SCORE  ${liveScore(state)}`, FIELD.width - 20, 24);
  ctx.textAlign = 'left';
}

/** Health bar, block badge and energy pips for the player, top left. */
export function drawPlayerPanel(ctx, state) {
  const { hp, maxHp, block, energy } = state.player;
  const x = 28;
  const y = 104;
  const w = 280;
  const h = 24;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, x - 8, y - 34, w + 16, 66, 10);
  ctx.fill();
  // Energy pips.
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.arc(x + 14 + i * 30, y - 18, 11, 0, Math.PI * 2);
    ctx.fillStyle = i < energy ? '#ffb347' : 'rgba(255,255,255,0.14)';
    ctx.fill();
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ENERGY', x + 168, y - 18);
  // Health bar.
  ctx.fillStyle = '#3a1512';
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  const frac = Math.max(0, hp / maxHp);
  ctx.fillStyle = frac > 0.5 ? '#e2574c' : frac > 0.25 ? '#e08a3c' : '#c22e2e';
  if (frac > 0) {
    roundRect(ctx, x, y, w * frac, h, 6);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${hp} / ${maxHp} HP`, x + w / 2, y + h / 2 + 1);
  ctx.textAlign = 'left';
  if (block > 0) {
    ctx.fillStyle = '#3fa7a0';
    ctx.beginPath();
    ctx.arc(x + w + 26, y + h / 2, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(block), x + w + 26, y + h / 2 + 1);
    ctx.textAlign = 'left';
  }
}

/** Deck and discard counts, drawn as two small card backs, bottom right. */
export function drawPiles(ctx, state) {
  const y = 636;
  drawPile(ctx, 1152, y, state.deck.length, '#2a2118', 'DECK');
  drawPile(ctx, 1216, y, state.discard.length, '#33241d', 'DISCARD');
}

function drawPile(ctx, x, y, count, color, label) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, 52, 68, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,179,71,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#e8e2d4';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(count), x + 26, y + 30);
  ctx.fillStyle = '#9aa3ad';
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillText(label, x + 26, y + 52);
  ctx.textAlign = 'left';
}

/** The End Turn button, top right above the piles. */
export function drawEndTurnButton(ctx, state, hovered) {
  const r = endTurnRect();
  ctx.fillStyle = hovered ? '#ffb347' : '#c96a1e';
  roundRect(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.fill();
  ctx.fillStyle = '#1c0f08';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('END TURN  [E]', r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.textAlign = 'left';
}

/** The enemy's intent badge: icon plus value, floating above the enemy. */
export function drawIntentBadge(ctx, enemy) {
  if (!enemy || !enemy.intent) return;
  const cx = ENEMY_POS.x;
  const cy = 96;
  const intent = enemy.intent;
  const colors = { attack: '#e2574c', block: '#3fa7a0', strength: '#ffb347' };
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors[intent.kind] || '#e8e2d4';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = colors[intent.kind] || '#e8e2d4';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (intent.kind === 'attack') {
    // Sword: a diagonal blade with a crossguard, drawn as strokes.
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy + 9);
    ctx.lineTo(cx + 9, cy - 9);
    ctx.moveTo(cx - 4, cy + 12);
    ctx.lineTo(cx + 12, cy - 4);
    ctx.moveTo(cx - 12, cy + 4);
    ctx.lineTo(cx - 4, cy + 12);
    ctx.stroke();
  } else if (intent.kind === 'block') {
    // Shield: a small shield outline.
    ctx.beginPath();
    ctx.moveTo(cx, cy - 11);
    ctx.lineTo(cx + 9, cy - 7);
    ctx.lineTo(cx + 9, cy + 2);
    ctx.quadraticCurveTo(cx + 9, cy + 9, cx, cy + 12);
    ctx.quadraticCurveTo(cx - 9, cy + 9, cx - 9, cy + 2);
    ctx.lineTo(cx - 9, cy - 7);
    ctx.closePath();
    ctx.stroke();
  } else {
    // Strength: an upward chevron.
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + 6);
    ctx.lineTo(cx, cy - 8);
    ctx.lineTo(cx + 10, cy + 6);
    ctx.moveTo(cx - 10, cy + 12);
    ctx.lineTo(cx, cy - 2);
    ctx.lineTo(cx + 10, cy + 12);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(intentText(intent), cx, cy + 48);
  ctx.textAlign = 'left';
}

/** The one-line log under the table, for the latest event. */
export function drawLogLine(ctx, state) {
  ctx.fillStyle = '#9aa3ad';
  ctx.font = 'italic 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.log, FIELD.width / 2, 486);
  ctx.textAlign = 'left';
}

/** Rounded-rectangle path helper, shared with the renderer. */
export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
