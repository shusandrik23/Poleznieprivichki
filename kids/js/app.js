// Интерфейс YouBoost Kids: экраны родителя и ребёнка.
import { S, initStore, kidsList, updateFamily, updateKid, addKid, removeKid, setupLocal, parentSignIn, joinWithCode, parentJoin, createCode, removeMember, leaveDevice, deleteFamily, isOwner } from './store.js';
import * as G from './logic.js';
import { t, pw, lang, setLang, LANGS, L, raw } from './i18n.js';
import { CATEGORIES, HABITS, REWARDS, HABIT_EMOJI, REWARD_EMOJI, AVATARS, COLORS, starterFor } from './catalog.js';
import { isNative, hasNativeGoogle, PUBLIC_URL, shareText, copyText, scheduleDailyReminder, cancelDailyReminder, canRemind, onBackButton } from './native.js';

const appEl = document.getElementById('app');
const modalEl = document.getElementById('modal');
const fxEl = document.getElementById('fx');

// ---------- Настройки этого устройства ----------
const PREFS_KEY = 'ybk-prefs';
function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (err) { return null; } }
const prefs = Object.assign({ pin: null, sound: true, tab: 'home', ktab: 'today', kidMode: null, seen: {}, reminder: null }, readJSON(PREFS_KEY) || {});
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (err) {} }

async function hashPin(pin) {
  const data = new TextEncoder().encode('ybk:' + pin);
  try {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    return 'p' + pin; // без защищённого контекста (http) — простое хранение
  }
}

// ---------- Состояние интерфейса ----------
const ui = {
  welcome: 'start',        // start | parent | child | parentCode
  busy: false,
  msg: null,               // { text, error }
  setup: { name: '', age: 8, avatar: AVATARS[0], color: COLORS[0], starter: true },
  kidOpen: null,           // открытый ребёнок на вкладке «Дети»
  showYesterday: false,
  phrase: {},              // kidId → { mood, text }
  pinBuf: '',
};
let modal = null;
const celebrateQueue = [];

const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stars = n => `${n} ${pw(n, 'star')}`;
const dayLabel = key => raw('days')[G.weekday(key)];
// В Android-приложении вход через Google работает только с нативным плагином (его нужно настроить в Firebase).
const googleOk = () => S.cloudReady && (!isNative || hasNativeGoogle());
const parentPid = () => (S.mode === 'local' ? 'p:local' : 'p:' + S.user?.uid);

function errText(err) {
  const code = err?.message || err?.code || String(err);
  if (/operation-not-allowed|admin-restricted/.test(code)) return t('err.anon-disabled');
  const known = raw('err.' + code);
  return known ? known : t('common.error', { msg: code });
}
function setMsg(text, error = false) { ui.msg = text ? { text, error } : null; render(); }

async function busy(fn) {
  if (ui.busy) return;
  ui.busy = true; ui.msg = null; render();
  try { await fn(); } catch (err) { console.error(err); ui.msg = { text: errText(err), error: true }; }
  ui.busy = false; render();
}

// ---------- Звуки и эффекты ----------
let audio = null;
function tone(freq, start, dur, type = 'sine', vol = 0.15) {
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, audio.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, audio.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + start + dur);
  o.connect(g); g.connect(audio.destination);
  o.start(audio.currentTime + start); o.stop(audio.currentTime + start + dur + 0.05);
}
function sound(kind) {
  if (!prefs.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (kind === 'ding') { tone(880, 0, 0.15); tone(1320, 0.08, 0.25); }
    else if (kind === 'fanfare') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.3, 'triangle')); }
    else if (kind === 'pop') tone(600, 0, 0.08, 'square', 0.05);
  } catch (err) {}
}

function floatText(el, text) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const s = document.createElement('div');
  s.className = 'float-text'; s.textContent = text;
  s.style.left = (r.left + r.width / 2) + 'px'; s.style.top = (r.top + 10) + 'px';
  fxEl.appendChild(s);
  setTimeout(() => s.remove(), 1200);
}

function confetti(count = 40) {
  const items = ['⭐', '🎉', '✨', '🌟', '💛', '🎈'];
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'confetti';
    s.textContent = items[i % items.length];
    s.style.left = Math.random() * 100 + 'vw';
    s.style.animationDelay = Math.random() * 0.4 + 's';
    s.style.animationDuration = 1.6 + Math.random() * 1.2 + 's';
    s.style.fontSize = 16 + Math.random() * 18 + 'px';
    fxEl.appendChild(s);
    setTimeout(() => s.remove(), 3400);
  }
}

// ---------- Отрисовка ----------
function keepInputs(root) {
  const vals = {};
  root.querySelectorAll('input[id], textarea[id], select[id]').forEach(i => { vals[i.id] = i.type === 'checkbox' ? i.checked : i.value; });
  const a = document.activeElement;
  const focus = a && root.contains(a) && a.id ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
  return { vals, focus };
}
function restoreInputs(root, k) {
  for (const [id, v] of Object.entries(k.vals)) {
    const el = root.querySelector('#' + CSS.escape(id));
    if (!el || el.dataset.fresh !== undefined) continue;
    if (el.type === 'checkbox') el.checked = v; else el.value = v;
  }
  if (k.focus) {
    const el = root.querySelector('#' + CSS.escape(k.focus.id));
    if (el) { el.focus(); try { el.setSelectionRange(k.focus.s, k.focus.e); } catch (err) {} }
  }
}

function render() {
  const k = keepInputs(appEl);
  appEl.innerHTML = view();
  restoreInputs(appEl, k);
  document.body.dataset.screen = screenName();
  checkCelebrations();
}
function renderModal(animate = false) {
  const k = keepInputs(modalEl);
  const a = animate ? ' anim' : '';
  modalEl.innerHTML = modal ? `<div class="backdrop${a}" data-act="closeModal"></div><div class="sheet${a}" role="dialog" aria-modal="true">${modalView()}</div>` : '';
  modalEl.classList.toggle('open', !!modal);
  restoreInputs(modalEl, k);
}
function openModal(m) { modal = m; ui.pinBuf = ''; renderModal(true); }
function closeModal() { modal = null; renderModal(); setTimeout(nextCelebration, 250); }

function screenName() {
  if (!S.ready || !S.mode) return 'welcome';
  if (S.role === 'child' || activeKidMode()) return 'kid';
  return 'parent';
}
function activeKidMode() { return S.role === 'parent' && prefs.kidMode && S.kids[prefs.kidMode] ? S.kids[prefs.kidMode] : null; }

function view() {
  if (!S.ready || (S.mode === 'cloud' && !S.synced)) return splash();
  if (!S.mode) return welcome();
  if (S.role === 'child') {
    const kid = S.kids[S.kidId];
    return kid ? kidView(kid, { device: true }) : splash();
  }
  if (!prefs.pin) return kidsList().length ? setupPin() : setupKid();
  const km = activeKidMode();
  if (km) return kidView(km, { locked: true });
  return parentView();
}

function splash() {
  return `<div class="splash"><div class="logo-big">⭐</div><div class="brand">YouBoost <span>Kids</span></div><div class="spinner"></div></div>`;
}

function msgLine() {
  return ui.msg ? `<p class="msg ${ui.msg.error ? 'error' : ''}">${e(ui.msg.text)}</p>` : '';
}

// ---------- Приветствие ----------
function welcome() {
  const head = `<div class="hero"><div class="logo-big">⭐</div><div class="brand">YouBoost <span>Kids</span></div><p class="muted">${t('tagline')}</p></div>`;
  const offline = !S.cloudReady ? `<p class="msg error">${t('welcome.noCloud')}</p>` : '';
  if (S.unlinked && !ui.sawUnlinked) { ui.sawUnlinked = true; ui.welcome = 'start'; }
  if (ui.welcome === 'parent') {
    return `<main class="narrow">${head}
      <div class="card"><h2>${t('welcome.parentTitle')}</h2>
        ${googleOk() || !S.cloudReady ? `<button class="btn big primary" data-act="parentGoogle" ${ui.busy || !S.cloudReady ? 'disabled' : ''}>${GOOGLE_SVG} ${t('welcome.google')}</button>
        <p class="hint">${t('welcome.googleHint')}</p>` : `<p class="hint">${t('welcome.googleSoon')}</p>`}
        <button class="btn big" data-act="startLocal" ${ui.busy ? 'disabled' : ''}>📱 ${t('welcome.local')}</button>
        <p class="hint">${t('welcome.localHint')}</p>
        ${googleOk() ? `<button class="link" data-act="welcome" data-step="parentCode">${t('welcome.haveCode')}</button>` : ''}
      </div>${msgLine()}${S.cloudReady ? '' : offline}
      <button class="link" data-act="welcome" data-step="start">${t('welcome.back')}</button></main>`;
  }
  if (ui.welcome === 'child' || ui.welcome === 'parentCode') {
    const child = ui.welcome === 'child';
    return `<main class="narrow">${head}
      <div class="card"><h2>${child ? t('welcome.childTitle') : t('welcome.haveCode')}</h2>
        ${child ? `<p class="muted">${t('welcome.childText')}</p>` : `<p class="muted">${t('err.need-google')}</p>`}
        <form data-form="${child ? 'joinChild' : 'joinParent'}" class="stack">
          <input id="code" class="code-input" maxlength="8" autocomplete="off" autocapitalize="characters" placeholder="${t('welcome.codePh')}">
          <button class="btn big primary" ${ui.busy || !S.cloudReady ? 'disabled' : ''}>${child ? t('welcome.connect') : GOOGLE_SVG + ' ' + t('welcome.connect')}</button>
        </form>
      </div>${msgLine()}${offline}
      <button class="link" data-act="welcome" data-step="${child ? 'start' : 'parent'}">${t('welcome.back')}</button></main>`;
  }
  return `<main class="narrow">${head}
    ${S.unlinked ? `<p class="msg error">${t('welcome.unlinked')}</p>` : ''}
    <div class="card center"><h2>${t('welcome.title')}</h2><p class="muted">${t('welcome.text')}</p>
      <div class="stack">
        <button class="btn big primary" data-act="welcome" data-step="parent">${t('welcome.parent')}</button>
        <button class="btn big" data-act="welcome" data-step="child">${t('welcome.child')}</button>
      </div>
    </div>
    <div class="lang-row">${LANGS.map(([c, n]) => `<button class="chip ${c === lang ? 'sel' : ''}" data-act="lang" data-lang="${c}">${n}</button>`).join('')}</div>
  </main>`;
}

