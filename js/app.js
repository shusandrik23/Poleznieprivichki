import { dateKey, dayKeyFromNumber, streaks, canFreezeYesterday, liveStreak, challengeProgress, todayNumber, escapeHtml as e } from './core.js';
import * as cloud from './cloud.js';
import { social } from './cloud.js';
import { t, pw, num, lang, setLang, locale, LANGS } from './i18n.js';
import { CATEGORIES, catalogName, keyOf, keyOfName, normKey, displayName, nameOfKey } from './catalog.js';
import { factFor } from './facts.js';
import { quoteFor } from './quotes.js';
import { PLANS, goalLimit, hasPlus, plusUntil, startTrial, trialUsed, PLUS_FEATURES } from './plans.js';
import { tipFor } from './tips.js';
import { habitStats, HEAT_WEEKS } from './stats.js';
import { prefs, savePrefs, applyTheme, theme, THEMES } from './prefs.js';
import { isNative, hasNativeGoogle, appUrl, PUBLIC_URL, nativeShare, copyText, openExternal, onBackButton, onAppUrlOpen, scheduleDailyReminder, cancelDailyReminder, notifyNow, replaceScheduled, registerPush, unregisterPush } from './native.js';
import { tournamentsAround, tournamentStatus, canJoin, FLAG_LIMIT, tourProgress } from './tournaments.js';

const STORAGE_KEY = 'habit-trainer-v1';
const TAB_KEY = 'habit-trainer-tab';
const INVITE_KEY = 'habit-trainer-invite';

const GOAL_PRESETS = [7, 21, 30, 66, 100];
const CHALLENGE_DAYS = [7, 14, 21, 30, 66, 100];

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const SHARE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';
const GOOGLE_SVG = '<svg viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const APPLE_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3 0 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4zM13.9 5c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>';

// «5 дней» / «5 days»
const nd = n => `${n} ${pw(n, 'day')}`;

// ---------- Данные ----------

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.habits)) return data;
  } catch (err) {}
  return { habits: [] };
}
let state = load();

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (err) {}
  cloud.scheduleSync();
}

let tab = 'habits';
try { tab = localStorage.getItem(TAB_KEY) || 'habits'; } catch (err) {}
if (tab === 'settings') tab = 'habits';   // настройки не открываем сразу при запуске
let editingGoal = null;     // id привычки с открытым редактором цели
let renaming = false;       // открыта форма смены ника
let challengeFriend = '';   // выбранный соперник в форме вызова
let challengeHabit = '';    // выбранная привычка в форме вызова
let factOffset = 0;         // «ещё факт»
let sharing = null;         // id привычки с открытой панелью «поделиться»
let statsOpen = null;       // id привычки с открытой статистикой (Plus)
let suggestions = null;     // случайные соперники
let suggestionsLoading = false;
let sentTo = {};            // кому уже бросили вызов из подборки
let suggestPhoto = false;   // галочка «с фото» в подборе соперников
const tourData = {};        // id турнира → { top, total, myPlace, loading }
let tourOpen = null;        // турнир с раскрытой таблицей лидеров
let feedOpen = null;        // турнир с раскрытой лентой фото
let photoUploading = null;  // турнир, для которого загружается фото
let photoFor = null;        // { kind: 'tour' | 'ch', id } — для чего выбирают фото
const challData = {};       // id вызова → { photos, loading }
const cleanedCh = new Set(); // вызовы, чьи фото уже удалены после окончания
let similar = null;         // результаты поиска единомышленников
let similarLoading = false;
let pendingInvite = null;   // { code, data?, status }
const flash = {};           // сообщения под формами: { friends: {text, error} }

function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Каталожные привычки совпадают на любом языке («Read for 20 minutes» = «Читать 20 минут»).
function findHabit(name) { const k = keyOfName(name); return state.habits.find(h => keyOf(h) === k); }
function findByKey(key) { const k = normKey(key); return state.habits.find(h => keyOf(h) === k); }
const hName = h => displayName(h.name);

// silent — привычка добавляется из вызова, приглашения или турнира (без сообщений).
function addHabit(name, { silent } = {}) {
  name = name.trim();
  if (!name) return false;
  if (findHabit(name)) {
    if (!silent) alert(t('habit.exists', { name: displayName(name) }));
    return false;
  }
  state.habits.push({ id: newId(), name, done: {}, created: dateKey(new Date()) });
  save(); render();
  return true;
}

function toggle(id, key) {
  const h = state.habits.find(x => x.id === id);
  if (!h) return;
  if (h.frozen?.[key]) {           // замороженный день отмечаем выполненным — заморозка возвращается
    delete h.frozen[key];
    rewards().freezes++;
    h.done[key] = true;
  } else if (h.done[key]) delete h.done[key];
  else h.done[key] = true;
  save(); render();
}

// ---------- Пазл и заморозки ----------

const PUZZLE_SIZE = 7;
function rewards() { return (state.rewards ||= { pieces: 0, freezes: 0, lastVisit: null }); }

// Кусочек пазла за каждый день, когда человек открыл приложение. 7 кусочков — заморозка.
function dailyVisit() {
  const r = rewards();
  const today = dateKey(new Date());
  if (r.lastVisit === today) return;
  r.lastVisit = today;
  r.pieces++;
  if (r.pieces >= PUZZLE_SIZE) {
    r.pieces = 0;
    r.freezes++;
    flash.puzzle = { text: t('puzzle.complete'), big: true };
  } else {
    flash.puzzle = { text: t('puzzle.piece', { n: r.pieces }) };
  }
  save();
}

// Заморозить вчерашний пропуск, чтобы серия не прервалась.
function useFreeze(id) {
  const h = state.habits.find(x => x.id === id);
  const r = rewards();
  if (!h || r.freezes < 1 || !canFreezeYesterday(h)) return;
  (h.frozen ||= {})[dayKeyFromNumber(todayNumber() - 1)] = true;
  r.freezes--;
  flash.puzzle = null;
  save(); render();
}

function puzzleHtml() {
  const r = rewards();
  const slots = Array.from({ length: PUZZLE_SIZE }, (_, i) => `<span class="piece${i < r.pieces ? ' on' : ''}">${i < r.pieces ? '🧩' : ''}</span>`).join('');
  return `<div class="puzzle-row">
      <div class="pieces" title="${r.pieces} / ${PUZZLE_SIZE}"><span class="ptitle">${t('puzzle.title')}</span>${slots}</div>
      <span class="freezes">${t('puzzle.freezes', { n: r.freezes })}</span>
    </div>
    ${flash.puzzle ? `<p class="puzzle-msg${flash.puzzle.big ? ' big' : ''}">${e(flash.puzzle.text)}</p>` : `<p class="small">${t('puzzle.note')}</p>`}`;
}

function removeHabit(id) {
  const h = state.habits.find(x => x.id === id);
  if (!h || !confirm(t('habit.removeConfirm', { name: hName(h) }))) return;
  state.habits = state.habits.filter(x => x.id !== id);
  save(); render();
}

function setGoal(id, days) {
  const h = state.habits.find(x => x.id === id);
  if (!h) return;
  if (days && !h.goal && state.habits.filter(x => x.goal).length >= goalLimit(social.referrals)) {
    flash.goal = { text: goalLimitText(), error: true, invite: true };
    render();
    return;
  }
  flash.goal = null;
  if (days) h.goal = days; else delete h.goal;
  editingGoal = null;
  save(); render();
}

function goalLimitText() {
  const n = goalLimit(social.referrals);
  return t('goal.limit', { n, goals: pw(n, 'activeGoal'), bonus: PLANS.bonusPerReferral });
}

// ---------- Отрисовка ----------

const $ = id => document.getElementById(id);

// Перерисовка без потери того, что пользователь уже ввёл в поля.
function setHTML(el, html) {
  const saved = {};
  let focus = null;
  for (const f of el.querySelectorAll('form[data-form] [name]')) {
    const k = f.form.dataset.form + (f.form.dataset.id || '') + ':' + f.name;
    saved[k] = f.type === 'checkbox' ? f.checked : f.value;
    if (f === document.activeElement) focus = { k, start: f.selectionStart, end: f.selectionEnd };
  }
  el.innerHTML = html;
  for (const f of el.querySelectorAll('form[data-form] [name]')) {
    const k = f.form.dataset.form + (f.form.dataset.id || '') + ':' + f.name;
    if (k in saved) { if (f.type === 'checkbox') f.checked = saved[k]; else f.value = saved[k]; }
    if (focus && focus.k === k) { f.focus(); try { f.setSelectionRange(focus.start, focus.end); } catch (err) {} }
  }
  syncNameField(el);
}

// Поле «настоящее имя» видно, только когда стоит галочка.
function syncNameField(root) {
  const cb = root.querySelector('input[name=showName]');
  if (cb) cb.form.querySelector('.indent').hidden = !cb.checked;
}
function clearForm(form) { for (const f of form.querySelectorAll('input')) f.value = ''; }

// Тексты из index.html (data-i18n="ключ", data-i18n-ph — для placeholder).
function applyStaticTexts() {
  document.title = t('app.title');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  $('settingsBtn').setAttribute('aria-label', t('settings.open'));
  $('settingsBtn').title = t('settings.open');
}

function render() {
  const now = new Date();
  $('today').textContent = now.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });

  const incomingChallenges = social.challenges.filter(c => c.status === 'pending' && c.participants[1] === social.user?.uid).length;
  for (const b of document.querySelectorAll('.tabs button')) {
    b.classList.toggle('active', b.dataset.tab === tab);
    const badge = b.dataset.tab === 'friends' ? social.incoming.length : b.dataset.tab === 'challenges' ? incomingChallenges : 0;
    b.querySelector('.badge').textContent = badge || '';
  }
  for (const v of document.querySelectorAll('.view')) v.hidden = v.id !== 'view-' + tab;
  renderInviteBanner();
  renderAppAuth();

  syncScheduled();
  if (tab === 'habits') renderHabits();
  if (tab === 'friends') renderFriends();
  if (tab === 'challenges') renderChallenges();
  if (tab === 'settings') renderSettings();
  $('settingsBtn').classList.toggle('active', tab === 'settings');
}

// Как показывать друга: настоящее имя, если он разрешил, иначе ник.
function friendLabel(f) { return social.friendStats[f.uid]?.realName || '@' + f.nickname; }
function friendHtml(f) {
  const real = social.friendStats[f.uid]?.realName;
  return real ? `${e(real)} <span class="nick">@${e(f.nickname)}</span>` : `@${e(f.nickname)}`;
}

// Серии друзей по такой же привычке.
function friendsOnHabit(h) {
  const key = keyOf(h);
  const today = todayNumber();
  const out = [];
  for (const f of social.friends) {
    const st = social.friendStats[f.uid]?.habits?.find(x => normKey(x.key) === key);
    if (st) out.push({ name: friendLabel(f), cur: liveStreak(st, today) });
  }
  return out.sort((a, b) => b.cur - a.cur);
}

