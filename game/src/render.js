// The renderer of EMBERHAND: everything the player sees, painted on one
// canvas at a fixed 1280x720 logical size and scaled to the window. The table,
// the enemy creature, the fanned hand, the floating damage numbers and every
// screen are drawn here from the battle state — nothing is an image file.
import { CARD_TYPES, defOf } from './cards.js';
import { computeScore } from './battle.js';
import {
  CARD_H,
  CARD_W,
  ENEMY_POS,
  FIELD,
  drawEndTurnButton,
  drawIntentBadge,
  drawLogLine,
  drawPiles,
  drawPlayerPanel,
  drawTopBar,
  handCardRect,
  rewardCardRect,
  roundRect,
  titleButtonRect,
} from './hud.js';

/** Paint the whole frame for the state's current phase. */
export function draw(ctx, state, time, hover) {
  ctx.save();
  drawTable(ctx, time);
  if (state.phase === 'title') {
    drawTitle(ctx, state, time);
  } else if (state.phase === 'battle') {
    drawBattle(ctx, state, time, hover);
  } else if (state.phase === 'reward') {
    drawBattleBackdrop(ctx, state, time);
    drawReward(ctx, state, hover);
  } else if (state.phase === 'victory') {
    drawBattleBackdrop(ctx, state, time);
    drawVictory(ctx, state);
  } else if (state.phase === 'defeat') {
    drawBattleBackdrop(ctx, state, time);
    drawDefeat(ctx, state);
  }
  ctx.restore();
}

/** The ember table: a dark felt with a warm glow and a thin gold border. */
function drawTable(ctx, time) {
  const g = ctx.createRadialGradient(640, 300, 60, 640, 360, 760);
  g.addColorStop(0, '#3a2118');
  g.addColorStop(0.55, '#241610');
  g.addColorStop(1, '#120a07');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  // Drifting embers.
  for (let i = 0; i < 24; i += 1) {
    const x = (i * 173 + 40) % FIELD.width;
    const y = (FIELD.height - ((time * (12 + i * 2) + i * 97) % (FIELD.height + 40))) % FIELD.height;
    const alpha = 0.12 + 0.1 * Math.sin(time * 1.3 + i);
    ctx.fillStyle = `rgba(255,${140 + (i % 3) * 30},60,${Math.max(0.04, alpha)})`;
    ctx.beginPath();
    ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,179,71,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, FIELD.width - 20, FIELD.height - 20);
}

/** The battle scene: enemy, player panel, hand, buttons and floaters. */
function drawBattle(ctx, state, time, hover) {
  drawBattleBackdrop(ctx, state, time);
  drawTopBar(ctx, state);
  drawPlayerPanel(ctx, state);
  drawPiles(ctx, state);
  drawEndTurnButton(ctx, state, hover.endTurn);
  drawLogLine(ctx, state);
  drawHand(ctx, state, hover);
  drawPlayedAnim(ctx, state);
  drawFloaters(ctx, state);
}

/** The enemy and its health bar, without the hand or buttons. */
function drawBattleBackdrop(ctx, state, time) {
  if (!state.enemy) return;
  drawEnemy(ctx, state.enemy, time);
  drawEnemyHealth(ctx, state.enemy);
  drawIntentBadge(ctx, state.enemy);
}

