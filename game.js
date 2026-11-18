/* SKY CLUTCH — Cloud9 Booth Aim Challenge
 * Vanilla HTML/CSS/JS. No modules, no fetch, no CDN — the file works
 * from http://localhost and from file:// alike.
 *
 * Game design (Category 3 — Event Mini Game):
 *  - One fast session: 60 seconds (10s with ?debug=fast, for automated tests).
 *  - Pop glowing sky orbs for points; chained pops build a combo multiplier.
 *  - Storm clouds are decoys: clicking one costs 15 points and breaks the combo.
 *  - Golden Clouds are rare: big points + 2 bonus seconds (max 2 per game).
 *  - No lives, instant restart, daily top-10 leaderboard in localStorage.
 *  - ?board=1 opens a big leaderboard display for a second monitor.
 */

'use strict';

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */
const PARAMS = new URLSearchParams(location.search);
const DEBUG_FAST = PARAMS.has('debug') && PARAMS.get('debug') === 'fast';
const BOARD_MODE = PARAMS.get('board') === '1';

const GAME_DURATION = DEBUG_FAST ? 10 : 60;   // seconds
const ORB_POINTS = 10;
const GOLD_POINTS = 50;
const STORM_PENALTY = 15;
const GOLD_TIME_BONUS = 2;                    // seconds
const MAX_GOLD_BONUS = 2;                     // per game
const BOARD_KEY = 'skyclutch_board_v1';
const MAX_BOARD_ENTRIES = 10;

const RANKS = [
  { min: 2200, name: "SKY'S THE LIMIT", top: true },
  { min: 1500, name: 'CLOUD9', top: true },
  { min: 900, name: 'PRO', top: false },
  { min: 400, name: 'SKILLED', top: false },
  { min: 0,   name: 'ROOKIE', top: false },
];

/* ------------------------------------------------------------------ */
/* DOM references                                                      */
/* ------------------------------------------------------------------ */
const byId = (id) => document.getElementById(id);
const stage = byId('stage');
const canvas = byId('gameCanvas');
const ctx = canvas.getContext('2d');
const mascotCanvas = byId('mascotCanvas');
const mctx = mascotCanvas.getContext('2d');
const hud = byId('hud');
const hudScore = byId('hudScore');
const hudCombo = byId('hudCombo');
const hudTimer = byId('hudTimer');
const hudBest = byId('hudBest');
const hudGold = byId('hudGold');
const popupsEl = byId('popups');
const menuScreen = byId('menuScreen');
const overScreen = byId('overScreen');
const boardScreen = byId('boardScreen');
const footerBest = byId('footerBest');

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */
let state = 'menu';            // 'menu' | 'playing' | 'over' | 'board'
let targets = [];              // active targets on the field
let particles = [];            // pop burst particles
let bgClouds = [];             // drifting background clouds (attract mode)
let score = 0;
let combo = 0;
let bestCombo = 0;
let hits = 0;                  // orbs + gold popped
let shots = 0;                 // total field clicks during play
let stormHits = 0;
let goldPopped = 0;
let goldBonusGiven = 0;
let timeLeft = GAME_DURATION;
let elapsed = 0;               // seconds of active play (pauses when hidden)
let lastTick = 0;
let hiddenSince = 0;           // timestamp when tab was hidden mid-game
let nextSpawnAt = 0;
let nextGoldAt = 0;
let lastWholeSecond = GAME_DURATION;
let dailyBest = 0;
let savedThisGame = false;
let muted = false;
let audioCtx = null;

let stageW = 0;
let stageH = 0;
let dpr = 1;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function rand(min, max) { return min + Math.random() * (max - min); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0');
}
function multiplier() { return Math.min(1 + Math.floor(combo / 5), 5); }
function progress() { return clamp(elapsed / GAME_DURATION, 0, 1); }
function rankFor(s) {
  for (const r of RANKS) if (s >= r.min) return r;
  return RANKS[RANKS.length - 1];
}
function orbRadius() {
  return clamp(Math.min(stageW, stageH) / 16, 30, 52);
}