// ---------- Первая настройка ----------
function kidForm(d, prefix) {
  return `
    <label class="field"><span>${t('setup.kidName')}</span><input id="${prefix}name" maxlength="24" value="${e(d.name)}" ${prefix === 'k_' ? 'data-fresh' : ''}></label>
    <label class="field"><span>${t('setup.kidAge')}</span>
      <div class="chips">${[5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(a => `<button type="button" class="chip ${d.age === a ? 'sel' : ''}" data-act="draft" data-k="age" data-v="${a}" data-scope="${prefix}">${a}</button>`).join('')}</div></label>
    <div class="field"><span>${t('setup.avatar')}</span>
      <div class="emoji-grid">${AVATARS.map(a => `<button type="button" class="emo ${d.avatar === a ? 'sel' : ''}" data-act="draft" data-k="avatar" data-v="${a}" data-scope="${prefix}">${a}</button>`).join('')}</div></div>
    <div class="field"><span>${t('setup.color')}</span>
      <div class="chips">${COLORS.map(c => `<button type="button" class="swatch ${d.color === c ? 'sel' : ''}" style="background:${c}" data-act="draft" data-k="color" data-v="${c}" data-scope="${prefix}" aria-label="${c}"></button>`).join('')}</div></div>`;
}

function setupKid() {
  const d = ui.setup;
  return `<main class="narrow">
    <div class="hero small"><div class="avatar xl" style="background:${d.color}">${d.avatar}</div></div>
    <form class="card stack" data-form="setupKid">
      <h2>${t('setup.familyTitle')}</h2>
      ${kidForm(d, 's_')}
      <label class="check"><input type="checkbox" id="s_starter" ${d.starter ? 'checked' : ''}> ${t('setup.starter')}</label>
      <button class="btn big primary">${t('setup.next')} →</button>
    </form>${msgLine()}</main>`;
}

function setupPin() {
  const repeat = ui.pinFirst;
  return `<main class="narrow"><div class="card center">
    <div class="logo-big">🔒</div>
    <h2>${repeat ? t('setup.pinRepeat') : t('setup.pinTitle')}</h2>
    ${repeat ? '' : `<p class="muted">${t('setup.pinText')}</p>`}
    ${pinPad('setupPin')}
  </div>${msgLine()}</main>`;
}

function pinPad(purpose) {
  const dots = [0, 1, 2, 3].map(i => `<span class="dot ${i < ui.pinBuf.length ? 'on' : ''}"></span>`).join('');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return `<div class="pin-dots">${dots}</div><div class="pinpad">${keys.map(k => k === '' ? '<span></span>' : `<button type="button" class="key" data-act="pinKey" data-k="${k}" data-purpose="${purpose}">${k}</button>`).join('')}</div>`;
}

// ---------- Ребёнок ----------
function kidView(kid, { locked, device }) {
  const fam = S.family || {};
  const bal = G.balance(kid, fam);
  const tab = prefs.ktab;
  const top = `<header class="kid-top" style="--kc:${kid.color || COLORS[0]}">
      <div class="avatar" style="background:${kid.color || COLORS[0]}">${e(kid.avatar || '🙂')}</div>
      <div class="kid-hi">${t('kid.hi', { name: e(kid.name) })}</div>
      <div class="star-pill" data-act="ktab" data-tab="rewards">⭐ <b>${bal}</b></div>
      ${locked ? `<button class="icon-btn" data-act="exitKid" aria-label="${t('kid.exit')}">🔒</button>` : ''}
      ${device ? `<button class="icon-btn" data-act="childSettings" aria-label="${t('set.title')}">⚙️</button>` : ''}
    </header>`;
  let body = '';
  if (tab === 'rewards') body = kidRewards(kid, bal);
  else if (tab === 'stickers') body = kidStickers(kid);
  else if (tab === 'challenges') body = kidChallenges(kid);
  else body = kidToday(kid);
  const tabs = [['today', '🏠', t('ktab.today')], ['rewards', '🎁', t('ktab.rewards')], ['stickers', '🏅', t('ktab.stickers')], ['challenges', '🏆', t('ktab.challenges')]];
  return `${top}<main class="kid-main">${body}</main>
    <nav class="bottom-nav kid">${tabs.map(([id, ic, label]) => `<button class="${tab === id ? 'active' : ''}" data-act="ktab" data-tab="${id}"><span class="ic">${ic}</span>${label}${id === 'challenges' && activeChallengesFor('k:' + kid.id) ? '<i class="dot-badge"></i>' : ''}</button>`).join('')}</nav>`;
}

function activeChallengesFor(pid) {
  const today = G.today();
  return (S.family?.challenges || []).some(ch => ch.participants?.includes(pid) && G.challengeState(ch) === 'active'
    && !(pid.startsWith('k:') ? G.kidChMarks(S.kids[pid.slice(2)], ch) : (ch.marks?.[pid] || {}))[today]);
}

function petCard(kid) {
  if (!kid.pet) {
    return `<section class="pet-card choose"><h2>${t('kid.choosePet')}</h2><p>${t('kid.choosePetText')}</p>
      <div class="pet-grid">${G.PETS.map(p => `<button class="pet-opt" data-act="pickPet" data-kid="${kid.id}" data-id="${p.id}"><span>${p.emoji}</span>${e(L(p))}</button>`).join('')}</div></section>`;
  }
  const fam = S.family || {};
  const xp = G.lifetimeStars(kid, fam);
  const lv = G.petLevel(xp);
  const pet = G.petById(kid.pet.type);
  const egg = lv.level === 0;
  const mood = egg ? 'egg' : G.petMood(kid);
  const cache = ui.phrase[kid.id];
  if (!cache || cache.mood !== mood) ui.phrase[kid.id] = { mood, text: t('mood.' + mood) };
  const item = G.PET_ITEMS[lv.level];
  const size = egg ? 76 : 70 + lv.level * 7;
  return `<section class="pet-card mood-${mood}" style="--kc:${kid.color || COLORS[0]}">
    <div class="bubble">${e(ui.phrase[kid.id].text)}</div>
    <button class="pet" data-act="petTap" data-kid="${kid.id}" style="font-size:${size}px" aria-label="${e(kid.pet.name)}">
      <span class="pet-emoji">${egg ? '🥚' : pet.emoji}</span>${item ? `<span class="pet-item">${item}</span>` : ''}${lv.level >= 7 ? '<span class="sparkle">✨</span>' : ''}
    </button>
    <div class="pet-name"><button class="link-plain" data-act="renamePet" data-kid="${kid.id}">${e(kid.pet.name)} ✏️</button> · ${egg ? t('kid.petEgg') : t('kid.petLevel', { n: lv.level })}</div>
    <div class="bar"><div class="fill" style="width:${Math.round(lv.progress * 100)}%"></div></div>
    <div class="small">${lv.max ? t('kid.petMax') : t('kid.petNext', { n: lv.toNext })}</div>
  </section>`;
}

function habitCard(kid, h, day, ctx = 'kid') {
  const st = G.status(kid, h.id, day, h);
  const streak = G.streak(kid, h);
  const starIcons = '⭐'.repeat(Math.min(h.stars, 3)) + (h.stars > 3 ? `×${h.stars}` : '');
  const sub = st === 'pending' ? `<span class="tag wait">⏳ ${t('kid.pending')}</span>`
    : st === 'rejected' ? `<span class="tag no">${t('kid.rejected')}</span>`
    : `<span class="stars-sm">${starIcons}</span>${streak > 1 ? ` <span class="tag fire">${t('kid.streak', { n: streak })}</span>` : ''}`;
  return `<button class="habit-card ${st}${ui.just === h.id + day ? ' just' : ''}" data-act="toggle" data-kid="${kid.id}" data-hid="${h.id}" data-day="${day}" data-ctx="${ctx}">
    <span class="h-emoji">${e(h.emoji || '⭐')}</span>
    <span class="h-body"><span class="h-name">${e(h.name)}</span><span class="h-sub">${sub}</span></span>
    <span class="h-check">${st === 'done' ? '✓' : st === 'pending' ? '⏳' : st === 'rejected' ? '✕' : ''}</span>
  </button>`;
}

