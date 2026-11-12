import { dateKey, streaks, liveStreak, habitKey, challengeProgress, todayNumber, plural, escapeHtml as e } from './core.js';
import * as cloud from './cloud.js';
import { social } from './cloud.js';
import { factFor } from './facts.js';
import { quoteFor } from './quotes.js';
import { PLANS, habitLimit, goalLimit } from './plans.js';
import { isNative, hasNativeGoogle, appUrl, nativeShare, copyText, openExternal, onBackButton } from './native.js';
import { tournamentsAround, tournamentStatus, canJoin } from './tournaments.js';

const STORAGE_KEY = 'habit-trainer-v1';
const TAB_KEY = 'habit-trainer-tab';
const INVITE_KEY = 'habit-trainer-invite';
const QUOTE_KEY = 'habit-trainer-quote-day';

const CATALOG = [
  { title: 'Здоровье', items: ['💧 Выпить 2 литра воды', '🏃 Зарядка 10 минут', '🚶 Пройти 8 000 шагов', '😴 Лечь спать до 23:00', '🥗 Съесть овощи или фрукты', '🧘 Растяжка', '🚿 Контрастный душ'] },
  { title: 'Спорт', items: ['💪 5 отжиманий', '🏋️ 20 приседаний', '⏱️ Планка 1 минута', '🪜 Лестница вместо лифта'] },
  { title: 'Ум и развитие', items: ['📖 Читать 20 минут', '🗣️ Учить иностранный язык 15 минут', '🎧 Послушать подкаст или лекцию', '✍️ Вести дневник', '🧠 Решить задачу или головоломку'] },
  { title: 'Спокойствие', items: ['🧘 Медитация 10 минут', '🙏 Записать 3 вещи, за которые благодарен', '🌳 Прогулка на свежем воздухе', '📵 Час без телефона перед сном'] },
  { title: 'Продуктивность', items: ['📝 Составить план на день', '🧹 Убрать рабочее место', '⏰ Встать без «ещё 5 минут»', '💰 Записать расходы', '💰 Откладывать 100 ₽'] },
  { title: 'Отказ от вредного', items: ['🚭 Не курить', '🍬 Без сладкого', '🍺 Без алкоголя', '📱 Не больше часа соцсетей'] },
  { title: 'Близкие', items: ['📞 Позвонить родным', '💬 Сделать комплимент', '🤝 Помочь кому-нибудь'] },
];
const GOAL_PRESETS = [7, 21, 30, 66, 100];
const CHALLENGE_DAYS = [7, 14, 21, 30, 66, 100];

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const SHARE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';
const TARGET_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>';
const GOOGLE_SVG = '<svg viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const APPLE_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3 0 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4zM13.9 5c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>';

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

function findHabit(name) { return state.habits.find(h => habitKey(h.name) === habitKey(name)); }

// silent — привычка добавляется из вызова или турнира: такие в лимит не упираются.
function addHabit(name, { silent } = {}) {
  name = name.trim();
  if (!name) return false;
  if (findHabit(name)) {
    if (!silent) alert(`Привычка «${name}» уже есть в списке.`);
    return false;
  }
  if (!silent && state.habits.length >= habitLimit(social.referrals)) {
    flash.limit = { text: limitText(), error: true };
    goTab('habits');
    return false;
  }
  flash.limit = null;
  state.habits.push({ id: newId(), name, done: {} });
  save(); render();
  return true;
}

function toggle(id, key) {
  const h = state.habits.find(x => x.id === id);
  if (!h) return;
  if (h.done[key]) delete h.done[key]; else h.done[key] = true;
  save(); render();
}

function removeHabit(id) {
  const h = state.habits.find(x => x.id === id);
  if (!h || !confirm(`Удалить привычку «${h.name}» вместе со статистикой?`)) return;
  state.habits = state.habits.filter(x => x.id !== id);
  save(); render();
}

function setGoal(id, days) {
  const h = state.habits.find(x => x.id === id);
  if (!h) return;
  if (days && !h.goal && state.habits.filter(x => x.goal).length >= goalLimit()) {
    flash.goal = { text: `Бесплатно можно держать ${PLANS.freeGoals} активные цели. Уберите цель у другой привычки или дождитесь YouBoost Plus — там без ограничений.`, error: true };
    render();
    return;
  }
  flash.goal = null;
  if (days) h.goal = days; else delete h.goal;
  editingGoal = null;
  save(); render();
}