/* ------------------------------------------------------------------ */
/* Audio — everything synthesized with WebAudio, no audio files.       */
/* ------------------------------------------------------------------ */
function ensureAudio() {
  if (!audioCtx) {
    try {
      const AC = window.AudioContext || window['webkitAudioContext']; // legacy Safari fallback
      audioCtx = new AC();
    } catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function tone(freq, dur, type, vol, delay, slideTo) {
  if (!audioCtx || muted) return;
  const t0 = audioCtx.currentTime + (delay || 0);
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol || 0.12, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}
const sfx = {
  pop()   { tone(620, 0.09, 'sine', 0.14, 0, 980); },
  gold()  { tone(880, 0.12, 'sine', 0.14); tone(1108, 0.12, 'sine', 0.14, 0.07); tone(1318, 0.2, 'sine', 0.14, 0.14); },
  storm() { tone(160, 0.28, 'sawtooth', 0.12, 0, 70); },
  click() { tone(1000, 0.05, 'sine', 0.08); },
  tick()  { tone(1250, 0.06, 'square', 0.05); },
  start() { tone(440, 0.1, 'sine', 0.12); tone(880, 0.16, 'sine', 0.12, 0.09); },
  over()  { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'sine', 0.12, i * 0.11)); },
};

/* ------------------------------------------------------------------ */
/* Leaderboard (localStorage, daily, top 10, no network)              */
/* ------------------------------------------------------------------ */
function loadBoard() {
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    const all = raw ? JSON.parse(raw) : [];
    return Array.isArray(all) ? all : [];
  } catch (e) { return []; }
}
function saveBoard(all) {
  try { localStorage.setItem(BOARD_KEY, JSON.stringify(all)); } catch (e) { /* storage full/blocked: board just stays in memory */ }
}
function todayBoard() {
  const key = todayKey();
  return loadBoard()
    .filter((e) => e.date === key)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_BOARD_ENTRIES);
}
function addScore(name, entry) {
  const all = loadBoard();
  all.push(Object.assign({ date: todayKey() }, entry, { name: name }));
  all.sort((a, b) => b.score - a.score);
  saveBoard(all);
  return todayBoard();
}
function clearTodayBoard() {
  const key = todayKey();
  saveBoard(loadBoard().filter((e) => e.date !== key));
}
function refreshDailyBest() {
  const board = todayBoard();
  dailyBest = board.length ? board[0].score : 0;
  hudBest.textContent = String(dailyBest);
  footerBest.textContent = 'Daily best: ' + dailyBest;
}
function renderBoardInto(ol, highlightScore) {
  const board = todayBoard();
  ol.innerHTML = '';
  if (!board.length) {
    const li = document.createElement('li');
    li.className = 'board-empty';
    li.textContent = 'No flights yet today — be the first pilot!';
    ol.appendChild(li);
    return;
  }
  board.forEach((e, i) => {
    const li = document.createElement('li');
    if (highlightScore != null && e.score === highlightScore) li.className = 'me';
    const rank = document.createElement('span');
    rank.className = 'b-rank';
    rank.textContent = (i + 1) + '.';
    const name = document.createElement('span');
    name.className = 'b-name';
    name.textContent = e.name;
    const acc = document.createElement('span');
    acc.className = 'b-acc';
    acc.textContent = e.acc + '% acc';
    const sc = document.createElement('span');
    sc.className = 'b-score';
    sc.textContent = e.score;
    li.append(rank, name, acc, sc);
    ol.appendChild(li);
  });
}
function renderAllBoards(highlightScore) {
  renderBoardInto(byId('miniBoard'), highlightScore);
  renderBoardInto(byId('overBoard'), highlightScore);
  renderBoardInto(byId('bigBoard'), highlightScore);
  byId('boardDate').textContent = todayKey();
}

