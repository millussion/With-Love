// ---- September recap (special edition, end of Sept 2026) ----
// The landing's camera button opens a chooser: the camera, or the jewelled "September so far" frame.
// The recap is drawn right here in the browser (no /process call): one 4:5 page on paper with the
// 6 photos as tilted postage stamps (white perforated border, drop shadow) overlapping each other,
// the jewelled "September / so far" across the middle, rhinestone charms around the words and
// around the page, and a dusty vintage-print finish on the paper. The person picks the paper
// texture, its colour and the stamp border colour.
// Assets come from dot-overlay-engine/make_sept_recap.py (app/m/recap/).
const RECAP_UNTIL = new Date('2026-10-08T00:00:00+07:00'); // chooser shows until the end of 7 Oct (VN)
const RECAP_W = 1080, RECAP_PANEL = 675;
const recapOn = () => Date.now() < RECAP_UNTIL.getTime() || new URLSearchParams(location.search).has('recap');
const recap = { photos: null, sample: null, assets: null, seed: 7, crops: [], paper: 'crumpled', paperColor: 'white', border: 'white', papers: {}, files: { story: null, card: null }, token: 0 };
screens.recap = $('#screen-recap');

function recapRng(seed) { // mulberry32: the same seed gives the same torn edges and gem spots
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const loadImg = (src) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error(`could not load ${src}`)); img.src = src; });

async function recapAssets() {
  if (recap.assets) return recap.assets;
  recap.assets = (async () => {
    const rects = RECAP_GEM_RECTS;
    const [gems, september, soFar] = await Promise.all([loadImg('recap/gems.webp'), loadImg('recap/september.webp'), loadImg('recap/so-far.webp')]);
    await document.fonts?.load('600 42px "Archivo Narrow"').catch(() => {});
    // Round stones read as rhinestone "beads"; the rest (hearts, stars, butterflies…) are accents.
    const round = rects.filter(([, , w, h]) => Math.min(w, h) / Math.max(w, h) > 0.8 && Math.max(w, h) < 70);
    return { gems, rects, round, september, soFar };
  })();
  return recap.assets.catch((error) => { recap.assets = null; throw error; });
}

// Photo files → images no bigger than we need (big phone photos eat memory on iPhone).
async function recapImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

// Fills the box with the image. crop (for stamp photos) = the point of the image at the box's centre
// (0–1 of its width/height) and a zoom on top of "just covers the box".
function coverDraw(ctx, img, x, y, w, h, crop = null) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const zoom = crop?.zoom || 1, s = Math.max(w / iw, h / ih) * zoom, sw = w / s, sh = h / s;
  const clamp = (v, max) => Math.min(Math.max(v, 0), max);
  const sx = clamp((crop ? crop.x * iw : iw / 2) - sw / 2, iw - sw), sy = clamp((crop ? crop.y * ih : ih / 2) - sh / 2, ih - sh);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawGem(ctx, assets, rect, x, y, size, angle, shadow = true) {
  const [sx, sy, sw, sh] = rect, s = size / Math.max(sw, sh);
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  if (shadow) { ctx.shadowColor = 'rgba(48,34,26,.45)'; ctx.shadowBlur = size * 0.16; ctx.shadowOffsetX = size * 0.05; ctx.shadowOffsetY = size * 0.12; }
  ctx.drawImage(assets.gems, sx, sy, sw, sh, (-sw * s) / 2, (-sh * s) / 2, sw * s, sh * s);
  ctx.restore();
}