function limitText() {
  const n = habitLimit(social.referrals);
  return `Бесплатно можно вести ${n} ${habitWord(n)}. Пригласите друга по ссылке — за каждого, кто зарегистрируется, +${PLANS.bonusPerReferral} привычка. Без ограничений — в YouBoost Plus (скоро).`;
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

function render() {
  const now = new Date();
  $('today').textContent = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

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
  const key = habitKey(h.name);
  const today = todayNumber();
  const out = [];
  for (const f of social.friends) {
    const st = social.friendStats[f.uid]?.habits?.find(x => x.key === key);
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
    week.push({ key: dateKey(d), label: d.toLocaleDateString('ru-RU', { weekday: 'short' }), num: d.getDate() });
  }

  let doneCount = 0;
  const items = state.habits.map(h => {
    const done = !!h.done[todayKey];
    if (done) doneCount++;
    const { best, current } = streaks(h, todayKey);
    let html = `<li class="habit${done ? ' done' : ''}">
      <button class="check" data-action="toggle" data-id="${h.id}" data-day="${todayKey}" aria-label="${done ? 'Снять отметку' : 'Отметить выполненной'}">${CHECK_SVG}</button>
      <div class="name">${e(h.name)}</div>
      <div class="actions">
        ${current > 0 ? `<button class="icon-btn${sharing === h.id ? ' active' : ''}" data-action="share-edit" data-id="${h.id}" title="Поделиться серией" aria-label="Поделиться серией">${SHARE_SVG}</button>` : ''}
        <button class="icon-btn${editingGoal === h.id ? ' active' : ''}" data-action="goal-edit" data-id="${h.id}" title="${h.goal ? 'Изменить цель' : 'Поставить цель'}" aria-label="${h.goal ? 'Изменить цель' : 'Поставить цель'}">${TARGET_SVG}</button>
        <button class="icon-btn delete" data-action="remove" data-id="${h.id}" title="Удалить привычку" aria-label="Удалить привычку">×</button>
      </div>
      <div class="stats"><span>Текущая серия: <b>${current}</b> ${plural(current)}</span><span>Рекорд: <b>${best}</b> ${plural(best)}</span></div>`;

    if (h.goal) {
      const reached = current >= h.goal, left = h.goal - current;
      html += `<div class="goal${reached ? ' reached' : ''}">
        <div class="goal-head"><span>🎯 Цель: <b>${h.goal}</b> ${plural(h.goal)} подряд</span>
        <span>${reached ? 'Цель достигнута! 🎉' : `${current} / ${h.goal} · осталось ${left} ${plural(left)}`}</span></div>
        <div class="bar"><div class="fill" style="width:${Math.min(100, current / h.goal * 100)}%"></div></div></div>`;
    }

    if (editingGoal === h.id) {
      const custom = h.goal && !GOAL_PRESETS.includes(h.goal) ? h.goal : '';
      html += `<div class="panel">
        <p>Сколько дней подряд вы хотите выполнять эту привычку?</p>
        <div class="chips">${GOAL_PRESETS.map(n => `<button class="chip${h.goal === n ? ' selected' : ''}" data-action="goal-set" data-id="${h.id}" data-days="${n}">${n} ${plural(n)}</button>`).join('')}</div>
        <form class="row" data-form="goal" data-id="${h.id}">
          <span>Своё:</span><input name="days" type="number" min="1" max="3650" inputmode="numeric" placeholder="дней" value="${custom}">
          <button class="chip" type="submit">Сохранить</button>
          ${h.goal ? `<button class="link-btn" type="button" data-action="goal-set" data-id="${h.id}" data-days="">Убрать цель</button>` : ''}
        </form>${flashHtml('goal')}</div>`;
    }

    if (sharing === h.id && current > 0) {
      html += `<div class="panel share-panel">
        <img class="share-img" src="${streakImage(h.name, current)}" alt="Карточка серии">
        <p>Похвастайтесь серией и позовите друзей посоревноваться: по ссылке они сразу примут вызов «${e(h.name)}».</p>
        <div class="row">
          ${canShareFiles() ? `<button class="btn primary" data-action="share-streak" data-via="image" data-id="${h.id}">Поделиться картинкой</button>` : ''}
          <button class="btn whatsapp" data-action="share-streak" data-via="whatsapp" data-id="${h.id}">WhatsApp</button>
          ${canShareText() ? `<button class="btn" data-action="share-streak" data-via="share" data-id="${h.id}">Поделиться…</button>` : ''}
          <button class="btn" data-action="share-streak" data-via="copy" data-id="${h.id}">Скопировать текст</button>
          ${isNative ? '' : `<button class="btn" data-action="share-streak" data-via="download" data-id="${h.id}">Скачать картинку</button>`}
        </div>
        ${flashHtml('share')}
      </div>`;
    }

    const fr = friendsOnHabit(h);
    if (fr.length) {
      html += `<div class="friends-line">👥 ${fr.map(f => `${e(f.name)} <b>${f.cur}</b>`).join(' · ')}</div>`;
    }

    html += `<div class="week">${week.map(d => `<button class="day${h.done[d.key] ? ' on' : ''}${d.key === todayKey ? ' today' : ''}" data-action="toggle" data-id="${h.id}" data-day="${d.key}" title="${h.done[d.key] ? 'Выполнено — нажмите, чтобы снять' : 'Не выполнено — нажмите, чтобы отметить'}"><span>${d.label}</span>${d.num}</button>`).join('')}</div></li>`;
    return html;
  });

  setHTML($('list'), items.length ? items.join('')
    : '<li class="empty">Пока нет привычек. Впишите свою или выберите из готового списка — что вы хотите делать каждый день?</li>');

  const total = state.habits.length;
  $('progress').hidden = !total;
  $('fill').style.width = total ? (doneCount / total * 100) + '%' : '0';
  $('progressText').textContent = total
    ? `Сегодня выполнено ${doneCount} из ${total}` + (doneCount === total ? ' — отличный день! 🎉' : '') : '';
  $('hint').hidden = !total;

  const added = new Set(state.habits.map(h => habitKey(h.name)));
  $('catalogBody').innerHTML = CATALOG.map(cat => `<div class="cat"><h3>${cat.title}</h3><div class="chips">${
    cat.items.map(item => added.has(habitKey(item))
      ? `<button class="chip added" disabled title="Уже в вашем списке">${e(item)} ✓</button>`
      : `<button class="chip" data-action="add" data-name="${e(item)}" title="Добавить">+ ${e(item)}</button>`).join('')
  }</div></div>`).join('');

  // Сколько привычек ещё можно добавить бесплатно
  const lim = habitLimit(social.referrals);
  $('limitNote').innerHTML = flash.limit ? `<div class="limit-card"><p>${e(flash.limit.text)}</p>
      ${cloud.cloudAvailable ? '<button class="btn primary small-btn" data-action="limit-invite">Пригласить друга</button>' : ''}</div>`
    : lim !== Infinity && state.habits.length >= lim - 1
      ? `<p class="small limit-hint">Привычек: ${state.habits.length} из ${lim}. <button class="link-btn" data-action="limit-invite">+1 за приглашённого друга</button></p>` : '';

  // Анонс турнира, к которому можно присоединиться
  const today = todayNumber();
  const tj = cloud.cloudAvailable && tournamentsAround(today).find(t => canJoin(t, today) && !social.joined.includes(t.id));
  $('tourBanner').hidden = !tj;
  if (tj) {
    const st = tournamentStatus(tj, today);
    $('tourBanner').innerHTML = `<div class="row-between"><div>🏆 <b>${e(tj.title)}</b>${st === 'active' ? ' уже идёт' : ` — ${startWord(tj, today)}`}: ${e(tj.habit)}, ${tj.days} ${plural(tj.days)} подряд</div>
      <button class="btn primary small-btn" data-action="go-tournaments">Участвовать</button></div>`;
  }

  // Факт дня
  const fact = factFor(todayNumber(), factOffset);
  const has = findHabit(fact.habit);
  $('fact').innerHTML = `<div class="fact-head"><span>💡 Факт дня</span>
      <button class="link-btn" data-action="next-fact">Ещё факт →</button></div>
    <p>${e(fact.text)}</p>
    ${has ? `<p class="small">✓ «${e(fact.habit)}» уже в вашем списке</p>`
      : `<button class="btn primary small-btn" data-action="add" data-name="${e(fact.habit)}">+ Добавить привычку «${e(fact.habit)}»</button>`}`;
}


function signInCard(text) {
  if (isNative && !hasNativeGoogle()) {
    return `<div class="card center"><p>${text}</p>
      <p class="small">Вход в приложении появится в следующей версии. А пока войти можно на сайте: <b>shusandrik23.github.io/Poleznieprivichki</b> — там же друзья, вызовы и турниры.</p></div>`;
  }
  return `<div class="card center">
    <p>${text}</p>
    <div class="signin">
      <button class="btn google" data-action="signin-google">${GOOGLE_SVG} Войти через Google</button>
      ${cloud.appleAvailable ? `<button class="btn apple" data-action="signin-apple">${APPLE_SVG} Войти через Apple</button>` : ''}
    </div>
    <p class="small">Ваши привычки сохранятся в аккаунте и будут доступны на всех устройствах. Другие люди видят только ваш ник и серии.</p>
  </div>`;
}

function nicknameForm() {
  return `<div class="card">
    <h2>${renaming ? 'Сменить ник' : 'Выберите ник'}</h2>
    <p class="small">По нику вас найдут друзья. Настоящее имя по желанию можно показать только друзьям — это настраивается ниже.</p>
    <form data-form="nickname" class="stack">
      <label>Ник<input name="nickname" required placeholder="например, anna_run" maxlength="21" autocomplete="off" autocapitalize="none" value="${e(social.profile?.nickname || '')}"></label>
      <div class="row"><button class="btn primary" type="submit">Сохранить</button>
      ${renaming ? '<button class="btn" type="button" data-action="rename-cancel">Отмена</button>' : ''}</div>
      ${flashHtml('nickname')}
    </form>
  </div>`;
}

// Общий «шлюз»: пока нет входа или ника — показываем соответствующий экран.
function socialGate(text) {
  if (!cloud.cloudAvailable) return `<div class="card center"><p>👥 Друзья и вызовы появятся, когда приложение подключат к серверу.</p><p class="small">Пока все привычки хранятся только на этом устройстве.</p></div>`;
  if (social.error) return `<div class="card center"><p>${e(social.error)}</p></div>`;
  if (!social.ready || (social.user && social.profile === undefined)) return `<div class="card center"><p class="small">Подключаемся…</p></div>`;
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
  return `<div class="card invite-card">
    <h2>Пригласить друга, которого нет в приложении</h2>
    <p class="small">Отправьте ссылку. Когда друг откроет её и войдёт, вы сразу станете друзьями.</p>
    ${PLANS.limitsEnabled ? `<p class="bonus">🎁 За каждого друга, который зарегистрируется по вашей ссылке, +${PLANS.bonusPerReferral} привычка.${n ? ` Уже пришли: <b>${n}</b> — вам доступно ${habitLimit(n)} ${habitWord(habitLimit(n))}.` : ''}</p>` : ''}
    <div class="row">
      <button class="btn whatsapp" data-action="invite" data-via="whatsapp">WhatsApp</button>
      ${canShareText() ? '<button class="btn" data-action="invite" data-via="share">Поделиться…</button>' : ''}
      <button class="btn" data-action="invite" data-via="copy">Скопировать ссылку</button>
    </div>
    ${flashHtml('invite')}
  </div>`;
}

function similarCard() {
  const me = social.user.uid;
  let html = `<div class="card">
    <h2>Люди с такими же привычками</h2>
    <p class="small">Не обязательно звать знакомых: найдите тех, кто тоже читает, бегает или бросает курить, — и соревнуйтесь.</p>`;
  if (!social.settings.discoverable) {
    html += `<p class="small">Чтобы искать и быть найденным, включите «Показывать меня людям с такими же привычками» в настройках ниже.</p>`;
  }
  if (!state.habits.length) {
    html += `<p class="small">Сначала добавьте хотя бы одну привычку.</p></div>`;
    return html;
  }
  html += `<button class="btn" data-action="find-similar"${similarLoading ? ' disabled' : ''}>${similarLoading ? 'Ищем…' : similar ? '🔄 Обновить' : '🔍 Найти'}</button>`;
  if (similar) {
    const list = similar.filter(p => p.uid !== me);
    if (!list.length) html += `<p class="small">Пока никого не нашлось. Загляните позже — людей становится больше.</p>`;
    const today = todayNumber();
    for (const p of list) {
      const isFriend = social.friends.some(f => f.uid === p.uid);
      const pending = social.outgoing.some(r => r.to === p.uid);
      html += `<div class="person">
        <div class="row-between"><b>@${e(p.nickname)}</b>
          <div class="row">
            ${isFriend ? '<span class="small">в друзьях</span>' : pending ? '<span class="small">заявка отправлена</span>'
              : `<button class="btn small-btn" data-action="similar-friend" data-uid="${p.uid}">+ В друзья</button>`}
            <button class="btn small-btn" data-action="challenge-person" data-uid="${p.uid}">⚔️ Вызов</button>
          </div></div>
        <div class="small">${p.common.map(h => { const c = liveStreak(h, today); return `${e(h.name)}: <b>${c}</b> ${plural(c)}`; }).join(' · ')}</div>
      </div>`;
    }
  }
  html += flashHtml('similar') + `</div>`;
  return html;
}

function settingsCard() {
  const st = social.settings;
  return `<div class="card">
    <h2>Настройки приватности</h2>
    <form data-form="settings" class="stack">
      <label class="check-row"><input type="checkbox" name="showName"${st.showName ? ' checked' : ''}><span>Показывать друзьям моё настоящее имя</span></label>
      <label class="indent"${st.showName ? '' : ' hidden'}>Настоящее имя<input name="realName" maxlength="40" value="${e(st.realName || '')}" placeholder="Анна Иванова" autocomplete="name"></label>
      <label class="check-row"><input type="checkbox" name="discoverable"${st.discoverable ? ' checked' : ''}><span>Показывать меня людям с такими же привычками <span class="small">— видны только ник и серии</span></span></label>
      <button class="btn primary" type="submit">Сохранить</button>
      ${flashHtml('settings')}
    </form>
  </div>`;
}

function renderFriends() {
  const el = $('view-friends');
  const gate = socialGate('Войдите, чтобы добавлять друзей, бросать им вызовы и видеть их серии по таким же привычкам, как у вас.');
  if (gate) { setHTML(el, gate); return; }

  const today = todayNumber();
  const todayKey = dateKey(new Date());
  let html = `<div class="card">
    <h2>Добавить друга по нику</h2>
    <form data-form="friend" class="row">
      <input name="nickname" placeholder="@ник друга" autocomplete="off" autocapitalize="none" required>
      <button class="btn primary" type="submit">Отправить заявку</button>
    </form>
    ${flashHtml('friend')}
    <p class="small">Ваш ник: <b>@${e(social.profile.nickname)}</b></p>
  </div>`;

  if (social.incoming.length) {
    html += `<h2 class="section">Заявки в друзья</h2>` + social.incoming.map(r => `<div class="card row-between">
      <div><b>@${e(r.fromNick)}</b><div class="small">хочет добавить вас в друзья</div></div>
      <div class="row"><button class="btn primary" data-action="req-accept" data-id="${r.id}">Принять</button>
      <button class="btn" data-action="req-decline" data-id="${r.id}">Отклонить</button></div></div>`).join('');
  }
  if (social.outgoing.length) {
    html += `<h2 class="section">Ждут ответа</h2>` + social.outgoing.map(r => `<div class="card row-between">
      <div><b>@${e(r.toNick)}</b><div class="small">заявка отправлена</div></div>
      <button class="btn" data-action="req-cancel" data-id="${r.id}">Отменить</button></div>`).join('');
  }

  html += `<h2 class="section">Друзья${social.friends.length ? ` (${social.friends.length})` : ''}</h2>`;
  if (!social.friends.length) {
    html += `<p class="empty">Пока никого. Добавьте друга по нику, пригласите по ссылке или найдите людей с такими же привычками.</p>`;
  }
  for (const f of social.friends) {
    const stats = social.friendStats[f.uid]?.habits || [];
    const common = state.habits.map(h => ({ h, st: stats.find(s => s.key === habitKey(h.name)) })).filter(x => x.st);
    html += `<div class="card friend">
      <div class="row-between"><div class="friend-name">${friendHtml(f)}</div>
      <div class="row"><button class="btn small-btn" data-action="challenge-person" data-uid="${f.uid}">⚔️ Вызов</button>
      <button class="icon-btn delete" data-action="friend-remove" data-uid="${f.uid}" title="Удалить из друзей" aria-label="Удалить из друзей">×</button></div></div>
      ${common.length ? `<table class="compare"><thead><tr><th>Общая привычка</th><th>${e(friendLabel(f))}</th><th>Вы</th></tr></thead><tbody>${
        common.map(({ h, st }) => {
          const theirs = liveStreak(st, today), mine = streaks(h, todayKey).current;
          return `<tr><td>${e(h.name)}</td><td class="${theirs > mine ? 'lead' : ''}"><b>${theirs}</b> ${plural(theirs)}<div class="small">рекорд ${st.best}</div></td><td class="${mine > theirs ? 'lead' : ''}"><b>${mine}</b> ${plural(mine)}</td></tr>`;
        }).join('')}</tbody></table>`
      : `<p class="small">Общих привычек пока нет${stats.length ? ` — у друга ${stats.length} ${habitWord(stats.length)}, но не такие, как у вас` : ''}.</p>`}
    </div>`;
  }

  html += inviteCard() + similarCard() + settingsCard() + accountCard();
  setHTML(el, html);
}

function habitWord(n) {
  const a = n % 100, b = n % 10;
  if (a > 10 && a < 20) return 'привычек';
  if (b === 1) return 'привычка';
  if (b >= 2 && b <= 4) return 'привычки';
  return 'привычек';
}

function accountCard() {
  return `<div class="account">
    <p class="small">Вы вошли как <b>@${e(social.profile.nickname)}</b>${social.user.email ? ` (${e(social.user.email)})` : ''}</p>
    <div class="row center-row">
      <button class="link-btn" data-action="rename">Сменить ник</button>
      <button class="link-btn" data-action="signout">Выйти</button>
      <button class="link-btn danger" data-action="delete-account">Удалить аккаунт</button>
    </div>
  </div>`;
}

function progressRow(name, p, ch, today) {
  // Результат пересчитываем по числу дней, а не доверяем сохранённому флагу.
  const count = p ? Math.min(Number(p.count) || 0, ch.days) : 0;
  const completed = count >= ch.days;
  const failed = !completed && ch.startDay + count < today;
  const status = completed ? 'выполнено 🏆' : failed ? 'выбыл(а) — пропущен день' : p ? 'в игре' : 'ещё не отметил(а)';
  return { failed, completed, html: `<div class="prow${completed ? ' win' : ''}${failed ? ' out' : ''}">
    <div class="row-between"><span>${e(name)}</span><span class="small">${count} / ${ch.days} · ${status}</span></div>
    <div class="bar"><div class="fill" style="width:${Math.min(100, count / ch.days * 100)}%"></div></div></div>` };
}

// Кому можно бросить вызов: друзья и найденные люди.
function challengeTargets() {
  const out = social.friends.map(f => ({ uid: f.uid, nickname: f.nickname, label: friendLabel(f), group: 'Друзья' }));
  for (const p of [...(suggestions || []), ...(similar || [])]) {
    if (!out.some(t => t.uid === p.uid)) out.push({ uid: p.uid, nickname: p.nickname, label: '@' + p.nickname, group: 'Люди с такими же привычками' });
  }
  return out;
}

function participantName(ch, uid) {
  const f = social.friends.find(x => x.uid === uid);
  return f ? friendLabel(f) : '@' + (ch.names?.[uid] || 'соперник');
}

function renderChallenges() {
  const el = $('view-challenges');
  const gate = socialGate('Войдите, чтобы бросать вызовы: кто дольше продержится с привычкой день за днём.');
  if (gate) { setHTML(el, gate); return; }
  const me = social.user.uid;
  const today = todayNumber();
  const habits = state.habits;
  const targets = challengeTargets();
  const groupsHtml = ['Друзья', 'Люди с такими же привычками'].map(g => {
    const list = targets.filter(t => t.group === g);
    return list.length ? `<optgroup label="${g}">${list.map(t => `<option value="${t.uid}"${t.uid === challengeFriend ? ' selected' : ''}>${e(t.label)}</option>`).join('')}</optgroup>` : '';
  }).join('');

  const showNew = !habits.length || challengeHabit === '__new';
  const formHtml = `<div class="card">
    <h2>Бросить вызов</h2>
    <p class="small">Побеждает тот, кто первым выполнит привычку нужное число дней подряд. Пропуск дня — выбываете.</p>
    <form data-form="challenge" class="stack">
      <label>Привычка<select name="habit">${habits.map(h => `<option value="${h.id}"${h.id === challengeHabit ? ' selected' : ''}>${e(h.name)}</option>`).join('')}
        <option value="__new"${showNew ? ' selected' : ''}>✏️ Своя новая привычка…</option></select></label>
      <label class="new-habit"${showNew ? '' : ' hidden'}>Название привычки<input name="newHabit" maxlength="80" placeholder="например, «Холодный душ» или «Не есть после 19:00»" autocomplete="off"></label>
      <label>Сколько дней подряд<select name="days">${CHALLENGE_DAYS.map(n => `<option value="${n}"${n === 21 ? ' selected' : ''}>${n} ${plural(n)}</option>`).join('')}</select></label>
      ${targets.length ? `<label>Соперник<select name="friend">${groupsHtml}</select></label>
        <button class="btn primary" type="submit">⚔️ Бросить вызов</button>` : ''}
      <div class="or">${targets.length ? 'или отправьте вызов тому, кого ещё нет в приложении' : 'Отправьте вызов другу — даже если его ещё нет в приложении'}</div>
      <div class="row">
        <button class="btn whatsapp" type="button" data-action="ch-invite" data-via="whatsapp">WhatsApp</button>
        ${canShareText() ? `<button class="btn" type="button" data-action="ch-invite" data-via="share">Поделиться…</button>` : ''}
        <button class="btn" type="button" data-action="ch-invite" data-via="copy">Скопировать ссылку</button>
      </div>
      ${flashHtml('challenge')}
    </form></div>`;

  const groups = { incoming: [], active: [], waiting: [], done: [] };
  for (const ch of social.challenges) {
    const other = ch.participants.find(u => u !== me);
    const otherName = participantName(ch, other);
    if (ch.status === 'pending') {
      (ch.participants[1] === me ? groups.incoming : groups.waiting).push(`<div class="card challenge">
        <div class="ch-title">⚔️ ${e(ch.habitName)}</div>
        <div class="small">${ch.days} ${plural(ch.days)} подряд</div>
        ${ch.participants[1] === me
          ? `<p>${e(otherName)} бросает вам вызов!</p><div class="row"><button class="btn primary" data-action="ch-accept" data-id="${ch.id}">Принять</button><button class="btn" data-action="ch-decline" data-id="${ch.id}">Отказаться</button></div>`
          : `<p class="small">Ждём ответа от ${e(otherName)}</p><button class="link-btn" data-action="ch-delete" data-id="${ch.id}">Отменить вызов</button>`}
      </div>`);
      continue;
    }
    if (ch.status === 'declined') {
      groups.done.push(`<div class="card challenge muted"><div class="ch-title">⚔️ ${e(ch.habitName)}</div>
        <p class="small">${ch.participants[0] === me ? `${e(otherName)} отказался(ась) от вызова` : 'Вы отказались от вызова'}</p>
        <button class="link-btn" data-action="ch-delete" data-id="${ch.id}">Убрать</button></div>`);
      continue;
    }
    // активный вызов: свой прогресс считаем по свежим отметкам
    const myHabit = findHabit(ch.habitName);
    const mine = progressRow('Вы', challengeProgress(myHabit, ch.startDay, ch.days, today), ch, today);
    const theirs = progressRow(otherName, ch.progress?.[other], ch, today);
    const over = (mine.completed || mine.failed) && (theirs.completed || theirs.failed);
    let result = '';
    if (mine.completed && theirs.completed) result = '🤝 Ничья — вы оба справились!';
    else if (mine.completed) result = '🏆 Вы победили!';
    else if (theirs.completed) result = `🏆 Победил(а) ${e(otherName)}`;
    else if (over) result = 'Оба выбыли. Попробуйте ещё раз!';
    else if (theirs.failed) result = `${e(otherName)} выбыл(а) — продержитесь до конца, и победа ваша!`;
    else if (mine.failed) result = 'Вы пропустили день и выбыли из вызова.';
    const finished = mine.completed || theirs.completed || over;
    (finished ? groups.done : groups.active).push(`<div class="card challenge${finished ? ' muted' : ''}">
      <div class="ch-title">⚔️ ${e(ch.habitName)}</div>
      <div class="small">${ch.days} ${plural(ch.days)} подряд · с ${new Date(ch.startDay * 86400000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
      ${mine.html}${theirs.html}
      ${result ? `<p class="result">${result}</p>` : ''}
      ${!myHabit ? `<p class="small">У вас нет этой привычки в списке — <button class="link-btn" data-action="ch-addhabit" data-name="${e(ch.habitName)}">добавить</button></p>` : ''}
      <button class="link-btn" data-action="ch-delete" data-id="${ch.id}">${finished ? 'Убрать' : 'Сдаться и удалить вызов'}</button>
    </div>`);
  }
  let html = '';
  if (groups.incoming.length) html += `<h2 class="section first">Вам бросили вызов</h2>${groups.incoming.join('')}`;
  html += tournamentsHtml(today);
  html += `<h2 class="section">⚔️ Вызовы</h2>` + suggestionsHtml(today) + formHtml;
  if (groups.active.length) html += `<h2 class="section">Идут сейчас</h2>${groups.active.join('')}`;
  if (groups.waiting.length) html += `<h2 class="section">Ждут ответа</h2>${groups.waiting.join('')}`;
  if (groups.done.length) html += `<h2 class="section">Завершённые</h2>${groups.done.join('')}`;
  setHTML(el, html);
}

// ---------- Поделиться серией ----------

const imageCache = {};
function streakImage(name, n) {
  const key = name + '|' + n;
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
  g.font = `600 64px ${font}`; g.fillText(`${plural(n)} подряд`, W / 2, 740);
  // название привычки, переносим по словам
  g.font = `bold 64px ${font}`;
  const words = name.split(' '); const lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > W - 160 && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line);
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, W / 2, 880 + i * 80));
  g.font = `600 56px ${font}`; g.fillStyle = '#ffe08a';
  g.fillText('Сможешь побить мой рекорд?', W / 2, 1130);
  g.font = `40px ${font}`; g.fillStyle = 'rgba(255,255,255,.85)';
  g.fillText('YouBoost — трекер полезных привычек', W / 2, 1250);
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
  // Ссылка-вызов, если есть аккаунт; иначе — просто ссылка на приложение.
  let url = appUrl();
  if (social.user && social.profile) {
    const inv = cloud.createInvite(h.name, 21);
    inv.saved.catch(err => console.error(err));
    url = inv.url;
  }
  const text = `🔥 ${n} ${plural(n)} подряд: «${h.name}»! Давай соревноваться — кто продержится 21 день? ${url}`;
  const img = streakImage(h.name, n);
  const file = `seriya-${n}.png`;
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
    flash.share = { text: 'Картинка сохранена — добавьте её в сторис или пост и приложите ссылку из «Скопировать текст».' };
  } else {
    copyText(text)
      .then(() => { flash.share = { text: 'Текст со ссылкой скопирован.' }; render(); })
      .catch(() => { flash.share = { text }; render(); });
  }
  render();
}