function kidToday(kid) {
  const day = G.today();
  const list = G.todayList(kid, day);
  const done = list.filter(h => G.isDone(kid, h, day)).length;
  let html = petCard(kid);
  if (!(kid.habits || []).length) return html + `<div class="empty">🗒️<p>${t('kid.noHabits')}</p></div>`;
  if (!list.length) html += `<div class="empty">${t('kid.nothing')}</div>`;
  else {
    html += `<div class="today-head"><b>${done === list.length ? t('kid.allDone') : t('kid.todayDone', { done, total: list.length })}</b>
      <div class="bar big"><div class="fill" style="width:${Math.round(done / list.length * 100)}%"></div></div></div>
      <div class="habit-list">${list.map(h => habitCard(kid, h, day)).join('')}</div>`;
  }
  const y = G.addDays(day, -1);
  const missed = (kid.habits || []).filter(h => G.scheduledOn(h, y) && G.status(kid, h.id, y, h) === 'none');
  if (missed.length) {
    html += `<div class="yesterday"><button class="link" data-act="toggleYesterday">${ui.showYesterday ? t('kid.yesterdayHide') : `${t('kid.yesterday')} ${t('kid.yesterdayShow')}`}</button>
      ${ui.showYesterday ? `<div class="habit-list small">${missed.map(h => habitCard(kid, h, y)).join('')}</div>` : ''}</div>`;
  }
  return html;
}

function kidRewards(kid, bal) {
  const rewards = S.family?.rewards || [];
  let html = `<section class="balance-card"><div class="big-num">⭐ ${bal}</div><div>${pw(bal, 'star')}</div></section>`;
  if (!rewards.length) html += `<div class="empty">🎁<p>${t('kid.noRewards')}</p></div>`;
  html += `<div class="reward-grid">${rewards.map(r => {
    const can = bal >= r.cost;
    return `<div class="reward-card ${can ? 'can' : ''}">
      <div class="r-emoji">${e(r.emoji)}</div><div class="r-name">${e(r.name)}</div>
      <div class="r-cost">⭐ ${r.cost}</div>
      ${can ? `<button class="btn primary" data-act="want" data-kid="${kid.id}" data-id="${r.id}">${t('kid.want')}</button>`
        : `<div class="bar"><div class="fill" style="width:${Math.round(Math.max(0, bal) / r.cost * 100)}%"></div></div><div class="small">${t('kid.need', { n: r.cost - bal })}</div>`}
    </div>`;
  }).join('')}</div>`;
  const reqs = (kid.requests || []).slice().reverse().slice(0, 10);
  if (reqs.length) {
    html += `<h3 class="section">${t('kid.myRequests')}</h3><div class="card list">${reqs.map(r => {
      const st = G.requestStatus(kid, r);
      return `<div class="row-between"><span>${e(r.emoji)} ${e(r.name)} · ⭐ ${r.cost}</span><span class="tag ${st === 'given' ? 'ok' : st === 'rejected' ? 'no' : 'wait'}">${st === 'given' ? '✓ ' + t('rewards.given') : st === 'rejected' ? t('rewards.rejected') : '⏳ ' + t('rewards.pending')}</span></div>`;
    }).join('')}</div>`;
  }
  return html;
}

function kidStickers(kid) {
  const got = new Set(G.earnedStickers(kid, S.family, S.kids));
  return `<section class="balance-card"><div class="big-num">🏅 ${got.size}</div><div>${t('kid.stickersText', { got: got.size, total: G.STICKERS.length })}</div></section>
    <div class="sticker-grid">${G.STICKERS.map(s => {
      const has = got.has(s.id);
      const [title, desc] = s[lang] || s.en;
      return `<div class="sticker ${has ? 'got' : 'locked'}"><div class="s-emoji">${has ? s.emoji : '❔'}</div><div class="s-title">${e(title)}</div><div class="s-desc">${e(desc)}</div></div>`;
    }).join('')}</div>`;
}

function participantName(pid) {
  if (pid.startsWith('k:')) { const k = S.kids[pid.slice(2)]; return k ? `${k.avatar || ''} ${k.name}` : '—'; }
  const uid = pid.slice(2);
  if (uid === 'local') return '👤 ' + t('ch.parent');
  const n = S.family?.parents?.[uid];
  return '👤 ' + (n ? n.split(' ')[0] : t('ch.parent'));
}

function challengeCard(ch, me) {
  const st = G.challengeState(ch);
  const board = G.challengeBoard(ch, S.kids);
  const today = G.today();
  const dayN = Math.min(ch.days, G.dayNumber(today) - G.dayNumber(ch.start) + 1);
  const winners = st === 'finished' ? G.challengeWinners(ch, S.kids) : [];
  const myMarks = me ? (me.startsWith('k:') ? G.kidChMarks(S.kids[me.slice(2)], ch) : (ch.marks?.[me] || {})) : {};
  const label = st === 'active' ? `${t('ch.active')} · ${t('ch.dayOf', { n: dayN, total: ch.days })}` : st === 'upcoming' ? `${t('ch.upcoming')} · ${t('ch.startDay')} ${ch.start === G.addDays(today, 1) ? t('ch.tomorrow') : ch.start}` : t('ch.finished');
  return `<div class="card ch-card ${st}">
    <div class="row-between"><div class="ch-title">${e(ch.emoji)} ${e(ch.name)}</div><span class="tag ${st === 'active' ? 'ok' : ''}">${label}</span></div>
    <div class="small">${ch.days} ${pw(ch.days, 'day')} · ${t('ch.bonus')}: ${ch.bonus || 0}</div>
    <div class="board">${board.map(r => `<div class="b-row ${winners.includes(r.pid) ? 'win' : ''}">
      <span class="b-name">${winners.includes(r.pid) ? '🥇 ' : ''}${e(participantName(r.pid))}</span>
      <div class="bar"><div class="fill" style="width:${Math.round(r.count / ch.days * 100)}%"></div></div>
      <span class="b-num">${r.count}/${ch.days}</span></div>`).join('')}</div>
    ${me && ch.participants.includes(me) && st === 'active' ? `<button class="btn ${myMarks[today] ? 'done-btn' : 'primary'} full" data-act="chMark" data-id="${ch.id}" data-pid="${me}">${myMarks[today] ? t('ch.doneToday') : '✅ ' + t('ch.markToday')}</button>` : ''}
    ${me && me.startsWith('p:') ? `<button class="link danger" data-act="chDelete" data-id="${ch.id}">${t('ch.delete')}</button>` : ''}
  </div>`;
}

function sortedChallenges() {
  const order = { active: 0, upcoming: 1, finished: 2 };
  return (S.family?.challenges || []).slice().sort((a, b) => order[G.challengeState(a)] - order[G.challengeState(b)] || (a.start < b.start ? 1 : -1));
}

function kidChallenges(kid) {
  const pid = 'k:' + kid.id;
  const list = sortedChallenges().filter(ch => ch.participants?.includes(pid));
  if (!list.length) return `<div class="empty">🏆<p>${t('kid.noChallenges')}</p></div>`;
  return list.map(ch => challengeCard(ch, pid)).join('');
}

// ---------- Родитель ----------
function parentView() {
  const tab = prefs.tab;
  let body;
  if (tab === 'kids') body = parentKids();
  else if (tab === 'rewards') body = parentRewards();
  else if (tab === 'challenges') body = parentChallenges();
  else if (tab === 'settings') body = parentSettings();
  else body = parentHome();
  const pending = kidsList().reduce((n, k) => n + G.pendingList(k).length + (k.requests || []).filter(r => G.requestStatus(k, r) === 'pending').length, 0);
  const tabs = [['home', '🏠', t('tab.home'), pending], ['kids', '👧', t('tab.kids')], ['rewards', '🎁', t('tab.rewards')], ['challenges', '🏆', t('tab.challenges')], ['settings', '⚙️', t('tab.settings')]];
  const fname = S.family?.name;
  const date = new Date().toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  return `<header class="parent-top"><div><div class="brand sm">YouBoost <span>Kids</span></div><div class="fam">${fname ? t('home.hello', { name: e(fname) }) : t('home.helloNoName')} · <span class="date">${e(date)}</span></div></div></header>
    <main class="parent-main">${msgLine()}${body}</main>
    <nav class="bottom-nav">${tabs.map(([id, ic, label, badge]) => `<button class="${tab === id ? 'active' : ''}" data-act="tab" data-tab="${id}"><span class="ic">${ic}</span>${label}${badge ? `<i class="num-badge">${badge}</i>` : ''}</button>`).join('')}</nav>`;
}

function parentHome() {
  const kids = kidsList();
  const day = G.today();
  if (!kids.length) return `<div class="empty">👶<p>${t('home.noKids')}</p><button class="btn primary" data-act="newKid">${t('home.addKid')}</button></div>`;
  let html = kids.map(k => {
    const list = G.todayList(k, day);
    const done = list.filter(h => G.isDone(k, h, day)).length;
    return `<div class="card kid-row" style="--kc:${k.color}">
      <div class="row"><div class="avatar" style="background:${k.color}">${e(k.avatar)}</div>
        <div class="grow"><div class="kid-name">${e(k.name)}</div><div class="small">${list.length ? t('home.today', { done, total: list.length }) : t('home.nothingToday')}</div></div>
        <div class="star-pill sm">⭐ ${G.balance(k, S.family)}</div></div>
      ${list.length ? `<div class="bar"><div class="fill" style="width:${Math.round(done / list.length * 100)}%;background:${k.color}"></div></div>` : ''}
      <div class="row gap"><button class="btn primary grow" data-act="enterKid" data-kid="${k.id}">▶ ${t('home.open')}</button><button class="btn" data-act="openKid" data-kid="${k.id}">${t('kids.edit')}</button></div>
    </div>`;
  }).join('');
  const approvals = kids.flatMap(k => G.pendingList(k).map(p => ({ ...p, kid: k })));
  const requests = kids.flatMap(k => (k.requests || []).filter(r => G.requestStatus(k, r) === 'pending').map(r => ({ r, kid: k })));
  if (approvals.length) {
    html += `<h3 class="section">${t('home.approvals')}</h3><div class="card list">${approvals.map(a => `
      <div class="appr"><div class="grow"><b>${e(a.kid.avatar)} ${e(a.kid.name)}</b> · ${e(a.habit.emoji)} ${e(a.habit.name)}
        <div class="small">${a.day === day ? t('home.todayWord') : a.day === G.addDays(day, -1) ? t('home.yesterday') : a.day} · ⭐ ${a.stars}</div></div>
        <button class="btn sm primary" data-act="approve" data-kid="${a.kid.id}" data-hid="${a.habit.id}" data-day="${a.day}" data-v="1">✓ ${t('home.approve')}</button>
        <button class="btn sm" data-act="approve" data-kid="${a.kid.id}" data-hid="${a.habit.id}" data-day="${a.day}" data-v="0" aria-label="${t('home.reject')}">✕</button></div>`).join('')}</div>`;
  }
  if (requests.length) {
    html += `<h3 class="section">${t('home.requests')}</h3><div class="card list">${requests.map(({ r, kid }) => `
      <div class="appr"><div class="grow"><b>${e(kid.avatar)} ${e(kid.name)}</b> · ${e(r.emoji)} ${e(r.name)} <div class="small">⭐ ${r.cost}</div></div>
        <button class="btn sm primary" data-act="decide" data-kid="${kid.id}" data-id="${r.id}" data-v="given">🎁 ${t('home.give')}</button>
        <button class="btn sm" data-act="decide" data-kid="${kid.id}" data-id="${r.id}" data-v="rejected" aria-label="${t('home.decline')}">✕</button></div>`).join('')}</div>`;
  }
  if (!approvals.length && !requests.length) html += `<p class="hint center">${t('home.allClear')}</p>`;
  return html;
}

