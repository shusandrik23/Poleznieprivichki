import { dateKey, dayKeyFromNumber, streaks, canFreezeYesterday, liveStreak, challengeProgress, todayNumber, escapeHtml as e } from './core.js';
import * as cloud from './cloud.js';
import { social } from './cloud.js';
import { t, pw, num, lang, setLang, locale, LANGS } from './i18n.js';
import { CATEGORIES, catalogName, keyOf, keyOfName, normKey, displayName, nameOfKey } from './catalog.js';
import { factFor } from './facts.js';
import { quoteFor } from './quotes.js';
import { PLANS, goalLimit } from './plans.js';
import { isNative, hasNativeGoogle, appUrl, nativeShare, copyText, openExternal, onBackButton } from './native.js';
import { tournamentsAround, tournamentStatus, canJoin } from './tournaments.js';

const STORAGE_KEY = 'habit-trainer-v1';
const TAB_KEY = 'habit-trainer-tab';
const INVITE_KEY = 'habit-trainer-invite';
const QUOTE_KEY = 'habit-trainer-quote-day';

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
let editingGoal = null;     // id привычки с открытым редактором цели
let renaming = false;       // открыта форма смены ника
let challengeFriend = '';   // выбранный соперник в форме вызова
let challengeHabit = '';    // выбранная привычка в форме вызова
let factOffset = 0;         // «ещё факт»
let sharing = null;         // id привычки с открытой панелью «поделиться»
let suggestions = null;     // случайные соперники
let suggestionsLoading = false;
let sentTo = {};            // кому уже бросили вызов из подборки
const tourData = {};        // id турнира → { top, total, myPlace, loading }
let tourOpen = null;        // турнир с раскрытой таблицей лидеров
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
  state.habits.push({ id: newId(), name, done: {} });
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
  $('langSwitch').innerHTML = LANGS.map(([code]) =>
    `<button data-lang="${code}" class="${code === lang ? 'active' : ''}" aria-label="${code === 'ru' ? 'Русский' : 'English'}">${code.toUpperCase()}</button>`).join('');
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

  if (tab === 'habits') renderHabits();
  if (tab === 'friends') renderFriends();
  if (tab === 'challenges') renderChallenges();
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