function drawEnemyHealth(ctx, enemy) {
  const x = ENEMY_POS.x - 130;
  const y = ENEMY_POS.y + ENEMY_POS.r - 6;
  const w = 260;
  const h = 20;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, x - 6, y - 26, w + 12, 56, 8);
  ctx.fill();
  ctx.fillStyle = '#e8e2d4';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(enemy.name, ENEMY_POS.x, y - 14);
  ctx.fillStyle = '#2a0d0a';
  roundRect(ctx, x, y, w, h, 5);
  ctx.fill();
  const frac = Math.max(0, enemy.hp / enemy.maxHp);
  ctx.fillStyle = '#e2574c';
  if (frac > 0) {
    roundRect(ctx, x, y, w * frac, h, 5);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`${enemy.hp} / ${enemy.maxHp}`, ENEMY_POS.x, y + h / 2 + 1);
  // Block, strength and burn badges under the bar.
  let bx = ENEMY_POS.x - 52;
  ctx.font = 'bold 13px system-ui, sans-serif';
  if (enemy.block > 0) {
    drawBadge(ctx, bx, y + 34, `Block ${enemy.block}`, '#3fa7a0');
    bx += 56;
  }
  if (enemy.strength > 0) {
    drawBadge(ctx, bx, y + 34, `+${enemy.strength} STR`, '#ffb347');
    bx += 72;
  }
  if (enemy.burn > 0) {
    drawBadge(ctx, bx, y + 34, `Burn ${enemy.burn}`, '#ff9a3c');
    bx += 72;
  }
  if (enemy.weak > 0) {
    drawBadge(ctx, bx, y + 34, `Weak ${enemy.weak}`, '#c9b8ff');
  }
  ctx.textAlign = 'left';
}

function drawBadge(ctx, x, y, text, color) {
  ctx.fillStyle = color;
  ctx.font = 'bold 13px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 16;
  roundRect(ctx, x, y - 11, w, 22, 11);
  ctx.fill();
  ctx.fillStyle = '#1c0f08';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, y + 1);
  ctx.textAlign = 'left';
}

/** The enemy creature: a glowing ember silhouette, one shape per kind. */
function drawEnemy(ctx, enemy, time) {
  const bob = Math.sin(time * 1.8) * 6;
  const cx = ENEMY_POS.x;
  const cy = ENEMY_POS.y + bob;
  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 150);
  glow.addColorStop(0, enemy.glow + '55');
  glow.addColorStop(1, enemy.glow + '00');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 150, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = enemy.color;
  ctx.strokeStyle = enemy.dark;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  if (enemy.shape === 'imp') {
    // Small horned body with a wide grin.
    ctx.beginPath();
    ctx.moveTo(cx - 52, cy + 62);
    ctx.quadraticCurveTo(cx - 66, cy - 30, cx, cy - 58);
    ctx.quadraticCurveTo(cx + 66, cy - 30, cx + 52, cy + 62);
    ctx.quadraticCurveTo(cx, cy + 82, cx - 52, cy + 62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawHorns(ctx, cx, cy - 52, enemy.dark);
    drawEyes(ctx, cx - 22, cy - 12, cx + 22, cy - 12, 9, '#ffe9a8');
    ctx.strokeStyle = enemy.dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy + 26);
    ctx.quadraticCurveTo(cx, cy + 42, cx + 24, cy + 26);
    ctx.stroke();
  } else if (enemy.shape === 'wolf') {
    // A crouched wolf head: pointed ears, long snout.
    ctx.beginPath();
    ctx.moveTo(cx - 78, cy + 30);
    ctx.lineTo(cx - 62, cy - 62);
    ctx.lineTo(cx - 28, cy - 30);
    ctx.lineTo(cx + 28, cy - 30);
    ctx.lineTo(cx + 62, cy - 62);
    ctx.lineTo(cx + 78, cy + 30);
    ctx.quadraticCurveTo(cx + 40, cy + 74, cx, cy + 74);
    ctx.quadraticCurveTo(cx - 40, cy + 74, cx - 78, cy + 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawEyes(ctx, cx - 26, cy - 6, cx + 26, cy - 6, 8, '#ffe9a8');
    ctx.fillStyle = enemy.dark;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 34, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.shape === 'wraith') {
    // A hooded wisp with a hollow face and trailing smoke.
    ctx.beginPath();
    ctx.moveTo(cx - 58, cy + 78);
    ctx.quadraticCurveTo(cx - 70, cy - 40, cx, cy - 66);
    ctx.quadraticCurveTo(cx + 70, cy - 40, cx + 58, cy + 78);
    ctx.quadraticCurveTo(cx + 30, cy + 56, cx, cy + 78);
    ctx.quadraticCurveTo(cx - 30, cy + 56, cx - 58, cy + 78);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#12081f';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8, 34, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    drawEyes(ctx, cx - 14, cy - 10, cx + 14, cy - 10, 6, '#c9b8ff');
  } else {
    // The Pyre Titan: a broad crowned giant wreathed in flame.
    ctx.beginPath();
    ctx.moveTo(cx - 84, cy + 78);
    ctx.lineTo(cx - 70, cy - 40);
    ctx.lineTo(cx - 34, cy - 58);
    ctx.lineTo(cx, cy - 78);
    ctx.lineTo(cx + 34, cy - 58);
    ctx.lineTo(cx + 70, cy - 40);
    ctx.lineTo(cx + 84, cy + 78);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawHorns(ctx, cx, cy - 66, enemy.dark);
    ctx.fillStyle = '#ff6b4a';
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy - 78);
    ctx.quadraticCurveTo(cx - 18, cy - 104, cx - 6, cy - 84);
    ctx.quadraticCurveTo(cx, cy - 108, cx + 8, cy - 84);
    ctx.quadraticCurveTo(cx + 22, cy - 102, cx + 30, cy - 78);
    ctx.closePath();
    ctx.fill();
    drawEyes(ctx, cx - 26, cy - 18, cx + 26, cy - 18, 10, '#ffe9a8');
    ctx.strokeStyle = enemy.dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy + 34);
    ctx.lineTo(cx + 28, cy + 34);
    ctx.stroke();
  }
}