/* ------------------------------------------------------------------ */
/* Canvas setup + background                                           */
/* ------------------------------------------------------------------ */
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  stageW = stage.clientWidth;
  stageH = stage.clientHeight;
  canvas.width = Math.round(stageW * dpr);
  canvas.height = Math.round(stageH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const t of targets) {
    t.x = clamp(t.x, t.r, stageW - t.r);
    t.y = clamp(t.y, t.r + 70, stageH - t.r);
  }
}
function initBgClouds() {
  bgClouds = [];
  for (let i = 0; i < 7; i++) {
    bgClouds.push({
      x: rand(0, 1200), y: rand(40, 500),
      s: rand(0.5, 1.4), v: rand(6, 18), a: rand(0.05, 0.13),
    });
  }
}
function drawSkyBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, stageH);
  g.addColorStop(0, '#0a2f66');
  g.addColorStop(0.55, '#1a63b8');
  g.addColorStop(1, '#5aa9e6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, stageW, stageH);

  // Sun glow, top right.
  const sg = ctx.createRadialGradient(stageW - 90, 70, 10, stageW - 90, 70, 190);
  sg.addColorStop(0, 'rgba(255, 244, 200, 0.85)');
  sg.addColorStop(0.35, 'rgba(255, 220, 120, 0.28)');
  sg.addColorStop(1, 'rgba(255, 220, 120, 0)');
  ctx.fillStyle = sg;
  ctx.fillRect(stageW - 280, -120, 380, 380);

  // Drifting background clouds.
  for (const c of bgClouds) {
    ctx.save();
    ctx.globalAlpha = c.a;
    ctx.fillStyle = '#ffffff';
    drawCloudShape(c.x, c.y, 60 * c.s);
    ctx.restore();
  }
}
function drawCloudShape(x, y, r) {
  // One soft cloud made of overlapping circles. r = overall radius.
  ctx.beginPath();
  ctx.arc(x - r * 0.55, y + r * 0.12, r * 0.52, 0, Math.PI * 2);
  ctx.arc(x, y - r * 0.28, r * 0.62, 0, Math.PI * 2);
  ctx.arc(x + r * 0.55, y + r * 0.12, r * 0.52, 0, Math.PI * 2);
  ctx.arc(x, y + r * 0.22, r * 0.58, 0, Math.PI * 2);
  ctx.fill();
}

/* ------------------------------------------------------------------ */
/* Targets                                                             */
/* ------------------------------------------------------------------ */
function spawnTarget(forceType) {
  const r = orbRadius();
  const topSafe = 96; // keep clear of the HUD strip
  let x = 0, y = 0, ok = false, tries = 0;
  while (!ok && tries < 12) {
    x = rand(r + 8, stageW - r - 8);
    y = rand(topSafe + r, stageH - r - 8);
    ok = targets.every((t) => Math.hypot(t.x - x, t.y - y) > r * 2.1);
    tries++;
  }
  const p = progress();
  let type = forceType;
  if (!type) {
    const roll = Math.random();
    type = roll < 0.18 + p * 0.08 ? 'storm' : 'orb';
  }
  const speed = (18 + p * 75) * rand(0.7, 1.3);
  const ang = rand(0, Math.PI * 2);
  const life = type === 'gold' ? 2600 : Math.max(1500 - p * 500, 950);
  targets.push({
    type, x, y, r: type === 'gold' ? r * 1.15 : r,
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    born: performance.now(), life, seed: rand(0, Math.PI * 2),
  });
}
function spawnGoldIfDue(now) {
  if (now >= nextGoldAt) {
    spawnTarget('gold');
    nextGoldAt = now + rand(12000, 18000);
  }
}
function drawTarget(t, now) {
  const age = now - t.born;
  const remain = t.life - age;
  let scale = 1;
  if (age < 140) scale = 0.6 + 0.4 * (age / 140);          // pop-in
  else if (remain < 300) scale = Math.max(0.4, remain / 300); // fade-out
  const bob = Math.sin(now / 380 + t.seed) * 2.5;
  const x = t.x, y = t.y + bob, r = t.r * scale;
  if (r <= 1) return;

  ctx.save();
  if (t.type === 'orb') {
    ctx.shadowColor = 'rgba(140, 210, 255, 0.95)';
    ctx.shadowBlur = 22;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.15);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.7, '#d9efff');
    g.addColorStop(1, '#8ec8f5');
    ctx.fillStyle = g;
    drawCloudShape(x, y, r);
    ctx.shadowBlur = 0;
    drawFace(x, y, r, false);
  } else if (t.type === 'gold') {
    ctx.shadowColor = 'rgba(255, 201, 60, 0.95)';
    ctx.shadowBlur = 30;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.15);
    g.addColorStop(0, '#fff6c9');
    g.addColorStop(0.55, '#ffd94d');
    g.addColorStop(1, '#f5a623');
    ctx.fillStyle = g;
    drawCloudShape(x, y, r);
    ctx.shadowBlur = 0;
    drawFace(x, y, r, true);
    // Sparkles.
    ctx.fillStyle = '#fff8d0';
    for (let i = 0; i < 3; i++) {
      const a = now / 300 + i * 2.1;
      const sx = x + Math.cos(a) * r * 0.9;
      const sy = y + Math.sin(a * 1.3) * r * 0.7;
      drawStar(sx, sy, 5 + 2 * Math.sin(now / 180 + i), 4);
    }
  } else { // storm
    ctx.shadowColor = 'rgba(255, 90, 90, 0.55)';
    ctx.shadowBlur = 16;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.15);
    g.addColorStop(0, '#6b7686');
    g.addColorStop(0.7, '#454e5c');
    g.addColorStop(1, '#232a35');
    ctx.fillStyle = g;
    drawCloudShape(x, y, r);
    ctx.shadowBlur = 0;
    drawFace(x, y, r, false, true);
    // Lightning bolt.
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(x + r * 0.08, y + r * 0.55);
    ctx.lineTo(x - r * 0.18, y + r * 1.05);
    ctx.lineTo(x + r * 0.02, y + r * 1.05);
    ctx.lineTo(x - r * 0.12, y + r * 1.5);
    ctx.lineTo(x + r * 0.28, y + r * 0.82);
    ctx.lineTo(x + r * 0.06, y + r * 0.82);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