function signInCard(text) {
  if (isNative && !hasNativeGoogle()) {
    return `<div class="card center"><p>${text}</p><p class="small">${t('signin.nativeSoon')}</p></div>`;
  }
  return `<div class="card center">
    <p>${text}</p>
    <div class="signin">
      <button class="btn google" data-action="signin-google">${GOOGLE_SVG} ${t('signin.google')}</button>
      ${cloud.appleAvailable ? `<button class="btn apple" data-action="signin-apple">${APPLE_SVG} ${t('signin.apple')}</button>` : ''}
    </div>
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

  html += inviteCard() + similarCard() + settingsCard() + accountCard();
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
        <div class="small">${t('ch.inRow', { n: ch.days, days: pw(ch.days, 'day') })}</div>
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
    // активный вызов: свой прогресс считаем по свежим отметкам
    const myHabit = findByKey(ch.habitKey);
    const mine = progressRow(t('common.you'), challengeProgress(myHabit, ch.startDay, ch.days, today), ch, today);
    const theirs = progressRow(otherName, ch.progress?.[other], ch, today);
    const over = (mine.completed || mine.failed) && (theirs.completed || theirs.failed);
    let result = '';
    if (mine.completed && theirs.completed) result = t('ch.draw');
    else if (mine.completed) result = t('ch.youWon');
    else if (theirs.completed) result = t('ch.theyWon', { name: e(otherName) });
    else if (over) result = t('ch.bothOut');
    else if (theirs.failed) result = t('ch.theyOut', { name: e(otherName) });
    else if (mine.failed) result = t('ch.youOut');
    const finished = mine.completed || theirs.completed || over;
    (finished ? groups.done : groups.active).push(`<div class="card challenge${finished ? ' muted' : ''}">
      ${title}
      <div class="small">${t('ch.inRow', { n: ch.days, days: pw(ch.days, 'day') })}${t('ch.since', { date: shortDate(ch.startDay) })}</div>
      ${mine.html}${theirs.html}
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
  const key = lang + '|' + name + '|' + n;
  if (imageCache[key]) return imageCache[key];
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#1f8f5f'); grad.addColorStop(1, '#0f5c3c');
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
    const mine = joined ? challengeProgress(findByKey(tr.habitKey), tr.startDay, tr.days, today) : null;
    const end = tr.startDay + tr.days - 1;
    const status = st === 'upcoming' ? startWord(tr, today) : st === 'active' ? t('tour.going', { d: today - tr.startDay + 1, n: tr.days }) : t('tour.finished');
    let mineHtml = '';
    if (joined && st !== 'upcoming') {
      const failed = !mine.completed && tr.startDay + mine.count < today;
      mineHtml = `<div class="prow${mine.completed ? ' win' : ''}${failed ? ' out' : ''}"><div class="row-between"><span>${t('common.you')}</span>
        <span class="small">${mine.count} / ${tr.days} · ${mine.completed ? t('ch.statusDone') : failed ? t('tour.youOut') : t('ch.statusPlaying')}${data?.myPlace ? t('tour.place', { n: data.myPlace }) : ''}</span></div>
        <div class="bar"><div class="fill" style="width:${mine.count / tr.days * 100}%"></div></div></div>`;
    }
    html += `<div class="card tour${joined ? ' joined' : ''}">
      <div class="row-between"><div class="ch-title">${e(tr.title)}</div><span class="tag">${status}</span></div>
      <div class="tour-habit">${e(tr.habit)} · ${t('ch.inRow', { n: tr.days, days: pw(tr.days, 'day') })}</div>
      <div class="small">${shortDate(tr.startDay)} — ${shortDate(end)} · ${e(tr.text)}</div>
      <div class="small">${t('tour.participants', { n: data && !data.loading && !data.error ? data.total : '…' })}</div>
      ${mineHtml}
      <div class="row tour-actions">
        ${joined
          ? `<span class="small">${t('tour.joined')}</span>${st === 'upcoming' ? `<button class="link-btn" data-action="tour-leave" data-id="${tr.id}">${t('tour.leave')}</button>` : ''}`
          : canJoin(tr, today) ? `<button class="btn primary small-btn" data-action="tour-join" data-id="${tr.id}">${t('tour.join')}</button>`
          : st !== 'finished' ? `<span class="small">${t('tour.closed')}</span>` : ''}
        <button class="link-btn" data-action="tour-board" data-id="${tr.id}">${tourOpen === tr.id ? t('tour.hideBoard') : t('tour.board')}</button>
      </div>
      ${tourOpen === tr.id ? leaderboardHtml(tr, data) : ''}
    </div>`;
  }
  return html + flashHtml('tour');
}