function parentKids() {
  const kids = kidsList();
  const open = ui.kidOpen && S.kids[ui.kidOpen] ? S.kids[ui.kidOpen] : kids[0];
  if (!open) return `<div class="empty">👶<p>${t('home.noKids')}</p><button class="btn primary" data-act="newKid">${t('home.addKid')}</button></div>`;
  const switcher = `<div class="kid-switch">${kids.map(k => `<button class="kid-chip ${k.id === open.id ? 'sel' : ''}" style="--kc:${k.color}" data-act="openKid" data-kid="${k.id}"><span class="avatar sm" style="background:${k.color}">${e(k.avatar)}</span>${e(k.name)}</button>`).join('')}<button class="kid-chip add" data-act="newKid">＋</button></div>`;
  const k = open;
  const fam = S.family || {};
  const stickers = G.earnedStickers(k, fam, S.kids).length;
  const xp = G.lifetimeStars(k, fam);
  const plv = G.petLevel(xp).level;
  const pet = k.pet ? `${plv === 0 ? '🥚' : G.petById(k.pet.type).emoji} ${e(k.pet.name)} · ${plv === 0 ? t('kid.petEgg') : t('kid.petLevel', { n: plv })}` : '—';
  const habits = k.habits || [];
  const days = [...Array(7)].map((_, i) => G.addDays(G.today(), i - 6));
  const grid = habits.length ? `<div class="grid7"><div></div>${days.map(d => `<div class="gh">${dayLabel(d)}<br>${d.slice(8)}</div>`).join('')}
    ${habits.map(h => `<div class="gname" title="${e(h.name)}">${e(h.emoji)}</div>${days.map(d => {
      if (!G.scheduledOn(h, d)) return '<div class="gc off"></div>';
      const st = G.status(k, h.id, d, h);
      return `<button class="gc ${st}" data-act="toggle" data-kid="${k.id}" data-hid="${h.id}" data-day="${d}" data-ctx="parent">${st === 'done' ? '✓' : st === 'pending' ? '⏳' : st === 'rejected' ? '✕' : ''}</button>`;
    }).join('')}`).join('')}</div>` : '';
  const devices = S.mode === 'cloud'
    ? `${S.members.filter(m => m.role === 'child' && m.kidId === k.id).map(m => `<div class="row-between"><span>📱 ${e(m.name || t('kids.device'))}</span><button class="btn sm" data-act="unlink" data-uid="${m.uid}">${t('kids.unlink')}</button></div>`).join('')}
       <button class="btn full" data-act="linkDevice" data-kid="${k.id}" ${ui.busy ? 'disabled' : ''}>${t('kids.link')}</button>
       <p class="hint">${t('kids.noDevices')}</p>`
    : `<p class="hint">${t('kids.needCloud')}</p><p class="hint">${t('kids.noDevices')}</p>`;
  return `${switcher}
    <div class="card kid-head" style="--kc:${k.color}">
      <div class="row"><div class="avatar lg" style="background:${k.color}">${e(k.avatar)}</div>
        <div class="grow"><div class="kid-name">${e(k.name)}${k.age ? ` <span class="muted">· ${k.age}</span>` : ''}</div>
        <div class="small">${t('kids.balance')}: ⭐ ${G.balance(k, fam)} · ${t('kids.stickersCount')}: ${stickers}/${G.STICKERS.length}</div>
        <div class="small">${t('kids.pet')}: ${pet}</div></div>
        <button class="btn sm" data-act="editKid" data-kid="${k.id}">✏️</button></div>
      <div class="row gap"><button class="btn primary grow" data-act="enterKid" data-kid="${k.id}">▶ ${t('home.open')}</button><button class="btn" data-act="bonus" data-kid="${k.id}">${t('kids.bonus')}</button></div>
    </div>
    <h3 class="section">${t('kids.habits')}</h3>
    <div class="card list">
      ${habits.length ? habits.map(h => `<button class="h-row" data-act="editHabit" data-kid="${k.id}" data-hid="${h.id}">
        <span class="h-emoji sm">${e(h.emoji)}</span><span class="grow"><b>${e(h.name)}</b><span class="small block">${'⭐'.repeat(Math.min(h.stars, 3))} · ${daysText(h.days)}${h.approval ? ' · 👀' : ''}</span></span><span class="muted">›</span></button>`).join('')
        : `<p class="muted">${t('kids.noHabits')}</p>`}
      <div class="row gap"><button class="btn grow" data-act="catalog" data-kid="${k.id}">📋 ${t('kids.fromCatalog')}</button><button class="btn grow" data-act="newHabit" data-kid="${k.id}">✏️ ${t('kids.custom')}</button></div>
    </div>
    ${grid ? `<h3 class="section">${t('kids.history')}</h3><div class="card">${grid}<p class="hint">${t('kids.markFor')}</p></div>` : ''}
    <h3 class="section">${t('kids.devices')}</h3><div class="card list">${devices}</div>
    <button class="link danger" data-act="deleteKid" data-kid="${k.id}">${t('kids.delete')}</button>`;
}

function daysText(days) {
  if (!days || !days.length || days.length === 7) return t('habit.everyDay');
  if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) return t('habit.weekdays');
  return [1, 2, 3, 4, 5, 6, 0].filter(d => days.includes(d)).map(d => raw('days')[d]).join(', ');
}

function parentRewards() {
  const rewards = S.family?.rewards || [];
  const have = new Set(rewards.map(r => r.name));
  const history = kidsList().flatMap(k => (k.requests || []).map(r => ({ r, k }))).sort((a, b) => (a.r.at < b.r.at ? 1 : -1)).slice(0, 20);
  return `<p class="muted">${t('rewards.text')}</p>
    <div class="card list">
      ${rewards.length ? rewards.map(r => `<button class="h-row" data-act="editReward" data-id="${r.id}"><span class="h-emoji sm">${e(r.emoji)}</span><span class="grow"><b>${e(r.name)}</b></span><span class="star-pill sm">⭐ ${r.cost}</span></button>`).join('') : `<p class="muted">${t('rewards.empty')}</p>`}
      <button class="btn primary full" data-act="newReward">${t('rewards.add')}</button>
    </div>
    <h3 class="section">${t('rewards.ideas')}</h3>
    <div class="chips">${REWARDS.filter(r => !have.has(L(r))).map((r, i) => `<button class="chip" data-act="addIdea" data-i="${REWARDS.indexOf(r)}">${r.emoji} ${e(L(r))} · ⭐${r.cost}</button>`).join('')}</div>
    ${history.length ? `<h3 class="section">${t('rewards.history')}</h3><div class="card list">${history.map(({ r, k }) => {
      const st = G.requestStatus(k, r);
      return `<div class="row-between"><span>${e(k.avatar)} ${e(k.name)} · ${e(r.emoji)} ${e(r.name)} · ⭐${r.cost}</span><span class="tag ${st === 'given' ? 'ok' : st === 'rejected' ? 'no' : 'wait'}">${t('rewards.' + st)}</span></div>`;
    }).join('')}</div>` : ''}`;
}

function parentChallenges() {
  const list = sortedChallenges();
  return `<p class="muted">${t('ch.text')}</p>
    <button class="btn primary full" data-act="newChallenge" ${kidsList().length ? '' : 'disabled'}>${t('ch.new')}</button>
    <div class="spacer"></div>
    ${list.length ? list.map(ch => challengeCard(ch, parentPid())).join('') : `<div class="empty">🏆<p>${t('ch.empty')}</p></div>`}`;
}