function drawFace(x, y, r, gold, angry) {
  const eyeY = y - r * 0.08;
  const eyeDX = r * 0.30;
  const eyeR = Math.max(2.5, r * 0.075);
  ctx.fillStyle = angry ? '#1a2029' : '#16324a';
  ctx.beginPath();
  ctx.arc(x - eyeDX, eyeY, eyeR, 0, Math.PI * 2);
  ctx.arc(x + eyeDX, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  if (angry) {
    // Angry brows.
    ctx.strokeStyle = '#1a2029';
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(x - eyeDX - r * 0.16, eyeY - r * 0.24);
    ctx.lineTo(x - eyeDX + r * 0.14, eyeY - r * 0.08);
    ctx.moveTo(x + eyeDX + r * 0.16, eyeY - r * 0.24);
    ctx.lineTo(x + eyeDX - r * 0.14, eyeY - r * 0.08);
    ctx.stroke();
    // Flat frown.
    ctx.beginPath();
    ctx.moveTo(x - r * 0.18, y + r * 0.34);
    ctx.lineTo(x + r * 0.18, y + r * 0.34);
    ctx.stroke();
  } else {
    // Happy smile.
    ctx.strokeStyle = gold ? '#7a5200' : '#16324a';
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.08, r * 0.26, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
}
function drawStar(x, y, outer, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outer : outer * 0.45;
    const a = (i * Math.PI) / points - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/* ------------------------------------------------------------------ */
/* Particles + popups                                                  */
/* ------------------------------------------------------------------ */
function burst(x, y, color, n) {
  for (let i = 0; i < (n || 12); i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(60, 260);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
      life: rand(0.35, 0.7), age: 0, size: rand(2.5, 6), color,
    });
  }
}
function popup(x, y, text, kind) {
  const el = document.createElement('div');
  el.className = 'popup ' + (kind || 'good');
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  popupsEl.appendChild(el);
  setTimeout(() => el.remove(), 850);
}

/* ------------------------------------------------------------------ */
/* Nimbus — the original mascot, drawn on the menu canvas.             */
/* ------------------------------------------------------------------ */
function drawMascot(now) {
  const w = mascotCanvas.width, h = mascotCanvas.height;
  mctx.clearRect(0, 0, w, h);
  const bob = Math.sin(now / 500) * 4;
  const cx = w / 2, cy = h / 2 + bob;
  const r = 46;
  mctx.save();
  mctx.shadowColor = 'rgba(140, 210, 255, 0.9)';
  mctx.shadowBlur = 18;
  const g = mctx.createRadialGradient(cx - 14, cy - 16, 6, cx, cy, r * 1.2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.7, '#d9efff');
  g.addColorStop(1, '#8ec8f5');
  mctx.fillStyle = g;
  mctx.beginPath();
  mctx.arc(cx - 26, cy + 6, 24, 0, Math.PI * 2);
  mctx.arc(cx, cy - 14, 29, 0, Math.PI * 2);
  mctx.arc(cx + 26, cy + 6, 24, 0, Math.PI * 2);
  mctx.arc(cx, cy + 10, 27, 0, Math.PI * 2);
  mctx.fill();
  mctx.shadowBlur = 0;
  // Pilot goggles.
  mctx.fillStyle = '#0b3d91';
  mctx.beginPath();
  mctx.arc(cx - 15, cy - 6, 10, 0, Math.PI * 2);
  mctx.arc(cx + 15, cy - 6, 10, 0, Math.PI * 2);
  mctx.fill();
  mctx.fillStyle = '#bfe0ff';
  mctx.beginPath();
  mctx.arc(cx - 17, cy - 8, 3.5, 0, Math.PI * 2);
  mctx.arc(cx + 13, cy - 8, 3.5, 0, Math.PI * 2);
  mctx.fill();
  mctx.strokeStyle = '#0b3d91';
  mctx.lineWidth = 3;
  mctx.beginPath();
  mctx.moveTo(cx - 5, cy - 6);
  mctx.lineTo(cx + 5, cy - 6);
  mctx.stroke();
  // Smile.
  mctx.strokeStyle = '#16324a';
  mctx.lineWidth = 3;
  mctx.lineCap = 'round';
  mctx.beginPath();
  mctx.arc(cx, cy + 8, 12, Math.PI * 0.15, Math.PI * 0.85);
  mctx.stroke();
  // Little scarf.
  mctx.strokeStyle = '#ffc93c';
  mctx.lineWidth = 7;
  mctx.beginPath();
  mctx.moveTo(cx - 20, cy + 26);
  mctx.quadraticCurveTo(cx, cy + 34, cx + 20, cy + 26);
  mctx.stroke();
  mctx.restore();
}

/* ------------------------------------------------------------------ */
/* Game flow                                                           */
/* ------------------------------------------------------------------ */
function showScreen(which) {
  menuScreen.classList.toggle('hidden', which !== 'menu');
  overScreen.classList.toggle('hidden', which !== 'over');
  boardScreen.classList.toggle('hidden', which !== 'board');
  hud.classList.toggle('hidden', which !== 'playing');
}
function startGame() {
  ensureAudio();
  score = 0; combo = 0; bestCombo = 0;
  hits = 0; shots = 0; stormHits = 0;
  goldPopped = 0; goldBonusGiven = 0;
  targets = []; particles = [];
  popupsEl.innerHTML = '';
  timeLeft = GAME_DURATION;
  elapsed = 0;
  lastTick = performance.now();
  hiddenSince = 0;
  nextSpawnAt = lastTick + 350;
  nextGoldAt = lastTick + 8000;
  lastWholeSecond = GAME_DURATION;
  savedThisGame = false;
  byId('nameForm').reset();
  byId('savedMsg').classList.add('hidden');
  byId('saveScoreBtn').disabled = false;
  byId('nameInput').disabled = false;
  state = 'playing';
  showScreen('playing');
  updateHud();
  sfx.start();
}
function endGame() {
  state = 'over';
  targets = [];
  const acc = shots ? Math.round((hits / shots) * 100) : 0;
  const rank = rankFor(score);
  byId('finalScore').textContent = String(score);
  byId('statHits').textContent = String(hits);
  byId('statAcc').textContent = acc + '%';
  byId('statCombo').textContent = String(bestCombo);
  byId('statGold').textContent = String(goldPopped);
  const badge = byId('rankBadge');
  badge.textContent = rank.name;
  badge.classList.toggle('rank-top', rank.top);
  refreshDailyBest();
  byId('newBest').classList.toggle('hidden', !(score > 0 && score > dailyBest));
  renderAllBoards(score);
  showScreen('over');
  sfx.over();
  if (score === 0) { byId('nameInput').value = 'ACE'; }
  byId('nameInput').focus({ preventScroll: true });
}
function updateHud() {
  hudScore.textContent = String(score);
  const m = multiplier();
  hudCombo.textContent = 'COMBO ' + combo + ' ×' + m;
  hudCombo.classList.toggle('hot', combo >= 10);
  hudTimer.textContent = String(Math.max(0, Math.ceil(timeLeft)));
  hudTimer.classList.toggle('low', timeLeft <= 5.5 && state === 'playing');
  hudGold.textContent = 'GOLD ' + goldBonusGiven + '/' + MAX_GOLD_BONUS;
}
function addPoints(base, x, y, label) {
  const pts = base * multiplier();
  score += pts;
  popup(x, y, '+' + pts + (label ? ' ' + label : ''), base >= GOLD_POINTS ? 'gold' : 'good');
  return pts;
}
function onFieldClick(clientX, clientY) {
  if (state !== 'playing') return;
  ensureAudio();
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  shots++;
  // Topmost target first (latest spawned is drawn last).
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    if (Math.hypot(t.x - x, t.y - y) <= t.r * 1.05) {
      targets.splice(i, 1);
      if (t.type === 'storm') {
        stormHits++;
        score = Math.max(0, score - STORM_PENALTY);
        combo = 0;
        popup(x, y, '-' + STORM_PENALTY + ' STORM!', 'bad');
        burst(x, y, '#5a6675', 10);
        sfx.storm();
      } else if (t.type === 'gold') {
        hits++;
        combo++;
        bestCombo = Math.max(bestCombo, combo);
        goldPopped++;
        addPoints(GOLD_POINTS, x, y, 'GOLD!');
        burst(x, y, '#ffc93c', 18);
        if (goldBonusGiven < MAX_GOLD_BONUS) {
          goldBonusGiven++;
          timeLeft += GOLD_TIME_BONUS;
          popup(x, y + 26, '+' + GOLD_TIME_BONUS + 's', 'gold');
        }
        sfx.gold();
      } else {
        hits++;
        combo++;
        bestCombo = Math.max(bestCombo, combo);
        addPoints(ORB_POINTS, x, y, combo >= 5 ? '×' + multiplier() : '');
        burst(x, y, '#bfe6ff', 12);
        sfx.pop();
      }
      updateHud();
      return;
    }
  }
  // Clicked empty sky: counts against accuracy, small puff, no combo loss.
  burst(x, y, 'rgba(255,255,255,0.7)', 4);
}