function drawHorns(ctx, cx, topY, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - 46, topY + 16);
  ctx.quadraticCurveTo(cx - 66, topY - 14, cx - 52, topY - 30);
  ctx.quadraticCurveTo(cx - 40, topY - 8, cx - 30, topY + 14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 46, topY + 16);
  ctx.quadraticCurveTo(cx + 66, topY - 14, cx + 52, topY - 30);
  ctx.quadraticCurveTo(cx + 40, topY - 8, cx + 30, topY + 14);
  ctx.closePath();
  ctx.fill();
}

function drawEyes(ctx, x1, y1, x2, y2, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x1, y1, r, 0, Math.PI * 2);
  ctx.arc(x2, y2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c0f08';
  ctx.beginPath();
  ctx.arc(x1, y1, r * 0.45, 0, Math.PI * 2);
  ctx.arc(x2, y2, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

/** The player's fanned hand, with the hovered and selected cards lifted. */
function drawHand(ctx, state, hover) {
  const count = state.hand.length;
  for (let i = 0; i < count; i += 1) {
    const rect = handCardRect(i, count, state.selected, hover.card);
    const playable = defOf(state.hand[i]).cost <= state.player.energy;
    drawCardFace(ctx, state.hand[i], rect, {
      playable,
      selected: i === state.selected,
      dimmed: !playable,
    });
    // Hotkey number under each card.
    ctx.fillStyle = '#9aa3ad';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), rect.x + rect.w / 2, rect.y + rect.h + 14);
    ctx.textAlign = 'left';
  }
}

/**
 * One card face: coloured header, cost gem, name, a drawn suit glyph, the
 * rules text and the type label. Colour and shape carry the type, never text
 * alone.
 */
export function drawCardFace(ctx, card, rect, opts = {}) {
  const def = defOf(card);
  const type = CARD_TYPES[def.type];
  const { x, y, w, h } = rect;
  ctx.save();
  if (opts.dimmed) ctx.globalAlpha = 0.55;
  ctx.shadowColor = opts.selected ? '#ffb347' : 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = opts.selected ? 22 : 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#f5efe2';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // Header band in the type colour.
  ctx.fillStyle = type.color;
  roundRect(ctx, x, y, w, 44, 10);
  ctx.fill();
  ctx.fillRect(x, y + 34, w, 10);
  // Cost gem.
  ctx.fillStyle = '#1c2b4a';
  ctx.beginPath();
  ctx.arc(x + 24, y + 24, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(def.cost), x + 24, y + 25);
  // Name.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(def.name, x + 46, y + 24);
  // Suit glyph in the middle.
  drawSuitGlyph(ctx, def.type, x + w / 2, y + 96, type.color);
  // Rules text.
  ctx.fillStyle = '#2a2118';
  ctx.font = '13px system-ui, sans-serif';
  wrapText(ctx, def.text, x + 12, y + 148, w - 24, 17);
  // Type label at the bottom.
  ctx.fillStyle = type.dark;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(type.label, x + w / 2, y + h - 12);
  ctx.textAlign = 'left';
  ctx.restore();
}