// ---------- YouBoost Plus: статистика, советы, напоминания ----------
const WEEKDAY_BASE = 4;   // день № 4 от 1970-01-01 — понедельник 5 января
const weekdayName = (i, style = 'short') => new Date((WEEKDAY_BASE + i) * 86400000).toLocaleDateString(locale(), { weekday: style, timeZone: 'UTC' });
const habitCatalogId = h => { const k = keyOf(h); return k.startsWith('c:') ? k.slice(2) : null; };

function statsPanelHtml(h) {
  const today = todayNumber();
  const st = habitStats(h, today);
  const heat = [];
  for (let w = 0; w < HEAT_WEEKS; w++) for (let d = 0; d < 7; d++) heat.push(`<i class="hc ${st.heat[w * 7 + d]}" style="grid-column:${w + 1};grid-row:${d + 1}"></i>`);
  const maxM = Math.max(1, ...st.months.map(m => m.count));
  const monthName = m => new Date(Date.UTC(m.y, m.m - 1, 1)).toLocaleDateString(locale(), { month: 'short', timeZone: 'UTC' });
  const rems = h.reminders || [];
  return `<div class="panel stats-panel">
    <p class="tip">💡 ${e(tipFor(habitCatalogId(h), today))}</p>
    <div class="stat-tiles">
      <div><b>${st.total}</b><span>${t('stats.totalDays', { days: pw(st.total, 'day') })}</span></div>
      <div><b>${st.rate7}%</b><span>${t('stats.rate7')}</span></div>
      <div><b>${st.rate30}%</b><span>${t('stats.rate30')}</span></div>
      <div><b>${st.rateAll}%</b><span>${t('stats.rateAll', { n: st.span, days: pw(st.span, 'day') })}</span></div>
    </div>
    <h4>${t('stats.heatTitle')}</h4>
    <div class="heat">${heat.join('')}</div>
    <h4>${t('stats.weekdays')}</h4>
    <div class="wd-bars">${st.weekdays.map((v, i) => `<div class="wd${i === st.best ? ' best' : ''}"><div class="wd-bar"><div style="height:${Math.round(v * 100)}%"></div></div><span>${weekdayName(i)}</span></div>`).join('')}</div>
    ${st.best >= 0 ? `<p class="small">${t('stats.bestWorst', { best: weekdayName(st.best, 'long'), worst: weekdayName(st.worst, 'long') })}</p>` : `<p class="small">${t('stats.tooEarly')}</p>`}
    <h4>${t('stats.months')}</h4>
    <div class="m-bars">${st.months.map(m => `<div class="mb"><b>${m.count}</b><div class="mb-bar"><div style="height:${Math.round(m.count / maxM * 100)}%"></div></div><span>${monthName(m)}</span></div>`).join('')}</div>
    <h4>${t('rem.title')}</h4>
    <div class="chips">${rems.map(tm => `<span class="chip selected">⏰ ${tm} <button class="chip-x" data-action="rem-del" data-id="${h.id}" data-time="${tm}" aria-label="${t('habit.delete')}">×</button></span>`).join('') || `<span class="small">${t('rem.none')}</span>`}</div>
    ${rems.length < 5 ? `<form class="row" data-form="rem" data-id="${h.id}"><input type="time" name="time" value="09:00" required><button class="chip" type="submit">${t('rem.add')}</button></form>` : ''}
    <p class="small">${isNative ? t('rem.note') : t('settings.reminderAppOnly')}</p>
    ${flashHtml('rem')}
  </div>`;
}

function plusTeaserHtml() {
  return `<div class="panel plus-teaser">
    <p><b>${t('plus.teaserTitle')}</b></p>
    <p>${t('plus.teaserText')}</p>
    <button class="btn plus-btn" data-action="go-plus">${t('plus.more')}</button>
  </div>`;
}

function plusCard() {
  const until = plusUntil();
  const list = PLUS_FEATURES.map(f => `<li>${t('plus.f.' + f)}</li>`).join('');
  let action;
  if (until) action = `<p class="plus-status">${t('plus.activeUntil', { date: new Date(until).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>`;
  else if (PLANS.testTrial && !trialUsed()) action = `<button class="btn plus-btn" data-action="plus-trial">${t('plus.tryBtn', { n: PLANS.trialDays })}</button><p class="small">${t('plus.tryNote')}</p>`;
  else action = `<p class="small">${t('plus.soon')}</p>`;
  return `<div class="card plus-card" id="plusCard"><h2>⭐ YouBoost Plus</h2><ul class="plus-list">${list}</ul>${action}</div>`;
}

// Разовые уведомления на ближайшие дни: напоминания по привычкам и «серия под угрозой».
// Пересчитываются при каждом изменении; если ничего не поменялось — не трогаем.
const SCHED_DAYS = 10;
let schedSig = null;
function syncScheduled() {
  if (!isNative) return;
  const list = [];
  if (hasPlus()) {
    const now = new Date();
    const todayKey = dateKey(now);
    let id = 2000;
    const at = (dayOffset, tm) => { const [hh, mm] = tm.split(':').map(Number); return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hh, mm); };
    const until = plusUntil();
    for (const h of state.habits) {
      for (const tm of h.reminders || []) {
        for (let d = 0; d < SCHED_DAYS; d++) {
          const when = at(d, tm);
          if (when <= now || when.getTime() > until) continue;
          if (d === 0 && h.done[todayKey]) continue;     // уже сделано сегодня — не напоминаем
          list.push({ id: id++, at: when, title: hName(h), body: t('rem.body') });
        }
      }
    }
    const r = prefs.risk;
    if (r?.on) {
      const atRisk = state.habits.filter(h => !h.done[todayKey] && streaks(h, todayKey).current >= 2);
      for (let d = 0; d < SCHED_DAYS; d++) {
        const when = at(d, r.time);
        if (when <= now || when.getTime() > until) continue;
        if (d === 0) {
          if (!atRisk.length) continue;
          const h = atRisk.sort((a, b) => streaks(b, todayKey).current - streaks(a, todayKey).current)[0];
          const n = streaks(h, todayKey).current;
          list.push({ id: id++, at: when, title: t('risk.title'), body: t('risk.bodyToday', { name: hName(h), n, days: pw(n, 'day'), more: atRisk.length - 1 }) });
        } else if (state.habits.length) {
          list.push({ id: id++, at: when, title: t('risk.title'), body: t('risk.bodyLater') });
        }
      }
    }
  }
  const sig = JSON.stringify(list.map(n => [n.id, +n.at, n.body]));
  if (sig === schedSig) return;
  schedSig = sig;
  replaceScheduled(list).then(ok => {
    if (!ok && list.length) { flash.rem = { text: t('settings.reminderDenied'), error: true }; schedSig = null; }
  });
}

function renderHabits() {
  const now = new Date();
  const todayKey = dateKey(now);
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    week.push({ key: dateKey(d), label: d.toLocaleDateString(locale(), { weekday: 'short' }), num: d.getDate() });
  }

  let doneCount = 0;
  const items = state.habits.map(h => {
    const name = hName(h);
    const done = !!h.done[todayKey];
    if (done) doneCount++;
    const { best, current } = streaks(h, todayKey);
    let html = `<li class="habit${done ? ' done' : ''}">
      <button class="check" data-action="toggle" data-id="${h.id}" data-day="${todayKey}" aria-label="${done ? t('habit.uncheck') : t('habit.check')}">${CHECK_SVG}</button>
      <div class="name">${e(name)}</div>
      <div class="actions">
        <button class="icon-btn${statsOpen === h.id ? ' active' : ''}" data-action="stats-toggle" data-id="${h.id}" title="${t('stats.open')}" aria-label="${t('stats.open')}">📊</button>
        ${current > 0 ? `<button class="icon-btn${sharing === h.id ? ' active' : ''}" data-action="share-edit" data-id="${h.id}" title="${t('habit.share')}" aria-label="${t('habit.share')}">${SHARE_SVG}</button>` : ''}
        <button class="icon-btn delete" data-action="remove" data-id="${h.id}" title="${t('habit.delete')}" aria-label="${t('habit.delete')}">×</button>
      </div>
      <div class="stats"><span>${t('stats.current', { n: current, days: pw(current, 'day') })}</span><span>${t('stats.best', { n: best, days: pw(best, 'day') })}</span></div>`;

    // Заморозка: вчера пропущено — можно спасти серию цели
    if (h.goal && canFreezeYesterday(h, todayKey)) {
      html += rewards().freezes > 0
        ? `<button class="freeze-btn" data-action="freeze" data-id="${h.id}">${t('freeze.use', { n: rewards().freezes })}</button>`
        : `<p class="freeze-hint">${t('freeze.none')}</p>`;
    }

    // Заметная кнопка «Поставить цель», пока цели нет
    if (!h.goal && editingGoal !== h.id) {
      html += `<button class="goal-btn" data-action="goal-edit" data-id="${h.id}">${t('goal.setBtn')}</button>`;
    }

    if (h.goal) {
      const reached = current >= h.goal, left = h.goal - current;
      html += `<div class="goal${reached ? ' reached' : ''}">
        <div class="goal-head"><span>${t('goal.head', { n: h.goal, days: pw(h.goal, 'day') })}<button class="goal-edit-link" data-action="goal-edit" data-id="${h.id}">${t('goal.editShort')}</button></span>
        <span>${reached ? t('goal.reached') : t('goal.progress', { cur: current, goal: h.goal, left, days: pw(left, 'day') })}</span></div>
        <div class="bar"><div class="fill" style="width:${Math.min(100, current / h.goal * 100)}%"></div></div></div>`;
    }

    if (editingGoal === h.id) {
      const custom = h.goal && !GOAL_PRESETS.includes(h.goal) ? h.goal : '';
      html += `<div class="panel">
        <p>${t('goal.question')}</p>
        <div class="chips">${GOAL_PRESETS.map(n => `<button class="chip${h.goal === n ? ' selected' : ''}" data-action="goal-set" data-id="${h.id}" data-days="${n}">${nd(n)}</button>`).join('')}</div>
        <form class="row" data-form="goal" data-id="${h.id}">
          <span>${t('goal.custom')}</span><input name="days" type="number" min="1" max="3650" inputmode="numeric" placeholder="${t('goal.daysPh')}" value="${custom}">
          <button class="chip" type="submit">${t('common.save')}</button>
          ${h.goal ? `<button class="link-btn" type="button" data-action="goal-set" data-id="${h.id}" data-days="">${t('goal.remove')}</button>` : ''}
        </form>${flash.goal ? `<div class="limit-card"><p>${e(flash.goal.text)}</p>${cloud.cloudAvailable ? `<button class="btn primary small-btn" data-action="limit-invite">${t('limit.inviteBtn')}</button>` : ''}</div>` : ''}</div>`;
    }

    if (statsOpen === h.id) html += hasPlus() ? statsPanelHtml(h) : plusTeaserHtml();

    if (sharing === h.id && current > 0) {
      html += `<div class="panel share-panel">
        <img class="share-img" src="${streakImage(name, current)}" alt="${t('share.alt')}">
        <p>${t('share.text', { name: e(name) })}</p>
        <div class="row">
          ${canShareFiles() ? `<button class="btn primary" data-action="share-streak" data-via="image" data-id="${h.id}">${t('share.image')}</button>` : ''}
          <button class="btn whatsapp" data-action="share-streak" data-via="whatsapp" data-id="${h.id}">WhatsApp</button>
          ${canShareText() ? `<button class="btn" data-action="share-streak" data-via="share" data-id="${h.id}">${t('share.more')}</button>` : ''}
          <button class="btn" data-action="share-streak" data-via="copy" data-id="${h.id}">${t('share.copyText')}</button>
          ${isNative ? '' : `<button class="btn" data-action="share-streak" data-via="download" data-id="${h.id}">${t('share.download')}</button>`}
        </div>
        ${flashHtml('share')}
      </div>`;
    }

    const fr = friendsOnHabit(h);
    if (fr.length) {
      html += `<div class="friends-line">👥 ${fr.map(f => `${e(f.name)} <b>${f.cur}</b>`).join(' · ')}</div>`;
    }

    html += `<div class="week">${week.map(d => {
      const fz = !h.done[d.key] && h.frozen?.[d.key];
      return `<button class="day${h.done[d.key] ? ' on' : ''}${fz ? ' frozen' : ''}${d.key === todayKey ? ' today' : ''}" data-action="toggle" data-id="${h.id}" data-day="${d.key}" title="${fz ? t('day.frozen') : h.done[d.key] ? t('day.done') : t('day.notDone')}"><span>${d.label}</span>${fz ? '❄️' : d.num}</button>`;
    }).join('')}</div></li>`;
    return html;
  });

  setHTML($('list'), items.length ? items.join('') : `<li class="empty">${t('habits.empty')}</li>`);

  const total = state.habits.length;
  $('puzzle').innerHTML = puzzleHtml();
  $('progress').hidden = !total;
  $('fill').style.width = total ? (doneCount / total * 100) + '%' : '0';
  $('progressText').textContent = total
    ? t('progress.text', { done: doneCount, total }) + (doneCount === total ? t('progress.perfect') : '') : '';
  $('hint').hidden = !total;

  const added = new Set(state.habits.map(keyOf));
  $('catalogBody').innerHTML = CATEGORIES.map(cat => `<div class="cat"><h3>${cat[lang]}</h3><div class="chips">${
    cat.items.map(id => {
      const name = catalogName(id);
      return added.has('c:' + id)
        ? `<button class="chip added" disabled title="${t('catalog.added')}">${e(name)} ✓</button>`
        : `<button class="chip" data-action="add" data-name="${e(name)}" title="${t('catalog.add')}">+ ${e(name)}</button>`;
    }).join('')
  }</div></div>`).join('');

  // Анонс турнира, к которому можно присоединиться
  const today = todayNumber();
  const tj = cloud.cloudAvailable && tournamentsAround(today).find(tr => canJoin(tr, today) && !social.joined.includes(tr.id));
  $('tourBanner').hidden = !tj;
  if (tj) {
    const st = tournamentStatus(tj, today);
    $('tourBanner').innerHTML = `<div class="row-between"><div>${t('tour.banner', {
      title: e(tj.title), when: st === 'active' ? t('tour.bannerOn') : ' — ' + startWord(tj, today), habit: e(tj.habit), n: tj.days, days: pw(tj.days, 'day') })}</div>
      <button class="btn primary small-btn" data-action="go-tournaments">${t('tour.join')}</button></div>`;
  }

  // Факт дня
  const fact = factFor(todayNumber(), factOffset);
  const factName = catalogName(fact.habit);
  const has = findByKey('c:' + fact.habit);
  $('fact').innerHTML = `<div class="fact-head"><span>${t('fact.title')}</span>
      <button class="link-btn" data-action="next-fact">${t('fact.next')}</button></div>
    <p>${e(fact.text)}</p>
    ${has ? `<p class="small">${t('fact.has', { name: e(factName) })}</p>`
      : `<button class="btn primary small-btn" data-action="add" data-name="${e(factName)}">${t('fact.add', { name: e(factName) })}</button>`}`;
}