/* ------------------------------------------------------------------ */
/* Main loop                                                           */
/* ------------------------------------------------------------------ */
function frame(now) {
  requestAnimationFrame(frame);
  if (!lastTick) lastTick = now;
  const dt = Math.min((now - lastTick) / 1000, 0.1);
  lastTick = now;

  drawSkyBackground();

  if (state === 'menu' || state === 'board') {
    drawMascot(now);
    for (const c of bgClouds) {
      c.x += c.v * dt;
      if (c.x - 90 > stageW) { c.x = -90; c.y = rand(40, stageH - 120); }
    }
  }

  if (state === 'playing') {
    elapsed += dt;
    timeLeft = GAME_DURATION + goldBonusGiven * GOLD_TIME_BONUS - elapsed;
    const whole = Math.ceil(timeLeft);
    if (whole !== lastWholeSecond) {
      lastWholeSecond = whole;
      if (whole <= 5 && whole > 0) sfx.tick();
    }
    if (timeLeft <= 0) {
      timeLeft = 0;
      updateHud();
      endGame();
    } else {
      if (now >= nextSpawnAt) {
        const maxTargets = 4 + Math.floor(progress() * 4);
        if (targets.length < maxTargets) spawnTarget();
        nextSpawnAt = now + rand(340, 620) * (1 - progress() * 0.45);
      }
      spawnGoldIfDue(now);
      updateHud();
    }
  }

  // Move + expire targets.
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    if (t.x < t.r) { t.x = t.r; t.vx = Math.abs(t.vx); }
    if (t.x > stageW - t.r) { t.x = stageW - t.r; t.vx = -Math.abs(t.vx); }
    if (t.y < 96 + t.r * 0.5) { t.y = 96 + t.r * 0.5; t.vy = Math.abs(t.vy); }
    if (t.y > stageH - t.r) { t.y = stageH - t.r; t.vy = -Math.abs(t.vy); }
    if (now - t.born > t.life) targets.splice(i, 1);
  }
  for (const t of targets) drawTarget(t, now);

  // Particles.
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 320 * dt;
    ctx.globalAlpha = 1 - p.age / p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  onFieldClick(e.clientX, e.clientY);
});
stage.addEventListener('contextmenu', (e) => e.preventDefault());