// ---------- Турниры ----------

function dayLabel(n) { return new Date(n * 86400000).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); }
function shortDay(n) { return new Date(n * 86400000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }); }

function startWord(t, today) {
  const d = t.startDay - today;
  if (d === 0) return 'старт сегодня';
  if (d === 1) return 'старт завтра';
  const label = dayLabel(t.startDay);
  return (label.startsWith('вторник') ? 'старт во ' : 'старт в ') + label.replace(/^(среда|пятница|суббота)/, m => m.slice(0, -1) + 'у');
}

function loadTour(t) {
  if (tourData[t.id]?.loading) return;
  tourData[t.id] = { ...(tourData[t.id] || {}), loading: true };
  cloud.loadLeaderboard(t)
    .then(d => { tourData[t.id] = { ...d, loading: false }; })
    .catch(err => { console.error(err); tourData[t.id] = { loading: false, error: true }; })
    .finally(render);
}

function tournamentsHtml(today) {
  const list = tournamentsAround(today);
  let html = `<h2 class="section">🏆 Турниры</h2>`;
  for (const t of list) {
    const st = tournamentStatus(t, today);
    const joined = social.joined.includes(t.id);
    const data = tourData[t.id];
    if (!data) loadTour(t);
    const mine = joined ? challengeProgress(findHabit(t.habit), t.startDay, t.days, today) : null;
    const end = t.startDay + t.days - 1;
    let status = st === 'upcoming' ? startWord(t, today) : st === 'active' ? `идёт: день ${today - t.startDay + 1} из ${t.days}` : 'завершён';
    let mineHtml = '';
    if (joined && st !== 'upcoming') {
      const failed = !mine.completed && t.startDay + mine.count < today;
      mineHtml = `<div class="prow${mine.completed ? ' win' : ''}${failed ? ' out' : ''}"><div class="row-between"><span>Вы</span>
        <span class="small">${mine.count} / ${t.days} · ${mine.completed ? 'выполнено 🏆' : failed ? 'выбыли — пропущен день' : 'в игре'}${data?.myPlace ? ` · ${data.myPlace} место` : ''}</span></div>
        <div class="bar"><div class="fill" style="width:${mine.count / t.days * 100}%"></div></div></div>`;
    }
    html += `<div class="card tour${joined ? ' joined' : ''}">
      <div class="row-between"><div class="ch-title">${e(t.title)}</div><span class="tag">${status}</span></div>
      <div class="tour-habit">${e(t.habit)} · ${t.days} ${plural(t.days)} подряд</div>
      <div class="small">${shortDay(t.startDay)} — ${shortDay(end)} · ${e(t.text)}</div>
      <div class="small">Участников: <b>${data && !data.loading && !data.error ? data.total : '…'}</b></div>
      ${mineHtml}
      <div class="row tour-actions">
        ${joined
          ? `<span class="small">✓ Вы участвуете</span>${st === 'upcoming' ? `<button class="link-btn" data-action="tour-leave" data-id="${t.id}">Отменить участие</button>` : ''}`
          : canJoin(t, today) ? `<button class="btn primary small-btn" data-action="tour-join" data-id="${t.id}">Участвовать</button>`
          : st !== 'finished' ? '<span class="small">Регистрация закрыта — ждите следующий турнир</span>' : ''}
        <button class="link-btn" data-action="tour-board" data-id="${t.id}">${tourOpen === t.id ? 'Скрыть таблицу' : 'Таблица лидеров'}</button>
      </div>
      ${tourOpen === t.id ? leaderboardHtml(t, data) : ''}
    </div>`;
  }
  return html + flashHtml('tour');
}