// Кнопки входа. В Android-приложении есть запасной вход через браузер.
function signInButtons() {
  return `<div class="signin">
      ${!isNative || hasNativeGoogle() ? `<button class="btn google" data-action="signin-google">${GOOGLE_SVG} ${t('signin.google')}</button>` : ''}
      ${isNative ? `<button class="btn" data-action="signin-browser">🌐 ${t('signin.browser')}</button>` : ''}
      ${cloud.appleAvailable ? `<button class="btn apple" data-action="signin-apple">${APPLE_SVG} ${t('signin.apple')}</button>` : ''}
    </div>${isNative ? `<p class="small">${t('signin.browserNote')}</p>` : ''}`;
}

function signInCard(text) {
  return `<div class="card center">
    <p>${text}</p>
    ${signInButtons()}
    ${flashHtml('signin')}
    <p class="small">${t('signin.note')}</p>
  </div>`;
}

function nicknameForm() {
  return `<div class="card">
    <h2>${renaming ? t('nick.titleRename') : t('nick.titleNew')}</h2>
    <p class="small">${t('nick.note')}</p>
    <form data-form="nickname" class="stack">
      <label>${t('nick.label')}<input name="nickname" required placeholder="${t('nick.ph')}" maxlength="21" autocomplete="off" autocapitalize="none" value="${e(social.profile?.nickname || '')}"></label>
      <div class="row"><button class="btn primary" type="submit">${t('common.save')}</button>
      ${renaming ? `<button class="btn" type="button" data-action="rename-cancel">${t('common.cancel')}</button>` : ''}</div>
      ${flashHtml('nickname')}
    </form>
  </div>`;
}

// Общий «шлюз»: пока нет входа или ника — показываем соответствующий экран.
function socialGate(text) {
  if (!cloud.cloudAvailable) return `<div class="card center"><p>${t('gate.noCloud')}</p><p class="small">${t('gate.noCloudNote')}</p></div>`;
  if (social.error) return `<div class="card center"><p>${t('err.connect')}</p></div>`;
  if (!social.ready || (social.user && social.profile === undefined)) return `<div class="card center"><p class="small">${t('gate.connecting')}</p></div>`;
  if (!social.user) return signInCard(text);
  if (!social.profile || renaming) return nicknameForm();
  return null;
}

function flashHtml(key) {
  const f = flash[key];
  return f ? `<p class="flash${f.error ? ' error' : ''}">${e(f.text)}</p>` : '';
}

function inviteCard() {
  const n = social.referrals;
  const lim = goalLimit(n);
  return `<div class="card invite-card">
    <h2>${t('invite.title')}</h2>
    <p class="small">${t('invite.note')}</p>
    ${PLANS.limitsEnabled ? `<p class="bonus">${t('invite.bonus', { bonus: PLANS.bonusPerReferral })}${n ? t('invite.bonusCount', { n, lim, goals: pw(lim, 'goal') }) : ''}</p>` : ''}
    <div class="row">
      <button class="btn whatsapp" data-action="invite" data-via="whatsapp">WhatsApp</button>
      ${canShareText() ? `<button class="btn" data-action="invite" data-via="share">${t('share.more')}</button>` : ''}
      <button class="btn" data-action="invite" data-via="copy">${t('common.copyLink')}</button>
    </div>
    ${flashHtml('invite')}
  </div>`;
}

function similarCard() {
  const me = social.user.uid;
  let html = `<div class="card">
    <h2>${t('similar.title')}</h2>
    <p class="small">${t('similar.note')}</p>`;
  if (!social.settings.discoverable) html += `<p class="small">${t('similar.offNote')}</p>`;
  if (!state.habits.length) {
    html += `<p class="small">${t('similar.needHabit')}</p></div>`;
    return html;
  }
  html += `<button class="btn" data-action="find-similar"${similarLoading ? ' disabled' : ''}>${similarLoading ? t('common.searching') : similar ? t('similar.refresh') : t('similar.find')}</button>`;
  if (similar) {
    const list = similar.filter(p => p.uid !== me);
    if (!list.length) html += `<p class="small">${t('similar.none')}</p>`;
    const today = todayNumber();
    for (const p of list) {
      const isFriend = social.friends.some(f => f.uid === p.uid);
      const pending = social.outgoing.some(r => r.to === p.uid);
      html += `<div class="person">
        <div class="row-between"><b>@${e(p.nickname)}</b>
          <div class="row">
            ${isFriend ? `<span class="small">${t('similar.inFriends')}</span>` : pending ? `<span class="small">${t('friends.sent')}</span>`
              : `<button class="btn small-btn" data-action="similar-friend" data-uid="${p.uid}">${t('similar.addFriend')}</button>`}
            <button class="btn small-btn" data-action="challenge-person" data-uid="${p.uid}">${t('common.challenge')}</button>
          </div></div>
        <div class="small">${p.common.map(h => { const c = liveStreak(h, today); return `${e(nameOfKey(h.key, h.name))}: <b>${c}</b> ${pw(c, 'day')}`; }).join(' · ')}</div>
      </div>`;
    }
  }
  html += flashHtml('similar') + `</div>`;
  return html;
}

function settingsCard() {
  const st = social.settings;
  return `<div class="card">
    <h2>${t('settings.title')}</h2>
    <form data-form="settings" class="stack">
      <label class="check-row"><input type="checkbox" name="showName"${st.showName ? ' checked' : ''}><span>${t('settings.showName')}</span></label>
      <label class="indent"${st.showName ? '' : ' hidden'}>${t('settings.realName')}<input name="realName" maxlength="40" value="${e(st.realName || '')}" placeholder="${t('settings.realNamePh')}" autocomplete="name"></label>
      <label class="check-row"><input type="checkbox" name="discoverable"${st.discoverable ? ' checked' : ''}><span>${t('settings.discoverable')} <span class="small">${t('settings.discoverableNote')}</span></span></label>
      <button class="btn primary" type="submit">${t('common.save')}</button>
      ${flashHtml('settings')}
    </form>
  </div>`;
}

