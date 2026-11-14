// Интерфейс YouBoost Kids: экраны родителя и ребёнка.
import { setupSolo, isSolo } from './store.js';
import { S, initStore, kidsList, updateKid, joinWithCode, leaveDevice, friendInvite, friendGetInvite, friendAccept, friendUpdate, friendRemove, friendRefreshCards } from './store.js';
import * as F from './friends.js';
import * as G from './logic.js';
import { t, pw, lang, setLang, LANGS, L, raw } from './i18n.js';
import { CATEGORIES, HABITS, REWARDS, HABIT_EMOJI, REWARD_EMOJI, AVATARS, COLORS, starterFor, randomNick } from './catalog.js';
import { canPickContact, pickContact, openSms, openWhatsApp } from './native.js';
import { isNative, hasNativeGoogle, PUBLIC_URL, shareText, copyText, scheduleDailyReminder, cancelDailyReminder, canRemind, onBackButton } from './native.js';

const ADULT_URL = 'https://shusandrik23.github.io/Poleznieprivichki/';
const appEl = document.getElementById('app');
const modalEl = document.getElementById('modal');
const fxEl = document.getElementById('fx');

// ---------- Настройки этого устройства ----------
const PREFS_KEY = 'ybk-prefs';
function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (err) { return null; } }
const prefs = Object.assign({ pin: null, sound: true, tab: 'home', ktab: 'today', kidMode: null, seen: {}, reminder: null }, readJSON(PREFS_KEY) || {});
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (err) {} }


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
  checkFriendLink();
  maybeRefreshCards();
  autoJoin();
}

// Ссылка от родителя (?join=КОД): подключаемся сами, без ввода кода.
function autoJoin() {
  if (!ui.joinCode || ui.autoJoined || !S.ready || !S.cloudReady || (S.mode && !isSolo()) || ui.busy) return;
  ui.autoJoined = true;
  const code = ui.joinCode;
  setTimeout(() => busy(async () => {
    await joinWithCode(code, navigator.userAgent.includes('Android') ? 'Android' : (navigator.platform || ''));
    prefs.ktab = 'today'; savePrefs();
  }), 0);
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
  return !S.ready || !S.mode || S.role !== 'child' ? 'welcome' : 'kid';
}

function view() {
  if (!S.ready || (S.mode === 'cloud' && !S.synced)) return splash();
  if (!S.mode) return welcome();
  if (S.role === 'child') {
    const kid = S.kids[S.kidId];
    return kid ? kidView(kid, { device: true }) : splash();
  }
  return parentMoved();
}