function leaderboardHtml(t, data) {
  if (!data || data.loading) return '<p class="small">Загружаем…</p>';
  if (data.error) return '<p class="small">Не удалось загрузить таблицу.</p>';
  if (!data.top.length) return '<p class="small">Пока никто не участвует — будьте первым!</p>';
  const me = social.user.uid;
  return `<ol class="board">${data.top.map(p => `<li class="${p.uid === me ? 'me' : ''}"><span>@${e(p.nickname)}</span>
    <span>${p.count} / ${t.days}${p.count >= t.days ? ' 🏆' : ''}</span></li>`).join('')}</ol>
    ${data.myPlace && data.myPlace > 10 ? `<p class="small">Ваше место: ${data.myPlace} из ${data.total}</p>` : ''}`;
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
    <div class="row-between"><h2>Соперники для вас</h2>
      <button class="link-btn" data-action="suggest-more"${suggestionsLoading ? ' disabled' : ''}>🔀 Другие</button></div>
    <p class="small">Случайные люди с такими же привычками. Бросьте вызов — кто продержится дольше?</p>
    <div class="row"><span class="small">Срок вызова:</span>
      <select class="inline-select" id="suggestDays">${CHALLENGE_DAYS.map(n => `<option value="${n}"${n === 7 ? ' selected' : ''}>${n} ${plural(n)}</option>`).join('')}</select></div>`;
  if (suggestionsLoading && !suggestions) html += '<p class="small">Ищем…</p>';
  else if (!suggestions?.length) html += '<p class="small">Пока никого с такими же привычками. Загляните позже или пригласите друзей по ссылке.</p>';
  for (const p of suggestions || []) {
    html += `<div class="person"><div class="row-between"><b>@${e(p.nickname)}</b></div>
      <div class="chips">${p.common.map(h => {
        const c = liveStreak(h, today), k = p.uid + '|' + h.key;
        return sentTo[k] ? `<span class="chip added">✓ ${e(h.name)} — вызов отправлен</span>`
          : `<button class="chip" data-action="suggest-challenge" data-uid="${p.uid}" data-key="${e(h.key)}">⚔️ ${e(h.name)} · серия ${c} ${plural(c)}</button>`;
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
  if (!social.ready) body = '<p class="small">Загружаем приглашение…</p>';
  else if (!social.user) body = `<p><b>Вас пригласили в YouBoost!</b></p><p class="small">Войдите, чтобы принять приглашение.</p>
    <div class="signin"><button class="btn google" data-action="signin-google">${GOOGLE_SVG} Войти через Google</button>
    ${cloud.appleAvailable ? `<button class="btn apple" data-action="signin-apple">${APPLE_SVG} Войти через Apple</button>` : ''}</div>`;
  else if (social.profile === undefined) body = '<p class="small">Загружаем приглашение…</p>';
  else if (!social.profile) { setHTML(el, `<p class="invite-note"><b>Вас пригласили в YouBoost!</b> Выберите ник — и сможете принять приглашение.</p>${nicknameForm()}`); return; }
  else {
    if (inv.status === 'new') {
      inv.status = 'loading';
      cloud.getInvite(inv.code).then(data => {
        Object.assign(inv, data ? { status: 'ready', data } : { status: 'missing' });
        render();
      }).catch(() => { inv.status = 'missing'; render(); });
    }
    if (inv.status === 'loading') body = '<p class="small">Загружаем приглашение…</p>';
    else if (inv.status === 'missing') body = `<p>Приглашение не найдено — возможно, ссылка устарела.</p><button class="btn" data-action="invite-dismiss">Закрыть</button>`;
    else if (inv.status === 'ready') {
      const d = inv.data;
      if (d.from === social.user.uid) body = `<p>Это ваша собственная ссылка-приглашение. Отправьте её другу!</p><button class="btn" data-action="invite-dismiss">Закрыть</button>`;
      else body = `<p><b>@${e(d.nickname)}</b> ${d.habitName
          ? `бросает вам вызов: <b>${e(d.habitName)}</b> — ${d.days} ${plural(d.days)} подряд! Кто продержится дольше?`
          : 'приглашает вас в друзья — будете видеть серии друг друга по общим привычкам.'}</p>
        <div class="row"><button class="btn primary" data-action="invite-accept">${d.habitName ? 'Принять вызов' : 'Добавить в друзья'}</button>
        <button class="btn" data-action="invite-dismiss">Не сейчас</button></div>`;
    }
  }
  setHTML(el, `<div class="card invite-banner">${body}${flashHtml('inviteBanner')}</div>`);
}

function inviteText(habitName, days, url) {
  return habitName
    ? `Бросаю тебе вызов: «${habitName}» ${days} ${plural(days)} подряд! Кто продержится дольше? 💪 Принять вызов: ${url}`
    : `Давай вместе следить за полезными привычками и соревноваться сериями! Мой ник @${social.profile.nickname}. Присоединяйся: ${url}`;
}

function shareInvite(via, flashKey, habitName = null, days = null) {
  const inv = cloud.createInvite(habitName, days);
  const text = inviteText(habitName, days, inv.url);
  inv.saved.catch(err => { console.error(err); flash[flashKey] = { text: 'Не удалось сохранить приглашение. Попробуйте ещё раз.', error: true }; render(); });
  if (via === 'whatsapp') {
    openExternal('https://wa.me/?text=' + encodeURIComponent(text));
    flash[flashKey] = { text: 'Открываем WhatsApp… Выберите, кому отправить.' };
  } else if (via === 'share') {
    (isNative ? nativeShare({ text }) : navigator.share({ text })).catch(() => {});
    flash[flashKey] = null;
  } else {
    copyText(text)
      .then(() => { flash[flashKey] = { text: 'Ссылка скопирована — вставьте её в любой мессенджер.' }; render(); })
      .catch(() => { flash[flashKey] = { text: 'Скопируйте ссылку: ' + inv.url }; render(); });
  }
  render();
}

// ---------- События ----------

// Привычка из формы вызова: выбранная из списка или новая, придуманная пользователем.
function formHabitName(form) {
  if (form.habit.value !== '__new') return state.habits.find(h => h.id === form.habit.value)?.name || null;
  const name = form.newHabit.value.trim();
  if (!name) { flash.challenge = { text: 'Впишите название привычки.', error: true }; render(); return null; }
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
    const text = err.message && !err.code ? err.message : 'Что-то пошло не так. Попробуйте ещё раз.';
    if (key) flash[key] = { text, error: true }; else alert(text);
  }
  render();
}

function goTab(t) {
  tab = t;
  try { localStorage.setItem(TAB_KEY, tab); } catch (err) {}
  render(); window.scrollTo(0, 0);
}

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-action], .tabs button');
  if (!t) return;
  if (t.dataset.tab) { goTab(t.dataset.tab); return; }
  const { action, id } = t.dataset;
  switch (action) {
    case 'toggle': toggle(id, t.dataset.day); break;
    case 'remove': removeHabit(id); break;
    case 'add': addHabit(t.dataset.name); break;
    case 'next-fact': factOffset++; render(); break;
    case 'limit-invite': flash.limit = null; goTab('friends'); setTimeout(() => document.querySelector('.invite-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); break;
    case 'goal-edit': editingGoal = editingGoal === id ? null : id; render(); break;
    case 'goal-set': setGoal(id, t.dataset.days ? Number(t.dataset.days) : null); break;
    case 'signin-google': run(null, cloud.signInGoogle); break;
    case 'signin-apple': run(null, cloud.signInApple); break;
    case 'signout': similar = null; run(null, cloud.signOut); break;
    case 'rename': renaming = true; flash.nickname = null; render(); break;
    case 'rename-cancel': renaming = false; render(); break;
    case 'delete-account':
      if (confirm('Удалить аккаунт? Друзья, вызовы и данные в облаке будут удалены без возможности восстановления. Привычки на этом устройстве останутся.')) {
        run(null, async () => { await cloud.deleteAccount(); similar = null; alert('Аккаунт удалён.'); });
      }
      break;
    case 'req-accept': run('friend', () => cloud.respondFriendRequest(social.incoming.find(r => r.id === id), true)); break;
    case 'req-decline': run('friend', () => cloud.respondFriendRequest(social.incoming.find(r => r.id === id), false)); break;
    case 'req-cancel': run('friend', () => cloud.cancelFriendRequest(social.outgoing.find(r => r.id === id))); break;
    case 'friend-remove': {
      const f = social.friends.find(x => x.uid === t.dataset.uid);
      if (f && confirm(`Удалить ${friendLabel(f)} из друзей?`)) run('friend', () => cloud.removeFriend(f.uid));
      break;
    }
    case 'invite': shareInvite(t.dataset.via, 'invite'); break;
    case 'find-similar':
      similarLoading = true; render();
      run('similar', async () => { try { similar = await cloud.findSimilar(); } finally { similarLoading = false; } });
      break;
    case 'similar-friend': {
      const p = similar?.find(x => x.uid === t.dataset.uid);
      if (p) run('similar', async () => { await cloud.sendFriendRequestTo(p); return `Заявка отправлена @${p.nickname}.`; });
      break;
    }
    case 'challenge-person': challengeFriend = t.dataset.uid; goTab('challenges'); break;
    case 'go-friends': goTab('friends'); break;
    case 'ch-invite': {
      const form = t.closest('form');
      const name = formHabitName(form);
      if (name) shareInvite(t.dataset.via, 'challenge', name, Number(form.days.value));
      break;
    }
    case 'share-edit': sharing = sharing === id ? null : id; flash.share = null; render(); break;
    case 'share-streak': { const h = state.habits.find(x => x.id === id); if (h) shareStreak(t.dataset.via, h); break; }
    case 'go-tournaments': goTab('challenges'); break;
    case 'tour-join': {
      const tr = tournamentsAround(todayNumber()).find(x => x.id === id);
      if (tr) run('tour', async () => { await cloud.joinTournament(tr, name => addHabit(name, { silent: true })); loadTour(tr); return `Вы участвуете в турнире «${tr.title}». Удачи! 💪`; });
      break;
    }
    case 'tour-leave': {
      const tr = tournamentsAround(todayNumber()).find(x => x.id === id);
      if (tr && confirm('Отменить участие в турнире?')) run('tour', async () => { await cloud.leaveTournament(tr); loadTour(tr); });
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
      const p = suggestions?.find(x => x.uid === t.dataset.uid);
      const mine = state.habits.find(h => habitKey(h.name) === t.dataset.key);
      const days = Number($('suggestDays')?.value || 7);
      if (p && mine) run('suggest', async () => {
        await cloud.createChallenge(p, mine.name, days);
        sentTo[p.uid + '|' + t.dataset.key] = true;
        return `Вызов отправлен @${p.nickname}! Когда соперник примет его, вызов появится в «Идут сейчас».`;
      });
      break;
    }
    case 'ch-accept': run('challenge', () => cloud.respondChallenge(social.challenges.find(c => c.id === id), true, name => addHabit(name, { silent: true }))); break;
    case 'ch-decline': run('challenge', () => cloud.respondChallenge(social.challenges.find(c => c.id === id), false)); break;
    case 'ch-delete':
      if (confirm('Удалить этот вызов у обоих участников?')) run('challenge', () => cloud.deleteChallenge(social.challenges.find(c => c.id === id)));
      break;
    case 'ch-addhabit': addHabit(t.dataset.name, { silent: true }); break;
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
    if (showName && !realName) { flash.settings = { text: 'Впишите имя или снимите галочку.', error: true }; render(); return; }
    run('settings', async () => {
      await cloud.saveSettings({ showName, realName, discoverable: !!fd.get('discoverable') });
      return 'Сохранено.';
    });
  } else if (kind === 'friend') {
    run('friend', async () => {
      const r = await cloud.sendFriendRequest(fd.get('nickname'));
      clearForm(form);
      return r === 'accepted' ? 'Этот человек уже звал вас в друзья — теперь вы друзья!' : 'Заявка отправлена. Как только друг её примет, вы увидите его серии.';
    });
  } else if (kind === 'challenge') {
    const target = challengeTargets().find(x => x.uid === fd.get('friend'));
    challengeFriend = target?.uid || '';
    if (!target) return;
    const name = formHabitName(form);
    if (!name) return;
    run('challenge', async () => {
      await cloud.createChallenge(target, name, Number(fd.get('days')));
      return `Вызов отправлен ${target.label}!`;
    });
  }
});

// Перерисовываем при смене дня, если вкладка открыта через полночь.
let lastKey = dateKey(new Date());
setInterval(() => { const k = dateKey(new Date()); if (k !== lastKey) { lastKey = k; factOffset = 0; render(); } }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); showQuote(); } });

// Цитата дня — при первом запуске за день.
function showQuote(force = false) {
  const day = todayNumber();
  let shown = null;
  try { shown = localStorage.getItem(QUOTE_KEY); } catch (err) {}
  if (!force && shown === String(day)) return;
  const q = quoteFor(day);
  $('quoteText').textContent = `«${q.text}»`;
  $('quoteAuthor').textContent = '— ' + q.author;
  $('quote').hidden = false;
  $('quoteClose').focus();
  try { localStorage.setItem(QUOTE_KEY, String(day)); } catch (err) {}
}
function hideQuote() { $('quote').hidden = true; }
$('quoteClose').addEventListener('click', hideQuote);
$('quote').addEventListener('click', ev => { if (ev.target.id === 'quote') hideQuote(); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('quote').hidden) hideQuote(); });
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