function parentSettings() {
  const fam = S.family || {};
  let account;
  if (S.mode === 'local') {
    account = `<p class="muted">${t('set.local')}</p>
      ${googleOk() ? `<button class="btn primary full" data-act="connectGoogle" ${ui.busy ? 'disabled' : ''}>${GOOGLE_SVG} ${t('set.connectGoogle')}</button>
      <p class="hint">${t('set.connectHint')}</p>` : `<p class="hint">${t(S.cloudReady ? 'welcome.googleSoon' : 'welcome.noCloud')}</p>`}`;
  } else {
    const parents = S.members.filter(m => m.role === 'parent');
    account = `<p>${t('set.signedIn', { who: e(S.user?.email || S.user?.name || '') })}</p>
      <div class="small">${t('set.parents')}:</div>
      ${parents.map(p => `<div class="row-between"><span>👤 ${e(p.name || '—')}${p.uid === fam.owner ? ' ⭐' : ''}</span>${isOwner() && p.uid !== S.user?.uid ? `<button class="btn sm" data-act="unlink" data-uid="${p.uid}">${t('kids.unlink')}</button>` : ''}</div>`).join('')}
      <button class="btn full" data-act="inviteParent" ${ui.busy ? 'disabled' : ''}>${t('set.inviteParent')}</button>
      <button class="btn full" data-act="signOut">${t('set.signOut')}</button>`;
  }
  return `<div class="card list">
      <button class="h-row" data-act="editFamily"><span class="grow">${t('set.family')}</span><span class="muted">${e(fam.name || '—')} ›</span></button>
      <div class="row-between"><span>${t('set.lang')}</span><div class="chips">${LANGS.map(([c, n]) => `<button class="chip ${c === lang ? 'sel' : ''}" data-act="lang" data-lang="${c}">${n}</button>`).join('')}</div></div>
      <label class="row-between"><span>${t('set.sound')}</span><input type="checkbox" class="switch" data-act="sound" ${prefs.sound ? 'checked' : ''}></label>
      ${reminderRow()}
      <button class="h-row" data-act="changePin"><span class="grow">🔒 ${t('set.pin')}</span><span class="muted">›</span></button>
    </div>
    <h3 class="section">${t('set.account')}</h3>
    <div class="card list">${account}</div>
    <div class="card list">
      <a class="h-row" href="privacy.html" target="_blank" rel="noopener"><span class="grow">${t('set.privacy')}</span><span class="muted">›</span></a>
      <a class="h-row" href="../" target="_blank" rel="noopener"><span class="grow">${t('set.adultApp')}</span><span class="muted">›</span></a>
    </div>
    ${isOwner() ? `<button class="link danger" data-act="deleteFamily">${t('set.deleteFamily')}</button>` : ''}
    <p class="hint center">YouBoost Kids · ${S.mode === 'cloud' ? '☁️' : '📱'}</p>`;
}

function reminderRow() {
  if (!canRemind()) return '';
  const r = prefs.reminder;
  return `<label class="row-between"><span>⏰ ${t('set.reminder')}</span>
    <input type="time" id="reminder" data-act="reminder" value="${r ? `${String(r.h).padStart(2, '0')}:${String(r.m).padStart(2, '0')}` : ''}"></label>`;
}

// ---------- Окна ----------
function modalView() {
  const m = modal;
  const close = `<button class="sheet-close" data-act="closeModal" aria-label="${t('common.close')}">✕</button>`;
  switch (m.type) {
    case 'pin':
      return `${close}<div class="center"><div class="logo-big">🔒</div><h2>${m.repeat ? t('setup.pinRepeat') : m.purpose === 'newPin' ? t('setup.pinTitle') : t('pin.enter')}</h2>
        ${pinPad(m.purpose)}${m.error ? `<p class="msg error">${e(m.error)}</p>` : ''}
        ${m.purpose === 'exitKid' || m.purpose === 'changePin' ? `<button class="link" data-act="forgotPin">${t('pin.forgot')}</button>` : ''}</div>`;
    case 'gate':
      return `${close}<div class="center"><div class="logo-big">🧑‍🦰</div><h2>${t('gate.title')}</h2><p>${t('gate.text')}</p>
        <form data-form="gate" class="stack"><div class="gate-q">${m.a} × ${m.b} = ?</div>
        <input id="gateAns" inputmode="numeric" autocomplete="off" class="code-input" data-fresh>
        ${m.error ? `<p class="msg error">${t('gate.wrong')}</p>` : ''}<button class="btn primary big">${t('gate.ok')}</button></form></div>`;
    case 'celebrate':
      return `<div class="center celebrate"><div class="cele-emoji">${m.emoji}</div><h2>${e(m.title)}</h2><p>${e(m.text)}</p><button class="btn primary big" data-act="closeModal">${t('kid.great')}</button></div>`;
    case 'code':
      return `${close}<div class="center"><h2>${e(m.title)}</h2><div class="code-big">${e(m.code)}</div><p class="muted">${e(m.text)}</p>
        <div class="row gap center-row"><button class="btn" data-act="copyCode">${m.copied ? '✓ ' + t('common.copied') : t('common.copy')}</button><button class="btn primary" data-act="shareCode">${t('common.share')}</button></div></div>`;
    case 'kid':
      return `${close}<form data-form="kid" class="stack"><h2>${m.id ? e(m.draft.name) : t('setup.familyTitle')}</h2>${kidForm(m.draft, 'k_')}
        ${m.id ? '' : `<label class="check"><input type="checkbox" id="k_starter" checked> ${t('setup.starter')}</label>`}
        <button class="btn primary big">${t('common.save')}</button></form>`;
    case 'habit': return close + habitForm(m);
    case 'catalog': return close + catalogView(m);
    case 'reward':
      return `${close}<form data-form="reward" class="stack"><h2>${t('rewards.name')}</h2>
        <label class="field"><span>${t('rewards.name')}</span><input id="r_name" maxlength="40" value="${e(m.draft.name)}" data-fresh></label>
        <label class="field"><span>${t('rewards.cost')}</span><input id="r_cost" type="number" min="1" max="9999" value="${m.draft.cost}" data-fresh></label>
        <div class="field"><span>${t('habit.emoji')}</span><div class="emoji-grid">${REWARD_EMOJI.map(x => `<button type="button" class="emo ${m.draft.emoji === x ? 'sel' : ''}" data-act="mdraft" data-k="emoji" data-v="${x}">${x}</button>`).join('')}</div></div>
        <button class="btn primary big">${t('common.save')}</button>
        ${m.id ? `<button type="button" class="link danger" data-act="deleteReward" data-id="${m.id}">${t('common.delete')}</button>` : ''}</form>`;
    case 'bonus':
      return `${close}<form data-form="bonus" class="stack"><h2>${t('kids.bonus')}</h2>
        <div class="chips center-row">${[1, 2, 3, 5, 10].map(n => `<button type="button" class="chip big ${m.stars === n ? 'sel' : ''}" data-act="mdraft" data-k="stars" data-v="${n}" data-num>⭐ ${n}</button>`).join('')}</div>
        <input id="b_reason" maxlength="60" placeholder="${t('kids.bonusReason')}">
        <button class="btn primary big">${t('kids.bonusGive')}</button></form>`;
    case 'want':
      return `<div class="center"><div class="cele-emoji">${e(m.reward.emoji)}</div><h2>${t('kid.confirmWant', { cost: m.reward.cost, name: e(m.reward.name) })}</h2>
        <div class="row gap center-row"><button class="btn big" data-act="closeModal">${t('kid.no')}</button><button class="btn primary big" data-act="confirmWant">${t('kid.yes')}</button></div></div>`;
    case 'petName':
      return `${close}<form data-form="petName" class="stack center"><div class="cele-emoji">${G.petById(m.type).emoji}</div><h2>${t('kid.petName')}</h2>
        <input id="petName" maxlength="20" value="${e(m.name)}" class="center-text" data-fresh><button class="btn primary big">${t('common.save')}</button></form>`;
    case 'text':
      return `${close}<form data-form="text" class="stack"><h2>${e(m.title)}</h2><input id="t_val" maxlength="${m.max || 40}" value="${e(m.value || '')}" placeholder="${e(m.ph || '')}" data-fresh>
        <button class="btn primary big">${t('common.save')}</button></form>`;
    case 'challenge': return close + challengeForm(m);
    case 'childSettings':
      return `${close}<h2>${t('set.title')}</h2><div class="list">
        <div class="row-between"><span>${t('set.lang')}</span><div class="chips">${LANGS.map(([c, n]) => `<button class="chip ${c === lang ? 'sel' : ''}" data-act="lang" data-lang="${c}">${n}</button>`).join('')}</div></div>
        <label class="row-between"><span>${t('set.sound')}</span><input type="checkbox" class="switch" data-act="sound" ${prefs.sound ? 'checked' : ''}></label>
        ${reminderRow()}
        <a class="h-row" href="privacy.html" target="_blank" rel="noopener"><span class="grow">${t('set.privacy')}</span><span class="muted">›</span></a>
        <button class="btn full" data-act="unlinkSelf">${t('set.unlinkDevice')}</button></div>`;
  }
  return close;
}