function renderFriends() {
  const el = $('view-friends');
  const gate = socialGate(t('friends.signinText'));
  if (gate) { setHTML(el, gate); return; }

  const today = todayNumber();
  const todayKey = dateKey(new Date());
  let html = `<div class="card">
    <h2>${t('friends.addTitle')}</h2>
    <form data-form="friend" class="row">
      <input name="nickname" placeholder="${t('friends.nickPh')}" autocomplete="off" autocapitalize="none" required>
      <button class="btn primary" type="submit">${t('friends.sendRequest')}</button>
    </form>
    ${flashHtml('friend')}
    <p class="small">${t('friends.yourNick', { nick: e(social.profile.nickname) })}</p>
  </div>`;

  if (social.incoming.length) {
    html += `<h2 class="section">${t('friends.requests')}</h2>` + social.incoming.map(r => `<div class="card row-between">
      <div><b>@${e(r.fromNick)}</b><div class="small">${t('friends.wantsAdd')}</div></div>
      <div class="row"><button class="btn primary" data-action="req-accept" data-id="${r.id}">${t('common.accept')}</button>
      <button class="btn" data-action="req-decline" data-id="${r.id}">${t('friends.decline')}</button></div></div>`).join('');
  }
  if (social.outgoing.length) {
    html += `<h2 class="section">${t('common.waiting')}</h2>` + social.outgoing.map(r => `<div class="card row-between">
      <div><b>@${e(r.toNick)}</b><div class="small">${t('friends.sent')}</div></div>
      <button class="btn" data-action="req-cancel" data-id="${r.id}">${t('common.cancel')}</button></div>`).join('');
  }

  html += `<h2 class="section">${t('friends.list')}${social.friends.length ? ` (${social.friends.length})` : ''}</h2>`;
  if (!social.friends.length) html += `<p class="empty">${t('friends.empty')}</p>`;
  for (const f of social.friends) {
    const stats = social.friendStats[f.uid]?.habits || [];
    const common = state.habits.map(h => ({ h, st: stats.find(s => normKey(s.key) === keyOf(h)) })).filter(x => x.st);
    html += `<div class="card friend">
      <div class="row-between"><div class="friend-name">${friendHtml(f)}</div>
      <div class="row"><button class="btn small-btn" data-action="challenge-person" data-uid="${f.uid}">${t('common.challenge')}</button>
      <button class="icon-btn delete" data-action="friend-remove" data-uid="${f.uid}" title="${t('friends.remove')}" aria-label="${t('friends.remove')}">×</button></div></div>
      ${common.length ? `<table class="compare"><thead><tr><th>${t('friends.common')}</th><th>${e(friendLabel(f))}</th><th>${t('common.you')}</th></tr></thead><tbody>${
        common.map(({ h, st }) => {
          const theirs = liveStreak(st, today), mine = streaks(h, todayKey).current;
          return `<tr><td>${e(hName(h))}</td><td class="${theirs > mine ? 'lead' : ''}"><b>${theirs}</b> ${pw(theirs, 'day')}<div class="small">${t('friends.best', { n: st.best })}</div></td><td class="${mine > theirs ? 'lead' : ''}"><b>${mine}</b> ${pw(mine, 'day')}</td></tr>`;
        }).join('')}</tbody></table>`
      : `<p class="small">${t('friends.noCommon')}${stats.length ? t('friends.noCommonMore', { n: stats.length, habits: pw(stats.length, 'habit') }) : ''}.</p>`}
    </div>`;
  }

  html += inviteCard() + similarCard();
  setHTML(el, html);
}

function accountCard() {
  return `<div class="account">
    <p class="small">${t('account.signedAs', { nick: e(social.profile.nickname) })}${social.user.email ? ` (${e(social.user.email)})` : ''}</p>
    <div class="row center-row">
      <button class="link-btn" data-action="rename">${t('nick.titleRename')}</button>
      <button class="link-btn" data-action="signout">${t('account.signout')}</button>
      <button class="link-btn danger" data-action="delete-account">${t('account.delete')}</button>
    </div>
  </div>`;
}

function progressRow(name, p, ch, today) {
  // Результат пересчитываем по числу дней, а не доверяем сохранённому флагу.
  const count = p ? Math.min(Number(p.count) || 0, ch.days) : 0;
  const completed = count >= ch.days;
  const failed = !completed && ch.startDay + count < today;
  const status = completed ? t('ch.statusDone') : failed ? t('ch.statusOut') : p ? t('ch.statusPlaying') : t('ch.statusNotYet');
  return { failed, completed, html: `<div class="prow${completed ? ' win' : ''}${failed ? ' out' : ''}">
    <div class="row-between"><span>${e(name)}</span><span class="small">${count} / ${ch.days} · ${status}</span></div>
    <div class="bar"><div class="fill" style="width:${Math.min(100, count / ch.days * 100)}%"></div></div></div>` };
}

// Кому можно бросить вызов: друзья и найденные люди.
function challengeTargets() {
  const out = social.friends.map(f => ({ uid: f.uid, nickname: f.nickname, label: friendLabel(f), group: 'friends' }));
  for (const p of [...(suggestions || []), ...(similar || [])]) {
    if (!out.some(x => x.uid === p.uid)) out.push({ uid: p.uid, nickname: p.nickname, label: '@' + p.nickname, group: 'similar' });
  }
  return out;
}

function participantName(ch, uid) {
  const f = social.friends.find(x => x.uid === uid);
  return f ? friendLabel(f) : '@' + (ch.names?.[uid] || t('ch.rival'));
}

const chName = ch => nameOfKey(ch.habitKey, ch.habitName);
const shortDate = n => new Date(n * 86400000).toLocaleDateString(locale(), { day: 'numeric', month: 'long', timeZone: 'UTC' });

function renderChallenges() {
  const el = $('view-challenges');
  const gate = socialGate(t('ch.signinText'));
  if (gate) { setHTML(el, gate); return; }
  const me = social.user.uid;
  const today = todayNumber();
  const habits = state.habits;
  const targets = challengeTargets();
  const groupsHtml = [['friends', t('friends.list')], ['similar', t('similar.title')]].map(([g, label]) => {
    const list = targets.filter(x => x.group === g);
    return list.length ? `<optgroup label="${label}">${list.map(x => `<option value="${x.uid}"${x.uid === challengeFriend ? ' selected' : ''}>${e(x.label)}</option>`).join('')}</optgroup>` : '';
  }).join('');

  const showNew = !habits.length || challengeHabit === '__new';
  const formHtml = `<div class="card">
    <h2>${t('ch.formTitle')}</h2>
    <p class="small">${t('ch.rules')}</p>
    <form data-form="challenge" class="stack">
      <label>${t('ch.habit')}<select name="habit">${habits.map(h => `<option value="${h.id}"${h.id === challengeHabit ? ' selected' : ''}>${e(hName(h))}</option>`).join('')}
        <option value="__new"${showNew ? ' selected' : ''}>${t('ch.newOption')}</option></select></label>
      <label class="new-habit"${showNew ? '' : ' hidden'}>${t('ch.newLabel')}<input name="newHabit" maxlength="80" placeholder="${t('ch.newPh')}" autocomplete="off"></label>
      <label>${t('ch.daysLabel')}<select name="days">${CHALLENGE_DAYS.map(n => `<option value="${n}"${n === 21 ? ' selected' : ''}>${nd(n)}</option>`).join('')}</select></label>
      <label class="check-row"><input type="checkbox" name="photoRequired"><span>${t('ch.photoOpt')} <span class="small">${t('ch.photoOptNote')}</span></span></label>
      ${targets.length ? `<label>${t('ch.opponent')}<select name="friend">${groupsHtml}</select></label>
        <button class="btn primary" type="submit">${t('ch.send')}</button>` : ''}
      <div class="or">${targets.length ? t('ch.orInvite') : t('ch.inviteOnly')}</div>
      <div class="row">
        <button class="btn whatsapp" type="button" data-action="ch-invite" data-via="whatsapp">WhatsApp</button>
        ${canShareText() ? `<button class="btn" type="button" data-action="ch-invite" data-via="share">${t('share.more')}</button>` : ''}
        <button class="btn" type="button" data-action="ch-invite" data-via="copy">${t('common.copyLink')}</button>
      </div>
      ${flashHtml('challenge')}
    </form></div>`;

  const groups = { incoming: [], active: [], waiting: [], done: [] };
  for (const ch of social.challenges) {
    const other = ch.participants.find(u => u !== me);
    const otherName = participantName(ch, other);
    const title = `<div class="ch-title">⚔️ ${e(chName(ch))}</div>`;
    if (ch.status === 'pending') {
      (ch.participants[1] === me ? groups.incoming : groups.waiting).push(`<div class="card challenge">
        ${title}
        <div class="small">${t('ch.inRow', { n: ch.days, days: pw(ch.days, 'day') })}${ch.photoRequired ? ` · ${t('ch.photoBadge')}` : ''}</div>
        ${ch.participants[1] === me
          ? `<p>${t('ch.challengesYou', { name: e(otherName) })}</p><div class="row"><button class="btn primary" data-action="ch-accept" data-id="${ch.id}">${t('common.accept')}</button><button class="btn" data-action="ch-decline" data-id="${ch.id}">${t('ch.refuse')}</button></div>`
          : `<p class="small">${t('ch.waitingFor', { name: e(otherName) })}</p><button class="link-btn" data-action="ch-delete" data-id="${ch.id}">${t('ch.cancel')}</button>`}
      </div>`);
      continue;
    }
    if (ch.status === 'declined') {
      groups.done.push(`<div class="card challenge muted">${title}
        <p class="small">${ch.participants[0] === me ? t('ch.theyDeclined', { name: e(otherName) }) : t('ch.youDeclined')}</p>
        <button class="link-btn" data-action="ch-delete" data-id="${ch.id}">${t('common.remove')}</button></div>`);
      continue;
    }
    // активный вызов: свой прогресс считаем по свежим отметкам, а в вызове с фото — по фото обоих
    const myHabit = findByKey(ch.habitKey);
    let myP, theirP, photos = [];
    if (ch.photoRequired) {
      if (!challData[ch.id]) loadChallenge(ch);
      photos = challData[ch.id]?.photos || [];
      const daysOf = uid => Object.fromEntries(photos.filter(p => p.uid === uid).map(p => [p.day, true]));
      myP = tourProgress(daysOf(me), ch, today);
      theirP = challData[ch.id]?.photos ? tourProgress(daysOf(other), ch, today) : null;
    } else {
      myP = challengeProgress(myHabit, ch.startDay, ch.days, today);
      theirP = ch.progress?.[other];
    }
    const mine = progressRow(t('common.you'), myP, ch, today);
    const theirs = progressRow(otherName, theirP, ch, today);
    const over = (mine.completed || mine.failed) && (theirs.completed || theirs.failed);
    let result = '';
    if (mine.completed && theirs.completed) result = t('ch.draw');
    else if (mine.completed) result = t('ch.youWon');
    else if (theirs.completed) result = t('ch.theyWon', { name: e(otherName) });
    else if (over) result = t('ch.bothOut');
    else if (theirs.failed) result = t('ch.theyOut', { name: e(otherName) });
    else if (mine.failed) result = t('ch.youOut');
    const finished = mine.completed || theirs.completed || over;
    // Вызов закончился — фото больше не нужны
    if (finished && ch.photoRequired && challData[ch.id]?.photos?.length && !cleanedCh.has(ch.id)) {
      cleanedCh.add(ch.id);
      cloud.cleanupChallengePhotos(ch).then(() => { delete challData[ch.id]; render(); });
    }
    let photoHtml = '';
    if (ch.photoRequired && !finished) {
      const myToday = photos.find(p => p.uid === me && p.day === String(today));
      const recent = [...photos].sort((a, b) => Number(b.day) - Number(a.day)).slice(0, 4);
      photoHtml = `<div class="tour-today">
        ${myToday ? `<span class="ok">${t('ch.photoAdded')}</span>`
          : photoUploading === ch.id ? `<span class="small">${t('tour.photoUploading')}</span>`
          : `<button class="btn primary small-btn" data-action="ch-photo" data-id="${ch.id}">${t('ch.addPhoto')}</button>`}
        <div class="small">${t('ch.photoRule')}</div>
        ${recent.length ? `<div class="feed mini">${recent.map(p => `<figure class="photo"><img src="${p.image}" alt="" loading="lazy">
          <figcaption>${p.uid === me ? t('common.you') : e(otherName)} · ${shortDate(Number(p.day))}</figcaption></figure>`).join('')}</div>` : ''}
        <div class="small">${t('ch.photosNote')}</div>
      </div>`;
    }
    (finished ? groups.done : groups.active).push(`<div class="card challenge${finished ? ' muted' : ''}">
      ${title}
      <div class="small">${t('ch.inRow', { n: ch.days, days: pw(ch.days, 'day') })}${t('ch.since', { date: shortDate(ch.startDay) })}${ch.photoRequired ? ` · ${t('ch.photoBadge')}` : ''}</div>
      ${mine.html}${theirs.html}${photoHtml}
      ${result ? `<p class="result">${result}</p>` : ''}
      ${!myHabit ? `<p class="small">${t('ch.noHabit')}<button class="link-btn" data-action="ch-addhabit" data-name="${e(ch.habitName)}">${t('ch.addLower')}</button></p>` : ''}
      <button class="link-btn" data-action="ch-delete" data-id="${ch.id}">${finished ? t('common.remove') : t('ch.giveUp')}</button>
    </div>`);
  }
  let html = '';
  if (groups.incoming.length) html += `<h2 class="section first">${t('ch.secIncoming')}</h2>${groups.incoming.join('')}`;
  html += tournamentsHtml(today);
  html += `<h2 class="section">${t('ch.secChallenges')}</h2>` + suggestionsHtml(today) + formHtml;
  if (groups.active.length) html += `<h2 class="section">${t('ch.secActive')}</h2>${groups.active.join('')}`;
  if (groups.waiting.length) html += `<h2 class="section">${t('common.waiting')}</h2>${groups.waiting.join('')}`;
  if (groups.done.length) html += `<h2 class="section">${t('ch.secDone')}</h2>${groups.done.join('')}`;
  setHTML(el, html);
}