// YouBoost Kids — только для детей. Родители управляют семьёй во взрослом YouBoost (вкладка «Дети»).
function parentMoved() {
  return `<main class="narrow"><div class="hero"><div class="logo-big">👨‍👩‍👧</div></div>
    <div class="card center"><h2>${t('moved.title')}</h2><p class="muted">${t('moved.text')}</p>
      <div class="stack"><a class="btn big primary" href="${ADULT_URL}" target="_blank" rel="noopener">${t('moved.open')}</a>
      <button class="btn big" data-act="leaveParent">${t('moved.reset')}</button></div></div></main>`;
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
  if (ui.welcome === 'solo') {
    const d = (ui.solo ||= { name: randomNick(lang), age: 8, avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], color: COLORS[Math.floor(Math.random() * COLORS.length)] });
    return `<main class="narrow">
      <div class="hero small"><div class="avatar xl" style="background:${d.color}">${d.avatar}</div></div>
      <div class="card stack"><h2>${t('solo.title')}</h2><p class="muted">${t('solo.text')}</p>
        <div class="field"><span>${t('solo.nick')}</span><div class="row"><div class="nick-big grow">${e(d.name)}</div><button class="btn" data-act="soloReroll" aria-label="${t('solo.reroll')}">🎲</button></div></div>
        <div class="field"><span>${t('setup.kidAge')}</span>
          <div class="chips">${[5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(a => `<button type="button" class="chip ${d.age === a ? 'sel' : ''}" data-act="soloSet" data-k="age" data-v="${a}">${a}</button>`).join('')}</div></div>
        <div class="field"><span>${t('setup.avatar')}</span>
          <div class="emoji-grid">${AVATARS.map(a => `<button type="button" class="emo ${d.avatar === a ? 'sel' : ''}" data-act="soloSet" data-k="avatar" data-v="${a}">${a}</button>`).join('')}</div></div>
        <button class="btn big primary" data-act="soloStart">${t('solo.go')}</button>
        <p class="hint center">${t('solo.local')}</p>
      </div>
      <button class="link" data-act="welcome" data-step="start">${t('welcome.back')}</button></main>`;
  }
  if (ui.welcome === 'child') {
    return `<main class="narrow">${head}
      <div class="card"><h2>${t('welcome.childTitle')}</h2>
        <p class="muted">${t('welcome.childText')}</p>
        <form data-form="joinChild" class="stack">
          <input id="code" class="code-input" maxlength="8" autocomplete="off" autocapitalize="characters" placeholder="${t('welcome.codePh')}" value="${e(ui.joinCode || '')}">
          <button class="btn big primary" ${ui.busy || !S.cloudReady ? 'disabled' : ''}>${t('welcome.connect')}</button>
        </form>
      </div>${msgLine()}${offline}
      <button class="link" data-act="welcome" data-step="start">${t('welcome.back')}</button></main>`;
  }
  return `<main class="narrow">${head}
    ${S.unlinked ? `<p class="msg error">${t('welcome.unlinked')}</p>` : ''}
    ${pendingFriendCode() ? `<p class="msg">👫 ${t('fr.invitedFirst')}</p>` : ''}
    <div class="card center"><h2>${t('welcome.title')}</h2><p class="muted">${t('welcome.text')}</p>
      <div class="stack">
        <button class="btn big primary" data-act="welcome" data-step="solo">${t('welcome.solo')}</button>
        <button class="btn big" data-act="welcome" data-step="child">${t('welcome.childCode')}</button>
      </div>
    </div>
    <div class="card center parents-note"><b>${t('welcome.parentsTitle')}</b><p class="muted">${t('welcome.parentsText')}</p>
      <a class="btn" href="${ADULT_URL}" target="_blank" rel="noopener">${t('moved.open')}</a></div>
    <div class="lang-row">${LANGS.map(([c, n]) => `<button class="chip ${c === lang ? 'sel' : ''}" data-act="lang" data-lang="${c}">${n}</button>`).join('')}</div>
  </main>`;
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
  else if (tab === 'friends') body = kidFriends(kid);
  else body = kidToday(kid);
  const tabs = [['today', '🏠', t('ktab.today')], ['rewards', '🎁', t('ktab.rewards')], ['stickers', '🏅', t('ktab.stickers')], ['challenges', '🏆', t('ktab.challenges')], ['friends', '👫', t('ktab.friends')]];
  return `${top}<main class="kid-main">${body}</main>
    <nav class="bottom-nav kid">${tabs.map(([id, ic, label]) => `<button class="${tab === id ? 'active' : ''}" data-act="ktab" data-tab="${id}"><span class="ic">${ic}</span>${label}${(id === 'challenges' && activeChallengesFor('k:' + kid.id)) || (id === 'friends' && friendsAttention(kid)) ? '<i class="dot-badge"></i>' : ''}</button>`).join('')}</nav>`;
}

// ---------- Друзья (дети из других семей) ----------
function myFriendships(kid) { return Object.values(S.friendships || {}).filter(fr => F.involves(fr, kid.id)); }
function friendsAttention(kid) {
  const today = G.today();
  return myFriendships(kid).some(fr => F.isActive(fr) && F.challenges(fr).some(c =>
    (c.status === 'pending' && c.from !== kid.id) || (F.chState(c) === 'active' && !fr.m?.[kid.id]?.[c.id]?.[today])));
}

function friendAvatar(card) {
  return `<span class="avatar" style="background:${e(card.color || '#ff8a3d')}">${e(card.avatar || '🙂')}</span>`;
}