function habitForm(m) {
  const d = m.draft;
  const order = [1, 2, 3, 4, 5, 6, 0];
  const all = !d.days || d.days.length === 0 || d.days.length === 7;
  return `<form data-form="habit" class="stack"><h2>${m.hid ? e(d.name) : t('kids.custom')}</h2>
    <label class="field"><span>${t('habit.name')}</span><input id="h_name" maxlength="40" value="${e(d.name)}" data-fresh></label>
    <div class="field"><span>${t('habit.emoji')}</span><div class="emoji-grid">${HABIT_EMOJI.map(x => `<button type="button" class="emo ${d.emoji === x ? 'sel' : ''}" data-act="mdraft" data-k="emoji" data-v="${x}">${x}</button>`).join('')}</div></div>
    <div class="field"><span>${t('habit.stars')}</span><div class="chips">${[1, 2, 3, 5].map(n => `<button type="button" class="chip ${d.stars === n ? 'sel' : ''}" data-act="mdraft" data-k="stars" data-v="${n}" data-num>${'⭐'.repeat(Math.min(n, 3))}${n > 3 ? '×' + n : ''}</button>`).join('')}</div></div>
    <div class="field"><span>${t('habit.days')}</span><div class="chips">
      <button type="button" class="chip ${all ? 'sel' : ''}" data-act="hdays" data-v="all">${t('habit.everyDay')}</button>
      ${order.map(n => `<button type="button" class="chip day ${!all && d.days.includes(n) ? 'sel' : ''}" data-act="hdays" data-v="${n}">${raw('days')[n]}</button>`).join('')}</div></div>
    <label class="check"><input type="checkbox" id="h_approval" ${d.approval ? 'checked' : ''} data-fresh> ${t('habit.approval')}</label>
    <p class="hint">${t('habit.approvalHint')}</p>
    <button class="btn primary big">${t('common.save')}</button>
    ${m.hid ? `<button type="button" class="link danger" data-act="deleteHabit">${t('habit.delete')}</button>` : ''}
  </form>`;
}

function catalogView(m) {
  const kid = S.kids[m.kid];
  const have = new Set((kid?.habits || []).map(h => h.code).filter(Boolean));
  return `<h2>${t('kids.fromCatalog')}</h2>${CATEGORIES.map(c => `<div class="cat"><h4>${c.emoji} ${e(L(c.name))}</h4><div class="chips">
    ${HABITS.filter(h => h.cat === c.id).map(h => `<button class="chip ${have.has(h.code) ? 'added' : ''}" data-act="addFromCatalog" data-code="${h.code}" ${have.has(h.code) ? 'disabled' : ''}>${h.emoji} ${e(h[lang] || h.en)}${have.has(h.code) ? ' ✓' : ''}</button>`).join('')}
  </div></div>`).join('')}`;
}

function challengeForm(m) {
  const d = m.draft;
  const people = [...kidsList().map(k => ['k:' + k.id, `${k.avatar} ${k.name}`])];
  if (S.mode === 'local') people.push(['p:local', '👤 ' + t('ch.me')]);
  else Object.entries(S.family?.parents || {}).forEach(([uid, name]) => people.push(['p:' + uid, '👤 ' + (uid === S.user?.uid ? t('ch.me') : (name || t('ch.parent')))]));
  return `<form data-form="challenge" class="stack"><h2>${t('ch.new')}</h2>
    <label class="field"><span>${t('ch.habit')}</span><input id="c_name" maxlength="40" value="${e(d.name)}" data-fresh></label>
    <div class="chips">${['read', 'sport', 'veggies', 'screen', 'bed', 'water'].map(code => { const h = HABITS.find(x => x.code === code); return `<button type="button" class="chip" data-act="chIdea" data-code="${code}">${h.emoji} ${e(h[lang] || h.en)}</button>`; }).join('')}</div>
    <div class="field"><span>${t('habit.emoji')}</span><div class="emoji-grid">${HABIT_EMOJI.slice(0, 24).map(x => `<button type="button" class="emo ${d.emoji === x ? 'sel' : ''}" data-act="mdraft" data-k="emoji" data-v="${x}">${x}</button>`).join('')}</div></div>
    <div class="field"><span>${t('ch.days')}</span><div class="chips">${[3, 7, 14, 21, 30].map(n => `<button type="button" class="chip ${d.days === n ? 'sel' : ''}" data-act="mdraft" data-k="days" data-v="${n}" data-num>${n}</button>`).join('')}</div></div>
    <div class="field"><span>${t('ch.bonus')}</span><div class="chips">${[5, 10, 20, 30].map(n => `<button type="button" class="chip ${d.bonus === n ? 'sel' : ''}" data-act="mdraft" data-k="bonus" data-v="${n}" data-num>⭐ ${n}</button>`).join('')}</div></div>
    <div class="field"><span>${t('ch.startDay')}</span><div class="chips">
      <button type="button" class="chip ${d.startOffset === 0 ? 'sel' : ''}" data-act="mdraft" data-k="startOffset" data-v="0" data-num>${t('ch.todayStart')}</button>
      <button type="button" class="chip ${d.startOffset === 1 ? 'sel' : ''}" data-act="mdraft" data-k="startOffset" data-v="1" data-num>${t('ch.tomorrow')}</button></div></div>
    <div class="field"><span>${t('ch.who')}</span><div class="chips">${people.map(([pid, name]) => `<button type="button" class="chip ${d.participants.includes(pid) ? 'sel' : ''}" data-act="chWho" data-pid="${pid}">${e(name)}</button>`).join('')}</div></div>
    ${m.error ? `<p class="msg error">${e(m.error)}</p>` : ''}
    <button class="btn primary big">${t('ch.start')} 🏁</button></form>`;
}

// ---------- Праздники: новые наклейки и уровни питомца ----------
function checkCelebrations() {
  const kid = S.role === 'child' ? S.kids[S.kidId] : activeKidMode();
  if (!kid || !S.synced) return;
  const fam = S.family || {};
  const got = G.earnedStickers(kid, fam, S.kids);
  const lvl = G.petLevel(G.lifetimeStars(kid, fam)).level;
  const seen = prefs.seen[kid.id];
  if (!seen) { prefs.seen[kid.id] = { st: got, lv: lvl }; savePrefs(); return; }
  const fresh = got.filter(id => !seen.st.includes(id));
  let changed = false;
  if (kid.pet && lvl > seen.lv) {
    const pet = G.petById(kid.pet.type);
    celebrateQueue.push({ emoji: seen.lv === 0 ? '🐣' : pet.emoji + (G.PET_ITEMS[lvl] || ''), title: seen.lv === 0 ? t('kid.hatched') : t('kid.levelUp'), text: `${kid.pet.name} · ${t('kid.petLevel', { n: lvl })}` });
    changed = true;
  }
  for (const id of fresh) {
    const s = G.STICKERS.find(x => x.id === id);
    const [title, desc] = s[lang] || s.en;
    celebrateQueue.push({ emoji: s.emoji, title: `${t('kid.newSticker')} «${title}»`, text: desc });
    changed = true;
  }
  if (changed || lvl !== seen.lv) { prefs.seen[kid.id] = { st: got, lv: Math.max(lvl, kid.pet ? lvl : 0) }; savePrefs(); }
  if (!kid.pet && lvl !== seen.lv) { prefs.seen[kid.id].lv = 0; savePrefs(); }
  if (changed) setTimeout(nextCelebration, 600);
}
function nextCelebration() {
  if (modal || !celebrateQueue.length) return;
  const c = celebrateQueue.shift();
  openModal({ type: 'celebrate', ...c });
  confetti(50); sound('fanfare');
}

// ---------- Действия ----------
function draftScope(scope) { return scope === 's_' ? ui.setup : modal?.draft; }

function readKidForm(root, prefix, d) {
  d.name = root.querySelector('#' + prefix + 'name')?.value.trim() || d.name;
}

function habitFromCatalog(c) {
  return { id: G.newId(), code: c.code, name: c[lang] || c.en, emoji: c.emoji, stars: c.stars, days: c.days ? [...c.days] : [], approval: !!c.approval, since: G.today() };
}

async function toggleMark(kidId, hid, day, ctx, el) {
  const k = S.kids[kidId];
  const h = (k?.habits || []).find(x => x.id === hid);
  if (!h) return;
  const parent = ctx === 'parent';
  const today = G.today();
  if (!parent && day !== today && day !== G.addDays(today, -1)) return;
  const marks = { ...(k.marks || {}) };
  const dm = { ...(marks[day] || {}) };
  const ap = k.approved?.[day]?.[hid];
  const patch = {};
  if (dm[hid]) {
    if (!parent && ap !== undefined) return; // подтверждённое или отклонённое ребёнок не меняет
    delete dm[hid];
    if (parent && ap !== undefined) {
      const approved = { ...(k.approved || {}) }; const da = { ...(approved[day] || {}) };
      delete da[hid]; if (Object.keys(da).length) approved[day] = da; else delete approved[day];
      patch.approved = approved;
    }
    sound('pop');
  } else {
    dm[hid] = h.stars;
    ui.just = hid + day; setTimeout(() => { ui.just = null; }, 800);
    if (parent && h.approval) {
      const approved = { ...(k.approved || {}) };
      approved[day] = { ...(approved[day] || {}), [hid]: true };
      patch.approved = approved;
    }
    if (!parent) {
      sound('ding');
      floatText(el, h.approval ? '⏳' : `+${h.stars} ⭐`);
      // Праздник, если это было последнее дело дня
      const list = G.todayList(k, day);
      const after = { ...k, marks: { ...marks, [day]: dm } };
      if (day === today && list.length && list.every(x => G.isDone(after, x, day))) { setTimeout(() => { confetti(60); sound('fanfare'); }, 200); }
    }
  }
  if (Object.keys(dm).length) marks[day] = dm; else delete marks[day];
  patch.marks = marks;
  try { await updateKid(kidId, patch); } catch (err) { setMsg(errText(err), true); }
}