/** The suit glyph: sword for attack, shield for guard, flame for skill. */
function drawSuitGlyph(ctx, type, cx, cy, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (type === 'attack') {
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + 16);
    ctx.lineTo(cx + 16, cy - 16);
    ctx.moveTo(cx - 8, cy + 22);
    ctx.lineTo(cx + 22, cy - 8);
    ctx.moveTo(cx - 22, cy + 8);
    ctx.lineTo(cx - 8, cy + 22);
    ctx.stroke();
  } else if (type === 'block') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 22);
    ctx.lineTo(cx + 18, cy - 14);
    ctx.lineTo(cx + 18, cy + 4);
    ctx.quadraticCurveTo(cx + 18, cy + 18, cx, cy + 24);
    ctx.quadraticCurveTo(cx - 18, cy + 18, cx - 18, cy + 4);
    ctx.lineTo(cx - 18, cy - 14);
    ctx.closePath();
    ctx.stroke();
  } else {
    // Flame: a teardrop with an inner tongue.
    ctx.beginPath();
    ctx.moveTo(cx, cy - 24);
    ctx.quadraticCurveTo(cx + 18, cy - 2, cx + 12, cy + 12);
    ctx.quadraticCurveTo(cx + 6, cy + 24, cx, cy + 24);
    ctx.quadraticCurveTo(cx - 6, cy + 24, cx - 12, cy + 12);
    ctx.quadraticCurveTo(cx - 18, cy - 2, cx, cy - 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5efe2';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.quadraticCurveTo(cx + 8, cy + 6, cx + 4, cy + 14);
    ctx.quadraticCurveTo(cx, cy + 18, cx - 4, cy + 14);
    ctx.quadraticCurveTo(cx - 8, cy + 6, cx, cy - 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

/** The card just played, sliding from the hand toward the enemy. */
function drawPlayedAnim(ctx, state) {
  const anim = state.playedAnim;
  if (!anim) return;
  const p = Math.min(1, anim.t / 0.55);
  const from = { x: 640 - 75, y: 500 };
  const to = { x: 640 - 75, y: 180 };
  const x = from.x + (to.x - from.x) * p;
  const y = from.y + (to.y - from.y) * p;
  ctx.save();
  ctx.globalAlpha = 1 - p * 0.55;
  drawCardFace(ctx, anim.card, { x, y, w: CARD_W, h: CARD_H }, {});
  ctx.restore();
}

/** Floating damage and effect numbers rising over the table. */
function drawFloaters(ctx, state) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const floater of state.floaters) {
    const p = floater.t / floater.life;
    const alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y - p * 46);
  }
  ctx.restore();
}