// ---------- Поделиться серией ----------

const imageCache = {};
function streakImage(name, n) {
  const key = prefs.theme + '|' + lang + '|' + name + '|' + n;
  if (imageCache[key]) return imageCache[key];
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, theme().grad[0]); grad.addColorStop(1, theme().grad[1]);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,.08)';
  g.beginPath(); g.arc(W - 120, 160, 260, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(120, H - 140, 200, 0, Math.PI * 2); g.fill();
  const font = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = `200px ${font}`; g.fillText('🔥', W / 2, 330);
  g.font = `bold 300px ${font}`; g.fillText(String(n), W / 2, 640);
  g.font = `600 64px ${font}`; g.fillText(t('img.inRow', { days: pw(n, 'day') }), W / 2, 740);
  // название привычки, переносим по словам
  g.font = `bold 64px ${font}`;
  const words = name.split(' '); const lines = []; let line = '';
  for (const w of words) { const s = line ? line + ' ' + w : w; if (g.measureText(s).width > W - 160 && line) { lines.push(line); line = w; } else line = s; }
  lines.push(line);
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, W / 2, 880 + i * 80));
  g.font = `600 56px ${font}`; g.fillStyle = '#ffe08a';
  g.fillText(t('img.beat'), W / 2, 1130);
  g.font = `40px ${font}`; g.fillStyle = 'rgba(255,255,255,.85)';
  g.fillText(t('app.title'), W / 2, 1250);
  return (imageCache[key] = c.toDataURL('image/png'));
}

function canShareText() { return isNative || !!navigator.share; }

function canShareFiles() {
  if (isNative) return true;
  try { return !!navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }); } catch (err) { return false; }
}

async function dataUrlToFile(url, filename) {
  const blob = await (await fetch(url)).blob();
  return new File([blob], filename, { type: 'image/png' });
}

function shareStreak(via, h) {
  const n = streaks(h).current;
  const name = hName(h);
  // Ссылка-вызов, если есть аккаунт; иначе — просто ссылка на приложение.
  let url = appUrl();
  if (social.user && social.profile) {
    const inv = cloud.createInvite(h.name, 21);
    inv.saved.catch(err => console.error(err));
    url = inv.url;
  }
  const text = t('share.streakText', { n, days: pw(n, 'day'), name, url });
  const img = streakImage(name, n);
  const file = `youboost-${n}.png`;
  if (via === 'image') {
    if (isNative) nativeShare({ text, imageDataUrl: img, filename: file }).catch(err => console.error(err));
    else dataUrlToFile(img, file).then(f => navigator.share({ files: [f], text })).catch(() => {});
  } else if (via === 'whatsapp') {
    openExternal('https://wa.me/?text=' + encodeURIComponent(text));
  } else if (via === 'share') {
    (isNative ? nativeShare({ text }) : navigator.share({ text })).catch(() => {});
  } else if (via === 'download') {
    const a = document.createElement('a');
    a.href = img; a.download = file; a.click();
    flash.share = { text: t('share.saved') };
  } else {
    copyText(text)
      .then(() => { flash.share = { text: t('share.copied') }; render(); })
      .catch(() => { flash.share = { text }; render(); });
  }
  render();
}

// ---------- Турниры ----------

function startWord(tr, today) {
  const d = tr.startDay - today;
  if (d === 0) return t('tour.startToday');
  if (d === 1) return t('tour.startTomorrow');
  const label = new Date(tr.startDay * 86400000).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return t('tour.startOn', { date: label });
}

function loadTour(tr) {
  if (tourData[tr.id]?.loading) return;
  tourData[tr.id] = { ...(tourData[tr.id] || {}), loading: true };
  cloud.loadLeaderboard(tr)
    .then(d => { tourData[tr.id] = { ...d, loading: false }; })
    .catch(err => { console.error(err); tourData[tr.id] = { loading: false, error: true }; })
    .finally(render);
}

function tournamentsHtml(today) {
  const list = tournamentsAround(today);
  let html = `<h2 class="section">${t('tour.section')}</h2>`;
  for (const tr of list) {
    const st = tournamentStatus(tr, today);
    const joined = social.joined.includes(tr.id);
    const data = tourData[tr.id];
    if (!data) loadTour(tr);
    const mine = data?.me;   // прогресс по отметкам на сервере
    const end = tr.startDay + tr.days - 1;
    const status = st === 'upcoming' ? startWord(tr, today) : st === 'active' ? t('tour.going', { d: today - tr.startDay + 1, n: tr.days }) : t('tour.finished');
    let mineHtml = '';
    if (joined && st !== 'upcoming' && mine) {
      mineHtml = `<div class="prow${mine.completed ? ' win' : ''}${mine.failed ? ' out' : ''}"><div class="row-between"><span>${t('common.you')}</span>
        <span class="small">${mine.count} / ${tr.days} · ${mine.completed ? t('ch.statusDone') : mine.failed ? t('tour.youOut') : t('ch.statusPlaying')}${data?.myPlace ? t('tour.place', { n: data.myPlace }) : ''}</span></div>
        <div class="bar"><div class="fill" style="width:${mine.count / tr.days * 100}%"></div></div></div>`;
    }
    // Сегодняшняя отметка и фото-подтверждение
    let todayHtml = '';
    if (joined && st === 'active' && data && !data.loading) {
      const checked = !!mine?.checks?.[String(today)];
      const myPhoto = (data.photos || []).find(p => p.uid === social.user.uid && p.day === String(today));
      todayHtml = `<div class="tour-today">${checked
        ? `<span class="ok">${t('tour.checkedToday')}</span> ${myPhoto ? `<span class="small">${t('tour.photoAdded')}</span>`
          : photoUploading === tr.id ? `<span class="small">${t('tour.photoUploading')}</span>`
          : `<button class="btn small-btn" data-action="tour-photo" data-id="${tr.id}">${t('tour.addPhoto')}</button>`}`
        : `<span class="small">${t('tour.markToday', { habit: e(tr.habit) })}</span>`}
        <div class="small">${t('tour.onlyToday')}</div></div>`;
    }
    const photosCount = data?.photos?.length || 0;
    html += `<div class="card tour${joined ? ' joined' : ''}">
      <div class="row-between"><div class="ch-title">${e(tr.title)}</div><span class="tag">${status}</span></div>
      <div class="tour-habit">${e(tr.habit)} · ${t('ch.inRow', { n: tr.days, days: pw(tr.days, 'day') })}</div>
      <div class="small">${shortDate(tr.startDay)} — ${shortDate(end)} · ${e(tr.text)}</div>
      <div class="small">${t('tour.participants', { n: data && !data.loading && !data.error ? data.total : '…' })}</div>
      ${mineHtml}${todayHtml}
      <div class="row tour-actions">
        ${joined
          ? `<span class="small">${t('tour.joined')}</span>${st === 'upcoming' ? `<button class="link-btn" data-action="tour-leave" data-id="${tr.id}">${t('tour.leave')}</button>` : ''}`
          : canJoin(tr, today) ? `<button class="btn primary small-btn" data-action="tour-join" data-id="${tr.id}">${t('tour.join')}</button>`
          : st !== 'finished' ? `<span class="small">${t('tour.closed')}</span>` : ''}
        <button class="link-btn" data-action="tour-board" data-id="${tr.id}">${tourOpen === tr.id ? t('tour.hideBoard') : t('tour.board')}</button>
        ${st !== 'upcoming' ? `<button class="link-btn" data-action="tour-feed" data-id="${tr.id}">${feedOpen === tr.id ? t('tour.hideFeed') : t('tour.feed', { n: photosCount })}</button>` : ''}
      </div>
      ${tourOpen === tr.id ? leaderboardHtml(tr, data) : ''}
      ${feedOpen === tr.id ? feedHtml(tr, data) : ''}
    </div>`;
  }
  return html + flashHtml('tour');
}

function leaderboardHtml(tr, data) {
  if (!data || data.loading) return `<p class="small">${t('common.loading')}</p>`;
  if (data.error) return `<p class="small">${t('tour.boardError')}</p>`;
  if (!data.top.length) return `<p class="small">${t('tour.boardEmpty')}</p>`;
  const me = social.user.uid;
  return `<ol class="board">${data.top.map(p => `<li class="${p.uid === me ? 'me' : ''}"><span>@${e(p.nickname)}${p.photos ? ` <span class="photos-badge">${t('tour.photosBadge', { n: p.photos })}</span>` : ''}</span>
    <span>${p.count} / ${tr.days}${p.count >= tr.days ? ' 🏆' : ''}</span></li>`).join('')}</ol>
    ${data.myPlace && data.myPlace > 10 ? `<p class="small">${t('tour.yourPlace', { p: data.myPlace, n: data.total })}</p>` : ''}`;
}