const actions = {
  welcome: d => { ui.welcome = d.step; ui.msg = null; S.unlinked = false; ui.sawUnlinked = false; render(); },
  lang: d => { setLang(d.lang); ui.phrase = {}; render(); if (modal) renderModal(); },
  startLocal: () => { setupLocal(''); render(); },
  parentGoogle: () => busy(async () => { await parentSignIn(''); }),
  connectGoogle: () => busy(async () => { const r = await parentSignIn(S.family?.name || ''); if (r === 'migrated') ui.msg = { text: t('set.migrated') }; }),
  draft: (d, el) => {
    const scope = d.scope;
    const target = draftScope(scope);
    if (!target) return;
    const root = scope === 's_' ? appEl : modalEl;
    readKidForm(root, scope, target);
    target[d.k] = d.k === 'age' ? Number(d.v) : d.v;
    if (scope === 's_') render(); else renderModal();
  },
  mdraft: d => {
    if (!modal) return;
    const val = d.num !== undefined ? Number(d.v) : d.v;
    if (modal.type === 'bonus') modal.stars = val;
    else { syncModalText(); modal.draft[d.k] = val; }
    renderModal();
  },
  hdays: d => {
    syncModalText();
    const dr = modal.draft;
    if (d.v === 'all') dr.days = [];
    else {
      const n = Number(d.v);
      let days = dr.days && dr.days.length ? [...dr.days] : [];
      days = days.includes(n) ? days.filter(x => x !== n) : [...days, n];
      if (days.length === 7) days = [];
      dr.days = days;
    }
    renderModal();
  },
  pinKey: (d) => pinKey(d.k, d.purpose),
  forgotPin: () => openGate('resetPin'),
  closeModal: () => closeModal(),
  tab: d => { prefs.tab = d.tab; savePrefs(); ui.msg = null; render(); window.scrollTo(0, 0); },
  ktab: d => { prefs.ktab = d.tab; savePrefs(); render(); window.scrollTo(0, 0); },
  enterKid: d => { prefs.kidMode = d.kid; prefs.ktab = 'today'; savePrefs(); render(); window.scrollTo(0, 0); },
  exitKid: () => openModal({ type: 'pin', purpose: 'exitKid' }),
  openKid: d => { ui.kidOpen = d.kid; prefs.tab = 'kids'; savePrefs(); render(); window.scrollTo(0, 0); },
  newKid: () => openModal({ type: 'kid', id: null, draft: { name: '', age: 8, avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], color: COLORS[kidsList().length % COLORS.length] } }),
  editKid: d => { const k = S.kids[d.kid]; openModal({ type: 'kid', id: k.id, draft: { name: k.name, age: k.age, avatar: k.avatar, color: k.color } }); },
  deleteKid: d => {
    const k = S.kids[d.kid];
    if (!confirm(t('kids.deleteConfirm', { name: k.name }))) return;
    busy(async () => { await removeKid(k.id); ui.kidOpen = null; if (prefs.kidMode === k.id) { prefs.kidMode = null; savePrefs(); } });
  },
  toggle: (d, el) => {
    const k = S.kids[d.kid];
    const st = G.status(k, d.hid, d.day, (k.habits || []).find(h => h.id === d.hid));
    if (d.ctx !== 'parent' && st === 'rejected') return;
    toggleMark(d.kid, d.hid, d.day, d.ctx, el);
  },
  toggleYesterday: () => { ui.showYesterday = !ui.showYesterday; render(); },
  approve: d => {
    const k = S.kids[d.kid];
    const approved = { ...(k.approved || {}) };
    approved[d.day] = { ...(approved[d.day] || {}), [d.hid]: d.v === '1' };
    updateKid(k.id, { approved }).catch(err => setMsg(errText(err), true));
  },
  decide: d => {
    const k = S.kids[d.kid];
    updateKid(k.id, { decisions: { ...(k.decisions || {}), [d.id]: d.v } }).catch(err => setMsg(errText(err), true));
  },
  catalog: d => openModal({ type: 'catalog', kid: d.kid }),
  addFromCatalog: d => {
    const c = HABITS.find(h => h.code === d.code);
    const k = S.kids[modal.kid];
    updateKid(k.id, { habits: [...(k.habits || []), habitFromCatalog(c)] }).catch(err => setMsg(errText(err), true));
    renderModal();
  },
  newHabit: d => openModal({ type: 'habit', kid: d.kid, hid: null, draft: { name: '', emoji: '⭐', stars: 1, days: [], approval: false } }),
  editHabit: d => { const h = S.kids[d.kid].habits.find(x => x.id === d.hid); openModal({ type: 'habit', kid: d.kid, hid: h.id, draft: { ...h, days: [...(h.days || [])] } }); },
  deleteHabit: () => {
    const k = S.kids[modal.kid];
    updateKid(k.id, { habits: k.habits.filter(h => h.id !== modal.hid) }).catch(err => setMsg(errText(err), true));
    closeModal();
  },
  bonus: d => openModal({ type: 'bonus', kid: d.kid, stars: 3 }),
  newReward: () => openModal({ type: 'reward', id: null, draft: { name: '', cost: 10, emoji: '🎁' } }),
  editReward: d => { const r = S.family.rewards.find(x => x.id === d.id); openModal({ type: 'reward', id: r.id, draft: { ...r } }); },
  deleteReward: d => { updateFamily({ rewards: S.family.rewards.filter(r => r.id !== d.id) }).catch(err => setMsg(errText(err), true)); closeModal(); },
  addIdea: d => {
    const r = REWARDS[Number(d.i)];
    updateFamily({ rewards: [...(S.family.rewards || []), { id: G.newId(), name: L(r), emoji: r.emoji, cost: r.cost }] }).catch(err => setMsg(errText(err), true));
  },
  want: d => { const r = S.family.rewards.find(x => x.id === d.id); if (r) openModal({ type: 'want', kid: d.kid, reward: r }); },
  confirmWant: () => {
    const k = S.kids[modal.kid], r = modal.reward;
    if (G.balance(k, S.family) < r.cost) return closeModal();
    const req = { id: G.newId(), rewardId: r.id, name: r.name, emoji: r.emoji, cost: r.cost, at: new Date().toISOString() };
    updateKid(k.id, { requests: [...(k.requests || []), req] }).catch(err => setMsg(errText(err), true));
    closeModal();
    sound('fanfare'); confetti(30);
    celebrateQueue.unshift({ emoji: r.emoji, title: t('kid.requested'), text: r.name });
    setTimeout(nextCelebration, 300);
  },
  pickPet: d => {
    const p = G.petById(d.id);
    openModal({ type: 'petName', kid: d.kid, name: L(p), pet: p.id });
  },
  renamePet: d => { const k = S.kids[d.kid]; openModal({ type: 'petName', kid: d.kid, name: k.pet.name, pet: k.pet.type }); },
  petTap: (d, el) => {
    const k = S.kids[d.kid];
    const egg = G.petLevel(G.lifetimeStars(k, S.family)).level === 0;
    const mood = egg ? 'egg' : G.petMood(k);
    ui.phrase[k.id] = { mood, text: t('mood.' + mood) };
    sound('pop');
    render();
    const pet = appEl.querySelector('.pet');
    pet?.classList.add('jump');
  },
  chIdea: d => { const h = HABITS.find(x => x.code === d.code); syncModalText(); modal.draft.name = h[lang] || h.en; modal.draft.emoji = h.emoji; renderModal(); },
  chWho: d => { syncModalText(); const p = modal.draft.participants; modal.draft.participants = p.includes(d.pid) ? p.filter(x => x !== d.pid) : [...p, d.pid]; renderModal(); },
  newChallenge: () => openModal({ type: 'challenge', draft: { name: '', emoji: '📖', days: 7, bonus: 10, startOffset: 1, participants: kidsList().map(k => 'k:' + k.id).concat(parentPid()) } }),
  chMark: (d, el) => {
    const today = G.today();
    const ch = S.family.challenges.find(c => c.id === d.id);
    if (!ch || G.challengeState(ch) !== 'active') return;
    if (d.pid.startsWith('k:')) {
      const k = S.kids[d.pid.slice(2)];
      const all = { ...(k.chMarks || {}) };
      const m = { ...(all[ch.id] || {}) };
      if (m[today]) delete m[today]; else { m[today] = true; sound('ding'); floatText(el, '🏆'); }
      all[ch.id] = m;
      updateKid(k.id, { chMarks: all }).catch(err => setMsg(errText(err), true));
    } else {
      const list = S.family.challenges.map(c => {
        if (c.id !== ch.id) return c;
        const marks = { ...(c.marks || {}) };
        const m = { ...(marks[d.pid] || {}) };
        if (m[today]) delete m[today]; else m[today] = true;
        marks[d.pid] = m;
        return { ...c, marks };
      });
      updateFamily({ challenges: list }).catch(err => setMsg(errText(err), true));
    }
  },
  chDelete: d => { if (confirm(t('ch.delete') + '?')) updateFamily({ challenges: S.family.challenges.filter(c => c.id !== d.id) }).catch(err => setMsg(errText(err), true)); },
  linkDevice: d => busy(async () => {
    const code = await createCode('child', d.kid);
    openModal({ type: 'code', code, title: `${S.kids[d.kid].avatar} ${S.kids[d.kid].name}`, text: t('kids.codeText') });
  }),
  inviteParent: () => busy(async () => {
    const code = await createCode('parent');
    openModal({ type: 'code', code, title: t('set.inviteParent').replace('+ ', ''), text: t('set.parentCodeText') });
  }),
  copyCode: async () => { try { await copyText(modal.code); modal.copied = true; renderModal(); } catch (err) {} },
  shareCode: async () => { try { await shareText(`YouBoost Kids: ${modal.code}\n${PUBLIC_URL}`); } catch (err) {} },
  unlink: d => { if (confirm(t('kids.unlink') + '?')) busy(() => removeMember(d.uid)); },
  editFamily: () => openModal({ type: 'text', field: 'familyName', title: t('set.family'), value: S.family?.name || '', ph: t('set.familyPh') }),
  sound: (d, el) => { prefs.sound = el.checked; savePrefs(); },
  changePin: () => openModal({ type: 'pin', purpose: 'changePin' }),
  signOut: () => { if (confirm(t('set.leaveConfirm'))) busy(async () => { await leaveDevice(); prefs.kidMode = null; prefs.pin = null; savePrefs(); ui.welcome = 'start'; }); },
  deleteFamily: () => {
    if (!confirm(t('set.deleteConfirm'))) return;
    const word = prompt(t('set.deleteConfirm2'));
    if ((word || '').trim().toLowerCase() !== t('set.deleteWord')) return;
    busy(async () => { await deleteFamily(); prefs.kidMode = null; prefs.pin = null; prefs.seen = {}; savePrefs(); ui.welcome = 'start'; });
  },
  childSettings: () => openGate('childSettings'),
  unlinkSelf: () => { if (confirm(t('set.unlinkConfirm'))) { closeModal(); busy(async () => { await leaveDevice(); ui.welcome = 'start'; }); } },
};