function leaderboardHtml(tr, data) {
  if (!data || data.loading) return `<p class="small">${t('common.loading')}</p>`;
  if (data.error) return `<p class="small">${t('tour.boardError')}</p>`;
  if (!data.top.length) return `<p class="small">${t('tour.boardEmpty')}</p>`;
  const me = social.user.uid;
  return `<ol class="board">${data.top.map(p => `<li class="${p.uid === me ? 'me' : ''}"><span>@${e(p.nickname)}</span>
    <span>${p.count} / ${tr.days}${p.count >= tr.days ? ' 🏆' : ''}</span></li>`).join('')}</ol>
    ${data.myPlace && data.myPlace > 10 ? `<p class="small">${t('tour.yourPlace', { p: data.myPlace, n: data.total })}</p>` : ''}`;
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
      <select class="inline-select" id="suggestDays">${CHALLENGE_DAYS.map(n => `<option value="${n}"${n === 7 ? ' selected' : ''}>${nd(n)}</option>`).join('')}</select></div>`;
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
    <div class="signin"><button class="btn google" data-action="signin-google">${GOOGLE_SVG} ${t('signin.google')}</button>
    ${cloud.appleAvailable ? `<button class="btn apple" data-action="signin-apple">${APPLE_SVG} ${t('signin.apple')}</button>` : ''}</div>${flashHtml('signin')}`;
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
          ? t('ib.challenge', { habit: e(nameOfKey(d.habitKey, d.habitName)), n: d.days, days: pw(d.days, 'day') })
          : t('ib.friend')}</p>
        <div class="row"><button class="btn primary" data-action="invite-accept">${d.habitName ? t('ib.acceptCh') : t('ib.addFriend')}</button>
        <button class="btn" data-action="invite-dismiss">${t('ib.notNow')}</button></div>`;
    }
  }
  setHTML(el, `<div class="card invite-banner">${body}${flashHtml('inviteBanner')}</div>`);
}

function inviteText(habitName, days, url) {
  return habitName
    ? t('invite.textChallenge', { habit: displayName(habitName), n: days, days: pw(days, 'day'), url })
    : t('invite.textFriend', { nick: social.profile.nickname, url });
}

function shareInvite(via, flashKey, habitName = null, days = null) {
  const inv = cloud.createInvite(habitName, days);
  const text = inviteText(habitName, days, inv.url);
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
  tab = name;
  try { localStorage.setItem(TAB_KEY, tab); } catch (err) {}
  render(); window.scrollTo(0, 0);
}

function switchLang(code) {
  setLang(code);
  applyStaticTexts();
  if (!$('quote').hidden) fillQuote();
  render();
}

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-action], .tabs button, [data-lang]');
  if (!el) return;
  if (el.dataset.lang) { switchLang(el.dataset.lang); return; }
  if (el.dataset.tab) { goTab(el.dataset.tab); return; }
  const { action, id } = el.dataset;
  switch (action) {
    case 'toggle': toggle(id, el.dataset.day); break;
    case 'remove': removeHabit(id); break;
    case 'add': addHabit(el.dataset.name); break;
    case 'next-fact': factOffset++; render(); break;
    case 'freeze': useFreeze(id); break;
    case 'limit-invite': flash.goal = null; editingGoal = null; goTab('friends'); setTimeout(() => document.querySelector('.invite-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); break;
    case 'goal-edit': editingGoal = editingGoal === id ? null : id; flash.goal = null; render(); break;
    case 'goal-set': setGoal(id, el.dataset.days ? Number(el.dataset.days) : null); break;
    case 'signin-google': flash.signin = { text: t('signin.opening') }; render(); run('signin', cloud.signInGoogle); break;
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
      if (name) shareInvite(el.dataset.via, 'challenge', name, Number(form.days.value));
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
    case 'suggest-more': suggestions = null; sentTo = {}; render(); break;
    case 'suggest-challenge': {
      const p = suggestions?.find(x => x.uid === el.dataset.uid);
      const mine = findByKey(el.dataset.key);
      const days = Number($('suggestDays')?.value || 7);
      if (p && mine) run('suggest', async () => {
        await cloud.createChallenge(p, mine.name, days);
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
      await cloud.createChallenge(target, name, Number(fd.get('days')));
      return t('ch.sentTo', { name: target.label });
    });
  }
});

// Перерисовываем при смене дня, если вкладка открыта через полночь.
let lastKey = dateKey(new Date());
setInterval(() => { const k = dateKey(new Date()); if (k !== lastKey) { lastKey = k; factOffset = 0; dailyVisit(); render(); } }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { dailyVisit(); render(); showQuote(); } });

// Цитата дня — при первом запуске за день.
function fillQuote() {
  const q = quoteFor(todayNumber());
  $('quoteText').textContent = lang === 'ru' ? `«${q.text}»` : `“${q.text}”`;
  $('quoteAuthor').textContent = '— ' + q.author;
}
function showQuote(force = false) {
  const day = todayNumber();
  let shown = null;
  try { shown = localStorage.getItem(QUOTE_KEY); } catch (err) {}
  if (!force && shown === String(day)) return;
  fillQuote();
  $('quote').hidden = false;
  $('quoteClose').focus();
  try { localStorage.setItem(QUOTE_KEY, String(day)); } catch (err) {}
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
  onChange: render,
  getState: () => state,
  setState: s => {
    state = s;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (err) {}
    render();
  },
});
