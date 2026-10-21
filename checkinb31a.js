// ---- Daily check-in + push reminders (from 1 Oct 2026) ----
// Signed in: make one new card a day = +10 gems, 6 or more = +30 (the server counts them, see
// app/checkin.mjs). The calendar lives in the profile sheet; a toast says when a day's gems land.
// Push: turned on from the calendar or the toast (Android, and iPhone once With Love is on the home
// screen). The service worker shows them; the server sends the 8pm reminder and announcements.
const checkin = { data: null, lastPhoto: null, config: null };
const pad2 = (n) => String(n).padStart(2, '0');
const coinImg = '<img src="./vision/coin.svg" alt="" />';

async function loadCheckin(fresh = false) {
  try { checkin.data = await fetch(`/checkin${fresh ? '?fresh' : ''}`).then((r) => r.json()); } catch { checkin.data = null; }
  return checkin.data;
}

function renderCheckin() {
  const box = $('#checkin');
  if (!box) return;
  const d = checkin.data, rules = d?.rules || { day: 10, big: 30, bigAt: 6 };
  const today = d?.today || new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const [y, m] = today.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)), daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // weeks start on Monday
  const month = first.toLocaleString('en', { month: 'long', timeZone: 'UTC' }).toLowerCase();
  const cells = [...'MTWTFSS'].map((w) => `<i class="ck-w">${w}</i>`);
  for (let i = 0; i < lead; i++) cells.push('<i></i>');
  for (let n = 1; n <= daysIn; n++) {
    const key = `${y}-${pad2(m)}-${pad2(n)}`, day = d?.days?.[key];
    const cls = ['ck-day', day && 'done', day?.earned >= rules.big && 'big', key === today && 'today', key > today && 'future'].filter(Boolean).join(' ');
    cells.push(`<span class="${cls}"${day ? ` title="${day.cards} card${day.cards === 1 ? '' : 's'} · +${day.earned}"` : ''}><b>${n}</b>${day ? `<em>${coinImg}+${day.earned}</em>` : ''}</span>`);
  }
  $('#checkin-cal').innerHTML = cells.join('');
  $('#checkin-month').textContent = month;
  const streak = d?.streak || 0;
  $('#checkin-streak').textContent = d?.signedIn && streak ? `${streak} day${streak === 1 ? '' : 's'} in a row ✦` : '';
  const t = d?.days?.[today];
  $('#checkin-today').innerHTML = !d?.signedIn
    ? `Make one With Love a day to collect <b>+${rules.day}</b> gems, or <b>+${rules.big}</b> for ${rules.bigAt}+ cards. <button type="button" class="link-button" id="checkin-signin">Sign in to collect</button>`
    : !t ? `Today: no card yet. Make one to collect <b>+${rules.day}</b>.`
    : t.cards < rules.bigAt ? `Today: ${t.cards} card${t.cards === 1 ? '' : 's'} · <b>+${t.earned}</b> ✓ · ${rules.bigAt - t.cards} more for <b>+${rules.big}</b>`
    : `Today: ${t.cards} cards · <b>+${t.earned}</b> ✦ full gems`;
  $('#checkin-signin')?.addEventListener('click', () => openLogin('checkin'));
  coinify($('#checkin-today'));
  renderPushToggle();
}

// After a card is made (m.js render / renderVideo): once per new photo, check whether today's
// gems just landed and say so.
let checkinTimer = null;
function noteCardMade() {
  if (!state.signedIn || !state.photoId || state.photoId === checkin.lastPhoto) return;
  checkin.lastPhoto = state.photoId;
  clearTimeout(checkinTimer);
  checkinTimer = setTimeout(async () => { // the server logs the render a moment after answering
    const before = checkin.data?.days?.[checkin.data?.today]?.earned || 0;
    const d = await loadCheckin(true);
    const now = d?.days?.[d?.today]?.earned || 0;
    const told = Number(store.get(`With Love-checkin-told-${d?.today}`) || 0);
    if (now > before || now > told) { // just earned, or earned earlier today and not told yet
      store.set(`With Love-checkin-told-${d.today}`, String(now));
      checkinToast(now >= d.rules.big && before ? `+${now - before} gems · ${d.rules.bigAt} cards today ✦✦✦` : `+${now} gems · checked in today ✦`, d.streak);
      track('checkin', { action: 'earned', earned: now, streak: d.streak });
      fetch('/perks').then((r) => r.json()).then((p) => { Object.assign(perks, p); $('#me-gems-number').textContent = String(perks.gems || 0); }).catch(() => {});
    }
  }, 2500);
}