// Лента фото-подтверждений турнира
function feedHtml(tr, data) {
  if (!data || data.loading) return `<p class="small">${t('common.loading')}</p>`;
  if (!data.photos?.length) return `<p class="small">${t('tour.feedEmpty')}</p>`;
  const me = social.user.uid;
  const iAmIn = social.joined.includes(tr.id);
  return `<p class="small">${t('tour.photosNote')}</p><div class="feed">${data.photos.map(p => {
    const flags = (p.flags || []).length;
    const rejected = flags >= FLAG_LIMIT;
    const mineFlag = (p.flags || []).includes(me);
    return `<figure class="photo${rejected ? ' rejected' : ''}">
      <img src="${p.image}" alt="" loading="lazy">
      <figcaption><b>@${e(p.nickname)}</b> · ${shortDate(Number(p.day))}${flags ? ` · ${t('tour.flags', { n: flags })}` : ''}
        ${rejected ? `<span class="rej">${t('tour.rejected')}</span>`
          : p.uid !== me && iAmIn ? (mineFlag ? `<span class="small">${t('tour.flagged')}</span>` : `<button class="link-btn" data-action="tour-flag" data-id="${tr.id}" data-photo="${p.id}">${t('tour.flag')}</button>`) : ''}
      </figcaption></figure>`;
  }).join('')}</div>`;
}

function loadChallenge(ch) {
  if (challData[ch.id]?.loading) return;
  challData[ch.id] = { ...(challData[ch.id] || {}), loading: true };
  cloud.loadChallengePhotos(ch)
    .then(photos => { challData[ch.id] = { photos, loading: false }; })
    .catch(err => { console.error(err); challData[ch.id] = { photos: [], loading: false }; })
    .finally(render);
}

// Сжимаем фото до ~720 px и JPEG — чтобы хранить прямо в базе.
async function compressImage(file, max = 720) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let data = c.toDataURL('image/jpeg', 0.6);
    if (data.length > 300000) data = c.toDataURL('image/jpeg', 0.4);
    return data;
  } finally { URL.revokeObjectURL(url); }
}

// ---------- Подбор соперников ----------

function loadSuggestions() {
  if (suggestionsLoading) return;
  suggestionsLoading = true;
  cloud.suggestOpponents(5)
    .then(list => { suggestions = list; })
    .catch(err => { console.error(err); suggestions = []; })
    .finally(() => { suggestionsLoading = false; render(); });
}

function suggestionsHtml(today) {
  if (!state.habits.length) return '';
  if (suggestions === null) loadSuggestions();
  let html = `<div class="card">
    <div class="row-between"><h2>${t('suggest.title')}</h2>
      <button class="link-btn" data-action="suggest-more"${suggestionsLoading ? ' disabled' : ''}>${t('suggest.more')}</button></div>
    <p class="small">${t('suggest.note')}</p>
    <div class="row"><span class="small">${t('suggest.daysLabel')}</span>
      <select class="inline-select" id="suggestDays">${CHALLENGE_DAYS.map(n => `<option value="${n}"${n === 7 ? ' selected' : ''}>${nd(n)}</option>`).join('')}</select>
      <label class="check-row inline"><input type="checkbox" id="suggestPhoto"${suggestPhoto ? ' checked' : ''}><span>${t('suggest.photo')}</span></label></div>`;
  if (suggestionsLoading && !suggestions) html += `<p class="small">${t('common.searching')}</p>`;
  else if (!suggestions?.length) html += `<p class="small">${t('suggest.none')}</p>`;
  for (const p of suggestions || []) {
    html += `<div class="person"><div class="row-between"><b>@${e(p.nickname)}</b></div>
      <div class="chips">${p.common.map(h => {
        const c = liveStreak(h, today), k = p.uid + '|' + normKey(h.key), name = nameOfKey(h.key, h.name);
        return sentTo[k] ? `<span class="chip added">${t('suggest.sent', { name: e(name) })}</span>`
          : `<button class="chip" data-action="suggest-challenge" data-uid="${p.uid}" data-key="${e(normKey(h.key))}">${t('suggest.chip', { name: e(name), n: c, days: pw(c, 'day') })}</button>`;
      }).join('')}</div></div>`;
  }
  return html + flashHtml('suggest') + '</div>';
}

// ---------- Приглашения по ссылке ----------

// Код из ссылки запоминаем, чтобы он пережил вход через Google.
(function readInviteFromUrl() {
  const url = new URL(location.href);
  const code = url.searchParams.get('invite');
  if (code) {
    try { localStorage.setItem(INVITE_KEY, code); } catch (err) {}
    url.searchParams.delete('invite');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  let saved = null;
  try { saved = localStorage.getItem(INVITE_KEY); } catch (err) {}
  if (saved) pendingInvite = { code: saved, status: 'new' };
})();

function dropInvite() {
  pendingInvite = null;
  try { localStorage.removeItem(INVITE_KEY); } catch (err) {}
  render();
}

function renderInviteBanner() {
  const el = $('inviteBanner');
  if (!pendingInvite || !cloud.cloudAvailable) { el.hidden = true; return; }
  el.hidden = false;
  const inv = pendingInvite;
  let body = '';
  if (!social.ready) body = `<p class="small">${t('ib.loading')}</p>`;
  else if (!social.user) body = `<p><b>${t('ib.invited')}</b></p><p class="small">${t('ib.signinToAccept')}</p>
    ${signInButtons()}${flashHtml('signin')}`;
  else if (social.profile === undefined) body = `<p class="small">${t('ib.loading')}</p>`;
  else if (!social.profile) { setHTML(el, `<p class="invite-note"><b>${t('ib.invited')}</b> ${t('ib.chooseNick')}</p>${nicknameForm()}`); return; }
  else {
    if (inv.status === 'new') {
      inv.status = 'loading';
      cloud.getInvite(inv.code).then(data => {
        Object.assign(inv, data ? { status: 'ready', data } : { status: 'missing' });
        render();
      }).catch(() => { inv.status = 'missing'; render(); });
    }
    if (inv.status === 'loading') body = `<p class="small">${t('ib.loading')}</p>`;
    else if (inv.status === 'missing') body = `<p>${t('ib.missing')}</p><button class="btn" data-action="invite-dismiss">${t('common.close')}</button>`;
    else if (inv.status === 'ready') {
      const d = inv.data;
      if (d.from === social.user.uid) body = `<p>${t('ib.own')}</p><button class="btn" data-action="invite-dismiss">${t('common.close')}</button>`;
      else body = `<p><b>@${e(d.nickname)}</b> ${d.habitName
          ? t('ib.challenge', { habit: e(nameOfKey(d.habitKey, d.habitName)), n: d.days, days: pw(d.days, 'day') }) + (d.photoRequired ? ' ' + t('ib.photoRequired') : '')
          : t('ib.friend')}</p>
        <div class="row"><button class="btn primary" data-action="invite-accept">${d.habitName ? t('ib.acceptCh') : t('ib.addFriend')}</button>
        <button class="btn" data-action="invite-dismiss">${t('ib.notNow')}</button></div>`;
    }
  }
  setHTML(el, `<div class="card invite-banner">${body}${flashHtml('inviteBanner')}</div>`);
}

function inviteText(habitName, days, url, photoRequired = false) {
  return habitName
    ? t(photoRequired ? 'invite.textChallengePhoto' : 'invite.textChallenge', { habit: displayName(habitName), n: days, days: pw(days, 'day'), url })
    : t('invite.textFriend', { nick: social.profile.nickname, url });
}

function shareInvite(via, flashKey, habitName = null, days = null, photoRequired = false) {
  const inv = cloud.createInvite(habitName, days, photoRequired);
  const text = inviteText(habitName, days, inv.url, photoRequired);
  inv.saved.catch(err => { console.error(err); flash[flashKey] = { text: t('invite.saveFail'), error: true }; render(); });
  if (via === 'whatsapp') {
    openExternal('https://wa.me/?text=' + encodeURIComponent(text));
    flash[flashKey] = { text: t('invite.waOpening') };
  } else if (via === 'share') {
    (isNative ? nativeShare({ text }) : navigator.share({ text })).catch(() => {});
    flash[flashKey] = null;
  } else {
    copyText(text)
      .then(() => { flash[flashKey] = { text: t('invite.linkCopied') }; render(); })
      .catch(() => { flash[flashKey] = { text: t('invite.copyManual') + inv.url }; render(); });
  }
  render();
}

// ---------- Настройки ----------

function renderSettings() {
  const r = prefs.reminder;
  const risk = prefs.risk || { on: false, time: '21:00' };
  let html = plusCard() + `<div class="card">
    <h2>${t('settings.colors')}</h2>
    <div class="swatches">${Object.entries(THEMES).map(([name, th]) => `<button class="swatch${prefs.theme === name ? ' active' : ''}" data-palette="${name}" style="--sw:${th.swatch};--sa:${th.accent}">
      <span class="dot"></span>${t('color.' + name)}</button>`).join('')}</div>
  </div>
  <div class="card">
    <h2>${t('settings.language')}</h2>
    <div class="lang-switch big">${LANGS.map(([code, label]) => `<button data-lang="${code}" class="${code === lang ? 'active' : ''}">${label}</button>`).join('')}</div>
  </div>
  <div class="card">
    <h2>${t('settings.reminders')}</h2>
    <label class="check-row"><input type="checkbox" id="reminderOn"${r.on ? ' checked' : ''}><span>${t('settings.reminderOn')}</span></label>
    <div class="row reminder-time"${r.on ? '' : ' hidden'}><span>${t('settings.reminderAt')}</span><input type="time" id="reminderTime" value="${r.time}"></div>
    <label class="check-row"><input type="checkbox" id="riskOn"${risk.on && hasPlus() ? ' checked' : ''}${hasPlus() ? '' : ' disabled'}><span>${t('risk.setting')} <span class="plus-tag">⭐ Plus</span></span></label>
    <div class="row risk-time"${risk.on && hasPlus() ? '' : ' hidden'}><span>${t('settings.reminderAt')}</span><input type="time" id="riskTime" value="${risk.time}"></div>
    <p class="small">${t('rem.perHabitHint')}</p>
    ${isNative ? '' : `<p class="small">${t('settings.reminderAppOnly')}</p>`}
    ${flashHtml('reminder')}
  </div>
  <div class="card">
    <h2>${t('settings.notifications')}</h2>
    <label class="check-row"><input type="checkbox" id="notifyChallenges"${prefs.notifyChallenges ? ' checked' : ''}><span>${t('settings.notifyChallenges')}</span></label>
    <p class="small">${t('settings.notifyNote')}</p>
  </div>`;
  if (social.user && social.profile) {
    html += settingsCard() + (renaming ? nicknameForm() : `<div class="card"><h2>${t('settings.account')}</h2>${accountCard()}</div>`);
  } else if (cloud.cloudAvailable) {
    html += `<div class="card"><h2>${t('settings.title')}</h2><p class="small">${t('settings.signinFirst')}</p>
      <button class="btn small-btn" data-action="go-friends">${t('tab.friends')}</button></div>`;
  }
  html += `<p class="small" style="text-align:center"><a href="${PUBLIC_URL}privacy.html?lang=${lang}" data-action="open-privacy">${t('settings.privacyPolicy')}</a></p>`;
  setHTML($('view-settings'), html);
}

async function updateReminder() {
  const r = prefs.reminder;
  if (!r.on) { await cancelDailyReminder(); flash.reminder = null; render(); return; }
  if (!isNative) { flash.reminder = null; render(); return; }
  const [hh, mm] = r.time.split(':').map(Number);
  const ok = await scheduleDailyReminder(hh, mm, 'YouBoost', t('reminder.body'));
  flash.reminder = ok ? { text: t('settings.reminderSet', { time: r.time }) } : { text: t('settings.reminderDenied'), error: true };
  render();
}

// ---------- Пуш-уведомления (Android) ----------
let pushToken = null;
let pushFor = null;   // uid, для которого телефон уже зарегистрирован

async function syncPush() {
  if (!isNative) return;
  const uid = social.user?.uid;
  const want = !!(uid && social.profile && prefs.notifyChallenges);
  if (want && pushFor !== uid) {
    pushFor = uid;
    try {
      pushToken = await registerPush({
        // приложение открыто — показываем пуш как обычное уведомление
        onReceived: n => notifyNow(Math.floor(Math.random() * 1e6) + 1000, n.title || 'YouBoost', n.body || '').catch(() => {}),
        onTap: data => goTab(data.type === 'friend' ? 'friends' : 'challenges'),
      });
      if (pushToken) await cloud.savePushToken(pushToken, lang);
    } catch (err) {
      // Не вышло (нет разрешения, правила ещё не опубликованы и т. п.) — повторять не будем до перезапуска,
      // а уведомления о вызовах останутся локальными.
      console.error('push', err);
      pushToken = null;
    }
  } else if (!want && pushFor) {
    if (pushToken) await cloud.removePushToken(pushToken);
    await unregisterPush();
    pushFor = null; pushToken = null;
  }
}

// Новые вызовы → уведомление (один раз на каждый вызов).
// В Android-приложении с пушами их присылает сервер; здесь — запасной вариант (сайт или пуши недоступны).
const SEEN_KEY = 'youboost-seen-challenges';
function onIncomingChallenges(list) {
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch (err) {}
  const fresh = list.filter(c => !seen.includes(c.id));
  if (!fresh.length) return;
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...fresh.map(c => c.id)].slice(-200))); } catch (err) {}
  if (!prefs.notifyChallenges || pushToken) return;
  for (const ch of fresh) {
    const from = '@' + (ch.names?.[ch.participants[0]] || '');
    notifyNow(100 + (Math.abs([...ch.id].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 0)) % 100000), 'YouBoost',
      t('notify.challenge', { name: from, habit: nameOfKey(ch.habitKey, ch.habitName) })).catch(err => console.error(err));
  }
}

