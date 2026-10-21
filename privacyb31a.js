// Privacy choices in Profile → Privacy (no pop-up). Usage stats start ON (people can turn them off);
// photo location starts OFF and is offered in the note tab when a photo has one.
// Kept per browser and mirrored to cookies the server reads: withlove_analytics (usage stats) and
// withlove_photo_location (city captions). withlovees, check-in days and rewards never depend on them.
(() => {
  // 'withlove-usage-stats' replaces the old pop-up's 'withlove-analytics' (left unticked by most people
  // without a real choice), so everyone starts from the new default.
  const KEYS = { analytics: 'withlove-usage-stats', photo_location: 'withlove-photo-location' };
  const DEFAULT_ON = { analytics: true, photo_location: false };
  const TOGGLES = { analytics: '#privacy-analytics', photo_location: '#privacy-photo-location' };
  const get = (name) => { try { const v = localStorage.getItem(KEYS[name]); return v == null ? DEFAULT_ON[name] : v === '1'; } catch { return DEFAULT_ON[name]; } };
  const cookie = (name, on) => { document.cookie = `withlove_${name}=${on ? 1 : 0}; Path=/; SameSite=Lax; Max-Age=31536000${location.protocol === 'https:' ? '; Secure' : ''}`; };
  const render = () => Object.entries(TOGGLES).forEach(([name, sel]) => document.querySelector(sel)?.setAttribute('aria-checked', String(get(name))));
  function set(name, on) {
    try { localStorage.setItem(KEYS[name], on ? '1' : '0'); } catch {}
    cookie(name, on); render();
  }
  window.withlovePrivacy = { get, set };
  Object.keys(KEYS).forEach((name) => cookie(name, get(name)));
  render();
  Object.entries(TOGGLES).forEach(([name, sel]) => document.querySelector(sel)?.addEventListener('click', () => set(name, !get(name))));
  // The small "Privacy" link at the top of the profile jumps down to the switches.
  document.querySelectorAll('[data-privacy]').forEach((button) => button.addEventListener('click', () => document.querySelector('#privacy-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })));
})();