function syncModalText() {
  if (!modal?.draft) return;
  const map = { h_name: 'name', r_name: 'name', r_cost: 'cost', c_name: 'name', k_name: 'name' };
  for (const [id, key] of Object.entries(map)) {
    const el = modalEl.querySelector('#' + id);
    if (el) modal.draft[key] = id === 'r_cost' ? Number(el.value) : el.value;
  }
  const ap = modalEl.querySelector('#h_approval');
  if (ap) modal.draft.approval = ap.checked;
}

function openGate(next) {
  const a = 12 + Math.floor(Math.random() * 15), b = 3 + Math.floor(Math.random() * 7);
  openModal({ type: 'gate', a, b, next });
}

async function pinKey(k, purpose) {
  if (k === '⌫') ui.pinBuf = ui.pinBuf.slice(0, -1);
  else if (ui.pinBuf.length < 4) ui.pinBuf += k;
  sound('pop');
  const inModal = !!modal && modal.type === 'pin';
  const redraw = () => (inModal ? renderModal() : render());
  redraw();
  if (ui.pinBuf.length < 4) return;
  const pin = ui.pinBuf;
  await new Promise(r => setTimeout(r, 120));
  ui.pinBuf = '';
  if (purpose === 'setupPin' || purpose === 'newPin') {
    const first = inModal ? modal.first : ui.pinFirst;
    if (!first) {
      if (inModal) { modal.first = pin; modal.repeat = true; modal.error = null; } else { ui.pinFirst = pin; ui.msg = null; }
      return redraw();
    }
    if (first !== pin) {
      if (inModal) { modal.first = null; modal.repeat = false; modal.error = t('setup.pinMismatch'); } else { ui.pinFirst = null; ui.msg = { text: t('setup.pinMismatch'), error: true }; }
      return redraw();
    }
    prefs.pin = await hashPin(pin); savePrefs();
    ui.pinFirst = null; ui.msg = null;
    if (inModal) closeModal();
    if (purpose === 'setupPin') { confetti(40); sound('fanfare'); }
    return render();
  }
  // проверка PIN
  if ((await hashPin(pin)) !== prefs.pin) { modal.error = t('pin.wrong'); return redraw(); }
  if (purpose === 'exitKid') { prefs.kidMode = null; savePrefs(); closeModal(); render(); window.scrollTo(0, 0); return; }
  if (purpose === 'changePin') { openModal({ type: 'pin', purpose: 'newPin' }); }
}

// ---------- Формы ----------
const forms = {
  joinChild: f => {
    const code = f.querySelector('#code').value;
    busy(async () => {
      await joinWithCode(code, navigator.userAgent.includes('Android') ? 'Android' : (navigator.platform || ''));
      prefs.ktab = 'today'; savePrefs();
    });
  },
  joinParent: f => {
    const code = f.querySelector('#code').value;
    busy(async () => { await parentJoin(code); });
  },
  setupKid: f => {
    const d = ui.setup;
    d.name = f.querySelector('#s_name').value.trim();
    d.starter = f.querySelector('#s_starter').checked;
    if (!d.name) return f.querySelector('#s_name').focus();
    busy(async () => {
      const habits = d.starter ? starterFor(d.age).map(code => habitFromCatalog(HABITS.find(h => h.code === code))) : [];
      await addKid({ name: d.name, age: d.age, avatar: d.avatar, color: d.color, habits });
      if (!(S.family?.rewards || []).length) {
        await updateFamily({ rewards: REWARDS.slice(0, 4).map(r => ({ id: G.newId(), name: L(r), emoji: r.emoji, cost: r.cost })) });
      }
    });
  },
  kid: f => {
    const d = modal.draft;
    d.name = f.querySelector('#k_name').value.trim();
    if (!d.name) return f.querySelector('#k_name').focus();
    const starter = f.querySelector('#k_starter')?.checked;
    const id = modal.id;
    closeModal();
    busy(async () => {
      if (id) await updateKid(id, { name: d.name, age: d.age, avatar: d.avatar, color: d.color });
      else {
        const habits = starter ? starterFor(d.age).map(code => habitFromCatalog(HABITS.find(h => h.code === code))) : [];
        ui.kidOpen = await addKid({ name: d.name, age: d.age, avatar: d.avatar, color: d.color, habits });
      }
    });
  },
  habit: f => {
    syncModalText();
    const d = modal.draft;
    d.name = d.name.trim();
    if (!d.name) return f.querySelector('#h_name').focus();
    const k = S.kids[modal.kid];
    const habit = { ...d, stars: Number(d.stars) || 1, days: d.days || [] };
    let habits;
    if (modal.hid) habits = k.habits.map(h => (h.id === modal.hid ? { ...h, ...habit, id: h.id } : h));
    else habits = [...(k.habits || []), { ...habit, id: G.newId(), since: G.today() }];
    updateKid(k.id, { habits }).catch(err => setMsg(errText(err), true));
    closeModal();
  },
  reward: f => {
    syncModalText();
    const d = modal.draft;
    d.name = (d.name || '').trim();
    d.cost = Math.max(1, Math.min(9999, Math.round(Number(d.cost) || 1)));
    if (!d.name) return f.querySelector('#r_name').focus();
    const list = S.family.rewards || [];
    const rewards = modal.id ? list.map(r => (r.id === modal.id ? { ...r, ...d } : r)) : [...list, { id: G.newId(), name: d.name, emoji: d.emoji, cost: d.cost }];
    updateFamily({ rewards }).catch(err => setMsg(errText(err), true));
    closeModal();
  },
  bonus: f => {
    const k = S.kids[modal.kid];
    const reason = f.querySelector('#b_reason').value.trim();
    updateKid(k.id, { bonus: [...(k.bonus || []), { id: G.newId(), stars: modal.stars, reason, at: new Date().toISOString() }] }).catch(err => setMsg(errText(err), true));
    closeModal();
    confetti(20); sound('ding');
  },
  petName: f => {
    const name = f.querySelector('#petName').value.trim() || modal.name;
    const k = S.kids[modal.kid];
    const type = modal.pet || k.pet?.type;
    updateKid(k.id, { pet: { ...(k.pet || {}), type, name } }).catch(err => setMsg(errText(err), true));
    closeModal();
    if (!k.pet) { confetti(30); sound('fanfare'); }
  },
  text: f => {
    const v = f.querySelector('#t_val').value.trim();
    if (modal.field === 'familyName') updateFamily({ name: v }).catch(err => setMsg(errText(err), true));
    closeModal();
  },
  challenge: f => {
    syncModalText();
    const d = modal.draft;
    d.name = d.name.trim();
    if (!d.name) return f.querySelector('#c_name').focus();
    if (d.participants.length < 2) { modal.error = t('ch.needTwo'); return renderModal(); }
    const ch = { id: G.newId(), name: d.name, emoji: d.emoji, days: d.days, bonus: d.bonus, start: G.addDays(G.today(), d.startOffset), participants: d.participants, marks: {}, createdAt: new Date().toISOString() };
    updateFamily({ challenges: [...(S.family.challenges || []), ch] }).catch(err => setMsg(errText(err), true));
    closeModal();
  },
  gate: f => {
    const ans = Number(f.querySelector('#gateAns').value);
    if (ans !== modal.a * modal.b) { modal.error = true; return renderModal(); }
    const next = modal.next;
    if (next === 'resetPin') openModal({ type: 'pin', purpose: 'newPin' });
    else if (next === 'childSettings') openModal({ type: 'childSettings' });
  },
};

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT') return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  ev.preventDefault();
  fn(el.dataset, el);
});
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset.act === 'sound') actions.sound(el.dataset, el);
  if (el.dataset.act === 'reminder') setReminder(el.value);
});
document.addEventListener('submit', ev => {
  const f = ev.target.closest('form[data-form]');
  if (!f) return;
  ev.preventDefault();
  forms[f.dataset.form]?.(f);
});

async function setReminder(value) {
  if (!value) { prefs.reminder = null; savePrefs(); return cancelDailyReminder(); }
  const [h, m] = value.split(':').map(Number);
  prefs.reminder = { h, m }; savePrefs();
  const ok = await scheduleDailyReminder(h, m, 'YouBoost Kids ⭐', lang === 'ru' ? 'Пора отметить дела и порадовать питомца!' : 'Time to check off your tasks and make your pet happy!');
  if (!ok) { prefs.reminder = null; savePrefs(); render(); }
}

onBackButton(() => { if (modal) { closeModal(); return true; } return false; });

// Новый день — перерисовать (если приложение открыто через полночь).
let lastDay = G.today();
setInterval(() => { if (G.today() !== lastDay) { lastDay = G.today(); render(); } }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

const GOOGLE_SVG = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

initStore(render);
render();