function friendChallengeHtml(fr, kid, c) {
  const st = F.chState(c);
  const friend = F.other(fr, kid.id);
  const today = G.today();
  if (st === 'declined') return '';
  if (st === 'pending') {
    return c.from === kid.id
      ? `<div class="fch pending">${e(c.emoji)} <b>${e(c.name)}</b> · ${c.days} ${pw(c.days, 'day')} <span class="tag wait">⏳ ${t('fr.waitAnswer')}</span></div>`
      : `<div class="fch incoming">⚔️ ${t('fr.challengesYou', { name: e(friend.card.name) })}: <b>${e(c.emoji)} ${e(c.name)}</b> · ${c.days} ${pw(c.days, 'day')}
          <div class="row gap"><button class="btn primary grow" data-act="frChAnswer" data-pair="${fr.id}" data-id="${c.id}" data-v="active">💪 ${t('fr.accept')}</button><button class="btn" data-act="frChAnswer" data-pair="${fr.id}" data-id="${c.id}" data-v="declined">${t('kid.no')}</button></div></div>`;
  }
  const mine = F.chCount(fr, kid.id, c), theirs = F.chCount(fr, friend.kidId, c);
  const dayN = Math.min(c.days, G.dayNumber(today) - G.dayNumber(c.start) + 1);
  const done = !!fr.m?.[kid.id]?.[c.id]?.[today];
  const win = st === 'finished' ? (mine > theirs ? 'me' : theirs > mine ? 'them' : 'tie') : null;
  return `<div class="fch ${st}">
    <div class="row-between"><b>${e(c.emoji)} ${e(c.name)}</b><span class="tag ${st === 'active' ? 'ok' : ''}">${st === 'active' ? t('ch.dayOf', { n: dayN, total: c.days }) : st === 'finished' ? (win === 'me' ? '🥇 ' + t('fr.youWon') : win === 'tie' ? '🤝 ' + t('fr.tie') : t('ch.finished')) : t('ch.upcoming')}</span></div>
    <div class="board">
      <div class="b-row ${win === 'me' ? 'win' : ''}"><span class="b-name">${e(kid.avatar)} ${t('fr.me')}</span><div class="bar"><div class="fill" style="width:${Math.round(mine / c.days * 100)}%"></div></div><span class="b-num">${mine}/${c.days}</span></div>
      <div class="b-row ${win === 'them' ? 'win' : ''}"><span class="b-name">${e(friend.card.avatar)} ${e(friend.card.name)}</span><div class="bar"><div class="fill" style="width:${Math.round(theirs / c.days * 100)}%"></div></div><span class="b-num">${theirs}/${c.days}</span></div>
    </div>
    ${st === 'active' ? `<button class="btn ${done ? 'done-btn' : 'primary'} full" data-act="frChMark" data-pair="${fr.id}" data-id="${c.id}" data-kid="${kid.id}">${done ? t('ch.doneToday') : '✅ ' + t('ch.markToday')}</button>` : ''}
  </div>`;
}

function kidFriends(kid) {
  if (isSolo()) return soloBanner(t('solo.friends'));
  if (S.mode !== 'cloud') return `<div class="empty">👫<p>${t('fr.needCloud')}</p></div>`;
  const list = myFriendships(kid);
  const active = list.filter(F.isActive);
  const waiting = list.filter(fr => !F.isActive(fr) && !F.isDeclined(fr));
  let html = `<section class="card center invite-box"><h2>${t('fr.title')}</h2><p class="muted">${t('fr.text')}</p>
    <div class="stack">
      ${canPickContact() ? `<button class="btn primary big" data-act="frContact" data-kid="${kid.id}" ${ui.busy ? 'disabled' : ''}>📇 ${t('fr.fromContacts')}</button>` : ''}
      <button class="btn big" data-act="frCode" data-kid="${kid.id}" ${ui.busy ? 'disabled' : ''}>🔗 ${t('fr.byCode')}</button>
      <button class="link" data-act="frEnter" data-kid="${kid.id}">${t('fr.haveCode')}</button>
    </div>
    ${canPickContact() ? '' : `<p class="hint">${t('fr.noContacts')}</p>`}
  </section>${msgLine()}`;
  if (waiting.length) {
    html += `<h3 class="section">${t('fr.waiting')}</h3><div class="card list">${waiting.map(fr => { const o = F.other(fr, kid.id); return `<div class="row">${friendAvatar(o.card)}<span class="grow"><b>${e(o.card.name)}</b><span class="small block">⏳ ${t('fr.waitParents')}</span></span></div>`; }).join('')}</div>`;
  }
  if (!active.length) return html + `<div class="empty">🤝<p>${t('fr.empty')}</p></div>`;
  html += `<h3 class="section">${t('fr.list')}</h3>` + active.map(fr => {
    const o = F.other(fr, kid.id);
    const chs = F.challenges(fr).filter(c => c.status !== 'declined' && !(F.chState(c) === 'finished' && G.challengeEnd(c) < G.addDays(G.today(), -7)));
    return `<div class="card friend-card" style="--kc:${e(o.card.color || '#ff8a3d')}">
      <div class="row">${friendAvatar(o.card)}<div class="grow"><div class="kid-name">${e(o.card.name)}</div>
        ${o.card.pet ? `<div class="small">${e(o.card.pet.emoji)} ${e(o.card.pet.name)}${o.card.pet.level ? ' · ' + t('kid.petLevel', { n: o.card.pet.level }) : ''}</div>` : ''}</div>
        <button class="btn sm primary" data-act="frChNew" data-pair="${fr.id}" data-kid="${kid.id}">⚔️ ${t('fr.challenge')}</button></div>
      ${chs.map(c => friendChallengeHtml(fr, kid, c)).join('')}
    </div>`;
  }).join('');
  return html;
}