function drawWatermark(ctx, W, top, H) {
  const size = Math.round(H * 0.062), margin = Math.round(W * 0.035), s = size * 0.36;
  const sx = W - margin - size * 2.35, sy = top + H - margin - size * 0.34;
  ctx.save();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(74,51,38,.45)'; ctx.lineWidth = size * 0.045; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = size * 0.2;
  const star = new Path2D(`M${sx} ${sy - s} L${sx + s * 0.22} ${sy - s * 0.22} L${sx + s} ${sy} L${sx + s * 0.22} ${sy + s * 0.22} L${sx} ${sy + s} L${sx - s * 0.22} ${sy + s * 0.22} L${sx - s} ${sy} L${sx - s * 0.22} ${sy - s * 0.22} Z`);
  ctx.stroke(star); ctx.fill(star);
  ctx.font = `600 ${size}px "Archivo Narrow", "Arial Narrow", sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.strokeText('with love', W - margin, top + H - margin); ctx.fillText('with love', W - margin, top + H - margin);
  ctx.restore();
}

// The page's paper: the same textures as the other gems (the person picks one under the card).
function recapPaper(key, color) {
  const id = `${key}/${color}`;
  recap.papers[id] ??= loadImg(`/layer/paper/${id}.jpg?v=3&page=1`) // a full 4:5 page: sharp texture, no stretching.catch(() => { delete recap.papers[id]; return loadImg('./paper-bg.jpg'); });
  return recap.papers[id];
}
// Paper colours = the server's PAPER_COLORS; the stamp border can be white or one of the same pastels.
const RECAP_PAPER_COLORS = { white: '#FAF9F6', yellow: '#FFF1BF', blue: '#D6ECFF', pink: '#FFDDEA', green: '#DDF5DF' };
const RECAP_BORDERS = { white: '#FFFFFF', yellow: '#FFF1BF', blue: '#D6ECFF', pink: '#FFDDEA', green: '#DDF5DF' };

// ---- Dusty vintage print ----
// Old-print grain on the paper only: the photos keep their own colours, the stamp border and paper
// keep the colours the person picked.
function vintageTone(ctx, x, y, W, H, rand) {
  const img = ctx.getImageData(x, y, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] * 0.96, g = d[i + 1] * 0.96, b = d[i + 2] * 0.95;
    const grain = (rand() - 0.5) * 22;
    d[i] = r + grain; d[i + 1] = g + grain; d[i + 2] = b + grain;
  }
  ctx.putImageData(img, x, y);
}
// Dust, hairs and a soft vignette over everything, like an old print.
function vintageWear(ctx, W, H, rand) {
  ctx.save();
  for (let i = 0; i < 220; i++) { // dust
    const dark = rand() < 0.55;
    ctx.fillStyle = dark ? `rgba(35,25,18,${0.25 + rand() * 0.45})` : `rgba(255,252,242,${0.35 + rand() * 0.5})`;
    ctx.beginPath(); ctx.arc(rand() * W, rand() * H, 0.5 + rand() * rand() * 3.2, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 6; i++) { // hairs
    const x = rand() * W, y = rand() * H;
    ctx.strokeStyle = `rgba(35,25,18,${0.35 + rand() * 0.3})`; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + (rand() - 0.5) * 60, y + (rand() - 0.5) * 60, x + (rand() - 0.5) * 60, y + (rand() - 0.5) * 60, x + (rand() - 0.5) * 70, y + (rand() - 0.5) * 70);
    ctx.stroke();
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.78);
  v.addColorStop(0, 'rgba(40,30,25,0)'); v.addColorStop(1, 'rgba(40,30,25,.16)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Six photo stamps scattered and overlapping (white perforated border, tilted, drop shadow), in
// order of stacking. Centre x/y, width/height and tilt, on the 1080×1350 page.
const STAMPS = [
  { x: 372, y: 330, w: 350, h: 410, r: -0.62 },
  { x: 742, y: 400, w: 380, h: 420, r: 0.2 },
  { x: 300, y: 1050, w: 300, h: 330, r: 0.16 },
  { x: 352, y: 772, w: 400, h: 350, r: -0.14 },
  { x: 752, y: 842, w: 380, h: 340, r: 0.24 },
  { x: 575, y: 1085, w: 330, h: 350, r: -0.05 },
];
// A postage stamp: white card with round perforation bites all along the edge, the photo inset.
function stampCanvas(photo, w, h, border = '#FFFFFF', crop = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const hole = Math.max(7, Math.round(Math.min(w, h) * 0.024)), inset = hole * 3.1;
  g.fillStyle = border; g.fillRect(0, 0, w, h);
  coverDraw(g, photo, inset, inset, w - inset * 2, h - inset * 2, crop);
  g.globalCompositeOperation = 'destination-out';
  const bites = (len, at) => { const n = Math.round(len / (hole * 2.7)); for (let i = 0; i <= n; i++) at((len * i) / n); };
  g.beginPath();
  bites(w, (x) => { g.moveTo(x + hole, 0); g.arc(x, 0, hole, 0, Math.PI * 2); g.moveTo(x + hole, h); g.arc(x, h, hole, 0, Math.PI * 2); });
  bites(h, (y) => { g.moveTo(hole, y); g.arc(0, y, hole, 0, Math.PI * 2); g.moveTo(w + hole, y); g.arc(w, y, hole, 0, Math.PI * 2); });
  g.fill();
  return c;
}

// style: paper, paperColor, border (the person's picks by default; the pop-up demo shows others).
async function drawRecap(canvas, photos, seed, style = recap) {
  const [assets, paper] = await Promise.all([recapAssets(), recapPaper(style.paper, style.paperColor)]);
  const W = RECAP_W, H = RECAP_PANEL * 2;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rand = recapRng(seed);
  coverDraw(ctx, paper, 0, 0, W, H);
  vintageTone(ctx, 0, 0, W, H, recapRng(seed + 1));

  // ---- the stamps ----
  STAMPS.forEach((s, i) => {
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.r);
    ctx.shadowColor = 'rgba(48,34,26,.42)'; ctx.shadowBlur = 18; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 10;
    ctx.drawImage(stampCanvas(photos[i % photos.length], s.w, s.h, RECAP_BORDERS[style.border], photos === recap.photos ? recap.crops[i] : null), -s.w / 2, -s.h / 2);
    ctx.restore();
  });

  // ---- "September / so far" across the middle, over the stamps ----
  const sw = 930, sh = (assets.september.height / assets.september.width) * sw, sx = (W - sw) / 2 - 6, sy = 520;
  const fw = sw * 0.58, fh = (assets.soFar.height / assets.soFar.width) * fw, fx = W / 2 - fw / 2 + 60, fy = sy + sh - 22;
  const words = (shadow) => {
    ctx.save(); Object.assign(ctx, shadow);
    ctx.drawImage(assets.september, sx, sy, sw, sh); ctx.drawImage(assets.soFar, fx, fy, fw, fh);
    ctx.restore();
  };
  // a dark drop shadow lifts the stone letters off the photos
  words({ shadowColor: 'rgba(30,20,14,.75)', shadowBlur: 6, shadowOffsetX: 2, shadowOffsetY: 5 });

  // ---- charms: a loose ring around the words, and more scattered around the page ----
  const spots = [];
  const free = (x, y, size) => !spots.some((p) => Math.hypot(p.x - x, p.y - y) < (p.size + size) * 0.62 + 6);
  const tcx = W / 2, tcy = sy + (sh + fh) / 2 - 10, rx = sw / 2 + 10, ry = (sh + fh) / 2 + 26;
  for (let tries = 0; spots.length < 26 && tries < 2000; tries++) {
    const a = rand() * Math.PI * 2, k = 0.92 + rand() * 0.22, size = rand() < 0.3 ? 38 + rand() * 18 : 16 + rand() * 14;
    const x = tcx + Math.cos(a) * rx * k, y = tcy + Math.sin(a) * ry * k;
    if (x < 24 || x > W - 24 || !free(x, y, size)) continue;
    spots.push({ x, y, size, big: size > 34 });
  }
  const ring = spots.length;
  for (let tries = 0; spots.length < ring + 30 && tries < 4000; tries++) {
    const size = rand() < 0.35 ? 40 + rand() * 22 : 15 + rand() * 15;
    const x = 22 + rand() * (W - 44), y = 22 + rand() * (H - 44);
    const edge = Math.min(x, W - x, y, H - y) < 150 || rand() < 0.25; // mostly around the page edge
    if (!edge || (x > W - 210 && y > H - 90) || !free(x, y, size)) continue;
    spots.push({ x, y, size, big: size > 34 });
  }
  spots.forEach((s) => drawGem(ctx, assets, s.big ? assets.rects[Math.floor(rand() * 60)] : assets.round[Math.floor(rand() * assets.round.length)], s.x, s.y, s.size, (rand() - 0.5) * 1.4));

  vintageWear(ctx, W, H, recapRng(seed + 2));
  drawWatermark(ctx, W, H - RECAP_PANEL, RECAP_PANEL); // same size and spot as on other gems
}

// Exports are the regular With Love ones (m.js): the 9:16 story with the With Love background, the 4:5 card,
// and the floating 3D video, here with the recap card and a card back that says what it is.
const recapBack = document.createElement('canvas');
const recapStoryOpts = () => ({ front: $('#recap-canvas'), back: recapBack, caption: 'September so far', when: '' });
const toFile = (cv, name, type, q) => new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(new File([b], name, { type })) : reject(new Error('export failed'))), type, q));

async function paintRecap() {
  const token = ++recap.token;
  const photos = recap.photos || recap.sample;
  const cv = $('#recap-canvas');
  await drawRecap(cv, photos, recap.seed);
  if (token !== recap.token) return;
  recap.files = { story: null, card: null };
  if (!recap.photos) return; // the sample isn't for sharing
  await drawCardBack(recapBack, cv.width, cv.height, ['September so far', 'my month in 6 stamps']);
  if (token !== recap.token) return;
  // Built ahead of the tap: iOS only opens the share sheet straight from one.
  const mark = (f) => Object.assign(f, { withloveFrom: 'recap' }); // export_done says it came from the recap
  toFile(cv, 'with-love-recap.png', 'image/png').then((f) => { if (token === recap.token) recap.files.card = mark(f); });
  storyStill(recapStoryOpts()).then((f) => { if (token === recap.token) recap.files.story = mark(f); }).catch((error) => console.warn('recap story', error));
}

// Paper picker under the card: the same textures as the rest of With Love.
async function renderRecapPapers() {
  const row = $('#recap-papers');
  if (row.dataset.ready) return;
  row.dataset.ready = '1';
  const papers = await fetch('/papers').then((r) => r.json()).catch(() => []);
  row.innerHTML = papers.map(({ key, name }) => `<button type="button" class="recap-paper${key === recap.paper ? ' active' : ''}" data-paper="${key}" aria-label="${name}" title="${name}"><img src="/paper-thumb/${key}.jpg?color=${recap.paperColor}" alt="" /><span>${name.split(' ')[0].toLowerCase()}</span></button>`).join('');
}
function renderRecapSwatches() {
  const row = (id, colors, current, kind) => { $(id).innerHTML = Object.entries(colors).map(([key, hex]) => `<button type="button" class="swatch${key === current ? ' active' : ''}" data-${kind}="${key}" style="background:${hex}" aria-label="${key}"></button>`).join(''); };
  row('#recap-paper-colors', RECAP_PAPER_COLORS, recap.paperColor, 'paper-color');
  row('#recap-borders', RECAP_BORDERS, recap.border, 'border');
}
$('#recap-paper-colors').addEventListener('click', (event) => {
  const button = event.target.closest('[data-paper-color]');
  if (!button || button.dataset.paperColor === recap.paperColor) return;
  recap.paperColor = button.dataset.paperColor;
  renderRecapSwatches();
  document.querySelectorAll('.recap-paper img').forEach((img) => { img.src = img.src.replace(/color=\w+/, `color=${recap.paperColor}`); });
  track('recap', { action: 'paper_color', color: recap.paperColor });
  paintRecap().catch((error) => console.error(error));
});
$('#recap-borders').addEventListener('click', (event) => {
  const button = event.target.closest('[data-border]');
  if (!button || button.dataset.border === recap.border) return;
  recap.border = button.dataset.border;
  renderRecapSwatches();
  track('recap', { action: 'border', color: recap.border });
  paintRecap().catch((error) => console.error(error));
});
$('#recap-papers').addEventListener('click', (event) => {
  const button = event.target.closest('[data-paper]');
  if (!button || button.dataset.paper === recap.paper) return;
  recap.paper = button.dataset.paper;
  document.querySelectorAll('.recap-paper').forEach((b) => b.classList.toggle('active', b === button));
  track('recap', { action: 'paper', paper: recap.paper });
  paintRecap().catch((error) => console.error(error));
});

function setRecapMode(mine) {
  $('#recap-screen-note').textContent = mine ? 'your september, bedazzled ✦' : 'sample · your 6 photos become the stamps';
  $('#recap-sample-actions').hidden = mine;
  $('#recap-mine-actions').hidden = !mine;
}

async function openRecap() {
  closeSheets();
  show('recap');
  track('recap', { action: 'open', from: new URLSearchParams(location.search).get('from') || null });
  setRecapMode(Boolean(recap.photos));
  bedazzle($('#recap-start'));
  document.querySelectorAll('.recap-reward').forEach((reward) => { if (!reward.querySelector('.kw-coin')) coinify(reward); });
  renderRecapPapers(); renderRecapSwatches();
  try {
    if (!recap.sample) recap.sample = await withLoading('Polishing the rhinestones…', () => Promise.all([1, 2, 3, 4, 5, 6].map((n) => loadImg(`./recap/sample-${n}.jpg`))));
    await paintRecap();
  } catch (error) { console.error(error); showError('The September frame didn’t load.', null); }
}

async function recapPicked(list, { append = false } = {}) {
  const all = [...list].filter((f) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name));
  const keep = append && recap.photos ? recap.photos : [];
  const files = all.slice(0, 6 - keep.length);
  if (!files.length) return;
  try {
    await withLoading('Setting your photos in the windows…', async () => {
      recap.photos = [...keep, ...await Promise.all(files.map(recapImage))];
      if (!append) recap.crops = [];
      await paintRecap();
    });
    setRecapMode(true);
    const total = recap.photos.length;
    $('#recap-count').hidden = total >= 6 && all.length <= files.length;
    $('#recap-add').hidden = total >= 6;
    $('#recap-add').textContent = `add ${6 - total} more photo${6 - total === 1 ? '' : 's'}`;
    $('#recap-count').textContent = total < 6 ? `${total} of 6 photos. Add more to fill every stamp (some repeat for now).` : (keep.length ? `Only 6 fit, so we used ${files.length} of the ${all.length} you added.` : `You picked ${all.length}, so we used the first 6.`);
    track('recap', { action: append ? 'added' : 'made', count: total, inApp: IN_APP || null });
    store.set('With Love-recap-made', '1');
    interrupts.cardMade = true;
  } catch (error) { console.error(error); showError('Those photos didn’t open. Try JPG or PNG ones.', null); }
}

// ---- Surviving the Google sign-in ----
// A guest who has used their one free export is sent to Google, which reloads the page. Their 6
// photos (already downscaled), paper and layout are kept in IndexedDB and put back afterwards.
function recapDb(mode, run) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('With Love-recap', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('draft');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => { const tx = open.result.transaction('draft', mode); const request = run(tx.objectStore('draft')); tx.oncomplete = () => resolve(request?.result); tx.onerror = () => reject(tx.error); };
  });
}
async function saveRecapDraft() {
  if (!recap.photos) return;
  try {
    // raw bytes, not Blobs: iOS Safari can lose a Blob kept in IndexedDB across a navigation
    const photos = await Promise.all(recap.photos.map((c) => new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.9)).then((b) => b.arrayBuffer())));
    await recapDb('readwrite', (store) => store.put({ photos, crops: recap.crops, paper: recap.paper, paperColor: recap.paperColor, border: recap.border, seed: recap.seed }, 'current'));
    sessionStorage.setItem('With Love-recap-pending', '1');
  } catch (error) { reportClient('recap-draft', `save: ${error?.message || error}`); }
}
async function takeRecapDraft() {
  if (!sessionStorage.getItem('With Love-recap-pending')) return null;
  sessionStorage.removeItem('With Love-recap-pending');
  try {
    const draft = await recapDb('readonly', (store) => store.get('current'));
    await recapDb('readwrite', (store) => store.delete('current'));
    return draft?.photos?.length ? draft : null;
  } catch (error) { reportClient('recap-draft', `restore: ${error?.message || error}`); return null; }
}

async function recapShare(kind) {
  const file = recap.files[kind];
  track('recap', { action: kind === 'story' ? 'share' : 'save' });
  if (!state.signedIn && guestExportUsed()) { await saveRecapDraft(); return openLogin(kind === 'story' ? 'share' : 'save'); }
  if (file) return shareFile(file, kind === 'story' ? 'share' : 'save');
  // still being built: hand it over with a fresh tap
  const cv = $('#recap-canvas');
  const made = await withLoading('Getting your recap ready…', () => (kind === 'story' ? storyStill(recapStoryOpts()) : toFile(cv, 'with-love-recap.png', 'image/png')));
  made.withloveFrom = 'recap';
  offerSave(made, 'Your September is ready', kind === 'story' ? 'share' : 'save');
}

// ---- Move a photo inside its stamp ----
// Tap a stamp on the card → a sheet with that photo in the stamp's window: drag to move, pinch or
// the slider to zoom. The card is redrawn on Done.
const STAMP_INSET = (w, h) => Math.max(7, Math.round(Math.min(w, h) * 0.024)) * 3.1;
function stampAt(clientX, clientY) {
  const cv = $('#recap-canvas'), box = cv.getBoundingClientRect();
  const x = ((clientX - box.left) / box.width) * cv.width, y = ((clientY - box.top) / box.height) * cv.height;
  for (let i = STAMPS.length - 1; i >= 0; i--) { // topmost first
    const s = STAMPS[i], dx = x - s.x, dy = y - s.y, c = Math.cos(-s.r), n = Math.sin(-s.r);
    const lx = dx * c - dy * n, ly = dx * n + dy * c;
    if (Math.abs(lx) <= s.w / 2 && Math.abs(ly) <= s.h / 2) return i;
  }
  return -1;
}
const mover = { index: -1, crop: null, pointers: new Map(), start: null };
function drawMover() {
  const s = STAMPS[mover.index], inset = STAMP_INSET(s.w, s.h), w = s.w - inset * 2, h = s.h - inset * 2;
  const cv = $('#recap-move-canvas');
  cv.width = Math.round(w * 2); cv.height = Math.round(h * 2);
  coverDraw(cv.getContext('2d'), recap.photos[mover.index % recap.photos.length], 0, 0, cv.width, cv.height, mover.crop);
}
function openMover(index) {
  mover.index = index;
  mover.crop = { x: 0.5, y: 0.5, zoom: 1, ...recap.crops[index] };
  const s = STAMPS[index], inset = STAMP_INSET(s.w, s.h);
  $('#recap-move-canvas').style.aspectRatio = `${s.w - inset * 2} / ${s.h - inset * 2}`;
  $('#recap-zoom').value = mover.crop.zoom;
  drawMover();
  openSheet('#recap-move-sheet');
  track('recap', { action: 'move_open' });
}
$('#recap-canvas').addEventListener('click', (event) => {
  if (!recap.photos) return;
  const index = stampAt(event.clientX, event.clientY);
  if (index >= 0) openMover(index);
});
// Keeps the photo covering the window: the centre can't go past where an edge would show.
function clampCrop() {
  const s = STAMPS[mover.index], inset = STAMP_INSET(s.w, s.h), w = s.w - inset * 2, h = s.h - inset * 2;
  const img = recap.photos[mover.index % recap.photos.length], iw = img.width, ih = img.height;
  const scale = Math.max(w / iw, h / ih) * mover.crop.zoom, fx = w / scale / iw / 2, fy = h / scale / ih / 2;
  mover.crop.x = Math.min(Math.max(mover.crop.x, fx), 1 - fx); mover.crop.y = Math.min(Math.max(mover.crop.y, fy), 1 - fy);
}
const moveCanvas = $('#recap-move-canvas');
moveCanvas.addEventListener('pointerdown', (event) => {
  moveCanvas.setPointerCapture(event.pointerId);
  mover.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  mover.start = null;
});
moveCanvas.addEventListener('pointermove', (event) => {
  if (!mover.pointers.has(event.pointerId)) return;
  const prev = mover.pointers.get(event.pointerId);
  mover.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const img = recap.photos[mover.index % recap.photos.length], box = moveCanvas.getBoundingClientRect();
  if (mover.pointers.size >= 2) { // pinch
    const [a, b] = [...mover.pointers.values()], dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (!mover.start) mover.start = { dist, zoom: mover.crop.zoom };
    mover.crop.zoom = Math.min(3, Math.max(1, mover.start.zoom * (dist / mover.start.dist)));
    $('#recap-zoom').value = mover.crop.zoom;
  } else { // drag: the photo follows the finger
    const scale = Math.max(box.width / img.width, box.height / img.height) * mover.crop.zoom;
    mover.crop.x -= (event.clientX - prev.x) / scale / img.width;
    mover.crop.y -= (event.clientY - prev.y) / scale / img.height;
  }
  clampCrop(); drawMover();
});
['pointerup', 'pointercancel'].forEach((type) => moveCanvas.addEventListener(type, (event) => { mover.pointers.delete(event.pointerId); mover.start = null; }));
$('#recap-zoom').addEventListener('input', (event) => { mover.crop.zoom = Number(event.target.value); clampCrop(); drawMover(); });
$('#recap-move-reset').addEventListener('click', () => { mover.crop = { x: 0.5, y: 0.5, zoom: 1 }; $('#recap-zoom').value = 1; drawMover(); });
$('#recap-move-done').addEventListener('click', () => {
  recap.crops[mover.index] = { ...mover.crop };
  closeSheets();
  track('recap', { action: 'move_done' });
  paintRecap().catch((error) => console.error(error));
});

// The floating 3D video, same as a regular With Love's (needs an account, like there).
async function recapAnimation() {
  track('recap', { action: 'animation' });
  if (!state.signedIn) { await saveRecapDraft(); return openLogin('animation'); }
  const file = await withLoading('Filming your story…', (setLine) => recordStory(setLine, recapStoryOpts()));
  file.withloveFrom = 'recap';
  offerSave(file, 'Your animation is ready', 'share');
}

// ---- "How was your September?" pop-up ----
// For people already using With Love, after they make a card (never on arrival): a notification-style sheet with a live demo (the sample photos in
// three looks), a way straight into the recap and the Instagram offer (200 gems, topped up by
// hand: the admin DMs them for their email). At most 3 times, one per visit, never once they've made
// a recap, and only if this visit hasn't had its one unasked pop-up yet (mayInterrupt, m.js).
const INVITE_LOOKS = [{ paper: 'doily', paperColor: 'pink', border: 'white' }, { paper: 'linen', paperColor: 'yellow', border: 'white' }, { paper: 'lace', paperColor: 'blue', border: 'pink' }];
let inviteTimer = null;
async function playInviteDemo() {
  const frames = [...document.querySelectorAll('#recap-invite-demo canvas')];
  recap.sample ??= await Promise.all([1, 2, 3, 4, 5, 6].map((n) => loadImg(`./recap/sample-${n}.jpg`)));
  for (const [i, look] of INVITE_LOOKS.entries()) { if (!frames[i].dataset.drawn) { await drawRecap(frames[i], recap.sample, 7 + i, look); frames[i].dataset.drawn = '1'; } if (i === 0) frames[0].classList.add('on'); }
  let at = 0;
  clearInterval(inviteTimer);
  inviteTimer = setInterval(() => { if ($('#recap-invite').hidden) { clearInterval(inviteTimer); return; } frames[at].classList.remove('on'); at = (at + 1) % frames.length; frames[at].classList.add('on'); }, 2200);
}
// Not called since 2 Oct: the recap lives in the frame picker as a jewelled chip, so no pop-up for it.
function maybeInviteRecap(tries = 0) {
  if (!recapOn() || new URLSearchParams(location.search).has('recap') || store.get('With Love-recap-made')) return;
  if (Number(store.get('With Love-recap-invites') || 0) >= 3) return;
  try { if (sessionStorage.getItem('With Love-recap-invited') || sessionStorage.getItem('With Love-survey-shown')) return; } catch {}
  if (!interrupts.cardMade || interrupts.used) return; // only after a card, one unasked pop-up per visit
  if (!mayInterrupt() || !screens.camera.hidden || !screens.recap.hidden) { if (tries < 40) setTimeout(() => maybeInviteRecap(tries + 1), 1500); return; }
  try { sessionStorage.setItem('With Love-recap-invited', '1'); } catch {}
  store.set('With Love-recap-invites', String(Number(store.get('With Love-recap-invites') || 0) + 1));
  usedInterrupt();
  openSheet('#recap-invite');
  coinify($('#recap-invite'));
  bedazzle($('#recap-invite-go'));
  track('recap', { action: 'popup_shown' });
  playInviteDemo().catch((error) => console.warn('recap demo', error));
}
$('#recap-invite-go').addEventListener('click', () => { track('recap', { action: 'popup_open' }); openRecap(); });
$('#recap-invite-later').addEventListener('click', () => { track('recap', { action: 'popup_later' }); closeSheets(); });

// The jewelled chooser button: stones stuck along its edge, cut from the same gem sheet.
// `beads`: [x %, y %, size px] each; the frame picker's recap chip passes a smaller set.
const BUTTON_BEADS = [[3, 8, 30], [11, 0, 18], [19, 4, 13], [27, 1, 11], [48, 0, 13], [66, 3, 12], [77, 0, 17], [87, 5, 20], [97, 12, 32], [99, 55, 16], [95, 92, 26], [84, 99, 14], [62, 98, 12], [38, 99, 15], [20, 97, 12], [5, 90, 22], [0, 50, 15]];
const CHIP_BEADS = [[3, 22, 13], [20, 2, 8], [48, 0, 9], [78, 3, 8], [97, 26, 14], [96, 84, 10], [68, 100, 8], [34, 99, 9], [4, 86, 10]];
async function bedazzle(button, beads = BUTTON_BEADS) {
  if (button.dataset.bedazzled) return;
  button.dataset.bedazzled = '1';
  const assets = await recapAssets().catch(() => null);
  if (!assets) { delete button.dataset.bedazzled; return; }
  const rand = recapRng(3);
  beads.forEach(([x, y, size], i) => {
    const [sx, sy, sw, sh] = i % 3 === 0 ? assets.rects[Math.floor(rand() * 60)] : assets.round[Math.floor(rand() * assets.round.length)];
    const s = size / Math.max(sw, sh);
    const bead = document.createElement('i');
    bead.className = 'bead';
    bead.style.cssText = `left:${x}%;top:${y}%;width:${sw * s}px;height:${sh * s}px;background-size:${assets.gems.width * s}px ${assets.gems.height * s}px;background-position:${-sx * s}px ${-sy * s}px;--r:${Math.round((rand() - 0.5) * 60)}deg;--d:${(i * 0.37) % 2.6}s`;
    button.appendChild(bead);
  });
}

// The September recap is a mode: it joins the modes sheet while it is running, filed under
// "multiple photos". The frame-picker chip is a second way in and stays as it is.
registerMode({
  key: 'recap',
  label: 'sept<br />recap',
  note: '6 photos',
  group: 'multi',
  screen: 'recap',
  special: true,
  icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.4 4h7.2l3.4 4.6-7 11-7-11z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M5 8.6h14M8.4 4l3.6 4.6L15.6 4M12 8.6v11" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  enabled: recapOn,
  fresh: recapOn,
  open: () => { track('recap', { action: 'modes' }); openRecap(); },
});
// A pink dot on the modes button while a special edition is live.
$('#camera-modes-new').hidden = !recapOn();
// Leaving the recap: the normal app from here on (and a reload shouldn't reopen the recap).
function leaveRecap() {
  if (new URLSearchParams(location.search).has('recap')) history.replaceState(null, '', location.pathname);
  openHome(); // the camera is home now
}
$('#recap-back').addEventListener('click', leaveRecap);
document.querySelectorAll('[data-recap-exit]').forEach((button) => button.addEventListener('click', () => { track('recap', { action: 'exit_to_app' }); leaveRecap(); }));
$('#recap-start').addEventListener('click', () => { track('recap', { action: 'start' }); $('#recap-input').click(); });
$('#recap-repick').addEventListener('click', () => { recapAppend = false; $('#recap-input').click(); });
let recapAppend = false;
$('#recap-input').addEventListener('change', (event) => { recapPicked(event.target.files, { append: recapAppend }); recapAppend = false; event.target.value = ''; });
$('#recap-add').addEventListener('click', () => { recapAppend = true; track('recap', { action: 'add_more' }); $('#recap-input').click(); });
$('#recap-shuffle').addEventListener('click', () => {
  if (!recap.photos) return;
  recap.photos = recap.photos.map((p) => [Math.random(), p]).sort((a, b) => a[0] - b[0]).map(([, p]) => p);
  recap.seed = Math.floor(Math.random() * 1e6); recap.crops = [];
  track('recap', { action: 'shuffle' });
  paintRecap().catch((error) => console.error(error));
});
$('#recap-share').addEventListener('click', () => recapShare('story').catch((error) => { console.error(error); showError('Sharing didn’t work.', null); }));
$('#recap-save').addEventListener('click', () => recapShare('card').catch((error) => { console.error(error); showError('Saving didn’t work.', null); }));
// Same three buttons (and icons) as a regular With Love.
$('#recap-share').innerHTML = `${PLANE_ICON}share 9:16<small>with background</small>`;
$('#recap-save').innerHTML = `${SAVE_ICON}save 4:5`;
$('#recap-animation').innerHTML = `${SPIN_ICON}export 3D video`;
$('#recap-animation').addEventListener('click', () => recapAnimation().catch((error) => { console.error(error); showError('The video didn’t work on this phone.', null); }));
// A link straight into the recap (for posts): /m/?recap. Back from Google sign-in: their recap again.
takeRecapDraft().then(async (draft) => {
  if (draft) {
    recap.photos = await Promise.all(draft.photos.map((bytes) => recapImage(new File([bytes], 'photo.jpg', { type: 'image/jpeg' }))));
    recap.paper = draft.paper || recap.paper; recap.seed = draft.seed ?? recap.seed;
    if (RECAP_PAPER_COLORS[draft.paperColor]) recap.paperColor = draft.paperColor;
    if (RECAP_BORDERS[draft.border]) recap.border = draft.border;
    recap.crops = Array.isArray(draft.crops) ? draft.crops : [];
    $('#recap-count').hidden = true;
    return openRecap();
  }
  if (new URLSearchParams(location.search).has('recap')) openRecap();
});