async function checkinToast(text, streak) {
  const toast = $('#checkin-toast');
  $('#checkin-toast-text').innerHTML = `${coinImg}<span>${esc(text)}${streak > 1 ? `<small>${streak} days in a row</small>` : ''}</span>`;
  const status = await pushStatus();
  $('#checkin-toast-push').hidden = !(status === 'off' && !store.get('With Love-push-toast-no'));
  toast.hidden = false; toast.classList.remove('out');
  clearTimeout(toast.hideTimer);
  toast.hideTimer = setTimeout(() => { toast.classList.add('out'); setTimeout(() => { toast.hidden = true; }, 400); }, $('#checkin-toast-push').hidden ? 3500 : 9000);
}

// gems are added on their own (no claiming). Someone who earned earlier today hears about it
// after their next card (never on arrival: docs/product-ux-rules.md).

// ---- Push ----
async function pushConfig() { checkin.config ??= await fetch('/config').then((r) => r.json()).catch(() => ({})); return checkin.config; }
// 'unsupported' | 'home' (iPhone: add to home screen first) | 'blocked' | 'off' | 'on'
async function pushStatus() {
  const config = await pushConfig();
  if (!config.vapidPublicKey || !('serviceWorker' in navigator)) return 'unsupported';
  if (!('PushManager' in window) || !('Notification' in window)) return IS_IOS && !standalone() ? 'home' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
}
const urlKey = (base64) => { const s = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
async function turnPushOn(from) {
  // Straight from the tap: iPhone only asks for permission inside one.
  const permission = await Notification.requestPermission();
  track('checkin', { action: 'push_permission', result: permission, from });
  if (permission !== 'granted') { renderPushToggle(); return false; }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlKey((await pushConfig()).vapidPublicKey) });
  await fetch('/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
  renderPushToggle();
  return true;
}
async function turnPushOff() {
  const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
  if (sub) { await fetch('/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {}); await sub.unsubscribe(); }
  track('checkin', { action: 'push_off' });
  renderPushToggle();
}
async function renderPushToggle() {
  const button = $('#push-toggle'), note = $('#push-note');
  const status = await pushStatus();
  button.hidden = !['off', 'on', 'home'].includes(status);
  note.hidden = status !== 'blocked';
  button.dataset.status = status;
  button.textContent = { off: '🔔 remind me at 8pm', on: '🔔 reminders on · turn off', home: '🔔 get reminders: add With Love to your home screen' }[status] || '';
  note.textContent = 'Notifications are off for With Love in your phone settings.';
}
$('#push-toggle').addEventListener('click', async () => {
  const status = $('#push-toggle').dataset.status;
  if (status === 'home') { closeSheets(); showHomeGuide('checkin'); return; }
  try { if (status === 'on') await turnPushOff(); else await turnPushOn('calendar'); } catch (error) { console.error(error); showError('Reminders didn’t turn on here. Try again from the home-screen app.', null); }
});
$('#checkin-toast-push').addEventListener('click', async () => {
  $('#checkin-toast').hidden = true;
  try { await turnPushOn('toast'); } catch (error) { console.error(error); }
});
$('#checkin-toast-x').addEventListener('click', () => { $('#checkin-toast').hidden = true; if (!$('#checkin-toast-push').hidden) store.set('With Love-push-toast-no', '1'); });

// Opened from a push about gems (/m/?mailbox): straight to the profile sheet.
if (new URLSearchParams(location.search).has('mailbox')) {
  history.replaceState(null, '', location.pathname);
  setTimeout(() => openMe(), 1200);
}