function inviteText(code, kid) {
  return t('fr.inviteText', { name: kid.name, url: `${PUBLIC_URL}?friend=${code}`, code });
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
    : `<span class="stars-sm">${starIcons}</span>${streak > 1 ? ` <span class="tag fire">${t('kid.streak', { n: streak })}</span>` : ''}${h.from ? ` <span class="tag from">${t('kid.from', { name: e(h.from) })}</span>` : ''}`;
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
  if (isSolo()) html += `<div class="row gap solo-row"><button class="btn primary grow" data-act="callParent">${t('solo.call')}</button><button class="btn grow" data-act="soloTasks" data-kid="${kid.id}">${t('solo.myTasks')}</button></div><div class="spacer"></div>`;
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

function soloBanner(text = t('solo.callText')) {
  return `<section class="card center solo-banner"><div class="logo-big">👨‍👩‍👧</div><h2>${t('solo.callTitle')}</h2><p class="muted">${e(text)}</p>
    <button class="btn primary big" data-act="callParent">${t('solo.call')}</button></section>`;
}

function kidRewards(kid, bal) {
  const rewards = S.family?.rewards || [];
  let html = `<section class="balance-card"><div class="big-num">⭐ ${bal}</div><div>${pw(bal, 'star')}</div></section>`;
  if (isSolo()) return html + soloBanner(t('solo.rewards'));
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
  return '👤 ' + G.parentName(S.family, pid.slice(2), t('ch.parent'));
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

function adultsList() {
  if (S.mode === 'local') return [['p:local', t('ch.parent')]];
  return Object.entries(S.family?.parents || {}).map(([uid, name]) => ['p:' + uid, name || t('ch.parent')]);
}

function kidChallenges(kid) {
  const pid = 'k:' + kid.id;
  const list = sortedChallenges().filter(ch => ch.participants?.includes(pid));
  if (isSolo()) return soloBanner(t('solo.challenges'));
  let html = `<button class="btn primary big" data-act="propose" data-kid="${kid.id}">${t('kid.propose')}</button><div class="spacer"></div>`;
  const props = (kid.proposals || []).slice().reverse().slice(0, 6);
  if (props.length) {
    html += `<h3 class="section">${t('kid.proposals')}</h3><div class="card list">${props.map(p => {
      const st = G.proposalStatus(kid, p);
      return `<div class="row-between"><span>${e(p.emoji)} ${e(p.name)} · ${e(participantName(p.to))}</span><span class="tag ${st === 'accepted' ? 'ok' : st === 'declined' ? 'no' : 'wait'}">${t(st === 'accepted' ? 'kid.propAccepted' : st === 'declined' ? 'kid.propDeclined' : 'kid.propPending')}</span></div>`;
    }).join('')}</div>`;
  }
  if (!list.length) return html + `<div class="empty">🏆<p>${t('kid.noChallenges')}</p></div>`;
  return html + list.map(ch => challengeCard(ch, pid)).join('');
}




function daysText(days) {
  if (!days || !days.length || days.length === 7) return t('habit.everyDay');
  if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) return t('habit.weekdays');
  return [1, 2, 3, 4, 5, 6, 0].filter(d => days.includes(d)).map(d => raw('days')[d]).join(', ');
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
    case 'habit': return close + habitForm(m);
    case 'catalog': return close + catalogView(m);
    case 'want':
      return `<div class="center"><div class="cele-emoji">${e(m.reward.emoji)}</div><h2>${t('kid.confirmWant', { cost: m.reward.cost, name: e(m.reward.name) })}</h2>
        <div class="row gap center-row"><button class="btn big" data-act="closeModal">${t('kid.no')}</button><button class="btn primary big" data-act="confirmWant">${t('kid.yes')}</button></div></div>`;
    case 'petName':
      return `${close}<form data-form="petName" class="stack center"><div class="cele-emoji">${G.petById(m.type).emoji}</div><h2>${t('kid.petName')}</h2>
        <input id="petName" maxlength="20" value="${e(m.name)}" class="center-text" data-fresh><button class="btn primary big">${t('common.save')}</button></form>`;
    case 'frSend':
      return `${close}<div class="center"><div class="cele-emoji">📇</div><h2>${t('fr.sendTo', { name: e(m.contact.name || m.contact.phone) })}</h2><p class="muted">${t('fr.sendText')}</p>
        <div class="stack"><button class="btn primary big" data-act="frSms">💬 SMS</button><button class="btn big" data-act="frWa">🟢 WhatsApp</button></div></div>`;
    case 'frEnter':
      return `${close}<form data-form="frEnter" class="stack"><h2>${t('fr.haveCode')}</h2>
        <input id="frCode" class="code-input" maxlength="10" autocomplete="off" autocapitalize="characters" placeholder="ABCD2345" value="${e(m.code || '')}" data-fresh>
        ${m.error ? `<p class="msg error">${e(m.error)}</p>` : ''}<button class="btn primary big">${t('welcome.connect')}</button></form>`;
    case 'frConfirm': {
      const c = m.invite.card || {};
      const kids = S.role === 'child' ? [S.kids[S.kidId]] : kidsList();
      return `${close}<div class="center"><span class="avatar xl" style="background:${e(c.color || '#ff8a3d')}">${e(c.avatar || '🙂')}</span>
        <h2>${t('fr.addQ', { name: e(c.name) })}</h2>${c.pet ? `<p class="muted">${e(c.pet.emoji)} ${e(c.pet.name)}</p>` : ''}
        ${m.invite.via === 'code' ? `<p class="hint">${t('fr.codeNote')}</p>` : ''}
        ${m.error ? `<p class="msg error">${e(m.error)}</p>` : ''}
        <div class="stack">${kids.filter(Boolean).map(k => `<button class="btn primary big" data-act="frAccept" data-kid="${k.id}">${kids.length > 1 ? `${e(k.avatar)} ${e(k.name)}: ` : ''}${t('fr.yesFriends')}</button>`).join('')}</div></div>`;
    }
    case 'frChNew': {
      const d = m.draft;
      return `${close}<form data-form="frChNew" class="stack"><h2>⚔️ ${t('fr.challengeTitle', { name: e(m.friendName) })}</h2>
        <label class="field"><span>${t('ch.habit')}</span><input id="c_name" maxlength="40" value="${e(d.name)}" data-fresh></label>
        <div class="chips">${['read', 'sport', 'veggies', 'screen', 'water', 'teeth_pm'].map(code => { const h = HABITS.find(x => x.code === code); return `<button type="button" class="chip" data-act="chIdea" data-code="${code}">${h.emoji} ${e(h[lang] || h.en)}</button>`; }).join('')}</div>
        <div class="field"><span>${t('ch.days')}</span><div class="chips">${[3, 7, 14, 21].map(n => `<button type="button" class="chip ${d.days === n ? 'sel' : ''}" data-act="mdraft" data-k="days" data-v="${n}" data-num>${n}</button>`).join('')}</div></div>
        <button class="btn primary big">${t('kid.proposeSend')} ⚔️</button></form>`;
    }
    case 'propose': {
      const d = m.draft;
      const adults = adultsList();
      if (!adults.length) return `${close}<div class="center"><div class="cele-emoji">🤷</div><p>${t('kid.noParents')}</p></div>`;
      return `${close}<form data-form="propose" class="stack"><h2>${t('kid.proposeTitle')}</h2>
        <div class="field"><span>${t('kid.proposeWho')}</span><div class="chips">${adults.map(([pid, name]) => `<button type="button" class="chip big ${d.to === pid ? 'sel' : ''}" data-act="mdraft" data-k="to" data-v="${pid}">👤 ${e(name)}</button>`).join('')}</div></div>
        <label class="field"><span>${t('ch.habit')}</span><input id="c_name" maxlength="40" value="${e(d.name)}" data-fresh></label>
        <div class="chips">${['read', 'sport', 'veggies', 'screen', 'water', 'sleep'].map(code => { const h = HABITS.find(x => x.code === code); return `<button type="button" class="chip" data-act="chIdea" data-code="${code}">${h.emoji} ${e(h[lang] || h.en)}</button>`; }).join('')}</div>
        <div class="field"><span>${t('ch.days')}</span><div class="chips">${[3, 7, 14, 21].map(n => `<button type="button" class="chip ${d.days === n ? 'sel' : ''}" data-act="mdraft" data-k="days" data-v="${n}" data-num>${n}</button>`).join('')}</div></div>
        <button class="btn primary big">${t('kid.proposeSend')} ⚔️</button></form>`;
    }
    case 'soloTasks': {
      const kid = S.kids[m.kid];
      return `${close}<h2>${t('solo.tasksTitle')}</h2><div class="list">
        ${(kid.habits || []).map(h => `<button class="h-row" data-act="editHabit" data-kid="${kid.id}" data-hid="${h.id}"><span class="h-emoji sm">${e(h.emoji)}</span><span class="grow"><b>${e(h.name)}</b><span class="small block">${'⭐'.repeat(Math.min(h.stars, 3))} · ${daysText(h.days)}</span></span><span class="muted">›</span></button>`).join('') || `<p class="muted">${t('kids.noHabits')}</p>`}
        <div class="row gap"><button class="btn grow" data-act="catalog" data-kid="${kid.id}">📋 ${t('kids.fromCatalog')}</button><button class="btn grow" data-act="newHabit" data-kid="${kid.id}">✏️ ${t('kids.custom')}</button></div></div>`;
    }
    case 'callParent':
      return `${close}<div class="center"><div class="cele-emoji">👨‍👩‍👧</div><h2>${t('solo.callTitle')}</h2><p class="muted">${t('solo.callText')}</p></div>
        <div class="stack"><button class="btn primary big" data-act="soloShare">${t('solo.send')}</button></div>
        <form data-form="joinChild" class="stack" style="margin-top:16px"><h3 class="section">${t('solo.haveCode')}</h3>
          <input id="code" class="code-input" maxlength="8" autocomplete="off" autocapitalize="characters" placeholder="${t('welcome.codePh')}">
          ${ui.msg?.error ? `<p class="msg error">${e(ui.msg.text)}</p>` : ''}
          <button class="btn big" ${ui.busy || !S.cloudReady ? 'disabled' : ''}>${t('welcome.connect')}</button></form>`;
    case 'childSettings':
      if (isSolo()) return `${close}<h2>${t('set.title')}</h2><div class="list">
        <div class="row-between"><span>${t('set.lang')}</span><div class="chips">${LANGS.map(([c, n]) => `<button class="chip ${c === lang ? 'sel' : ''}" data-act="lang" data-lang="${c}">${n}</button>`).join('')}</div></div>
        <label class="row-between"><span>${t('set.sound')}</span><input type="checkbox" class="switch" data-act="sound" ${prefs.sound ? 'checked' : ''}></label>
        ${reminderRow()}
        <p class="hint">${t('solo.local')}</p>
        <button class="btn primary full" data-act="callParent">${t('solo.call')}</button>
        <a class="h-row" href="privacy.html" target="_blank" rel="noopener"><span class="grow">${t('set.privacy')}</span><span class="muted">›</span></a>
        <button class="btn full" data-act="soloRestart">${t('solo.restart')}</button></div>`;
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
    ${isSolo() ? '' : `<label class="check"><input type="checkbox" id="h_approval" ${d.approval ? 'checked' : ''} data-fresh> ${t('habit.approval')}</label>
    <p class="hint">${t('habit.approvalHint')}</p>`}
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


// ---------- Праздники: новые наклейки и уровни питомца ----------
function checkCelebrations() {
  const kid = S.role === 'child' ? S.kids[S.kidId] : null;
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



function habitFromCatalog(c) {
  // в самостоятельном режиме подтверждать некому
  return { id: G.newId(), code: c.code, name: c[lang] || c.en, emoji: c.emoji, stars: c.stars, days: c.days ? [...c.days] : [], approval: !!c.approval && !isSolo(), since: G.today() };
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
  // Вызовы с друзьями по такой же привычке засчитываются сами.
  if (S.mode === 'cloud') {
    for (const fr of Object.values(S.friendships || {})) {
      if (!F.involves(fr, kidId) || !F.isActive(fr)) continue;
      const fp = F.marksAfterHabit(fr, kidId, h.name, day, !!dm[hid]);
      if (fp) friendUpdate(fr.id, fp).catch(() => {});
    }
  }
}

const actions = {
  welcome: d => { ui.welcome = d.step; ui.msg = null; S.unlinked = false; ui.sawUnlinked = false; render(); },
  lang: d => { setLang(d.lang); ui.phrase = {}; render(); if (modal) renderModal(); },
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
  closeModal: () => closeModal(),
  ktab: d => { prefs.ktab = d.tab; savePrefs(); render(); window.scrollTo(0, 0); },
  toggle: (d, el) => {
    const k = S.kids[d.kid];
    const st = G.status(k, d.hid, d.day, (k.habits || []).find(h => h.id === d.hid));
    if (d.ctx !== 'parent' && st === 'rejected') return;
    toggleMark(d.kid, d.hid, d.day, d.ctx, el);
  },
  toggleYesterday: () => { ui.showYesterday = !ui.showYesterday; render(); },
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
    }
  },
  frContact: d => busy(async () => {
    const contact = await pickContact();
    if (!contact) return;
    const code = await friendInvite(d.kid, 'contact');
    openModal({ type: 'frSend', contact, text: inviteText(code, S.kids[d.kid]) });
  }),
  frSms: () => { openSms(modal.contact.phone, modal.text); closeModal(); },
  frWa: () => { openWhatsApp(modal.contact.phone, modal.text); closeModal(); },
  frCode: d => busy(async () => {
    const code = await friendInvite(d.kid, 'code');
    openModal({ type: 'code', code, title: t('fr.byCode'), text: t('fr.codeText'), share: inviteText(code, S.kids[d.kid]) });
  }),
  frEnter: () => openModal({ type: 'frEnter' }),
  frAccept: d => {
    const inv = modal.invite;
    busy(async () => {
      try { await friendAccept(inv, d.kid); } catch (err) { modal.error = errText(err); renderModal(); throw err; }
      closeModal();
      try { localStorage.removeItem('ybk-friend'); } catch (err) {}
      prefs.ktab = 'friends'; savePrefs();
      confetti(40); sound('fanfare');
    });
  },
  frApprove: d => friendUpdate(d.pair, { [`approvals.${S.fid}`]: d.v === '1' }).catch(err => setMsg(errText(err), true)),
  frRemove: d => { if (confirm(t('fr.remove') + '?')) friendRemove(d.pair).catch(err => setMsg(errText(err), true)); },
  frChNew: d => {
    const fr = S.friendships[d.pair];
    openModal({ type: 'frChNew', pair: d.pair, kid: d.kid, friendName: F.other(fr, d.kid).card.name, draft: { name: '', emoji: '⚔️', days: 7 } });
  },
  frChAnswer: d => {
    const patch = { [`ch.${d.id}.status`]: d.v };
    if (d.v === 'active') patch[`ch.${d.id}.start`] = G.today();
    friendUpdate(d.pair, patch).catch(err => setMsg(errText(err), true));
    if (d.v === 'active') { sound('fanfare'); confetti(30); }
  },
  frChMark: (d, el) => {
    const fr = S.friendships[d.pair];
    const today = G.today();
    const mine = { ...(fr.m?.[d.kid] || {}) };
    const cm = { ...(mine[d.id] || {}) };
    if (cm[today]) delete cm[today]; else { cm[today] = true; sound('ding'); floatText(el, '⚔️'); }
    mine[d.id] = cm;
    friendUpdate(d.pair, { [`m.${d.kid}`]: mine }).catch(err => setMsg(errText(err), true));
  },
  propose: d => {
    const adults = adultsList();
    openModal({ type: 'propose', kid: d.kid, draft: { to: adults[0]?.[0] || null, name: '', emoji: '🏆', days: 7 } });
  },
  copyCode: async () => { try { await copyText(modal.code); modal.copied = true; renderModal(); } catch (err) {} },
  shareCode: async () => { try { await shareText(modal.share || `YouBoost Kids: ${modal.code}\n${PUBLIC_URL}?join=${modal.code}`); } catch (err) {} },
  sound: (d, el) => { prefs.sound = el.checked; savePrefs(); },
  childSettings: () => (isSolo() ? openModal({ type: 'childSettings' }) : openGate('childSettings')),
  leaveParent: () => busy(async () => { await leaveDevice(); prefs.kidMode = null; prefs.pin = null; savePrefs(); ui.welcome = 'start'; }),
  soloReroll: () => { ui.solo.name = randomNick(lang); sound('pop'); render(); },
  soloSet: d => { ui.solo[d.k] = d.k === 'age' ? Number(d.v) : d.v; render(); },
  soloStart: () => {
    const d = ui.solo;
    const habits = starterFor(d.age).map(code => habitFromCatalog(HABITS.find(h => h.code === code))).map(h => ({ ...h, approval: false }));
    setupSolo({ name: d.name, age: d.age, avatar: d.avatar, color: d.color, habits });
    prefs.ktab = 'today'; prefs.pin = null; savePrefs();
    ui.solo = null;
    confetti(40); sound('fanfare');
    render();
  },
  soloTasks: d => openModal({ type: 'soloTasks', kid: d.kid }),
  callParent: () => { ui.msg = null; openModal({ type: 'callParent' }); },
  soloShare: async () => { try { await shareText(t('solo.message', { url: ADULT_URL })); } catch (err) {} },
  soloRestart: () => {
    if (!confirm(t('solo.restartConfirm'))) return;
    closeModal();
    busy(async () => { await leaveDevice(); prefs.seen = {}; savePrefs(); ui.welcome = 'start'; });
  },
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


// ---------- Формы ----------
const forms = {
  joinChild: f => {
    const code = f.querySelector('#code').value;
    const fromModal = modal?.type === 'callParent';
    busy(async () => {
      try {
        await joinWithCode(code, navigator.userAgent.includes('Android') ? 'Android' : (navigator.platform || ''));
      } finally { if (fromModal && modal) renderModal(); }
      prefs.ktab = 'today'; savePrefs();
      if (fromModal) closeModal();
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
  petName: f => {
    const name = f.querySelector('#petName').value.trim() || modal.name;
    const k = S.kids[modal.kid];
    const type = modal.pet || k.pet?.type;
    updateKid(k.id, { pet: { ...(k.pet || {}), type, name } }).catch(err => setMsg(errText(err), true));
    closeModal();
    if (!k.pet) { confetti(30); sound('fanfare'); }
  },
  frEnter: f => {
    const code = f.querySelector('#frCode').value;
    busy(async () => {
      try { openModal({ type: 'frConfirm', invite: await friendGetInvite(code) }); }
      catch (err) { modal.error = errText(err); modal.code = code; renderModal(); }
    });
  },
  frChNew: f => {
    syncModalText();
    const d = modal.draft;
    d.name = d.name.trim();
    if (!d.name) return f.querySelector('#c_name').focus();
    const id = G.newId();
    friendUpdate(modal.pair, { [`ch.${id}`]: F.newChallenge(modal.kid, d) }).catch(err => setMsg(errText(err), true));
    closeModal();
    sound('fanfare'); confetti(25);
  },
  propose: f => {
    syncModalText();
    const d = modal.draft;
    d.name = d.name.trim();
    if (!d.name) return f.querySelector('#c_name').focus();
    if (!d.to) return;
    const k = S.kids[modal.kid];
    const prop = { id: G.newId(), to: d.to, name: d.name, emoji: d.emoji, days: d.days, at: new Date().toISOString() };
    updateKid(k.id, { proposals: [...(k.proposals || []), prop].slice(-20) }).catch(err => setMsg(errText(err), true));
    closeModal();
    sound('fanfare'); confetti(30);
    celebrateQueue.unshift({ emoji: '⚔️', title: t('kid.proposeSent'), text: t('kid.proposeSentText') });
    setTimeout(nextCelebration, 300);
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


// Ссылки-приглашения: ?join=КОД — родитель зовёт ребёнка в семью, ?friend=КОД — друг зовёт дружить.
(function readLinks() {
  const q = new URLSearchParams(location.search);
  const join = F.cleanCode(q.get('join'));
  const friend = F.cleanCode(q.get('friend'));
  if (join) { ui.joinCode = join; ui.welcome = 'child'; }
  if (friend) { try { localStorage.setItem('ybk-friend', friend); } catch (err) {} }
  if (join || friend) {
    q.delete('join'); q.delete('friend');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
  }
})();
function pendingFriendCode() { try { return localStorage.getItem('ybk-friend'); } catch (err) { return null; } }
let friendLinkBusy = false;
function checkFriendLink() {
  const code = pendingFriendCode();
  if (!code || friendLinkBusy || modal || S.mode !== 'cloud' || !S.synced) return;
  if (!kidsList().length) return;
  friendLinkBusy = true;
  friendGetInvite(code).then(invite => {
    if (invite.fid === S.fid) { localStorage.removeItem('ybk-friend'); return; }
    openModal({ type: 'frConfirm', invite });
  }).catch(err => { try { localStorage.removeItem('ybk-friend'); } catch (e2) {} setMsg(errText(err), true); })
    .finally(() => { friendLinkBusy = false; });
}
let cardsAt = 0;
function maybeRefreshCards() {
  if (Date.now() - cardsAt < 15000) return;
  cardsAt = Date.now();
  friendRefreshCards();
}

initStore(render);
render();