byId('playBtn').addEventListener('click', () => { sfx.click(); startGame(); });
byId('againBtn').addEventListener('click', () => { sfx.click(); startGame(); });
byId('menuBtn').addEventListener('click', () => {
  sfx.click();
  state = 'menu';
  renderAllBoards();
  showScreen('menu');
});
byId('boardBtn').addEventListener('click', () => {
  sfx.click();
  state = 'board';
  renderAllBoards();
  showScreen('board');
});
byId('boardPlayBtn').addEventListener('click', () => { sfx.click(); startGame(); });
byId('boardMenuBtn').addEventListener('click', () => {
  sfx.click();
  state = 'menu';
  renderAllBoards();
  showScreen('menu');
});

byId('nameForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (savedThisGame || state !== 'over') return;
  const name = (byId('nameInput').value || 'ACE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'ACE';
  const acc = shots ? Math.round((hits / shots) * 100) : 0;
  addScore(name, { score, acc, combo: bestCombo });
  savedThisGame = true;
  byId('saveScoreBtn').disabled = true;
  byId('nameInput').disabled = true;
  byId('savedMsg').classList.remove('hidden');
  refreshDailyBest();
  renderAllBoards(score);
  sfx.gold();
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' && state === 'over') return; // let the form handle it
    e.preventDefault();
    ensureAudio();
    if (state === 'menu' || state === 'board' || state === 'over') startGame();
  } else if (e.code === 'KeyM') {
    muted = !muted;
  } else if (e.code === 'KeyR' && state === 'board') {
    clearTodayBoard();
    renderAllBoards();
    popup(stageW / 2, stageH / 2, 'BOARD RESET', 'bad');
  }
});