// ---------- Запасной вход через браузер (Android) ----------
// Приложение открывает сайт в Chrome (?appauth=код), там человек входит через Google, а кнопка
// «Вернуться в YouBoost» открывает com.youboost.app://auth?state=код&idToken=… — и приложение входит по этому токену.

const AUTH_STATE_KEY = 'youboost-auth-state';

function startBrowserSignIn() {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { localStorage.setItem(AUTH_STATE_KEY, state); } catch (err) {}
  flash.signin = { text: t('signin.browserOpening') };
  render();
  openExternal(`${PUBLIC_URL}?appauth=${state}`);
}

onAppUrlOpen(url => {
  if (!url || !url.startsWith('com.youboost.app://auth')) return;
  const q = new URL(url.replace('com.youboost.app://', 'https://x/')).searchParams;
  let expected = null;
  try { expected = localStorage.getItem(AUTH_STATE_KEY); } catch (err) {}
  if (!q.get('idToken') || !expected || q.get('state') !== expected) {
    flash.signin = { text: t('err.signin') + ' state', error: true }; render(); return;
  }
  try { localStorage.removeItem(AUTH_STATE_KEY); } catch (err) {}
  flash.signin = { text: t('signin.opening') }; render();
  run('signin', () => cloud.signInWithIdToken(q.get('idToken')));
});

// На сайте: страница входа для приложения
const appAuthState = !isNative ? new URLSearchParams(location.search).get('appauth') : null;
let appAuth = appAuthState ? { status: 'ready' } : null;

async function appAuthSignIn() {
  appAuth = { status: 'working' }; renderAppAuth();
  try {
    const idToken = await cloud.webSignInForApp();
    const qs = `state=${encodeURIComponent(appAuthState)}&idToken=${encodeURIComponent(idToken)}`;
    appAuth = { status: 'done', link: `intent://auth?${qs}#Intent;scheme=com.youboost.app;package=com.youboost.app;end`, plain: `com.youboost.app://auth?${qs}` };
  } catch (err) {
    console.error(err);
    appAuth = { status: 'error', text: `${t('err.signin')} ${err.code || err.message}` };
  }
  renderAppAuth();
}

function renderAppAuth() {
  const el = $('appAuth');
  if (!appAuth) { el.hidden = true; return; }
  el.hidden = false;
  const a = appAuth;
  el.innerHTML = `<div class="card center invite-banner">
    <h2>${t('appauth.title')}</h2>
    ${a.status === 'done'
      ? `<p>${t('appauth.done')}</p><a class="btn primary" href="${a.link}">${t('appauth.back')}</a>
         <p class="small"><a href="${a.plain}">${t('appauth.altLink')}</a></p>`
      : `<p class="small">${t('appauth.text')}</p>
         <div class="signin"><button class="btn google" data-action="appauth-signin"${a.status === 'working' || !social.ready ? ' disabled' : ''}>${GOOGLE_SVG} ${t('signin.google')}</button></div>
         ${a.status === 'error' ? `<p class="flash error">${e(a.text)}</p>` : ''}`}
  </div>`;
}

// ---------- События ----------

// Привычка из формы вызова: выбранная из списка или новая, придуманная пользователем.
function formHabitName(form) {
  if (form.habit.value !== '__new') return state.habits.find(h => h.id === form.habit.value)?.name || null;
  const name = form.newHabit.value.trim();
  if (!name) { flash.challenge = { text: t('ch.needName'), error: true }; render(); return null; }
  if (!findHabit(name)) addHabit(name, { silent: true });
  const h = findHabit(name);
  challengeHabit = h.id;
  return h.name;
}

async function run(key, fn) {
  try {
    const msg = await fn();
    if (key) flash[key] = msg ? { text: msg } : null;
  } catch (err) {
    console.error(err);
    const text = err.message && !err.code ? err.message : t('err.generic');
    if (key) flash[key] = { text, error: true }; else alert(text);
  }
  render();
}

function goTab(name) {
  if (name === 'challenges') {   // свежие таблицы турниров и фото вызовов
    for (const k of Object.keys(tourData)) if (!tourData[k].loading) delete tourData[k];
    for (const k of Object.keys(challData)) if (!challData[k].loading) delete challData[k];
  }
  tab = name;
  try { localStorage.setItem(TAB_KEY, tab); } catch (err) {}
  render(); window.scrollTo(0, 0);
}

