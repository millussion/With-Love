// Google sign-in. Google Identity Services redirects back to withlove's own /auth/google (so Google's
// screen reads "continue to withlove.techieslab.app", not the Supabase domain); the server exchanges
// Google's ID token with Supabase and answers with its own signed cookie, so every render is gated
// server-side. Without Google/Supabase config (local dev with no .env) it falls back to the demo cookie.
(() => {
  const DRAFT_DB = 'withlove-draft';
  let config = {};
  let google = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => { const tag = document.createElement('script'); tag.src = src; tag.onload = resolve; tag.onerror = reject; document.head.append(tag); });
  }

  // The photo and words survive the Google redirect in IndexedDB (a File is too big for sessionStorage).
  function draftStore(mode, run) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(DRAFT_DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore('draft');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => { const tx = open.result.transaction('draft', mode); const request = run(tx.objectStore('draft')); tx.oncomplete = () => resolve(request?.result); tx.onerror = () => reject(tx.error); };
    });
  }
  // The photo is stored as raw bytes, not a Blob: iOS Safari can lose a Blob kept in IndexedDB across a
  // navigation ("WebKitBlobResource error 1"), which dropped drafts on the way back from Google.
  const log = (detail) => { try { navigator.sendBeacon?.('/client-log', JSON.stringify({ kind: 'draft', detail, page: location.pathname })); } catch {} };
  async function saveDraft(draft) {
    try {
      if (!draft?.file) { await draftStore('readwrite', (store) => store.delete('current')); return; }
      const { file, ...rest } = draft;
      const bytes = await file.arrayBuffer();
      await draftStore('readwrite', (store) => store.put({ ...rest, photo: { bytes, type: file.type || 'image/jpeg', name: file.name || 'photo.jpg' } }, 'current'));
      sessionStorage.setItem('withlove-draft-pending', String(bytes.byteLength));
    } catch (error) { log(`save failed: ${error?.message || error}`); }
  }
  async function takeDraft() {
    const pending = sessionStorage.getItem('withlove-draft-pending');
    sessionStorage.removeItem('withlove-draft-pending');
    try {
      const draft = await draftStore('readonly', (store) => store.get('current'));
      if (draft) await draftStore('readwrite', (store) => store.delete('current'));
      if (pending) log(draft?.photo ? `restored ${draft.photo.bytes.byteLength} bytes` : `missing after login (saved ${pending} bytes)`);
      if (!draft?.photo) return null;
      const { photo, ...rest } = draft;
      return { ...rest, file: new File([photo.bytes], photo.name, { type: photo.type }) };
    } catch (error) { if (pending) log(`restore failed: ${error?.message || error}`); return null; }
  }

  async function ready() {
    try {
      config = await fetch('/config').then((response) => response.json()).catch(() => ({ feedback: false }));
      if (config.googleClientId) {
        await loadScript('https://accounts.google.com/gsi/client?hl=en');
        google = window.google.accounts.id;
        google.initialize({ client_id: config.googleClientId, ux_mode: 'redirect', login_uri: `${location.origin}/auth/google` });
      }
      const session = await fetch('/session').then((response) => response.json()).catch(() => null);
      if (session) return { ...session, feedback: Boolean(config.feedback) };
    } catch {}
    return { email: 'guest@withlove.local', name: 'Guest', avatar: '', signedIn: true, defaults: { template: 'stars', paper: 'crumpled', paperColor: 'white', vectorColor: 'white', color: 'yellow' }, feedback: false };
  }

  // Renders Google's button into `container`. Google's button can't be restyled, so without Google
  // config a plain demo button stands in. `onDemo` runs after a demo sign-in.
  function mountButton(container, onDemo) {
    container.innerHTML = '';
    // Where to land after Google; the server only accepts a same-site path.
    // Google returns with a cross-site POST, which drops SameSite=Lax cookies — so None (https only).
    const crossSite = location.protocol === 'https:' ? '; SameSite=None; Secure' : '';
    document.cookie = `withlove_return=${encodeURIComponent(location.pathname)}; Path=/; Max-Age=900${crossSite}`;
    if (google) { google.renderButton(container, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'en', logo_alignment: 'center', width: Math.min(container.clientWidth || 320, 400) }); return; }
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'button primary'; button.textContent = 'Continue with Google (demo)';
    button.addEventListener('click', async () => onDemo(await fetch('/session/demo', { method: 'POST' }).then((response) => response.json())));
    container.append(button);
  }

  // Call when the login screen opens and wait for it: Google's button navigates away with no click
  // hook of ours, so the draft must be saved before the button is shown.
  const prepare = (draft) => saveDraft(draft);

  const signOut = () => fetch('/session/logout', { method: 'POST' }).then((response) => response.json());

  window.withloveAuth = window.withloveAuth = { ready, mountButton, prepare, takeDraft, signOut };
})();