/** Title screen: the name, the promise, the controls, the best score. */
function drawTitle(ctx, state, time) {
  // A decorative fanned hand behind the title.
  const demo = ['strike', 'flame', 'guard', 'kindle', 'smash'].map((defId, i) => ({ uid: 900 + i, defId }));
  for (let i = 0; i < demo.length; i += 1) {
    const rect = handCardRect(i, demo.length, -1, -1);
    rect.y = 470 + Math.sin(time * 1.2 + i) * 4;
    drawCardFace(ctx, demo[i], rect, {});
  }
  ctx.fillStyle = 'rgba(10,5,3,0.55)';
  ctx.fillRect(0, 0, FIELD.width, 330);
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EMBERHAND', FIELD.width / 2, 120);
  ctx.fillStyle = '#f5efe2';
  ctx.font = '26px system-ui, sans-serif';
  ctx.fillText('A roguelike card battler', FIELD.width / 2, 178);
  ctx.fillStyle = '#c9b8a8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Battle four ember creatures. Spend energy, play cards, read the enemy intent —', FIELD.width / 2, 224);
  ctx.fillText('and take the Pyre Titan’s crown before your own ember fades.', FIELD.width / 2, 248);
  const btn = titleButtonRect();
  const pulse = 0.75 + 0.25 * Math.sin(time * 2.4);
  ctx.fillStyle = `rgba(255,179,71,${pulse})`;
  roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
  ctx.fill();
  ctx.fillStyle = '#1c0f08';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('BEGIN THE RUN', FIELD.width / 2, btn.y + btn.h / 2 + 1);
  ctx.fillStyle = '#9aa3ad';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Click a card to select it, click the enemy to play it  •  Keys 1-5 play cards  •  E ends the turn  •  M mutes', FIELD.width / 2, 606);
  if (state.best > 0) {
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`Best score: ${state.best}`, FIELD.width / 2, 640);
  }
  ctx.textAlign = 'left';
}

/** Reward screen: three cards to choose from after a cleared battle. */
function drawReward(ctx, state, hover) {
  ctx.fillStyle = 'rgba(10,5,3,0.88)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BATTLE CLEARED!', FIELD.width / 2, 150);
  ctx.fillStyle = '#f5efe2';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Choose one card to add to your deck', FIELD.width / 2, 200);
  ctx.fillStyle = '#9aa3ad';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`Deck: ${state.deck.length + state.hand.length + state.discard.length} cards`, FIELD.width / 2, 228);
  for (let i = 0; i < state.rewardChoices.length; i += 1) {
    const rect = rewardCardRect(i);
    if (i === hover.reward) {
      rect.y -= 10;
    }
    drawCardFace(ctx, state.rewardChoices[i], rect, { selected: i === hover.reward });
  }
  ctx.textAlign = 'left';
}

/** Victory screen with the score broken down. */
function drawVictory(ctx, state) {
  drawEndScreen(ctx, '#ffd94d', 'VICTORY', 'The Pyre Titan falls. The ember is yours, Ember Knight.', state);
}

/** Defeat screen with the score and a retry prompt. */
function drawDefeat(ctx, state) {
  drawEndScreen(ctx, '#e2574c', 'DEFEAT', 'The ember fades... but a knight always rises again.', state);
}

function drawEndScreen(ctx, color, title, subtitle, state) {
  ctx.fillStyle = 'rgba(10,5,3,0.86)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = color;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, FIELD.width / 2, 170);
  ctx.fillStyle = '#f5efe2';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(subtitle, FIELD.width / 2, 224);
  const turnsBonus = Math.max(0, 30 - state.totalTurns) * 10;
  const lines = [
    ['Damage dealt', state.damageDealt],
    ['Health remaining', state.player.hp],
    [`Speed bonus (${state.totalTurns} turns)`, turnsBonus],
    ['TOTAL SCORE', state.score],
  ];
  ctx.font = '18px system-ui, sans-serif';
  let y = 300;
  for (const [label, value] of lines) {
    const bold = label === 'TOTAL SCORE';
    ctx.font = `${bold ? 'bold ' : ''}20px system-ui, sans-serif`;
    ctx.fillStyle = bold ? '#ffd94d' : '#e8e2d4';
    ctx.textAlign = 'right';
    ctx.fillText(label, FIELD.width / 2 - 10, y);
    ctx.textAlign = 'left';
    ctx.fillText(String(value), FIELD.width / 2 + 10, y);
    y += 38;
  }
  ctx.fillStyle = '#9aa3ad';
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Press R or click to play again', FIELD.width / 2, y + 30);
  ctx.textAlign = 'left';
}