function switchLang(code) {
  setLang(code);
  if (prefs.reminder.on) updateReminder();   // текст напоминания — на новом языке
  if (pushToken) cloud.savePushToken(pushToken, code);   // пуши — на новом языке
  applyStaticTexts();
  if (!$('quote').hidden) fillQuote();
  render();
}

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-action], .tabs button, button[data-lang], button[data-palette]');
  if (!el) return;
  if (el.dataset.lang) { switchLang(el.dataset.lang); return; }
  if (el.dataset.palette) {
    savePrefs({ theme: el.dataset.palette }); applyTheme();
    for (const k of Object.keys(imageCache)) delete imageCache[k];
    render(); return;
  }
  if (el.dataset.tab) { goTab(el.dataset.tab); return; }
  const { action, id } = el.dataset;
  switch (action) {
    case 'toggle': toggle(id, el.dataset.day); break;
    case 'remove': removeHabit(id); break;
    case 'add': addHabit(el.dataset.name); break;
    case 'next-fact': factOffset++; render(); break;
    case 'freeze': useFreeze(id); break;
    case 'limit-invite': flash.goal = null; editingGoal = null; goTab('friends'); setTimeout(() => document.querySelector('.invite-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); break;
    case 'stats-toggle': statsOpen = statsOpen === id ? null : id; flash.rem = null; render(); break;
    case 'go-plus': goTab('settings'); setTimeout(() => $('plusCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); break;
    case 'plus-trial': startTrial(); render(); break;
    case 'rem-del': {
      const h = state.habits.find(x => x.id === id);
      if (h) { h.reminders = (h.reminders || []).filter(x => x !== el.dataset.time); save(); render(); }
      break;
    }
    case 'goal-edit': editingGoal = editingGoal === id ? null : id; flash.goal = null; render(); break;
    case 'goal-set': setGoal(id, el.dataset.days ? Number(el.dataset.days) : null); break;
    case 'signin-google': flash.signin = { text: t('signin.opening') }; render(); run('signin', cloud.signInGoogle); break;
    case 'signin-browser': startBrowserSignIn(); break;
    case 'open-privacy': ev.preventDefault(); openExternal(el.getAttribute('href')); break;
    case 'open-settings': goTab(tab === 'settings' ? 'habits' : 'settings'); break;
    case 'appauth-signin': appAuthSignIn(); break;
    case 'signin-apple': flash.signin = { text: t('signin.opening') }; render(); run('signin', cloud.signInApple); break;
    case 'signout': similar = null; run(null, cloud.signOut); break;
    case 'rename': renaming = true; flash.nickname = null; render(); break;
    case 'rename-cancel': renaming = false; render(); break;
    case 'delete-account':
      if (confirm(t('account.deleteConfirm'))) {
        run(null, async () => { await cloud.deleteAccount(); similar = null; alert(t('account.deleted')); });
      }
      break;
    case 'req-accept': run('friend', () => cloud.respondFriendRequest(social.incoming.find(r => r.id === id), true)); break;
    case 'req-decline': run('friend', () => cloud.respondFriendRequest(social.incoming.find(r => r.id === id), false)); break;
    case 'req-cancel': run('friend', () => cloud.cancelFriendRequest(social.outgoing.find(r => r.id === id))); break;
    case 'friend-remove': {
      const f = social.friends.find(x => x.uid === el.dataset.uid);
      if (f && confirm(t('friends.removeConfirm', { name: friendLabel(f) }))) run('friend', () => cloud.removeFriend(f.uid));
      break;
    }
    case 'invite': shareInvite(el.dataset.via, 'invite'); break;
    case 'find-similar':
      similarLoading = true; render();
      run('similar', async () => { try { similar = await cloud.findSimilar(); } finally { similarLoading = false; } });
      break;
    case 'similar-friend': {
      const p = similar?.find(x => x.uid === el.dataset.uid);
      if (p) run('similar', async () => { await cloud.sendFriendRequestTo(p); return t('similar.requestSent', { nick: p.nickname }); });
      break;
    }
    case 'challenge-person': challengeFriend = el.dataset.uid; goTab('challenges'); break;
    case 'go-friends': goTab('friends'); break;
    case 'ch-invite': {
      const form = el.closest('form');
      const name = formHabitName(form);
      if (name) shareInvite(el.dataset.via, 'challenge', name, Number(form.days.value), form.photoRequired.checked);
      break;
    }
    case 'share-edit': sharing = sharing === id ? null : id; flash.share = null; render(); break;
    case 'share-streak': { const h = state.habits.find(x => x.id === id); if (h) shareStreak(el.dataset.via, h); break; }
    case 'go-tournaments': goTab('challenges'); break;
    case 'tour-join': {
      const tr = tournamentsAround(todayNumber()).find(x => x.id === id);
      if (tr) run('tour', async () => { await cloud.joinTournament(tr, name => addHabit(name, { silent: true })); loadTour(tr); return t('tour.joinedMsg', { title: tr.title }); });
      break;
    }
    case 'tour-leave': {
      const tr = tournamentsAround(todayNumber()).find(x => x.id === id);
      if (tr && confirm(t('tour.leaveConfirm'))) run('tour', async () => { await cloud.leaveTournament(tr); loadTour(tr); });
      break;
    }
    case 'tour-board': {
      tourOpen = tourOpen === id ? null : id;
      const tr = tournamentsAround(todayNumber()).find(x => x.id === id);
      if (tourOpen && tr) loadTour(tr);
      render();
      break;
    }
    case 'tour-feed': {
      feedOpen = feedOpen === id ? null : id;
      const tr = tournamentsAround(todayNumber()).find(x => x.id === id);
      if (feedOpen && tr) loadTour(tr);
      render();
      break;
    }
    case 'tour-photo': photoFor = { kind: 'tour', id }; $('photoInput').value = ''; $('photoInput').click(); break;
    case 'ch-photo': photoFor = { kind: 'ch', id }; $('photoInput').value = ''; $('photoInput').click(); break;
    case 'tour-flag': {
      const tr = tournamentsAround(todayNumber()).find(x => x.id === id);
      const photo = tourData[id]?.photos?.find(p => p.id === el.dataset.photo);
      if (tr && photo && confirm(t('tour.flagConfirm', { n: FLAG_LIMIT }))) run('tour', async () => { await cloud.flagPhoto(tr, photo); loadTour(tr); });
      break;
    }
    case 'suggest-more': suggestions = null; sentTo = {}; render(); break;
    case 'suggest-challenge': {
      const p = suggestions?.find(x => x.uid === el.dataset.uid);
      const mine = findByKey(el.dataset.key);
      const days = Number($('suggestDays')?.value || 7);
      if (p && mine) run('suggest', async () => {
        await cloud.createChallenge(p, mine.name, days, suggestPhoto);
        sentTo[p.uid + '|' + el.dataset.key] = true;
        return t('suggest.sentMsg', { nick: p.nickname });
      });
      break;
    }
    case 'ch-accept': run('challenge', () => cloud.respondChallenge(social.challenges.find(c => c.id === id), true, name => addHabit(name, { silent: true }))); break;
    case 'ch-decline': run('challenge', () => cloud.respondChallenge(social.challenges.find(c => c.id === id), false)); break;
    case 'ch-delete':
      if (confirm(t('ch.deleteConfirm'))) run('challenge', () => cloud.deleteChallenge(social.challenges.find(c => c.id === id)));
      break;
    case 'ch-addhabit': addHabit(el.dataset.name, { silent: true }); break;
    case 'invite-dismiss': dropInvite(); break;
    case 'invite-accept': {
      const d = pendingInvite?.data;
      if (!d) break;
      run('inviteBanner', async () => {
        await cloud.acceptInvite(d, name => addHabit(name, { silent: true }));
        dropInvite();
        goTab(d.habitName ? 'challenges' : 'friends');
      });
      break;
    }
  }
});

document.addEventListener('change', ev => {
  if (ev.target.id === 'suggestPhoto') { suggestPhoto = ev.target.checked; return; }
  if (ev.target.id === 'reminderOn' || ev.target.id === 'reminderTime') {
    savePrefs({ reminder: { on: $('reminderOn').checked, time: $('reminderTime').value || '20:00' } });
    updateReminder(); return;
  }
  if (ev.target.id === 'riskOn' || ev.target.id === 'riskTime') {
    savePrefs({ risk: { on: $('riskOn').checked, time: $('riskTime').value || '21:00' } });
    render(); return;
  }
  if (ev.target.id === 'notifyChallenges') {
    savePrefs({ notifyChallenges: ev.target.checked });
    syncPush();
    // в браузере просим разрешение на уведомления
    if (ev.target.checked && !isNative && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    return;
  }
  if (ev.target.id === 'photoInput' && photoFor?.kind === 'ch') {
    const file = ev.target.files?.[0];
    const ch = social.challenges.find(c => c.id === photoFor.id);
    if (!file || !ch) return;
    photoUploading = ch.id; render();
    run('challenge', async () => {
      try {
        await cloud.addChallengePhoto(ch, await compressImage(file));
        // фото — это и отметка привычки за сегодня
        const h = findByKey(ch.habitKey), today = dateKey(new Date());
        if (h && !h.done[today]) { h.done[today] = true; save(); }
        loadChallenge(ch);
        return t('ch.photoSaved');
      } finally { photoUploading = null; }
    });
    return;
  }
  if (ev.target.id === 'photoInput') {
    const file = ev.target.files?.[0];
    const tr = tournamentsAround(todayNumber()).find(x => x.id === photoFor?.id);
    if (!file || !tr) return;
    photoUploading = tr.id; render();
    run('tour', async () => {
      try {
        await cloud.addTournamentPhoto(tr, await compressImage(file));
        feedOpen = tr.id;
        loadTour(tr);
        return t('tour.photoSaved');
      } finally { photoUploading = null; }
    });
    return;
  }
  if (ev.target.name === 'habit' && ev.target.form?.dataset.form === 'challenge') {
    challengeHabit = ev.target.value;
    ev.target.form.querySelector('.new-habit').hidden = ev.target.value !== '__new';
  }
  // показываем поле имени, только когда отмечена галочка
  if (ev.target.name === 'showName') {
    syncNameField(ev.target.form);
    if (ev.target.checked && !ev.target.form.realName.value) ev.target.form.realName.value = social.user?.displayName || '';
  }
});

document.addEventListener('submit', ev => {
  const form = ev.target;
  const kind = form.dataset.form;
  if (form.id === 'addForm') {
    ev.preventDefault();
    const input = $('newHabit');
    if (addHabit(input.value)) input.value = '';
    return;
  }
  if (!kind) return;
  ev.preventDefault();
  const fd = new FormData(form);
  if (kind === 'rem') {
    const h = state.habits.find(x => x.id === form.dataset.id);
    const tm = String(fd.get('time') || '');
    if (h && /^\d\d:\d\d$/.test(tm) && hasPlus()) {
      h.reminders = [...new Set([...(h.reminders || []), tm])].sort().slice(0, 5);
      flash.rem = isNative ? { text: t('rem.added', { time: tm }) } : null;
      save(); render();
    }
    return;
  }
  if (kind === 'goal') {
    const n = Math.round(Number(fd.get('days')));
    if (n >= 1 && n <= 3650) setGoal(form.dataset.id, n); else form.days.focus();
  } else if (kind === 'nickname') {
    run('nickname', async () => { await cloud.claimNickname(fd.get('nickname'), pendingInvite?.code); renaming = false; });
  } else if (kind === 'settings') {
    const showName = !!fd.get('showName');
    const realName = (fd.get('realName') || '').trim();
    if (showName && !realName) { flash.settings = { text: t('settings.needName'), error: true }; render(); return; }
    run('settings', async () => {
      await cloud.saveSettings({ showName, realName, discoverable: !!fd.get('discoverable') });
      return t('common.saved');
    });
  } else if (kind === 'friend') {
    run('friend', async () => {
      const r = await cloud.sendFriendRequest(fd.get('nickname'));
      clearForm(form);
      return r === 'accepted' ? t('friends.nowFriends') : t('friends.requestSent');
    });
  } else if (kind === 'challenge') {
    const target = challengeTargets().find(x => x.uid === fd.get('friend'));
    challengeFriend = target?.uid || '';
    if (!target) return;
    const name = formHabitName(form);
    if (!name) return;
    run('challenge', async () => {
      await cloud.createChallenge(target, name, Number(fd.get('days')), !!fd.get('photoRequired'));
      return t('ch.sentTo', { name: target.label });
    });
  }
});

// Перерисовываем при смене дня, если вкладка открыта через полночь.
let lastKey = dateKey(new Date());
setInterval(() => { const k = dateKey(new Date()); if (k !== lastKey) { lastKey = k; factOffset = 0; dailyVisit(); render(); } }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { dailyVisit(); render(); } });

// Цитата дня
function fillQuote() {
  const q = quoteFor(todayNumber());
  $('quoteText').textContent = lang === 'ru' ? `«${q.text}»` : `“${q.text}”`;
  $('quoteAuthor').textContent = '— ' + q.author;
}
// Цитата дня — при каждом запуске приложения (не при возврате из свёрнутого состояния).
function showQuote() {
  fillQuote();
  $('quote').hidden = false;
  $('quoteClose').focus();
}
function hideQuote() { $('quote').hidden = true; }
$('quoteClose').addEventListener('click', hideQuote);
$('quote').addEventListener('click', ev => { if (ev.target.id === 'quote') hideQuote(); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('quote').hidden) hideQuote(); });

applyStaticTexts();
showQuote();

// Кнопка «Назад» на Android: сначала закрываем открытое, потом возвращаемся на главную.
onBackButton(() => {
  if (!$('quote').hidden) { hideQuote(); return true; }
  if (sharing || editingGoal || renaming || tourOpen) { sharing = editingGoal = tourOpen = null; renaming = false; render(); return true; }
  if (tab !== 'habits') { goTab('habits'); return true; }
  return false;
});

// Пока привычек нет — сразу показываем готовый список.
$('catalog').open = !state.habits.length;
dailyVisit();
render();

cloud.initCloud({
  onChange: () => { render(); syncPush(); },
  onIncomingChallenges,
  // отметка в турнире записана — обновляем таблицу
  onTournament: id => { const tr = tournamentsAround(todayNumber()).find(x => x.id === id); if (tr) loadTour(tr); },
  getState: () => state,
  setState: s => {
    state = s;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (err) {}
    render();
  },
});
