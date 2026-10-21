// Photobooth: two photos on one card. Found in the frame picker under the October chip, as the first
// tile. The first time, a short demo explains it ("Got it" starts it). Each half has its own shutter
// tap and a 3-second countdown: shot 1 fills the top half, shot 2 the bottom. The viewfinder shows the
// whole card while shooting. Words are Maddy's two-bubble sheet (frame/booth/so-pretty-sheet.webp →
// dot-overlay-engine/make_booth_masks.py). Composed in the browser; uses m.js helpers (cam, $, track…).
(() => {
  const FRAME = { top: './booth/so-pretty-top.png?v=1', bottom: './booth/so-pretty-bottom.png?v=1' };
  // The demo plays the couple examples in turn, one per loop (the same ones as the photobooth card in m.js).
const DEMO_SETS = ['pride-prejudice', 'rooftop-camera', 'better-days', '500-days'].map((n) => [`./booth/examples/${n}-top.jpg`, `./booth/examples/${n}-bottom.jpg`]);
  const booth = { active: false, busy: false, ready: null, shots: [] };
  const load = (src) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
  let masksLoading;
  const masks = () => (masksLoading ||= Promise.all([load(FRAME.top), load(FRAME.bottom)]).catch((error) => { masksLoading = null; throw error; }));
  const ui = () => $('#booth-ui');
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const seenDemo = () => { try { return Boolean(localStorage.getItem('With Love-booth-demo')); } catch { return false; } };

  // No words under the viewfinder while the booth is on: just the camera.
  window.boothLabel = () => (booth.active ? '' : null);
  window.boothWords = () => masks(); // the two halves' words, for the studio's move & zoom sheet

  // While the booth is on, the viewfinder is the whole 4:5 card: the half being shot is live, a half
  // already taken shows its photo, the other waits on plain paper; each half wears its own words.
  function sizeViewfinder(on) { const c = $('#viewfinder'); const h = on ? PANEL_H * 2 : PANEL_H; if (c && c.height !== h) c.height = h; }
  function drawCard(o, live, shots, words, paint, flips = []) {
    for (let i = 0; i < 2; i++) {
      const y = i * PANEL_H;
      if (shots[i] && flips[i]) { o.save(); o.translate(PANEL_W, y); o.scale(-1, 1); o.drawImage(shots[i], 0, 0, PANEL_W, PANEL_H); o.restore(); }
      else if (shots[i]) o.drawImage(shots[i], 0, y, PANEL_W, PANEL_H);
      else if (i === live && paint) paint(y);
      else { o.fillStyle = '#e9e3da'; o.fillRect(0, y, PANEL_W, PANEL_H); }
      if (words[i]) o.drawImage(words[i], 0, y, PANEL_W, PANEL_H);
    }
    o.fillStyle = 'rgba(255,255,255,.9)'; o.fillRect(0, PANEL_H - 2, PANEL_W, 4); // the fold between the halves
  }
  window.boothDraw = (o, el, crop) => {
    if (!booth.active || !booth.ready) return false;
    sizeViewfinder(true);
    drawCard(o, booth.shots.length, booth.shots, booth.ready, (y) => drawCameraImage(o, el, crop, 0, y, PANEL_W, PANEL_H, cam.facing === 'user'));
    return true;
  };

  async function enter() {
    booth.active = true; booth.shots = [];
    document.documentElement.classList.add('booth-on');
    $('#camera-frame-name').textContent = '';
    track('booth', { action: 'open' });
    booth.ready = await masks().catch(() => null);
    if (!booth.ready) { exit(); showError('The photobooth didn’t load. Try again in a moment.', null); return; }
    if (screens.camera.hidden || !cam.running) openCamera('user'); // front camera: two people, one phone
  }
  function exit() {
    if (!booth.active) return;
    booth.active = false; booth.busy = false; booth.shots = [];
    document.documentElement.classList.remove('booth-on');
    ui().hidden = true; sizeViewfinder(false);
    if (typeof showCameraFrame === 'function') showCameraFrame().catch(() => {});
  }
  window.exitBooth = exit;
  window.boothActive = () => booth.active;
  // Upload while in the photobooth: the picked photo fills the half being shot (cropped like the camera's),
  // then the camera carries on with the other half, or both are done and the card opens in the studio.
  const picker = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', hidden: true, id: 'booth-upload-input' });
  document.body.append(picker);
  window.boothUpload = () => { if (booth.active && !booth.busy && booth.shots.length < 2) picker.click(); };
  picker.addEventListener('change', async () => {
    const file = picker.files[0]; picker.value = '';
    if (!file || !booth.active || booth.shots.length > 1) return;
    try {
      const bitmap = await createImageBitmap(file);
      const shot = document.createElement('canvas'); shot.width = PANEL_W; shot.height = PANEL_H;
      const { sx, sy, sw, sh } = coverCrop(bitmap.width, bitmap.height);
      shot.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, PANEL_W, PANEL_H);
      bitmap.close?.();
      booth.shots.push(shot);
      track('booth', { action: 'upload', half: booth.shots.length });
      if (booth.shots.length < 2) return;
      const shots = booth.shots.slice(); track('booth', { action: 'done' }); exit(); window.openBoothStudio(shots);
    } catch (error) { console.warn('booth upload', error); showError('That photo didn’t open. Try a JPG or PNG.', null); }
  });
  // The tile in the frame picker: the demo the first time, straight to the camera after that.
  window.openBooth = () => { if (seenDemo()) enter(); else openDemo(); };

  async function countdown(half) {
    const box = ui(); box.hidden = false;
    box.style.top = half ? '50%' : '0'; box.style.bottom = half ? '0' : '50%';
    for (const n of [3, 2, 1]) {
      box.innerHTML = `<b class="booth-count">${n}</b>`;
      await wait(1000);
      if (!booth.active || !cam.running) { box.hidden = true; return false; }
    }
    box.innerHTML = '<span class="booth-flash"></span>';
    setTimeout(() => { if (box.querySelector('.booth-flash')) box.hidden = true; }, 400);
    return true;
  }
  // One panel-sized still from the camera, cropped exactly like the viewfinder.
  function grab() {
    const el = cam.el; if (!el || el.readyState < 2) return null;
    const c = document.createElement('canvas'); c.width = PANEL_W; c.height = PANEL_H;
    drawCameraImage(c.getContext('2d'), el, zoomCrop(coverCrop(el.videoWidth, el.videoHeight), cam.digital), 0, 0, PANEL_W, PANEL_H, cam.facing === 'user');
    return c;
  }
  // The With Love mark, bottom-right of the lower half (every export carries it).
  function watermark(g, x0, y0, w, h) {
    const size = Math.round(h * 0.062), m = Math.round(w * 0.035);
    g.save(); g.font = `600 ${size}px 'Archivo Narrow', sans-serif`; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = size * 0.3; g.fillStyle = '#fff';
    g.fillText('with love', x0 + w - m, y0 + h - m);
    const s = size * 0.36, sx = x0 + w - m - g.measureText('with love').width - s * 1.6, sy = y0 + h - m - size * 0.34;
    g.beginPath(); g.moveTo(sx, sy - s); g.lineTo(sx + s * 0.22, sy - s * 0.22); g.lineTo(sx + s, sy); g.lineTo(sx + s * 0.22, sy + s * 0.22);
    g.lineTo(sx, sy + s); g.lineTo(sx - s * 0.22, sy + s * 0.22); g.lineTo(sx - s, sy); g.lineTo(sx - s * 0.22, sy - s * 0.22); g.closePath(); g.fill();
    g.restore();
  }
  // The card for the studio (m.js renderBooth): both photos (colours already adjusted) with their flips,
  // their words, the fold and the With Love mark. The studio adds grain and builds the exports as for any card.
  window.boothCompose = async (shots, { flip = [] } = {}) => {
    const words = booth.ready || (booth.ready = await masks());
    const card = document.createElement('canvas'); card.width = PANEL_W; card.height = PANEL_H * 2;
    const g = card.getContext('2d');
    drawCard(g, -1, shots, words.map(() => null), null, flip);
    words.forEach((w, i) => g.drawImage(w, 0, i * PANEL_H, PANEL_W, PANEL_H));
    g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(0, PANEL_H - 2, PANEL_W, 4);
    watermark(g, 0, PANEL_H, PANEL_W, PANEL_H);
    return card;
  };

  // Called by the shutter in m.js; true means the booth took the tap. Each tap shoots the next half.
  window.boothShutter = () => {
    if (!booth.active) return false;
    if (booth.busy || !booth.ready) return true;
    booth.busy = true; shootNext().finally(() => { booth.busy = false; });
    return true;
  };
  async function shootNext() {
    const half = booth.shots.length; if (half > 1) return;
    track('booth', { action: 'shot', half: half + 1 });
    if (!(await countdown(half))) return;
    const shot = grab();
    if (!shot) return; // left the app mid-countdown: the camera comes back on return, tap again
    booth.shots.push(shot);
    if (booth.shots.length < 2) return; // the bottom half is live now: the next tap shoots it
    // Both taken: into the studio like any other card (adjust, grain, flip, share/save), minus frame and note.
    const shots = booth.shots.slice();
    track('booth', { action: 'done' });
    exit();
    window.openBoothStudio(shots);
  }

  // ---- The demo: the card filling itself in, half by half, on a loop ----
  let demoTimer = 0;
  async function openDemo() {
    openSheet('#booth-demo');
    track('booth', { action: 'demo' });
    const canvas = $('#booth-demo-card'), g = canvas.getContext('2d');
    let words, sets;
    try { [words, sets] = await Promise.all([masks(), Promise.all(DEMO_SETS.map((pair) => Promise.all(pair.map(load))))]); } catch { return; }
    const panels = sets.map((photos) => photos.map((photo) => {
      const c = document.createElement('canvas'); c.width = PANEL_W; c.height = PANEL_H;
      const { sx, sy, sw, sh } = coverCrop(photo.width, photo.height);
      c.getContext('2d').drawImage(photo, sx, sy, sw, sh, 0, 0, PANEL_W, PANEL_H);
      return c;
    }));
    // 0–3 s: 3, 2, 1 on the top half, snap · 3.6–6.6 s: the same on the bottom, snap · hold, loop.
    const started = performance.now();
    cancelAnimationFrame(demoTimer);
    const frame = () => {
      if ($('#booth-demo').hidden) return;
      const elapsed = (performance.now() - started) / 1000, t = elapsed % 9.5, shots = panels[Math.floor(elapsed / 9.5) % panels.length];
      const taken = t < 3 ? 0 : t < 6.6 ? 1 : 2, half = t < 3.3 ? 0 : 1;
      g.clearRect(0, 0, PANEL_W, PANEL_H * 2);
      drawCard(g, -1, shots.slice(0, taken), words);
      const counting = t < 3 ? t : t >= 3.6 && t < 6.6 ? t - 3.6 : null;
      if (counting != null) {
        g.save(); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, half * PANEL_H, PANEL_W, PANEL_H);
        g.fillStyle = '#fff'; g.font = `700 260px 'Archivo Narrow', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 24; g.fillText(String(3 - Math.floor(counting)), PANEL_W / 2, half * PANEL_H + PANEL_H / 2); g.restore();
      }
      const flash = t >= 3 && t < 3.3 ? 3.3 - t : t >= 6.6 && t < 6.9 ? 6.9 - t : 0;
      if (flash) { g.fillStyle = `rgba(255,255,255,${Math.min(1, flash * 3)})`; g.fillRect(0, (t < 6 ? 0 : 1) * PANEL_H, PANEL_W, PANEL_H); }
      demoTimer = requestAnimationFrame(frame);
    };
    frame();
  }
  $('#booth-demo-ok').addEventListener('click', () => {
    try { localStorage.setItem('With Love-booth-demo', '1'); } catch {}
    cancelAnimationFrame(demoTimer); closeSheets(); track('booth', { action: 'demo_ok' }); enter();
  });
})();