document.addEventListener('visibilitychange', () => {
  if (state !== 'playing') return;
  if (document.hidden) {
    hiddenSince = performance.now();
  } else if (hiddenSince) {
    // Shift the clock so hidden time does not eat the round.
    const gap = performance.now() - hiddenSince;
    lastTick += gap;
    nextSpawnAt += gap;
    nextGoldAt += gap;
    for (const t of targets) t.born += gap;
    hiddenSince = 0;
  }
});

window.addEventListener('resize', resize);

/* ------------------------------------------------------------------ */
/* Boot + debug/testing hooks                                          */
/* ------------------------------------------------------------------ */
resize();
initBgClouds();
refreshDailyBest();
renderAllBoards();
if (BOARD_MODE) {
  state = 'board';
  showScreen('board');
  // Second-monitor display: keep the board fresh.
  setInterval(() => { if (state === 'board') renderAllBoards(); }, 5000);
} else {
  showScreen('menu');
}
requestAnimationFrame(frame);

// Small read-only hook for automated tests (Playwright). Harmless in play.
window.SkyClutch = {
  getState: () => state,
  getScore: () => score,
  getTimeLeft: () => timeLeft,
  getTargets: () => targets.map((t) => ({ type: t.type, x: t.x, y: t.y, r: t.r })),
  getStats: () => ({ hits, shots, combo, bestCombo, goldPopped, stormHits }),
  getBoard: () => todayBoard(),
  startGame,
  version: '1.0.0',
};
window.__SKYCLUTCH_READY__ = true;
