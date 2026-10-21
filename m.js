window.$ = (selector) => document.querySelector(selector);
const $ = window.$;

// Report errors to the server so problems on phones are visible in its log.
function reportClient(kind, detail) {
  try { navigator.sendBeacon?.('/client-log', JSON.stringify({ kind, detail: String(detail?.stack || detail?.message || detail).slice(0, 1500), page: location.pathname })); } catch {}
}
// Product analytics: actions that happen only in the browser (exports, prompts). Renders are logged by the server.
function track(type, meta = {}) {
  const body = JSON.stringify({ type, photo: state.photoId, template: state.template, paper: state.paper, paperColor: state.paperColor, vectorColor: state.vectorColor, captionColor: state.color, meta });
  try { if (!navigator.sendBeacon?.('/track', new Blob([body], { type: 'application/json' }))) fetch('/track', { method: 'POST', body, keepalive: true }).catch(() => {}); } catch {}
}
// Only With Love's own errors: browser extensions and cross-site scripts (reported as a bare
// "Script error.") aren't ours to fix and just add noise.
const foreignError = (text) => /chrome-extension:|safari-extension:|safari-web-extension:|moz-extension:/.test(text) || /^Script error\.?$/.test(text.trim());
addEventListener('error', (event) => {
  const text = String(event.error?.stack || event.message || '');
  if (foreignError(text) || (event.filename && !event.filename.startsWith(location.origin))) return;
  reportClient('error', `${event.message || ''} @ ${(event.filename || '').replace(location.origin, '')}:${event.lineno || 0}:${event.colno || 0}\n${event.error?.stack || ''}`);
});
addEventListener('unhandledrejection', (event) => {
  const text = String(event.reason?.stack || event.reason?.message || event.reason || '');
  if (!foreignError(text)) reportClient('rejection', event.reason);
});
const consoleError = console.error.bind(console);
console.error = (...args) => { consoleError(...args); reportClient('console', args.map((a) => a?.stack || a?.message || a).join(' ')); };

// ---- Polka-dot lettering (original dot-grid letterforms, no font) ----------------
// Coarse grid, big loose dots: each dot is nudged and sized a little differently so the
// letters read as hand-placed polka dots that overlap, not a rigid matrix.
// Rows 0-1 ascender, 2-6 x-height, 7-8 descender.
const DOT_LETTERS = {
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  e: ['....', '....', '.##.', '#..#', '####', '#...', '.###'],
  u: ['....', '....', '#..#', '#..#', '#..#', '#..#', '.###'],
  c: ['....', '....', '.###', '#...', '#...', '#...', '.###'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  a: ['....', '....', '.##.', '...#', '.###', '#..#', '.###'],
  s: ['....', '....', '.###', '#...', '.##.', '...#', '###.'],
  t: ['.#.', '.#.', '###', '.#.', '.#.', '.#.', '..#'],
  o: ['....', '....', '.##.', '#..#', '#..#', '#..#', '.##.'],
  r: ['...', '...', '#.#', '##.', '#..', '#..', '#..'],
  y: ['....', '....', '#..#', '#..#', '#..#', '.###', '...#', '...#', '.##.'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '##.##', '.#.#.'],
  i: ['.#.', '...', '.#.', '.#.', '.#.', '.#.', '.#.'],
  h: ['#...', '#...', '###.', '#..#', '#..#', '#..#', '#..#'],
  l: ['#.', '#.', '#.', '#.', '#.', '#.', '.#'],
  v: ['....', '....', '#..#', '#..#', '#..#', '.##.', '..#.'],
};

function seededRandom(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

// Lays out a word as dots. Returns positions in cell units (1 cell = one grid step).
function dotWord(word, { seed = 5150, gap = 1, jitter = 0.14, rMin = 0.5, rMax = 0.7 } = {}) {
  const random = seededRandom(seed);
  const dots = [];
  let offset = 0, rows = 0;
  for (const letter of String(word).toLowerCase()) {
    if (letter === ' ') { offset += 2 + gap; continue; }
    const glyph = DOT_LETTERS[letter];
    if (!glyph) { offset += 1 + gap; continue; }
    rows = Math.max(rows, glyph.length);
    glyph.forEach((row, y) => [...row].forEach((cell, x) => {
      if (cell !== '#') return;
      dots.push({ x: offset + x + 0.5 + (random() - 0.5) * jitter * 2, y: y + 0.5 + (random() - 0.5) * jitter * 2, r: rMin + random() * (rMax - rMin) });
    }));
    offset += glyph[0].length + gap;
  }
  return { dots, width: Math.max(1, offset - gap), rows, random };
}

let svgIds = 0;
// "With Love" wordmark: every dot is a window onto the lily (same mask idea as the eyes).
function buildDotWordmark(host, { animate = false } = {}) {
  const CELL = 10;
  const { dots, width: w, random } = dotWord('With Love');
  const width = w * CELL, height = 7 * CELL, id = `lily-${++svgIds}`;
  // userSpaceOnUse pattern: each dot carries its piece of the photo while it flies in,
  // so the fragments assemble the lily as they land.
  host.innerHTML = `<svg viewBox="-6 -6 ${width + 12} ${height + 12}" aria-hidden="true"><defs><pattern id="${id}" patternUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><image href="./lily-strip.jpg" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/></pattern></defs>${dots
    .map((d) => `<circle cx="${(d.x * CELL).toFixed(1)}" cy="${(d.y * CELL).toFixed(1)}" r="${(d.r * CELL).toFixed(2)}" fill="url(#${id})"/>`).join('')}</svg>`;
  const circles = [...host.querySelectorAll('circle')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gather = () => {
    // Reduce motion: dots fade into place instead of flying in.
    if (reduced) { circles.forEach((circle) => circle.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: random() * 600, fill: 'backwards' })); return; }
    circles.forEach((circle) => {
      const dx = (random() - 0.5) * width * 1.1, dy = (random() - 0.5) * height * 2.6;
      circle.animate([{ transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 900 + random() * 500, delay: random() * 450, easing: 'cubic-bezier(.2,.9,.3,1.25)', fill: 'backwards' });
    });
  };
  if (animate) {
    gather();
    host.addEventListener('click', gather);
    if (!reduced) setInterval(() => circles[Math.floor(random() * circles.length)].animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 700, easing: 'ease-in-out' }), 1600);
  }
}
document.querySelectorAll('.dot-wordmark').forEach((host) => buildDotWordmark(host, { animate: host.hasAttribute('data-animate') }));

// ---- Tagline: "make" and "story" in polka dots, the rest in the normal font. The whole
// line is one mask over images 1-8, cut like a GIF so the tagline keeps changing colour.
const TAGLINE_FRAMES = 8;
async function buildTagline(host) {
  const size = 58, cell = size * 0.122, lineHeight = size * 1.02;
  const font = `600 ${size}px "Archivo Narrow"`;
  try { await document.fonts.load(font); } catch {}
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  if ('letterSpacing' in measure) measure.letterSpacing = `${(-size * 0.01).toFixed(2)}px`;
  const textWidth = (text) => measure.measureText(text).width;
  // Dot words sit on the text baseline: their x-height rows (2-6) end at row 7.
  // SVG drops leading spaces in <text>, so the space after a dot word is its `after` gap.
  const lines = [[{ dots: 'make', after: size * 0.26 }, { text: 'every' }], [{ text: 'picture worth a' }], [{ dots: 'story', after: size * 0.03 }, { text: '.' }]];
  // clipPath only accepts shapes and text directly (a <g> wrapper is ignored), so style each <text>.
  const textStyle = `font-family="Archivo Narrow" font-weight="600" font-size="${size}" letter-spacing="${(-size * 0.01).toFixed(2)}"`;
  let clip = '', maxWidth = 0, seed = 700;
  lines.forEach((parts, index) => {
    const baseline = size * 0.9 + index * lineHeight;
    let x = 0;
    for (const part of parts) {
      if (part.text) {
        clip += `<text x="${x.toFixed(1)}" y="${baseline.toFixed(1)}" ${textStyle}>${part.text.replace(/&/g, '&amp;')}</text>`;
        x += textWidth(part.text);
      } else {
        const { dots, width } = dotWord(part.dots, { seed: seed += 97, gap: 0.85, jitter: 0.14, rMin: 0.56, rMax: 0.76 });
        const top = baseline - 7 * cell;
        clip += dots.map((d) => `<circle cx="${(x + d.x * cell).toFixed(1)}" cy="${(top + d.y * cell).toFixed(1)}" r="${(d.r * cell).toFixed(2)}"/>`).join('');
        x += width * cell + part.after;
      }
    }
    maxWidth = Math.max(maxWidth, x);
  });
  const width = Math.ceil(maxWidth + 8), height = Math.ceil(size * 0.9 + 2 * lineHeight + 2 * cell + 8);
  const id = `tagline-${++svgIds}`;
  host.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><defs><clipPath id="${id}">${clip}</clipPath></defs><image href="./tagline/1.jpg" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/></svg>`;
  const image = host.querySelector('image');
  const frames = Array.from({ length: TAGLINE_FRAMES }, (_, i) => `./tagline/${i + 1}.jpg`);
  frames.forEach((src) => { new Image().src = src; });
  let frame = 0;
  const slow = matchMedia('(prefers-reduced-motion: reduce)').matches;
  setInterval(() => { frame = (frame + 1) % frames.length; image.setAttribute('href', frames[frame]); }, slow ? 2400 : 700);
}
document.querySelectorAll('.dot-tagline').forEach(buildTagline);
window.screens = { landing: $('#screen-landing'), story: $('#screen-story'), camera: $('#screen-camera') };
const screens = window.screens;
const canvas = $('#preview');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const fields = { caption: $('#field-caption'), feeling: $('#field-feeling'), location: $('#field-location'), date: $('#field-date'), time: $('#field-time') };
const FEELINGS = ['cozy', 'happy', 'calm', 'nostalgic', 'grateful', 'giddy'];
// Long enough that the first blink always plays (the GIF holds its open-eye frame 650ms).
const MIN_LOADING_MS = 700;

window.state = { file: null, signedIn: false, defaults: {}, template: 'stars', paper: 'crumpled', paperColor: 'white', vectorColor: 'white', color: 'yellow', palettes: {}, renderToken: 0, lastAction: null, inAppStyleChanges: 0 };
const state = window.state;
// "pop": the cut-out pieces cast a shadow on the paper. On by default; each phone remembers a choice.
state.pop = (() => { try { return localStorage.getItem('withlove-pop') !== '0'; } catch { return true; } })();
// Guests (in-app browsers and normal browsers alike) can try any frame and take ONE With Love out
// (share or save). After that, changing the style or taking another one out asks them to sign in.
const GUEST_EXPORT_KEY = 'withlove-guest-export-used';
const OLD_IN_APP_EXPORT_KEY = 'withlove-inapp-export-used'; // the in-app-only version of this rule
let guestExportUsedThisPage = false, guestExportPending = false;
function guestExportUsed() {
  if (guestExportUsedThisPage) return true;
  try { return localStorage.getItem(GUEST_EXPORT_KEY) === '1' || localStorage.getItem(OLD_IN_APP_EXPORT_KEY) === '1'; } catch { return false; }
}
function markGuestExportUsed() {
  if (state.signedIn) return;
  guestExportUsedThisPage = true;
  try { localStorage.setItem(GUEST_EXPORT_KEY, '1'); } catch {}
  renderAccount(); renderPickers();
}
// Style and frames are fully unlocked
const canStyle = () => true;
function allowInAppStyleChange(want) { return true; }

function show(name) {
  state.shown = name; // the modes sheet marks the one you are in
  if (name !== 'camera') stopCamera();
  $('#feedback-open').hidden = !state.feedbackOn || name === 'camera'; // it would cover the camera controls
  Object.entries(screens).forEach(([key, node]) => { if (node) node.hidden = key !== name; });
  window.scrollTo(0, 0);
}
window.show = show;

let loadingDepth = 0;
async function withLoading(line, task) {
  const loading = $('#loading');
  const setLine = (text) => { const el = $('#loading-line'); if (el) el.textContent = text; };
  setLine(line);
  loadingDepth += 1; if (loading) loading.hidden = false;
  const started = performance.now();
  try {
    return await task(setLine);
  } finally {
    const wait = MIN_LOADING_MS - (performance.now() - started);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    loadingDepth -= 1;
    if (!loadingDepth && loading) loading.hidden = true;
  }
}
window.withLoading = withLoading;

function openSheet(id) { const b = $('#sheet-backdrop'); if (b) b.hidden = false; const s = $(id); if (s) s.hidden = false; }
window.openSheet = openSheet;
function closeSheets() {
  clearInterval(state.demoTimer); state.demoTimer = null; // a letter's live demo
  const b = $('#sheet-backdrop'); if (b) b.hidden = true;
  document.querySelectorAll('.sheet').forEach((sheet) => { sheet.hidden = true; });
  if (state.styleDirty) { state.styleDirty = false; renderPickers(); rerender('Tinting the paper…'); }
}
window.closeSheets = closeSheets;

function showError(detail, retry) {
  state.lastAction = retry;
  $('#error-detail').textContent = detail;
  openSheet('#error-sheet');
}

const pad = (value) => String(value).padStart(2, '0');
function defaultWhen(file, taken) {
  const when = taken || new Date(file.lastModified || Date.now());
  return { date: `${pad(when.getDate())}.${pad(when.getMonth() + 1)}`, time: `${pad(when.getHours())}:${pad(when.getMinutes())}` };
}

// What the photo itself knows: when it was taken (EXIF) and where (GPS → city, looked up on our
// own server with an offline city list; coordinates aren't stored). Must read the original file:
// shrinking re-encodes it and drops the metadata.
async function photoFacts(file) {
  try {
    const meta = await window.exifr?.parse(file, { tiff: true, exif: true, gps: true });
    const taken = meta?.DateTimeOriginal || meta?.CreateDate;
    return { taken: taken instanceof Date && !Number.isNaN(+taken) ? taken : null, lat: meta?.latitude, lon: meta?.longitude };
  } catch { return {}; }
}
async function placeName(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  try {
    if (localStorage.getItem('withlove-photo-location') !== '1') return '';
    const response = await fetch('/place', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lon }) });
    return response.ok ? (await response.json()).city || '' : '';
  } catch { return ''; }
}
// A new (or changed) photo sets its own date, time and city. The city only fills an empty location,
// or replaces one we filled from the previous photo — never words the person typed.
async function applyPhotoFacts(file) {
  const facts = isVideo(file) ? {} : await photoFacts(file);
  const { date, time } = defaultWhen(file, facts.taken);
  fields.date.value = date; fields.time.value = time;
  const auto = !fields.location.value.trim() || fields.location.value === state.autoLocation;
  // The photo knows where it was taken but city captions are off: ask in the note tab (once, until
  // they answer) instead of looking it up.
  const hasPlace = Number.isFinite(facts.lat) && Number.isFinite(facts.lon);
  state.pendingPlace = hasPlace ? { lat: facts.lat, lon: facts.lon } : null;
  $('#loc-ask').hidden = !(hasPlace && auto && !withlovePrivacy.get('photo_location') && !store.get('withlove-photo-location-asked'));
  if (!auto) return;
  const city = await placeName(facts.lat, facts.lon);
  fields.location.value = city; state.autoLocation = city;
}
$('#loc-add').addEventListener('click', async () => {
  withlovePrivacy.set('photo_location', true);
  $('#loc-ask').hidden = true;
  const { lat, lon } = state.pendingPlace || {};
  const city = await placeName(lat, lon);
  if (city && (!fields.location.value.trim() || fields.location.value === state.autoLocation)) { fields.location.value = city; state.autoLocation = city; fields.location.dispatchEvent(new Event('input', { bubbles: true })); }
});
$('#loc-no').addEventListener('click', () => { store.set('withlove-photo-location-asked', '1'); $('#loc-ask').hidden = true; });

function isImage(file) { return file && (file.type.startsWith('image/') || /\.hei[cf]$/i.test(file.name)); }

// keepDraft: swapping the photo on an existing story keeps its words, frame and colours.
// restoring: the saved draft coming back after sign-in. Its photo has lost its metadata, and its
// fields are already right, so nothing is re-read.
async function startWithFile(file, { keepDraft = false, restoring = false, line = 'Developing your photo…', source = restoring ? 'restore' : 'upload', adjust = null } = {}) {
  leaveBooth(); // a new photo or video is a normal card again
  if (isVideo(file)) return startWithVideo(file, { keepDraft, restoring });
  const startedAt = performance.now();
  stopVideo();
  if (!isImage(file)) { showError('That file is not a photo With Love can read yet. Try a JPG, PNG, WEBP or HEIC.', null); return; }
  if (!keepDraft) { Object.values(fields).forEach((input) => { input.value = ''; }); state.autoLocation = ''; }
  try {
    await withLoading(line, async () => {
      // Date/city (EXIF + city lookup) and shrinking run side by side, both before the render
      // needs them — they used to run one after the other, before the loader even showed.
      const [shrunk] = await Promise.all([shrinkForUpload(file), restoring ? null : applyPhotoFacts(file)]);
      renderChips();
      state.file = shrunk;
      resetAdjust(); state.crop = null; // a new photo starts centred
      if (adjust) { [...ADJUST_KEYS, 'grain'].forEach((key) => { state.adjust[key] = Math.max(-50, Math.min(50, Number(adjust[key]) || 0)); }); state.adjustDraft = { ...state.adjust }; paintAdjust(); }
      state.photoBitmap = await photoForThumbs(state.file);
      $('#detected').hidden = true; // the category classifier was a stub; its extra request is gone
      await render();
    });
    renderAccount();
    show('story');
    track('card_ready', { kind: 'photo', source, ms: Math.round(performance.now() - startedAt), mb: +(file.size / 1e6).toFixed(1) });
    revealCard().catch((error) => console.warn('reveal', error));
  } catch (error) {
    console.error(error);
    showError('We couldn\'t develop this photo.', () => startWithFile(file, { keepDraft }));
  }
}

function styleHeaders() {
  const headers = { 'Content-Type': state.file.type || 'application/octet-stream', 'x-template': state.template, 'x-paper': state.paper, 'x-paper-color': state.paperColor, 'x-vector-color': state.vectorColor, 'x-caption-color': state.color };
  if (FROM_THREADS) headers['x-threads-source'] = '1';
  if (!state.pop) headers['x-pop'] = '0';
  if (state.crop) headers['x-crop'] = `${state.crop.x.toFixed(4)},${state.crop.y.toFixed(4)},${state.crop.zoom.toFixed(3)}`;
  if (IN_APP) headers['x-withlove-app'] = IN_APP;
  Object.entries(fields).forEach(([name, input]) => { headers[`x-${name}`] = encodeURIComponent(input.value.trim()); });
  const frameQuote = gallery.byKey[state.template]?.quote;
  ['top', 'bottom'].forEach((panel) => { if (frameQuote?.[panel] != null) headers[`x-quote-${panel}`] = encodeURIComponent($(`#quote-${panel}`).value.trim()); });
  // Photo adjustments: the server applies them to the bottom panel's photo only.
  if (state.adjust && !neutral(state.adjust)) headers['x-adjust'] = ADJUST_KEYS.map((key) => state.adjust[key]).join(',');
  return headers;
}

function watermark(g, x0, y0, w, h) {
  const size = Math.round(h * 0.062), m = Math.round(w * 0.035);
  g.save(); g.font = `600 ${size}px 'Archivo Narrow', sans-serif`; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = size * 0.3; g.fillStyle = '#fff';
  g.fillText('With Love', x0 + w - m, y0 + h - m);
  const s = size * 0.36, sx = x0 + w - m - g.measureText('With Love').width - s * 1.6, sy = y0 + h - m - size * 0.34;
  g.beginPath(); g.moveTo(sx, sy - s); g.lineTo(sx + s * 0.22, sy - s * 0.22); g.lineTo(sx + s, sy); g.lineTo(sx + s * 0.22, sy + s * 0.22);
  g.lineTo(sx, sy + s); g.lineTo(sx - s * 0.22, sy + s * 0.22); g.lineTo(sx - s, sy); g.lineTo(sx - s * 0.22, sy - s * 0.22); g.closePath(); g.fill();
  g.restore();
}

async function renderClientCard() {
  const c = document.createElement('canvas');
  c.width = PANEL_W;
  c.height = PANEL_H * 2;
  const g = c.getContext('2d');

  const photo = await createImageBitmap(state.file);
  const adjusted = adjustedShot(photo, state.adjust);
  const crop = state.crop ? (() => {
    const base = coverCrop(photo.width, photo.height);
    const z = state.crop.zoom || 1;
    const cw = base.sw / z, ch = base.sh / z;
    const cx = photo.width * (state.crop.x ?? 0.5), cy = photo.height * (state.crop.y ?? 0.5);
    return {
      sx: Math.max(0, Math.min(photo.width - cw, cx - cw / 2)),
      sy: Math.max(0, Math.min(photo.height - ch, cy - ch / 2)),
      sw: cw, sh: ch
    };
  })() : coverCrop(photo.width, photo.height);

  // Top Panel background: paper
  let paperImg;
  try {
    paperImg = await loadImage(`layer/paper/${state.paper}/${state.paperColor}.jpg`);
  } catch {
    try { paperImg = await loadImage('./paper-bg.jpg'); } catch { paperImg = null; }
  }
  if (paperImg) {
    g.drawImage(paperImg, 0, 0, PANEL_W, PANEL_H);
  } else {
    g.fillStyle = state.palettes?.paperColor?.[state.paperColor] || '#faf9f6';
    g.fillRect(0, 0, PANEL_W, PANEL_H);
  }

  // Top Panel: mask with photo
  const templateKey = state.template || 'stars';
  let mask;
  try {
    mask = await maskImage(templateKey);
  } catch {
    mask = await maskImage('stars');
  }
  const fit = gallery.byKey[templateKey]?.scale ?? 0.78;
  const maskScale = Math.min((PANEL_W * fit) / mask.naturalWidth, (PANEL_H * fit) / mask.naturalHeight);
  const mw = mask.naturalWidth * maskScale, mh = mask.naturalHeight * maskScale;
  const mx = (PANEL_W - mw) / 2, my = (PANEL_H - mh) / 2;

  const maskedCanvas = document.createElement('canvas');
  maskedCanvas.width = PANEL_W; maskedCanvas.height = PANEL_H;
  const mc = maskedCanvas.getContext('2d');
  mc.drawImage(mask, mx, my, mw, mh);
  mc.globalCompositeOperation = 'source-in';
  mc.drawImage(adjusted, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, PANEL_W, PANEL_H);

  if (state.pop) {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = PANEL_W; shadowCanvas.height = PANEL_H;
    const sc = shadowCanvas.getContext('2d');
    sc.shadowColor = 'rgba(60, 40, 30, 0.28)';
    sc.shadowBlur = 16;
    sc.shadowOffsetY = 6;
    sc.drawImage(mask, mx, my, mw, mh);
    g.drawImage(shadowCanvas, 0, 0);
  }
  g.drawImage(maskedCanvas, 0, 0);

  // Stamp edge if stamp
  if (gallery.byKey[templateKey]?.stamp) {
    g.save();
    g.strokeStyle = state.palettes?.paperColor?.[state.paperColor] || '#faf9f6';
    g.lineWidth = 14;
    g.strokeRect(mx + 7, my + 7, mw - 14, mh - 14);
    g.restore();
  }

  // Top quote
  const quoteTop = $('#quote-top')?.value?.trim();
  if (quoteTop) {
    g.save();
    g.font = "600 36px 'Archivo Narrow', sans-serif";
    g.fillStyle = state.palettes?.color?.[state.color] || '#5b4b43';
    g.textAlign = 'center';
    g.fillText(quoteTop, PANEL_W / 2, 65);
    g.restore();
  }

  // Date and Time on top panel
  const dVal = fields.date?.value?.trim() || '';
  const tVal = fields.time?.value?.trim() || '';
  const whenStr = [dVal, tVal].filter(Boolean).join(' · ');
  if (whenStr) {
    g.save();
    g.font = "600 42px 'Archivo Narrow', sans-serif";
    const txtColor = state.palettes?.color?.[state.color] || '#FFE9A8';
    g.fillStyle = txtColor;
    g.strokeStyle = 'rgba(74, 51, 38, 0.35)';
    g.lineWidth = 3;
    g.strokeText(whenStr, 40, PANEL_H - 28);
    g.fillText(whenStr, 40, PANEL_H - 28);
    g.restore();
  }

  // Bottom Panel: photo
  g.drawImage(adjusted, crop.sx, crop.sy, crop.sw, crop.sh, 0, PANEL_H, PANEL_W, PANEL_H);

  // Bottom Panel: vector motif scatter (if not a stamp)
  if (!gallery.byKey[templateKey]?.stamp) {
    const vectorColor = state.palettes?.vectorColor?.[state.vectorColor] || '#FFFFFF';
    const motifCanvas = document.createElement('canvas');
    motifCanvas.width = PANEL_W; motifCanvas.height = PANEL_H;
    const moc = motifCanvas.getContext('2d');
    moc.drawImage(mask, mx, my, mw, mh);
    moc.globalCompositeOperation = 'source-in';
    moc.fillStyle = vectorColor;
    moc.fillRect(0, 0, PANEL_W, PANEL_H);
    g.drawImage(motifCanvas, 0, PANEL_H);
  }

  // Bottom text: quote, caption, feeling, location
  const quoteBottom = $('#quote-bottom')?.value?.trim();
  let bTextY = PANEL_H + 65;
  if (quoteBottom) {
    g.save();
    g.font = "600 36px 'Archivo Narrow', sans-serif";
    g.fillStyle = state.palettes?.vectorColor?.[state.vectorColor] || '#FFFFFF';
    g.textAlign = 'center';
    g.fillText(quoteBottom, PANEL_W / 2, bTextY);
    g.restore();
    bTextY += 50;
  }

  const cap = fields.caption?.value?.trim();
  const feel = fields.feeling?.value?.trim();
  const loc = fields.location?.value?.trim();
  if (cap) {
    g.save();
    g.font = "600 46px 'Archivo Narrow', sans-serif";
    g.fillStyle = state.palettes?.color?.[state.color] || '#FFFFFF';
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 8;
    g.fillText(cap, 40, bTextY);
    g.restore();
    bTextY += 50;
  }
  if (feel || loc) {
    const sub = [feel, loc].filter(Boolean).join(' · ');
    g.save();
    g.font = "500 32px 'Archivo Narrow', sans-serif";
    g.fillStyle = 'rgba(255, 255, 255, 0.88)';
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 6;
    g.fillText(sub, 40, bTextY);
    g.restore();
  }

  // Watermark
  watermark(g, 0, PANEL_H, PANEL_W, PANEL_H);

  return c;
}

async function render() {
  const token = ++state.renderToken;
  if (state.video) return renderVideo(token);
  if (state.booth) return renderBooth(token);
  const cardCanvas = await renderClientCard();
  if (token !== state.renderToken) return;
  const bitmap = await createImageBitmap(cardCanvas);
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  state.cardBitmap = bitmap;
  ctx.drawImage(bitmap, 0, 0);
  applyFilm();
  await drawBack();
  prepareExport(token);
  interrupts.cardMade = true; noteCardMade();
}

// ---- Photobooth cards (booth.js) in the studio ----
// Nothing here goes to the server: no /process, no handoff, no library upload. The draft that survives
// sign-in lives in this browser (IndexedDB, auth.js).
// Two photos on one card, put together on the phone. The studio works as usual (adjust with colours on
// both photos, grain, a flip for each photo; share and save) but has no frame, paper or note (Maddy, 11 Oct 2026).
// state.file holds the two photos stacked, untouched, so a draft can carry the card through sign-in.
async function renderBooth(token) {
  // Colours are worked out pixel by pixel (the server's own maths, dot-overlay-engine adjustPhoto): canvas
  // filters are ignored by Safari on iPhone, so brightness/contrast/saturation/warmth never showed there.
  const card = await window.boothCompose(state.booth.shots.map((shot) => adjustedShot(shot, state.adjust)), { flip: state.booth.flip });
  if (token !== state.renderToken) return;
  const bitmap = await createImageBitmap(card);
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  state.cardBitmap = bitmap;
  ctx.drawImage(bitmap, 0, 0);
  applyFilm();
  await drawBack();
  prepareExport(token);
  interrupts.cardMade = true; noteCardMade();
}
function adjustedShot(shot, a) {
  const { brightness = 0, contrast = 0, saturation = 0, warmth = 0 } = a || {};
  if (!brightness && !contrast && !saturation && !warmth) return shot;
  const c = document.createElement('canvas'); c.width = shot.width; c.height = shot.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(shot, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const lift = brightness * 1.28, k = contrast * 2.55, f = (259 * (k + 255)) / (255 * (259 - k)), sat = 1 + saturation / 100, warm = warmth * 0.7;
  for (let i = 0; i < d.length; i += 4) {
    const r = f * (d[i] + lift - 128) + 128, gr = f * (d[i + 1] + lift - 128) + 128, b = f * (d[i + 2] + lift - 128) + 128;
    const l = 0.299 * r + 0.587 * gr + 0.114 * b;
    d[i] = l + (r - l) * sat + warm; d[i + 1] = l + (gr - l) * sat + warm * 0.25; d[i + 2] = l + (b - l) * sat - warm; // Uint8Clamped: clamps and rounds
  }
  g.putImageData(img, 0, 0);
  return c;
}
async function stackShots(shots) {
  const c = document.createElement('canvas'); c.width = PANEL_W; c.height = PANEL_H * 2;
  shots.forEach((shot, i) => c.getContext('2d').drawImage(shot, 0, i * PANEL_H, PANEL_W, PANEL_H));
  const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.92));
  return new File([blob], 'with-love-photobooth.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}
async function splitShots(file) {
  const bitmap = await createImageBitmap(file);
  return [0, 1].map((i) => {
    const c = document.createElement('canvas'); c.width = PANEL_W; c.height = PANEL_H;
    c.getContext('2d').drawImage(bitmap, 0, i * bitmap.height / 2, bitmap.width, bitmap.height / 2, 0, 0, PANEL_W, PANEL_H);
    return c;
  });
}
function leaveBooth() { state.booth = null; document.documentElement.classList.remove('booth-studio'); }
function paintBoothFlips() {
  document.querySelectorAll('.booth-flip').forEach((b) => b.setAttribute('aria-pressed', String(Boolean(state.booth?.flip[b.dataset.half]))));
  document.querySelectorAll('.booth-thumb').forEach((c) => {
    const shot = state.booth?.shots[c.dataset.half]; if (!shot) return;
    const g = c.getContext('2d'); g.save();
    if (state.booth.flip[c.dataset.half]) { g.translate(c.width, 0); g.scale(-1, 1); }
    g.drawImage(shot, 0, 0, c.width, c.height); g.restore();
  });
}
window.openBoothStudio = async (shots, { flip = [false, false], adjust = null, source = 'booth' } = {}) => {
  const startedAt = performance.now();
  stopVideo();
  Object.values(fields).forEach((input) => { input.value = ''; }); state.autoLocation = '';
  try {
    await withLoading('Developing your photobooth…', async () => {
      state.booth = { shots, src: shots.slice(), crop: [null, null], flip: [...flip] }; // src: each photo as taken or picked; crop: its move & zoom
      document.documentElement.classList.add('booth-studio');
      state.file = await stackShots(shots);
      resetAdjust(); state.crop = null;
      if (adjust) { [...ADJUST_KEYS, 'grain'].forEach((key) => { state.adjust[key] = Math.max(-50, Math.min(50, Number(adjust[key]) || 0)); }); state.adjustDraft = { ...state.adjust }; paintAdjust(); }
      state.photoBitmap = await photoForThumbs(state.file);
      await render();
    });
    paintBoothFlips(); renderChips(); renderAccount();
    show('story'); setTab('adjust');
    track('card_ready', { kind: 'booth', source, ms: Math.round(performance.now() - startedAt) });
    revealCard().catch((error) => console.warn('reveal', error));
  } catch (error) {
    console.error(error); leaveBooth();
    showError('We couldn\'t put your photobooth together.', null);
  }
};
document.querySelectorAll('.booth-flip').forEach((b) => b.addEventListener('click', () => {
  if (!state.booth) return;
  const half = Number(b.dataset.half);
  state.booth.flip[half] = !state.booth.flip[half]; paintBoothFlips();
  track('booth', { action: 'flip', half: half + 1, on: state.booth.flip[half] });
  rerender('Flipping the photo…');
}));
// One half's photo as it shows: its source, moved and zoomed (same window maths as the Move sheet).
function boothShot(half) {
  const src = state.booth.src[half], w = cropWindow(src.width, src.height, state.booth.crop[half] || CROP_CENTRE);
  const shot = document.createElement('canvas'); shot.width = PANEL_W; shot.height = PANEL_H;
  shot.getContext('2d').drawImage(src, w.sx, w.sy, w.sw, w.sh, 0, 0, PANEL_W, PANEL_H);
  return shot;
}
document.querySelectorAll('.booth-zoom').forEach((b) => b.addEventListener('click', () => openBoothMove(Number(b.dataset.half))));
// Change one photo: from the phone's photos (or its camera, which the picker offers), cropped to fill the half.
let boothChanging = 0;
document.querySelectorAll('.booth-change').forEach((b) => b.addEventListener('click', () => { if (!state.booth) return; boothChanging = Number(b.dataset.half); $('#booth-change-input').click(); }));
$('#booth-change-input').addEventListener('change', async (event) => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file || !state.booth) return;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height)), src = document.createElement('canvas'); // kept whole, so move & zoom has room
    src.width = Math.round(bitmap.width * scale); src.height = Math.round(bitmap.height * scale);
    src.getContext('2d').drawImage(bitmap, 0, 0, src.width, src.height);
    bitmap.close?.();
    Object.assign(state.booth, { src: Object.assign([...state.booth.src], { [boothChanging]: src }) });
    state.booth.crop[boothChanging] = null; state.booth.flip[boothChanging] = false;
    state.booth.shots[boothChanging] = boothShot(boothChanging);
    state.file = await stackShots(state.booth.shots);
    paintBoothFlips();
    track('booth', { action: 'change', half: boothChanging + 1 });
    rerender('Swapping the photo…');
  } catch (error) { console.warn('booth change', error); showError('That photo didn’t open. Try a JPG or PNG.', null); }
});

// iOS only opens the share sheet straight from a tap (an await first loses it), so the PNG is built
// in the background after each render and share() can hand it over immediately.
function prepareExport(token) {
  state.exportFile = null; state.cardFile = null;
  storyStill().then((file) => { if (token === state.renderToken) state.exportFile = file; }).catch((error) => console.warn('story still', error));
  cardPng().then((file) => { if (token === state.renderToken) state.cardFile = file; }).catch((error) => console.warn('card png', error));
}

// The 4:5 card on its own, lossless PNG at full size (exactly what's on screen), for Save.
function cardPng() {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(new File([blob], 'with-love-card.png', { type: 'image/png' })) : reject(new Error('export failed'))), 'image/png'));
}

// Video cards: the 4:5 card as a video — one pass of the clip, recorded straight off the card canvas.
async function recordCardVideo(setLine = () => {}) {
  const video = state.video;
  if (video.recording) await video.recording.catch(() => {});
  const type = videoRecorderType();
  if (!type) throw new Error('This browser cannot record video');
  await video.played;
  const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: type, videoBitsPerSecond: 10_000_000 });
  const chunks = []; recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  const done = new Promise((resolve) => { recorder.onstop = resolve; });
  const el = video.el;
  el.currentTime = 0;
  await waitFor(el, 'seeked', 3000, 'rewind').catch(() => {});
  recorder.start();
  el.play().catch(() => {});
  await new Promise((resolve) => { const check = () => { setLine(`Saving your card… ${Math.max(0, Math.ceil(video.seconds - el.currentTime))}s`); if (video.stopped || el.currentTime >= video.seconds - 0.05 || el.ended) resolve(); else setTimeout(check, 60); }; check(); });
  recorder.stop(); await done;
  const mime = type.split(';')[0];
  return new File([new Blob(chunks, { type: mime })], `withlove-card.${mime === 'video/mp4' ? 'mp4' : 'webm'}`, { type: mime });
}

async function saveCard() {
  if (state.video) {
    if (!state.video.playing) state.video.el.play().catch(() => {}); // this tap unblocks playback
    const file = await withLoading('Saving your card…', recordCardVideo);
    offerSave(file, 'Your card video is ready');
    return;
  }
  const file = state.cardFile || await withLoading('Getting your card ready…', cardPng);
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'with-love-card.png';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  saveToast('Card saved!', 'Find it in Downloads.');
}

// ---- Reveal: a new card assembles itself ----
// The top panel's motif pieces (each star, dot, stamp…) pop in one by one with the photo's colours,
// then the bottom panel fades in. It plays on an overlay canvas above the finished card, so the card
// itself (what Share and Save use) is never mid-animation.
// Builds the pieces for the current card; returns draw(o, t) for one frame at t seconds, or null.
async function prepareReveal() {
  if (state.video || state.booth) return null; // the reveal animates the chosen frame's motif; a photobooth card has none
  const token = state.renderToken;
  const W = canvas.width, H = canvas.height, PH = H / 2;
  if (W !== PANEL_W || PH !== PANEL_H) return;
  const [mask, paper] = await Promise.all([loadImage(`/layer/mask/${state.template}.png?v=2`), loadImage(`/layer/paper/${state.paper}/${state.paperColor}.jpg?v=2`)]).catch(() => []);
  if (!mask || token !== state.renderToken) return null;
  // Final top panel, the mask's alpha and the paper, as pixels.
  const grab = (draw) => { const c = document.createElement('canvas'); c.width = W; c.height = PH; const g = c.getContext('2d', { willReadFrequently: true }); draw(g); return g.getImageData(0, 0, W, PH); };
  const finalTop = grab((g) => g.drawImage(canvas, 0, 0, W, PH, 0, 0, W, PH));
  const alpha = grab((g) => g.drawImage(mask, 0, 0, W, PH)).data;
  const paperPx = grab((g) => g.drawImage(paper, 0, 0, W, PH)).data;
  // Label each separate piece of the motif (at half size: fast, and plenty for grouping).
  const hw = W >> 1, hh = PH >> 1, label = new Int32Array(hw * hh), boxes = [];
  const solid = (x, y) => alpha[((y * 2) * W + x * 2) * 4 + 3] > 32;
  for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) {
    if (label[y * hw + x] || !solid(x, y)) continue;
    const id = boxes.length + 1, box = { x0: x, y0: y, x1: x, y1: y }, stack = [x, y];
    label[y * hw + x] = id;
    while (stack.length) {
      const cy = stack.pop(), cx = stack.pop();
      box.x0 = Math.min(box.x0, cx); box.x1 = Math.max(box.x1, cx); box.y0 = Math.min(box.y0, cy); box.y1 = Math.max(box.y1, cy);
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx < 0 || ny < 0 || nx >= hw || ny >= hh || label[ny * hw + nx] || !solid(nx, ny)) continue;
        label[ny * hw + nx] = id; stack.push(nx, ny);
      }
    }
    boxes.push(box);
  }
  if (!boxes.length || token !== state.renderToken) return null;
  // Very busy motifs (dot fields) animate in grid groups rather than hundreds of single dots.
  const grouped = boxes.length > 220, cols = 12, rows = 7;
  const groupOf = (id) => { if (!grouped) return id; const b = boxes[id - 1]; return 1 + Math.floor(((b.y0 + b.y1) / 2) / hh * rows) * cols + Math.floor(((b.x0 + b.x1) / 2) / hw * cols); };
  const groups = new Map();
  boxes.forEach((b, i) => { const g = groupOf(i + 1); const box = groups.get(g) || { x0: 1e9, y0: 1e9, x1: -1, y1: -1, ids: new Set() }; box.x0 = Math.min(box.x0, b.x0); box.y0 = Math.min(box.y0, b.y0); box.x1 = Math.max(box.x1, b.x1); box.y1 = Math.max(box.y1, b.y1); box.ids.add(i + 1); groups.set(g, box); });
  // Background = the final top with the motif swapped for plain paper; one small canvas per piece.
  const bg = new ImageData(new Uint8ClampedArray(finalTop.data), W, PH);
  for (let i = 0; i < W * PH; i++) { const a = alpha[i * 4 + 3] / 255; if (a) for (let c = 0; c < 3; c++) bg.data[i * 4 + c] = finalTop.data[i * 4 + c] * (1 - a) + paperPx[i * 4 + c] * a; }
  const random = seeded(4242);
  const pieces = [...groups.values()].map((g) => {
    const x0 = Math.max(0, g.x0 * 2 - 2), y0 = Math.max(0, g.y0 * 2 - 2), x1 = Math.min(W, g.x1 * 2 + 4), y1 = Math.min(PH, g.y1 * 2 + 4);
    const w = x1 - x0, h = y1 - y0, img = new ImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = x0 + x, gy = y0 + y, i = gy * W + gx;
      const l = label[Math.min(hh - 1, gy >> 1) * hw + Math.min(hw - 1, gx >> 1)];
      if (!g.ids.has(l) && !(l === 0 && alpha[i * 4 + 3])) continue;
      const o = (y * w + x) * 4;
      img.data[o] = finalTop.data[i * 4]; img.data[o + 1] = finalTop.data[i * 4 + 1]; img.data[o + 2] = finalTop.data[i * 4 + 2]; img.data[o + 3] = alpha[i * 4 + 3];
    }
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(img, 0, 0);
    return { c, x: x0, y: y0, w, h, delay: random() * 0.9 };
  });
  const bgCanvas = document.createElement('canvas'); bgCanvas.width = W; bgCanvas.height = PH; bgCanvas.getContext('2d').putImageData(bg, 0, 0);
  const POP = 0.38, TOP_END = 0.9 + POP, BOTTOM = 0.75, duration = TOP_END + BOTTOM;
  const backOut = (p) => 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
  const draw = (o, t) => {
    o.clearRect(0, 0, W, H);
    o.drawImage(bgCanvas, 0, 0);
    for (const piece of pieces) {
      const p = Math.min(Math.max((t - piece.delay) / POP, 0), 1);
      if (!p) continue;
      const scale = 0.5 + 0.5 * backOut(p), cx = piece.x + piece.w / 2, cy = piece.y + piece.h / 2;
      o.globalAlpha = Math.min(1, p * 1.6);
      o.drawImage(piece.c, cx - piece.w * scale / 2, cy - piece.h * scale / 2, piece.w * scale, piece.h * scale);
    }
    o.globalAlpha = 1;
    // Bottom panel: plain paper until the top is done, then the photo panel fades in.
    o.drawImage(paper, 0, PH, W, PH);
    const b = Math.min(Math.max((t - TOP_END) / BOTTOM, 0), 1);
    if (b) { o.globalAlpha = b * b * (3 - 2 * b); o.drawImage(canvas, 0, PH, W, PH, 0, PH, W, PH); o.globalAlpha = 1; }
  };
  return { draw, duration, token, pieces: pieces.length };
}

async function revealCard() {
  const reveal = await prepareReveal();
  if (!reveal) return;
  // Overlay above the card face.
  const overlay = document.createElement('canvas'); overlay.width = canvas.width; overlay.height = canvas.height; overlay.className = 'reveal-layer';
  canvas.parentElement.append(overlay);
  const o = overlay.getContext('2d');
  const started = performance.now();
  await new Promise((resolve) => {
    const frame = (now) => {
      const t = (now - started) / 1000;
      if (reveal.token !== state.renderToken) return resolve();
      reveal.draw(o, t);
      if (t < reveal.duration) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
  overlay.remove();
}

// ---- Adjust: brightness, contrast, saturation, warmth, grain (photos only) ----
// iPhone Photos style: tap a dial, drag the one ruler under it. The first four change the photo
// on the bottom panel only (the server applies them); the top panel's motif, the paper, text and white elements stay as they are.
// Grain is the film pass's noise over the whole card, drawn here on the phone: 0 = With Love's usual grain,
// -50 = none at all, +50 = half as much again.
const ADJUST_KEYS = ['brightness', 'contrast', 'saturation', 'warmth']; // sent to the server
const DIALS = [...ADJUST_KEYS, 'grain'];
// The grain level is remembered on this phone: someone who turns it off shouldn't have to again on every photo.
const savedGrain = () => { try { return Math.max(-50, Math.min(50, Number(localStorage.getItem('withlove-grain')) || 0)); } catch { return 0; } };
const saveGrain = (v) => { try { localStorage.setItem('withlove-grain', String(v)); } catch {} };
const grainAmount = () => { const v = Number(state.adjustDraft?.grain) || 0; return v < 0 ? 1 + v / 50 : 1 + v / 100; };
const PX_PER_STEP = 6; // ruler: -50…50 over 600px, a major tick every 10
const neutral = (a) => ADJUST_KEYS.every((key) => !a[key]);
let adjustKey = 'brightness';
state.adjust = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, grain: savedGrain() };
state.adjustDraft = { ...state.adjust };
function paintAdjust() {
  const value = state.adjustDraft[adjustKey];
  $('#adjust-name').textContent = adjustKey;
  $('#adjust-value').textContent = value > 0 ? `+${value}` : String(value);
  $('#ruler-ticks').style.left = `calc(50% - ${(value + 50) * PX_PER_STEP + 3}px)`;
  $('#adjust-ruler').setAttribute('aria-valuenow', value);
  document.querySelectorAll('.dial').forEach((dial) => {
    dial.setAttribute('aria-pressed', dial.dataset.adjust === adjustKey);
    dial.style.setProperty('--p', Math.abs(state.adjustDraft[dial.dataset.adjust]) / 50);
  });
}
function resetAdjust() {
  state.adjust = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, grain: savedGrain() };
  state.adjustDraft = { ...state.adjust };
  clearAdjustPreview();
  paintAdjust();
}
// Live preview while dragging: a backdrop filter over the bottom panel only (the top panel's motif
// and the paper keep their colours; the final render leaves the white motif and text untouched).
const adjustFilter = (a) => (neutral(a) ? '' : `brightness(${1 + a.brightness / 100}) contrast(${1 + a.contrast / 100}) saturate(${1 + a.saturation / 100})${a.warmth > 0 ? ` sepia(${a.warmth / 250})` : ''}${a.warmth < 0 ? ` hue-rotate(${a.warmth / 5}deg)` : ''}`);
function previewAdjust() {
  const a = state.adjustDraft;
  const filter = adjustFilter(a);
  const layer = $('#adjust-preview');
  layer.style.backdropFilter = layer.style.webkitBackdropFilter = filter;
  layer.hidden = !filter;
  if (adjustKey === 'grain') refilmSoon();
  paintAdjust();
}
// Grain needs no server trip: redraw the last card and run the film pass again (once per frame while dragging).
let refilmQueued = false;
function refilmSoon() {
  if (refilmQueued || !state.cardBitmap) return;
  refilmQueued = true;
  requestAnimationFrame(() => { refilmQueued = false; ctx.drawImage(state.cardBitmap, 0, 0); applyFilm(); });
}
function clearAdjustPreview() { const layer = $('#adjust-preview'); layer.style.backdropFilter = layer.style.webkitBackdropFilter = ''; layer.hidden = true; }
async function commitAdjust() {
  const a = { ...state.adjustDraft };
  if (!state.file || state.video) return;
  if (DIALS.every((key) => a[key] === state.adjust[key])) { clearAdjustPreview(); return; }
  const onlyGrain = ADJUST_KEYS.every((key) => a[key] === state.adjust[key]) && state.cardBitmap;
  state.adjust = a;
  if (a.grain !== savedGrain()) saveGrain(a.grain);
  track('adjust', a);
  if (onlyGrain) { // same card, new film pass: redraw and rebuild the export, no new render
    const token = state.renderToken;
    ctx.drawImage(state.cardBitmap, 0, 0); applyFilm(); await drawBack(); prepareExport(token);
    return;
  }
  await inPlace(render).catch((error) => { console.error(error); showError('We couldn\'t adjust this photo.', null); });
  clearAdjustPreview();
}
document.querySelectorAll('.dial').forEach((dial) => {
  dial.addEventListener('click', () => { adjustKey = dial.dataset.adjust; paintAdjust(); });
  dial.addEventListener('dblclick', () => { adjustKey = dial.dataset.adjust; state.adjustDraft[adjustKey] = 0; previewAdjust(); commitAdjust(); });
});
// The ruler: drag it left/right under the fixed centre line (it snaps to 0 near the middle).
(() => {
  const ruler = $('#adjust-ruler');
  let drag = null;
  const set = (value) => {
    let v = Math.max(-50, Math.min(50, Math.round(value)));
    if (Math.abs(v) <= 1) v = 0;
    if (v !== state.adjustDraft[adjustKey]) { state.adjustDraft[adjustKey] = v; previewAdjust(); }
  };
  ruler.addEventListener('pointerdown', (event) => { drag = { x: event.clientX, start: state.adjustDraft[adjustKey] }; ruler.setPointerCapture(event.pointerId); });
  ruler.addEventListener('pointermove', (event) => { if (drag) set(drag.start - (event.clientX - drag.x) / PX_PER_STEP); });
  const end = () => { if (!drag) return; drag = null; commitAdjust(); };
  ruler.addEventListener('pointerup', end);
  ruler.addEventListener('pointercancel', end);
  ruler.addEventListener('keydown', (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!step) return;
    event.preventDefault(); set(state.adjustDraft[adjustKey] + step * 5); commitAdjust();
  });
})();
$('#adjust-reset').addEventListener('click', () => { state.adjustDraft = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, grain: 0 }; previewAdjust(); commitAdjust(); });
paintAdjust();

// ---- Editor tabs ----
function setTab(name) {
  const scroll = $('.story-scroll');
  scroll.dataset.tab = name;
  document.querySelectorAll('#editor-tabs [data-tab]').forEach((tab) => tab.setAttribute('aria-selected', tab.dataset.tab === name));
}
document.querySelectorAll('#editor-tabs [data-tab]').forEach((tab) => tab.addEventListener('click', () => { setTab(tab.dataset.tab); track('tab_open', { tab: tab.dataset.tab }); }));
setTab('note');

// ---- Video stories (≤5 s, silent): both panels move ----
// The server renders the still parts from one frame (paper, motif mask, text, motif + watermark);
// the browser plays the clip through them on the card canvas and records that canvas as an MP4.
const VIDEO_MAX_SECONDS = 5;
const PANEL_W = 1080, PANEL_H = 675;
const isVideo = (file) => Boolean(file && (file.type.startsWith('video/') || /\.(mov|mp4|m4v|webm)$/i.test(file.name || '')));

// Layers change with every style tweak, so unlike loadImage() they aren't cached.
const loadLayer = (src) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });

function stopVideo() {
  const video = state.video;
  if (!video) return;
  video.stopped = true;
  video.el.pause(); video.el.removeAttribute('src'); video.el.load(); video.el.remove();
  URL.revokeObjectURL(video.url);
  state.video = null;
  tapToPlay(false);
}

async function openVideo(file) {
  const el = document.createElement('video');
  Object.assign(el, { muted: true, playsInline: true, preload: 'auto' });
  el.setAttribute('playsinline', ''); el.setAttribute('muted', '');
  // iPhone Safari won't decode frames for a video that isn't in the page, so it sits there,
  // invisible (not display:none, which also stops decoding).
  el.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
  document.body.append(el);
  const url = URL.createObjectURL(file);
  el.src = url;
  el.load();
  // Only metadata: iOS Safari won't load frames (no loadeddata) until the video plays.
  try { await waitFor(el, 'loadedmetadata', 12000, 'open'); } catch (error) { el.remove(); URL.revokeObjectURL(url); throw error; }
  const seconds = Math.min(Number.isFinite(el.duration) ? el.duration : VIDEO_MAX_SECONDS, VIDEO_MAX_SECONDS);
  const video = { el, url, file, seconds, trimmed: el.duration > VIDEO_MAX_SECONDS + 0.2, layers: null, stopped: false, playing: false };
  // Safari can refuse to start a video on its own (Low Power Mode, no recent tap): NotAllowedError.
  // Then the card shows a tap-to-play button, and the export waits for real playback.
  video.played = new Promise((resolve) => el.addEventListener('playing', () => { video.playing = true; tapToPlay(false); resolve(); }, { once: true }));
  return video;
}

// The 8:5 centre crop the photo engine uses, so video and photo cards frame the same way.
function coverCrop(sw, sh) {
  const ratio = PANEL_W / PANEL_H;
  return sw / sh > ratio ? { sx: (sw - sh * ratio) / 2, sy: 0, sw: sh * ratio, sh } : { sx: 0, sy: (sh - sw / ratio) / 2, sw, sh: sw / ratio };
}

// One still frame (JPEG): thumbnails, the style galleries, the browser-local saved draft.
// Resolves on `event`, or fails with the step name (reported to the server log) instead of hanging.
function waitFor(el, event, ms, step) {
  return new Promise((resolve, reject) => {
    const done = (ok) => { clearTimeout(timer); el.removeEventListener(event, onEvent); el.removeEventListener('error', onError); ok ? resolve() : reject(new Error(el.error ? 'This video can’t be played in this browser.' : `video ${step} timed out`)); };
    const onEvent = () => done(true), onError = () => done(false);
    const timer = setTimeout(() => { reportClient('video-stuck', `${step} after ${ms}ms`); done(false); }, ms);
    el.addEventListener(event, onEvent); el.addEventListener('error', onError);
  });
}

async function videoPoster(video) {
  const el = video.el;
  // Play (muted) to get real frames — seeking an unplayed video can hang on iPhone.
  await el.play().catch((error) => reportClient('video-play', `${error.name}: ${error.message}`));
  // Any drawable frame will do (readyState ≥ 2); a little into the clip is nicer than frame 0 when
  // it's quick to get, but never wait long for it.
  await new Promise((resolve) => { const started = performance.now(); const check = () => { const waited = performance.now() - started; if ((el.readyState >= 2 && (el.currentTime > 0.2 || waited > 500)) || waited > 6000) resolve(); else setTimeout(check, 30); }; check(); });
  el.pause();
  if (el.readyState < 2) { reportClient('video-stuck', `frame readyState ${el.readyState}`); throw new Error('video frame timed out'); }
  const c = document.createElement('canvas');
  const scale = Math.min(1, 1080 / Math.max(el.videoWidth, el.videoHeight));
  c.width = Math.round(el.videoWidth * scale); c.height = Math.round(el.videoHeight * scale);
  c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
  const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.84));
  return new File([blob], 'video-frame.jpg', { type: 'image/jpeg' });
}

// Same id the server computes for photo uploads (first 32 hex of SHA-256), so events and the
// archived frame line up without waiting for the upload.
async function frameId(file) {
  try { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32); } catch { return ''; }
}

// Film look without a per-pixel pass (too slow per frame): a fixed grain layer and a gentle lift.
let grainLayer = null;
function grain() {
  if (grainLayer) return grainLayer;
  grainLayer = document.createElement('canvas'); grainLayer.width = PANEL_W; grainLayer.height = PANEL_H * 2;
  const g = grainLayer.getContext('2d'); const pixels = g.createImageData(PANEL_W, PANEL_H * 2); const random = seeded(3658);
  for (let i = 0; i < pixels.data.length; i += 4) { const v = 128 + (random() - 0.5) * 70 + (random() - 0.5) * 90; pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = v; pixels.data[i + 3] = 255; }
  g.putImageData(pixels, 0, 0);
  return grainLayer;
}

const maskedPanel = document.createElement('canvas'); maskedPanel.width = PANEL_W; maskedPanel.height = PANEL_H;
function drawVideoFrame() {
  const video = state.video;
  if (!video?.layers) return;
  const { el } = video; const { paper, shadow, mask, top, bottom } = video.layers;
  const crop = coverCrop(el.videoWidth, el.videoHeight);
  const m = maskedPanel.getContext('2d');
  m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, PANEL_W, PANEL_H);
  m.drawImage(el, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, PANEL_W, PANEL_H);
  m.globalCompositeOperation = 'destination-in'; m.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(paper, 0, 0, PANEL_W, PANEL_H);
  if (shadow) ctx.drawImage(shadow, 0, 0, PANEL_W, PANEL_H); // "pop": pieces cast a shadow on the paper
  ctx.drawImage(maskedPanel, 0, 0);
  if (top) ctx.drawImage(top, 0, 0);
  ctx.drawImage(el, crop.sx, crop.sy, crop.sw, crop.sh, 0, PANEL_H, PANEL_W, PANEL_H);
  ctx.drawImage(bottom, 0, PANEL_H);
  const amount = grainAmount(); if (amount > 0) { ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = Math.min(1, 0.22 * amount); ctx.drawImage(grain(), 0, 0); }
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(38,34,30,1)'; ctx.fillRect(0, 0, PANEL_W, PANEL_H * 2);
  ctx.globalCompositeOperation = 'source-over';
}

// Plays the first ≤5 s on a loop and paints each frame onto the card.
function runVideo(video) {
  const { el } = video;
  const tick = () => {
    if (video.stopped) return;
    if (el.currentTime >= video.seconds) el.currentTime = 0;
    drawVideoFrame();
    if (el.requestVideoFrameCallback) el.requestVideoFrameCallback(tick); else requestAnimationFrame(tick);
  };
  el.loop = !video.trimmed;
  el.play().catch(() => { if (!video.playing && !video.stopped) tapToPlay(true); });
  tick();
}

// "Tap to play" over the card, for when Safari blocks playback until the person taps.
function tapToPlay(show) {
  let button = $('#video-play');
  if (!button && show) {
    button = document.createElement('button');
    button.id = 'video-play'; button.type = 'button'; button.className = 'video-play';
    button.innerHTML = '<span aria-hidden="true">▶</span> tap to play';
    // Keep the tap from also tilting the card.
    button.addEventListener('pointerdown', (event) => event.stopPropagation());
    button.addEventListener('click', (event) => { event.stopPropagation(); state.video?.el.play().catch((error) => reportClient('video-play', `tap: ${error.name}`)); });
    $('#card-stage').append(button);
  }
  if (button) button.hidden = !show;
}

async function renderVideo(token) {
  const video = state.video;
  // No upload here: the still frame goes to /archive in the background (see startWithVideo).
  const headers = { ...styleHeaders(), 'x-photo-id': video.frameId || '', 'x-video-seconds': String(Math.round(video.seconds * 10) / 10) };
  const response = await fetch('/process-layers', { method: 'POST', headers });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'render failed');
  const layers = await response.json();
  // Paper and mask URLs are stable per paper/template (cached by the browser and loadImage); the
  // text layers are per render.
  const [paper, mask, top, bottom, shadow] = await Promise.all([loadImage(layers.paper), loadImage(layers.mask), layers.top && loadLayer(layers.top), loadLayer(layers.bottom), layers.shadow && loadLayer(layers.shadow)]);
  if (token !== state.renderToken || video.stopped) return;
  state.photoId = layers.id || state.photoId;
  const first = !video.layers;
  video.layers = { paper, shadow, mask, top, bottom };
  // Resizing clears the canvas and restarts a running recording's encoder, so only when it changes.
  if (canvas.width !== PANEL_W || canvas.height !== PANEL_H * 2) { canvas.width = PANEL_W; canvas.height = PANEL_H * 2; }
  if (first) runVideo(video); else drawVideoFrame();
  await drawBack();
  prepareVideoExport(token);
  interrupts.cardMade = true; noteCardMade(); // checkin.js: today's gems
}

// Records one pass of the clip from the card canvas in the background, so Share can hand the MP4
// straight to the share sheet (Save Video → Photos).
function videoRecorderType() {
  return ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
}
function prepareVideoExport(token) {
  state.exportFile = null;
  const video = state.video;
  state.exportPromise = (async () => {
    // One recording at a time: two recorders on one canvas would fight over playback.
    if (video.recording) await video.recording.catch(() => {});
    if (token !== state.renderToken || video.stopped) return null;
    await video.played; // blocked autoplay: recording starts once they tap play (or Share)
    if (token !== state.renderToken || video.stopped) return null;
    video.el.currentTime = 0;
    video.recording = recordStory((line) => { state.exportLine = line; });
    const file = await video.recording.finally(() => { video.recording = null; });
    if (token !== state.renderToken || video.stopped) return null;
    state.exportFile = file;
    return file;
  })();
  state.exportPromise.catch((error) => console.warn('video export', error));
}

async function startWithVideo(file, { keepDraft = false, restoring = false } = {}) {
  stopVideo();
  if (!keepDraft) { Object.values(fields).forEach((input) => { input.value = ''; }); state.autoLocation = ''; }
  if (!restoring) await applyPhotoFacts(file);
  renderChips();
  try {
    // Step timings go to the server log so slow phones can be diagnosed.
    const t0 = performance.now(), steps = {}; let last = t0;
    const mark = (name) => { const now = performance.now(); steps[name] = Math.round(now - last); last = now; };
    await withLoading('Developing your video…', async () => {
      const video = await openVideo(file); mark('open');
      state.video = video;
      state.file = await videoPoster(video); mark('frame');
      video.frameId = await frameId(state.file);
      state.photoId = video.frameId || null;
      state.photoBitmap = await photoForThumbs(state.file); mark('thumbs');
      $('#detected').textContent = 'Video: using the first 5 seconds'; $('#detected').hidden = !video.trimmed;
      await render(); mark('render');
    });
    renderAccount();
    show('story');
    reportClient('video-timing', JSON.stringify({ ...steps, total: Math.round(performance.now() - t0), mb: +(file.size / 1e6).toFixed(1), type: file.type, seconds: state.video?.seconds }));
    track('card_ready', { kind: 'video', source: restoring ? 'restore' : 'upload', ms: Math.round(performance.now() - t0), mb: +(file.size / 1e6).toFixed(1), seconds: state.video?.seconds, trimmed: Boolean(state.video?.trimmed) });
  } catch (error) {
    console.error(error);
    stopVideo();
    showError(error.message?.includes('played') ? error.message : 'We couldn\'t develop this video.', () => startWithVideo(file, { keepDraft }));
  }
}

// ---- The story card's back: paper, the eyes, the lily-dot wordmark and the story's words ----
const backCanvas = $('#preview-back');
const imageCache = new Map();
function loadImage(src) {
  if (gallery.revision && (src.startsWith('https://With Love.techieslab.app/layer/') || src.startsWith('https://With Love.techieslab.app/paper-thumb/'))) {
    const url = new URL(src, location.origin); url.searchParams.set('content', gallery.revision); src = url.pathname + url.search;
  }
  if (!imageCache.has(src)) imageCache.set(src, new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; }));
  return imageCache.get(src);
}

async function drawBack() {
  const value = (name) => fields[name].value.trim();
  const lines = [value('caption'), value('feeling'), value('location'), [value('date'), value('time')].filter(Boolean).join(' · ')].filter(Boolean);
  await drawCardBack(backCanvas, canvas.width, canvas.height, lines);
}
// The back of a card: paper, the eyes, the dotted wordmark and the story's words. Also used by the
// September recap (recap.js) for its own card.
async function drawCardBack(target, w, h, lines) {
  await document.fonts.load("600 68px 'Archivo Narrow'").catch(() => {});
  const [paper, eyes, lily] = await Promise.all(['./paper-bg.jpg', 'eyes.png', './lily-strip.jpg'].map(loadImage));
  target.width = w; target.height = h;
  const b = target.getContext('2d');
  const cover = Math.max(w / paper.width, h / paper.height);
  b.drawImage(paper, (w - paper.width * cover) / 2, (h - paper.height * cover) / 2, paper.width * cover, paper.height * cover);
  const eyesW = w * 0.34, eyesH = eyesW * eyes.height / eyes.width;
  b.imageSmoothingEnabled = false;
  b.drawImage(eyes, (w - eyesW) / 2, h * 0.16, eyesW, eyesH);
  b.imageSmoothingEnabled = true;
  // Dotted "With Love", each dot filled from the lily — same as the app's wordmark.
  const { dots, width: cells } = dotWord('With Love');
  const cell = (w * 0.56) / cells, left = (w - cells * cell) / 2, top = h * 0.16 + eyesH + h * 0.04;
  const pattern = b.createPattern(lily, 'no-repeat');
  pattern.setTransform(new DOMMatrix().translate(left, top).scale((cells * cell) / lily.width, (7 * cell) / lily.height));
  b.fillStyle = pattern;
  for (const d of dots) { b.beginPath(); b.arc(left + d.x * cell, top + d.y * cell, d.r * cell, 0, Math.PI * 2); b.fill(); }
  // The story's own words, if any.
  b.fillStyle = '#5b4b43'; b.textAlign = 'center';
  lines.forEach((line, i) => {
    b.font = `${i === 0 ? '600 68px' : '400 46px'} 'Archivo Narrow', sans-serif`;
    b.fillText(line, w / 2, h * 0.64 + i * 70, w * 0.84);
  });
  b.font = "400 32px 'Archivo Narrow', sans-serif"; b.fillStyle = '#8a8378';
  b.fillText('made with With Love', w / 2 + 16, h * 0.93);
  // Drawn sparkle (the font has no ✦ glyph).
  const sx = w / 2 - b.measureText('made with With Love').width / 2 - 6, sy = h * 0.93 - 11, r = 12;
  b.beginPath(); [[0, -r], [r * .22, -r * .22], [r, 0], [r * .22, r * .22], [0, r], [-r * .22, r * .22], [-r, 0], [-r * .22, -r * .22]].forEach(([x, y], i) => (i ? b.lineTo(sx + x, sy + y) : b.moveTo(sx + x, sy + y))); b.closePath(); b.fill();
}

// ---- Card: sways at rest, tap to lift it into a floating 30-45° pose, drag to spin/flip ----
const stage = $('#card-stage'), card3d = $('#card3d');
let cardAngle = 0, cardTilt = 0, cardRoll = 0, cardScale = 1, poseSide = 1, settleTimer = 0;
function setCard() { card3d.style.transform = `scale(${cardScale}) rotateX(${cardTilt}deg) rotateY(${cardAngle}deg) rotateZ(${cardRoll}deg)`; }
const faceAngle = () => Math.round(cardAngle / 180) * 180;
function restCard() {
  clearTimeout(settleTimer);
  cardAngle = faceAngle(); cardTilt = 0; cardRoll = 0; cardScale = 1; setCard();
  stage.classList.remove('lifted');
  stage.classList.toggle('flipped', Math.abs(cardAngle / 180) % 2 === 1);
}
function liftCard() {
  // Alternate sides each tap; the angle stays within 30-45° so the card never turns edge-on.
  poseSide = -poseSide;
  const face = faceAngle();
  cardAngle = face + poseSide * (30 + Math.random() * 15);
  cardTilt = 8 + Math.random() * 6;
  cardRoll = -poseSide * (2 + Math.random() * 3);
  cardScale = 1.04; setCard();
  stage.classList.add('lifted');
  clearTimeout(settleTimer);
  settleTimer = setTimeout(restCard, 3500);
}
(() => {
  let startX = 0, startY = 0, baseAngle = 0, moved = false, active = false;
  stage.addEventListener('pointerdown', (event) => {
    active = true; moved = false; startX = event.clientX; startY = event.clientY; baseAngle = cardAngle;
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!active) return;
    const dx = event.clientX - startX, dy = event.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    if (!moved) { clearTimeout(settleTimer); stage.classList.remove('lifted'); cardRoll = 0; cardScale = 1; }
    moved = true; stage.classList.add('dragging');
    cardAngle = baseAngle + dx * 0.7; cardTilt = Math.max(-18, Math.min(18, -dy * 0.15));
    setCard();
  });
  const release = () => {
    if (!active) return;
    active = false; stage.classList.remove('dragging');
    // A drag settles on whichever face is nearest (so dragging past 90° flips it); a tap lifts it.
    if (moved) restCard(); else liftCard();
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
})();

// ---- Story video (animation button, and Share on video cards): 12 s, 1080×1920 for IG Stories ----
// Timeline: 0–6 s the card floats, gently tilting · 6–9 s it turns to the back and rests ·
// 9–12 s it turns to the front and settles. The With Love logo + domain sit at the top the whole time and
// the caption types out under the card. On video cards the front keeps playing the clip.
const STORY = { W: 1080, H: 1920, seconds: 12, fps: 30 };

// The blinking eyes as 8 stacked frames (made from eyes-blink.gif: canvas can't animate a GIF).
const EYES_DELAYS = [650, 110, 150, 170, 190, 130, 110, 650];
const EYES_LOOP = EYES_DELAYS.reduce((a, b) => a + b, 0);
function eyesFrame(t) {
  let ms = (t * 1000) % EYES_LOOP;
  for (let i = 0; i < EYES_DELAYS.length; i++) { if (ms < EYES_DELAYS[i]) return i; ms -= EYES_DELAYS[i]; }
  return 0;
}

// Everything that doesn't move, drawn once: paper, the dotted "With Love" and the domain. Also a
// pre-blurred card shadow (a live shadowBlur every frame is what made the video stutter).
// opts (September recap): its own card faces and words instead of the editor's.
async function prepareStory(opts = {}) {
  const { W, H } = STORY;
  await document.fonts.load("600 64px 'Archivo Narrow'").catch(() => {});
  const [paper, eyesSheet, lily] = await Promise.all(['./paper-bg.jpg', 'eyes-blink-sheet.png', './lily-strip.jpg'].map(loadImage));
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  const g = bg.getContext('2d');
  const cover = Math.max(W / paper.width, H / paper.height);
  g.drawImage(paper, (W - paper.width * cover) / 2, (H - paper.height * cover) / 2, paper.width * cover, paper.height * cover);
  // Logo row: eyes (animated per frame) + dotted wordmark.
  const logoW = 560, top = 150, left = W / 2 - logoW / 2;
  const frameH = eyesSheet.height / EYES_DELAYS.length;
  const eyesW = logoW * 0.3, eyesH = eyesW * frameH / eyesSheet.width;
  const { dots, width: cells } = dotWord('With Love');
  const cell = (logoW - eyesW - logoW * 0.05) / cells, wordH = 7 * cell;
  const rowH = Math.max(eyesH, wordH);
  const wl = left + eyesW + logoW * 0.05, wt = top + (rowH - wordH) / 2;
  const pattern = g.createPattern(lily, 'no-repeat');
  pattern.setTransform(new DOMMatrix().translate(wl, wt).scale((cells * cell) / lily.width, wordH / lily.height));
  g.fillStyle = pattern;
  for (const d of dots) { g.beginPath(); g.arc(wl + d.x * cell, wt + d.y * cell, d.r * cell, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#5b4b43'; g.textAlign = 'center'; g.font = "500 40px 'Archivo Narrow', sans-serif";
  g.fillText('With Love.techieslab.app', W / 2, top + rowH + 62);
  // Shadow sprite: only the blurred shadow of a card-sized rectangle (the shape is drawn off-canvas).
  const card = { w: 840, h: 1050, cy: 1000 }, pad = 120;
  const shadow = document.createElement('canvas'); shadow.width = card.w + pad * 2; shadow.height = card.h + pad * 2;
  const sh = shadow.getContext('2d');
  sh.shadowColor = 'rgba(60,40,30,.32)'; sh.shadowBlur = 46; sh.shadowOffsetX = 10000; sh.shadowOffsetY = 26;
  sh.fillStyle = '#000'; sh.fillRect(pad - 10000, pad, card.w, card.h);
  const value = (name) => fields[name].value.trim();
  return {
    bg, shadow, pad, card, eyesSheet, frameH, eyes: { x: left, y: top + (rowH - eyesH) / 2, w: eyesW, h: eyesH },
    caption: opts.caption ?? (value('caption') || value('feeling') || ''), when: opts.when ?? [value('date'), value('time')].filter(Boolean).join(' · '),
    front: opts.front || canvas, back: opts.back || backCanvas,
  };
}

function storyFrame(o, t, story, { eyesOpen = false } = {}) {
  const { W } = STORY;
  const { bg, shadow, pad, card, eyesSheet, frameH, eyes, caption, when, front, back } = story;
  o.drawImage(bg, 0, 0);
  o.imageSmoothingEnabled = false;
  o.drawImage(eyesSheet, 0, (eyesOpen ? 0 : eyesFrame(t)) * frameH, eyesSheet.width, frameH, eyes.x, eyes.y, eyes.w, eyes.h);
  o.imageSmoothingEnabled = true;
  // Card turn: 0 → π over 6.0–6.8 s (to the back), π → 2π over 9.0–9.8 s (to the front).
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const turn = (from, len) => ease(Math.min(Math.max((t - from) / len, 0), 1));
  const angle = (turn(6, 0.8) + turn(9, 0.8)) * Math.PI;
  const cos = Math.cos(angle), face = cos >= 0 ? front : back;
  // Float: a slow tilt and bob, calmer once it has settled at the end.
  const calm = t > 9.8 ? 0.45 : 1;
  const tilt = (Math.sin(t * 1.3) * 3.2 - 1.5) * calm * Math.PI / 180;
  const bob = Math.sin(t * 1.9) * 14 * calm;
  const sx = Math.max(Math.abs(cos), 0.001), lift = 1 + (1 - Math.abs(cos)) * 0.04;
  o.save();
  o.translate(W / 2, card.cy + bob); o.rotate(tilt); o.scale(sx, lift);
  o.drawImage(shadow, -card.w / 2 - pad, -card.h / 2 - pad);
  o.drawImage(face, -card.w / 2, -card.h / 2, card.w, card.h);
  o.restore();
  // Caption types out under the card (from 0.8 s, ~16 letters/s), then the date and time.
  const typed = (text, start, cps) => text.slice(0, Math.max(0, Math.floor((t - start) * cps)));
  const captionDone = 0.8 + caption.length / 16;
  const line1 = typed(caption, 0.8, 16), line2 = typed(when, captionDone + 0.3, 18);
  const cursorOn = Math.floor(t * 2.4) % 2 === 0;
  o.textAlign = 'center';
  o.fillStyle = '#5b4b43'; o.font = "600 64px 'Archivo Narrow', sans-serif";
  const typingCaption = caption && line1.length < caption.length;
  o.fillText(line1 + (typingCaption && cursorOn ? '|' : ''), W / 2, 1650, W * 0.86);
  o.font = "400 44px 'Archivo Narrow', sans-serif"; o.fillStyle = '#85766b';
  const typingWhen = !typingCaption && line2.length < when.length;
  o.fillText(line2 + (typingWhen && cursorOn ? '|' : ''), W / 2, caption ? 1728 : 1650, W * 0.86);
}

async function recordStory(setLine = () => {}, opts = {}) {
  const { W, H, seconds, fps } = STORY;
  const story = await prepareStory(opts);
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const o = out.getContext('2d', { alpha: false });
  const type = videoRecorderType();
  if (!type) throw new Error('This browser cannot record video');
  // The recorder samples the canvas itself. (Pushing frames by hand with requestFrame froze
  // iPhone recordings after ~3 s.)
  const stream = out.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 10_000_000 });
  const chunks = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  const done = new Promise((resolve) => { recorder.onstop = resolve; });
  storyFrame(o, 0, story);
  recorder.start();
  const started = performance.now();
  let shown = -1, lastFrame = -1, drawn = 0;
  await new Promise((resolve) => {
    const frame = (now) => {
      const t = Math.min((now - started) / 1000, seconds);
      const index = Math.floor(t * fps);
      if (index !== lastFrame) { // cap at `fps` even on 120 Hz screens
        lastFrame = index;
        storyFrame(o, t, story);
        drawn += 1;
      }
      const left = Math.ceil(seconds - t);
      if (left !== shown) { shown = left; setLine(`Filming your story… ${left}s`); }
      if (t < seconds) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
  recorder.stop();
  await done;
  const mime = type.split(';')[0];
  const file = new File([new Blob(chunks, { type: mime })], `with-love-story.${mime === 'video/mp4' ? 'mp4' : 'webm'}`, { type: mime });
  reportClient('story-recording', JSON.stringify({ drawn, chunks: chunks.length, kb: Math.round(file.size / 1024), ms: Math.round(performance.now() - started), type, video: Boolean(state.video) }));
  return file;
}

// The same 9:16 story layout as a still image (card settled, words fully typed) — what Share
// hands over for photo cards, ready for an Instagram Story.
async function storyStill(opts = {}) {
  const { W, H } = STORY;
  const story = await prepareStory(opts);
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  storyFrame(out.getContext('2d', { alpha: false }), 11.6, story, { eyesOpen: true });
  const blob = await new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('export failed'))), 'image/jpeg', 0.93));
  return new File([blob], 'with-love-story.jpg', { type: 'image/jpeg' });
}

async function downloadAnimation() {
  const video = state.video;
  // Video cards: start playback from this tap (Safari may have paused or blocked it), and only
  // start filming once it is really playing, so the clip moves inside the card.
  if (video && video.el.paused) video.el.play().catch((error) => reportClient('video-play', `animation: ${error.name}`));
  const file = await withLoading('Filming your story…', async (setLine) => {
    if (video) {
      await Promise.race([video.played, new Promise((resolve) => setTimeout(resolve, 3000))]);
      if (video.el.paused) await video.el.play().catch(() => {});
    }
    const before = video && { paused: video.el.paused, t: +video.el.currentTime.toFixed(2) };
    const result = await recordStory(setLine);
    if (video) reportClient('animation-video', JSON.stringify({ before, after: { paused: video.el.paused, t: +video.el.currentTime.toFixed(2) } }));
    return result;
  });
  offerSave(file, 'Your animation is ready', 'share');
}

// Style and adjust changes update the card in place: a small badge on its corner instead of the
// full-screen loader (kept for slow things — opening a photo or video, exporting).
let quietDepth = 0;
async function inPlace(task) {
  quietDepth += 1; $('#card-stage').classList.add('updating');
  try { return await task(); } finally { quietDepth -= 1; if (!quietDepth) $('#card-stage').classList.remove('updating'); }
}
// While the card re-renders, the blinking eyes sit on it with what's happening ("Trying a new frame…").
function rerender(line = 'Updating your With Love…') {
  if (!state.file) return;
  $('#updating-line').textContent = line;
  inPlace(render).catch((error) => { console.error(error); showError('We couldn\'t update your story.', () => rerender()); });
}

function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
// Same default With Love film pass as the desktop prototype, so exports match.
function applyFilm() {
  const amount = grainAmount();
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height); const data = pixels.data; const random = seeded(3658);
  const lift = (v) => Math.max(0, Math.min(1, (v - 0.015) * 1.01 + 0.105));
  for (let i = 0; i < data.length; i += 4) {
    let r = lift(data[i] / 255), g = lift(data[i + 1] / 255), b = lift(data[i + 2] / 255);
    const luma = (r + g + b) / 3; r = luma + (r - luma) * 1.16; g = luma + (g - luma) * 1.16; b = luma + (b - luma) * 1.16;
    const grain = ((random() - 0.5) * 0.16 + (random() - 0.5) * 0.22) * amount;
    data[i] = Math.max(0, Math.min(255, (r + grain) * 255)); data[i + 1] = Math.max(0, Math.min(255, (g + grain) * 255)); data[i + 2] = Math.max(0, Math.min(255, (b + grain) * 255));
  }
  ctx.putImageData(pixels, 0, 0);
}

function renderChips() {
  const current = fields.feeling.value.trim();
  $('#feeling-chips').innerHTML = FEELINGS.map((feeling) => `<button type="button" class="chip${feeling === current ? ' active' : ''}" data-feeling="${feeling}">${feeling}</button>`).join('');
}

const PLANE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 3.5 10.2l6.8 2.9L13.2 20z M21 3l-10.7 10.1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const SAVE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0-4-4m4 4 4-4M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SPIN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="4" width="8" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 13c0 3 3.6 5.5 8 5.5s8-2.5 8-5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="m17.5 16.5 2.5 2-2.8 1.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function renderAccount() {
  renderMe();
  $('#style-card').classList.toggle('locked', !canStyle());
  // Share is also how people save to Photos (share sheet → Save Image), so guests get it too — their
  // render carries the With Love mark. The spinning animation needs an account.
  // Share = the 9:16 story frame for Instagram & co; Save = the 4:5 card alone, full quality, for
  // Photos. (The share sheet can't tell us which app they pick, so it's two buttons.)
  // Taking a With Love out of the app (share, save, the floating story) needs sign-in; guests get the
  // sign-in sheet, and their draft comes back after Google.
  const out = (action) => action;
  // Share = the 9:16 story with its background; Save = the 4:5 card; Export 3D video = the floating card.
  // (Change picture lives in the adjust tab.)
  $('#actions').innerHTML = `<button class="icon-action primary" type="button" data-action="${out('share')}" data-want="share" aria-label="Share the 9:16 story with background">${PLANE_ICON}share 9:16<small>with background</small></button>`
    + `<button class="icon-action" type="button" data-action="${out('save')}" data-want="save" aria-label="Save the 4:5 card to Photos">${SAVE_ICON}save 4:5</button>`
    // Video cards: Share already is the story video, so no separate 3D video.
    + (state.video ? '' : `<button class="icon-action" type="button" data-action="${out('animation')}" data-want="animation" aria-label="Export a 3D video of your With Love">${SPIN_ICON}export 3D video</button>`);
  $('#actions').style.gridTemplateColumns = `repeat(${state.video ? 2 : 3}, 1fr)`;
  // Adjust: dials and move & zoom are for photos; video cards still get "change picture" there.
  $('#adjust-card').classList.toggle('video', Boolean(state.video));
  $('#move-photo').hidden = Boolean(state.video);
}

function renderSwatches() {
  document.querySelectorAll('.swatches[data-group]').forEach((row) => {
    const group = row.dataset.group;
    row.innerHTML = Object.entries(state.palettes[group] || {}).map(([key, hex]) => `<button type="button" class="swatch${key === state[group] ? ' active' : ''}" data-color="${key}" style="background:${hex}" aria-label="${key} ${group}"></button>`).join('');
  });
}


// Opens the share sheet (Save Image / Save Video puts it in Photos). Must run inside a tap.
// Every With Love they really take out counts towards the home-screen offer (after the 3rd).
function countExport(file) {
  if (file?.withloveFrom === 'recap') { try { localStorage.setItem('withlove-recap-saved', '1'); } catch {} paintDropDots(); } // the frames heart can rest now
  try { localStorage.setItem('withlove-exports', String(Number(localStorage.getItem('withlove-exports') || 0) + 1)); } catch {}
  // After the share sheet closes: the survey (not taken yet) goes first, then the home-screen offer
  // (from the 3rd), otherwise the rating.
  setTimeout(() => { if (surveyDue()) { maybeAskSurvey(); return; } maybeOfferHomeScreen(); maybeAskRating(); }, 700);
}
async function shareFile(file, want = 'save') {
  const android = want === 'save' && !IS_IOS && /Android/i.test(navigator.userAgent);
  // Saving the same card again soon after an Android download usually means the first one never landed
  // (the browser ignored it, storage access was off, or it's not where they looked): use the other way.
  const again = android && Date.now() - (androidSaves.get(saveKey(file)) || 0) < ANDROID_RETRY_MS;
  if (!state.signedIn && !again) {
    if (guestExportUsed()) { openLogin(want); return; }
    if (guestExportPending) return;
    guestExportPending = true;
  }
  try {
    // Android: the share sheet has no "save" in it (people landed in Quick Share, Zalo… and couldn't
    // save), so Save downloads the file instead; it shows up in Gallery / Google Photos. iPhone keeps
    // the share sheet, which is the only way to reach "Save Image".
    if (android) {
      const image = file.type.startsWith('image/');
      // Many Android browsers (the phone makers' own, Opera, UC… mostly WebViews) quietly ignore a blob
      // download, and we can't tell whether it worked. Those get the press-and-hold sheet, which saves
      // everywhere; only the browsers that really download (Chrome, Samsung Internet, Firefox) download.
      if (IN_APP || (image && (!ANDROID_DOWNLOADS || again))) { if (image) return holdToSave(file, { counted: again, retry: again }); }
      else if (!ANDROID_DOWNLOADS || again) return await saveVideoByLink(file, { counted: again });
      else {
        track('export_done', { file: file.type, from: file.withloveFrom || null, result: 'downloaded', android: true, browser: androidBrowser() }); markGuestExportUsed(); countExport(file);
        const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = file.name; document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 60000);
        androidSaves.set(saveKey(file), Date.now());
        // Honest: the browser downloads it, we can't see the result. A tap on the note (or Save again) offers the other way.
        const otherWay = image ? () => { closeSheets(); holdToSave(file, { counted: true, retry: true }); } : () => saveVideoByLink(file, { counted: true });
        saveToast(image ? 'Downloading your With Love' : 'Downloading your video', 'Find it in Downloads. Not there? Tap here.', otherWay);
        return;
      }
    }
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // Files only: a title or text alongside makes Instagram drop out of the iOS share sheet.
      try { await navigator.share({ files: [file] }); track('export_done', { file: file.type, from: file.withloveFrom || null, result: 'shared', inApp: IN_APP || null }); markGuestExportUsed(); countExport(file); return; } catch (error) { if (error.name === 'AbortError') { track('export_done', { file: file.type, from: file.withloveFrom || null, result: 'cancelled', inApp: IN_APP || null }); return; } if (error.name !== 'NotAllowedError' && !IN_APP) throw error; }
    }
    // Inside apps a download link goes nowhere: show the picture big so a long press saves it.
    // (Videos can't be saved that way, so those go to the browser.)
    if (IN_APP) {
      if (!file.type.startsWith('image/')) { track('export_done', { file: file.type, from: file.withloveFrom || null, result: 'video_blocked', inApp: IN_APP }); showInAppGate(want); return; }
      return holdToSave(file);
    }
    // Desktop browsers (or a tap that expired): a normal download.
    track('export_done', { file: file.type, from: file.withloveFrom || null, result: 'downloaded' }); countExport(file);
    const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = file.name; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  } finally { guestExportPending = false; }
}

// Videos can't be pressed and held to save, so on the browsers that ignore a blob download the video
// goes up to our server for 10 minutes and comes back as an ordinary download link (POST /save-link),
// which every Android browser hands to its downloads.
const ANDROID_RETRY_MS = 3 * 60e3;
const androidSaves = new Map(); // card file → when it was last downloaded on Android
const saveKey = (file) => `${file.type}|${file.size}|${file.name}`;
// `counted`: a second try for the same card, not a new export.
async function saveVideoByLink(file, { counted = false } = {}) {
  let url = null;
  try {
    await withLoading('Getting your video ready…', async () => {
      const response = await fetch('/save-link', { method: 'POST', headers: { 'Content-Type': file.type, 'x-file-name': encodeURIComponent(file.name || 'With Love.mp4') }, body: file });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.url) throw new Error(body.error || 'save link failed');
      url = body.url;
    });
  } catch (error) {
    reportClient('save_link', error); track('export_done', { file: file.type, from: file.withloveFrom || null, result: 'link_failed', android: true, browser: androidBrowser() });
    saveToast('Your video didn’t save', 'Try again in a moment.'); return;
  }
  track('export_done', { file: file.type, from: file.withloveFrom || null, result: 'download_link', android: true, browser: androidBrowser(), retry: counted || null });
  if (!counted) { markGuestExportUsed(); countExport(file); }
  const link = document.createElement('a'); link.href = url; link.download = file.name || ''; document.body.append(link); link.click(); link.remove();
  androidSaves.set(saveKey(file), Date.now());
  saveToast('Downloading your video', 'Find it in Downloads.');
}

// Android browsers known to save a blob download for real. Android WebViews say "; wv)" and are left out.
const ANDROID_UA = navigator.userAgent;
const ANDROID_DOWNLOADS = /SamsungBrowser|Firefox\//i.test(ANDROID_UA)
  || (/Chrome\/\d+/.test(ANDROID_UA) && !/; wv\)|EdgA|OPR\/|OPT\/|MiuiBrowser|XiaoMi|UCBrowser|HeyTapBrowser|OppoBrowser|VivoBrowser|YaBrowser|Puffin|CocCoc|Opera/i.test(ANDROID_UA));
function androidBrowser() {
  const m = ANDROID_UA.match(/SamsungBrowser|Firefox|EdgA|OPR|OPT|MiuiBrowser|UCBrowser|HeyTapBrowser|OppoBrowser|VivoBrowser|YaBrowser|CocCoc|; wv\)|Chrome/i);
  return m ? m[0].replace('; wv)', 'webview') : 'other';
}
// A small note after a download (Android), top of the screen, gone on its own. `onTap`: what a tap on it does.
function saveToast(title, note, onTap = null) {
  const toast = $('#save-toast');
  $('#save-toast-text').innerHTML = `<span>${esc(title)}<small>${esc(note)}</small></span>`;
  toast.hidden = false; toast.classList.remove('out');
  toast.onclick = onTap ? () => { toast.hidden = true; onTap(); } : null;
  toast.style.cursor = onTap ? 'pointer' : '';
  clearTimeout(toast.hideTimer);
  toast.hideTimer = setTimeout(() => { toast.classList.add('out'); setTimeout(() => { toast.hidden = true; }, 400); }, onTap ? 6000 : 3500);
}
// `retry`: the download before it didn't seem to work, so the note says so.
function holdToSave(file, { counted = false, retry = false } = {}) {
  const img = $('#hold-card');
  if (img.src) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(file);
  $('#hold-note').textContent = `${retry ? 'Didn’t save? ' : ''}Press and hold your With Love, then tap ${IS_IOS ? '“Save to Photos”' : '“Download image” or “Save image”'}.`;
  openSheet('#hold-sheet');
  if (counted) return; // already counted by the download it backs up
  markGuestExportUsed();
  track('export_done', { file: file.type, from: file.withloveFrom || null, result: 'hold_shown', inApp: IN_APP }); countExport(file);
}

// Anything that took too long to make (the animation) is offered with a button, so the share sheet
// gets a fresh tap.
// mode 'share' (to Instagram & co) or 'save' (to Photos): the sheet says what the tap will do.
const READY_COPY = {
  share: { button: 'Share', note: 'Pick Instagram, or any app, to post your story.' },
  save: { button: 'Save to Photos', note: 'Then choose “Save Image” or “Save Video” to put it in Photos.' },
};
function offerSave(file, title, mode = 'save') {
  $('#save-title').textContent = title;
  $('#save-go').textContent = READY_COPY[mode].button;
  $('#save-note').textContent = mode === 'save' && !IS_IOS && /Android/i.test(navigator.userAgent) ? (!IN_APP && (ANDROID_DOWNLOADS || file.type.startsWith('video/')) ? 'It goes to your Downloads folder.' : 'Then press and hold it to save.') : READY_COPY[mode].note;
  $('#save-go').onclick = () => { closeSheets(); shareFile(file, mode).catch((error) => { console.error(error); showError('Saving didn’t work.', null); }); };
  openSheet('#save-sheet');
}

async function share() {
  // This tap lets Safari start a blocked video, which also starts the MP4 recording.
  if (state.video && !state.video.playing) state.video.el.play().catch(() => {});
  if (state.exportFile) return shareFile(state.exportFile, 'share');
  if (state.video) {
    const waitStart = performance.now();
    // Show the background recording's countdown while they wait.
    const file = await withLoading('Getting your video ready…', (setLine) => {
      const timer = setInterval(() => state.exportLine && setLine(state.exportLine), 250);
      return state.exportPromise.finally(() => clearInterval(timer));
    });
    reportClient('video-share-wait', `${Math.round(performance.now() - waitStart)}ms`);
    if (file) offerSave(file, 'Your video story is ready', 'share');
    return;
  }
  const file = await withLoading('Getting your story ready…', () => storyStill());
  offerSave(file, 'Your story is ready', 'share');
}

// Snapshot of the story so it survives the trip to Google and back.
function currentDraft() {
  if (!state.file) return null;
  return { file: state.video?.file || state.file, fields: Object.fromEntries(Object.entries(fields).map(([name, input]) => [name, input.value])), quotes: { top: $('#quote-top').value, bottom: $('#quote-bottom').value },
    style: { template: state.template, paper: state.paper, paperColor: state.paperColor, vectorColor: state.vectorColor, color: state.color, adjust: state.adjust, ...(state.booth && { booth: { flip: state.booth.flip } }) } };
}
// Puts a saved draft (after Google, or carried over from an app) back on screen.
async function applyDraft(draft, source) {
  Object.entries(draft.fields || {}).forEach(([name, value]) => { if (fields[name]) fields[name].value = value; });
  ['top', 'bottom'].forEach((panel) => { if (draft.quotes?.[panel] != null) $(`#quote-${panel}`).value = draft.quotes[panel]; });
  const s = draft.style || {};
  if (s.booth) return window.openBoothStudio(await splitShots(draft.file), { flip: (s.booth.flip || []).map(Boolean), adjust: s.adjust, source });
  if (gallery.byKey[s.template]) { state.template = s.template; loadFrameQuote(); ['top', 'bottom'].forEach((panel) => { if (draft.quotes?.[panel] != null) $(`#quote-${panel}`).value = draft.quotes[panel]; }); }
  if (gallery.paperByKey[s.paper] || s.paper === 'plain') state.paper = s.paper;
  ['paperColor', 'vectorColor', 'color'].forEach((group) => { if (state.palettes[group]?.[s[group]]) state[group] = s[group]; });
  renderChips(); renderSwatches(); renderPickers();
  await startWithFile(draft.file, { keepDraft: true, restoring: true, source, adjust: s.adjust });
}

// ---- Opening the real browser ----
// Threads/Instagram… keep their own storage, so when the "open in your browser" screen shows, the
// card (photo or short video, words, style) is parked on the server for up to 30 minutes. The link
// out, and the page address (which the app's ••• menu opens), carry its one-time token.
const b64url = (text) => btoa(unescape(encodeURIComponent(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (text) => decodeURIComponent(escape(atob(text.replace(/-/g, '+').replace(/_/g, '/'))));
let handoffToken = null, handoffSaving = null;
// Photos go up at most 2048 px as JPEG (a few hundred KB); videos as they are, if under 25 MB.
async function handoffFile(file) {
  if (/^video\//.test(file.type)) return file.size <= 25e6 ? file : null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch { return file.size <= 8e6 ? file : null; }
}
async function pushHandoff(want = '') {
  if (!IN_APP || state.booth) return; // photobooth photos never leave the phone (Maddy, 12 Oct 2026)
  const current = currentDraft();
  if (!current?.file) return;
  const { file, ...draft } = current;
  handoffSaving = (async () => {
    try {
      const body = await handoffFile(file);
      if (!body) return;
      const response = await fetch('/handoff', { method: 'POST', headers: { 'Content-Type': body.type || 'image/jpeg', 'x-draft': b64url(JSON.stringify({ ...draft, app: IN_APP, want })) }, body });
      const { token } = await response.json().catch(() => ({}));
      if (!token) return;
      handoffToken = token;
      // The app's ••• → "Open in browser" opens this address, so it carries the token too.
      const url = new URL(location.href); url.searchParams.set('handoff', IN_APP); url.searchParams.set('draft', token);
      history.replaceState(history.state, '', url);
    } catch {}
  })();
  return handoffSaving;
}
function queueHandoff() {} // Drafts are parked only when the "open in your browser" screen shows.
function askResume(app) {
  $('#resume-note').textContent = app ? `You started a With Love in ${app} a moment ago. Carry on with it here.` : 'You started a With Love a moment ago. Carry on with it here.';
  openSheet('#resume-sheet');
  return new Promise((resolve) => {
    const done = (answer) => { $('#resume-go').onclick = $('#resume-skip').onclick = null; $('#sheet-backdrop').removeEventListener('click', no); closeSheets(); resolve(answer); };
    const no = () => done(false);
    $('#resume-go').onclick = () => done(true); $('#resume-skip').onclick = no;
    $('#sheet-backdrop').addEventListener('click', no, { once: true });
  });
}
async function takeHandoff() {
  if (IN_APP) return null;
  const params = new URLSearchParams(location.search);
  const token = params.get('draft');
  if (!token) return null;
  // via=link: the "Open in Safari/Chrome" button; via=address: the app's own ••• menu.
  const via = params.get('from') === 'gate' ? 'link' : 'address';
  params.delete('draft'); params.delete('from');
  history.replaceState(null, '', location.pathname + (params.toString() ? `?${params}` : ''));
  try {
    const response = await fetch(`/handoff/${encodeURIComponent(token)}?via=${via}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const draft = JSON.parse(unb64url(response.headers.get('x-draft') || 'e30'));
    const type = response.headers.get('content-type') || 'image/jpeg';
    draft.file = new File([await response.blob()], /^video\//.test(type) ? (type.includes('quicktime') ? 'withlove-video.mov' : 'withlove-video.mp4') : 'withlove-photo.jpg', { type });
    return draft;
  } catch { return null; }
}

// Google's button leaves the page, so the draft is saved as soon as the login sheet opens.
// Google refuses to sign people in inside apps' built-in browsers (Instagram, Facebook, TikTok…:
// error disallowed_useragent), which is where links from social posts open. There we offer
// "open in browser" instead of a button that would fail.
function fromThreads(ua, referrer, search) {
  if (/Barcelona|Threads/i.test(ua)) return true;
  const params = new URLSearchParams(search);
  if (['utm_source', 'source', 'handoff', 'preview_inapp'].some((key) => /^threads$/i.test(params.get(key) || ''))) return true;
  try { return /(^|\.)threads\.(com|net)$/i.test(new URL(referrer).hostname); } catch { return false; }
}
const FROM_THREADS = fromThreads(navigator.userAgent, document.referrer, location.search);
const initialDefaults = (defaults) => FROM_THREADS ? { ...defaults, template: 'stamp-landscape' } : defaults;
const embeddedBrowser = (ua) => /; wv[);]|WebView/i.test(ua) || (/iPhone|iPad|iPod/i.test(ua) && !/Safari|CriOS|FxiOS|EdgiOS/i.test(ua));
const IN_APP = (() => {
  const ua = navigator.userAgent;
  const apps = [['Threads', /Barcelona|Threads/i], ['Instagram', /Instagram/i], ['Facebook', /FBAN|FBAV|FB_IAB|FBIOS/i], ['Messenger', /Messenger|FB_IAB\/Orca/i], ['TikTok', /musical_ly|TikTok|BytedanceWebview|Bytedance/i], ['Zalo', /Zalo/i], ['Line', /\sLine\//i]];
  // ?preview_inapp=Threads shows the in-app experience in a normal browser, for testing.
  const preview = new URLSearchParams(location.search).get('preview_inapp');
  return (preview && preview.slice(0, 20)) || apps.find(([, pattern]) => pattern.test(ua))?.[0] || (FROM_THREADS && embeddedBrowser(ua) ? 'Threads' : '');
})();
const IS_IOS = new URLSearchParams(location.search).get('preview_os') ? new URLSearchParams(location.search).get('preview_os') === 'ios' : /iPhone|iPad|iPod/i.test(navigator.userAgent); // ?preview_os=ios|android for testing

// Where each app keeps "open in browser" (researched Sep 2026). Unknown apps get a general wording.
const IN_APP_MENUS = {
  Instagram: { ios: ['•••', 'top right', 'Open in external browser'], android: ['⋮', 'top right', 'Open in external browser'] },
  Threads: { ios: ['•••', 'top right', 'Open in Safari'], android: ['⋮', 'top right', 'Open in browser'] },
  TikTok: { ios: ['•••', 'top right', 'Open in browser'], android: ['•••', 'top right', 'Open in browser'] },
  Facebook: { ios: ['•••', 'bottom right', 'Open in external browser'], android: ['⋮', 'top right', 'Open in external browser'] },
  Messenger: { ios: ['•••', 'top right', 'Open in browser'], android: ['⋮', 'top right', 'Open in browser'] },
};
function inAppMenu() {
  const [icon, where, option] = IN_APP_MENUS[IN_APP]?.[IS_IOS ? 'ios' : 'android'] || [IS_IOS ? '•••' : '⋮', 'top right', 'Open in browser'];
  return { icon, where, option };
}
// Fills the menu hints and points the arrow at the right corner for this app and phone.
function applyInAppMenuCopy() {
  if (!IN_APP) return;
  const { icon, where, option } = inAppMenu();
  const dots = `<span class="inapp-dots" aria-hidden="true">${icon}</span>`;
  document.querySelectorAll('.inapp-hint').forEach((el) => { el.innerHTML = `${dots} Or tap the menu at the ${where}, then <b>“${option}”</b>.`; });
  document.querySelectorAll('.handoff-help').forEach((el) => { el.innerHTML = `<b>${possessive(IN_APP)} browser blocked that.</b> Tap ${dots} at the ${where}, then <b>“${option}”</b>.`; });
  document.querySelectorAll('.menu-arrow').forEach((el) => { el.classList.toggle('at-bottom', /bottom/.test(where)); el.querySelector('span').textContent = `tap ${icon}`; });
}
const possessive = (name) => (/s$/i.test(name) ? `${name}’` : `${name}’s`); // Threads’, Instagram’s
function openInBrowserLink() {
  // ?handoff=<app> lets monitoring see who actually arrives in the real browser.
  let invite = null; try { invite = localStorage.getItem('withlove-invited-by'); } catch {}
  // …and a friend's invite code, so the real browser (where Google sign-in works) knows who invited them.
  const query = `?handoff=${encodeURIComponent(IN_APP)}${handoffToken ? `&draft=${handoffToken}&from=gate` : ''}${invite ? `&invite=${encodeURIComponent(invite)}` : ''}`;
  const url = `${location.origin}/m/${query}`;
  if (IS_IOS) return `x-safari-${url}`; // iOS 17+: hands the page to Safari
  // Android: name Chrome explicitly (Meta's apps pass that through more often), falling back to the page itself.
  return `intent://${location.host}/m/${query}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

// Apps like Threads often block the jump to the real browser: the tap registers but nothing
// happens. If the page is still showing ~1.2 s later, say so and point at the app's own ••• menu,
// which always works.
function watchHandoff(where) {
  let left = false;
  const onHide = () => { left = true; };
  document.addEventListener('visibilitychange', onHide, { once: true });
  addEventListener('pagehide', onHide, { once: true });
  setTimeout(() => {
    if (left || document.visibilityState === 'hidden') return;
    track('inapp_gate', { inApp: IN_APP, action: 'open_blocked', where });
    document.querySelectorAll('.handoff-help').forEach((el) => { el.hidden = false; el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); });
    document.querySelectorAll('.menu-arrow').forEach((el) => { el.hidden = false; });
    document.querySelectorAll('.inapp-hint').forEach((el) => { el.hidden = true; }); // the note above says the same, louder
  }, 1200);
}

async function openLogin(want = null) {
  track('login_prompt', { inApp: IN_APP || null, want }); // want: which export sent them here
  // Inside Threads/Instagram…, Google sign-in can't work: send them to their browser instead.
  if (IN_APP) { closeSheets(); showInAppGate(want); return; }
  closeSheets();
  const button = $('#login-google');
  $('#login-news').checked = false; newsPending(false); // never pre-ticked (email provider rule)
  $('#login-inapp').hidden = !IN_APP;
  button.hidden = Boolean(IN_APP);
  openSheet('#login-sheet');
  if (IN_APP) {
    $('#login-inapp-app').textContent = possessive(IN_APP);
    $('#login-open-browser').href = openInBrowserLink();
    applyInAppMenuCopy();
    return;
  }
  button.innerHTML = '<p class="sheet-note small">Saving your draft…</p>';
  await withloveAuth.prepare(currentDraft());
  withloveAuth.mountButton(button, signedInDemo);
}
// The gate: anyone who opens With Love inside an app's browser is asked to open it in their real one.
function showInAppGate(want = null) {
  if (!IN_APP) return;
  applyInAppMenuCopy();
  const lead = { share: 'To share your With Love,', save: 'To save your With Love,', animation: 'To see your With Love float,', frame: 'To try other frames,', avatar: 'To pick your picture,', survey: 'To take the survey,', perks: 'To get your invite link,', paper: 'To change the paper,', color: 'To change the colours,', pop: 'To turn the shadow off,' }[want] || 'To unlock every frame and colour,';
  $('#inapp-lead').textContent = `${lead} sign in from your browser.`;
  $('#inapp-app').textContent = possessive(IN_APP);
  document.querySelectorAll('.app-name-possessive').forEach((el) => { el.textContent = possessive(IN_APP); });
  $('#inapp-open').href = openInBrowserLink();
  // Park the card now (and why they're leaving), so the browser opens right where they are.
  // The button waits (a second or two at most) until the card is parked, so the link carries it.
  const open = $('#inapp-open');
  open.setAttribute('aria-busy', 'true');
  $('#inapp-carry').textContent = state.file ? 'Your With Love comes with you, just as it is.' : '';
  const ready = () => {
    open.href = openInBrowserLink(); open.removeAttribute('aria-busy');
    if (state.file && !handoffToken) $('#inapp-carry').textContent = 'You’ll pick your photo again there.';
  };
  Promise.race([pushHandoff(want || ''), new Promise((resolve) => setTimeout(resolve, 6000))]).then(ready);
  $('#inapp-gate').hidden = false;
  track('inapp_gate', { inApp: IN_APP, action: 'shown', want });
}
$('#inapp-close').addEventListener('click', () => { $('#inapp-gate').hidden = true; track('inapp_gate', { inApp: IN_APP, action: 'closed' }); });
$('#inapp-open').addEventListener('click', (event) => { if ($('#inapp-open').getAttribute('aria-busy')) { event.preventDefault(); return; } track('inapp_gate', { inApp: IN_APP, action: 'open_browser', draft: Boolean(handoffToken) }); watchHandoff('gate'); });
$('#login-open-browser').addEventListener('click', () => { track('login_open_browser', { inApp: IN_APP || null }); watchHandoff('login'); });

// ---- Small, one-at-a-time prompts ----
// ?reset_prompts=1 forgets which prompts this phone has seen/answered (for testing).
if (new URLSearchParams(location.search).has('reset_prompts')) {
  try { ['withlove-exports', 'withlove-rated-at', 'withlove-rate-asks', 'withlove-rate-last', 'withlove-home-done', 'withlove-home-later'].forEach((k) => localStorage.removeItem(k)); ['withlove-rate-asked', 'withlove-home-asked', 'withlove-visit'].forEach((k) => sessionStorage.removeItem(k)); } catch {}
  history.replaceState(null, '', location.pathname);
}
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
window.store = store;
const sessionOnce = (k) => { try { if (sessionStorage.getItem(k)) return false; sessionStorage.setItem(k, '1'); return true; } catch { return true; } };
// Unasked pop-ups (docs/product-ux-rules.md): none until the person has made a card this visit, then
// at most one per visit. Anything opened by a tap doesn't count.
const interrupts = { cardMade: false, used: false };
const mayInterrupt = () => interrupts.cardMade && !interrupts.used && !somethingOpen() && !document.querySelector('dialog[open]');
const usedInterrupt = () => { interrupts.used = true; };
const somethingOpen = () => [...document.querySelectorAll('.sheet, .inapp-gate, .home-gate, .appstore-live')].some((el) => !el.hidden) || !$('#loading').hidden;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// ---- Rating: after a share/save (from the 1st). Never again once they answer (the server also
// remembers, per browser and per account). Closed without answering: asked at most twice more,
// at least 3 days apart. ----
// Love level (5 hearts) + what could be better (pick any) + their own words.
let rating = 0;
const LOVE = ['', 'not yet', 'it’s okay', 'I like it', 'I really like it', 'I love it!'];
function paintHearts() {
  document.querySelectorAll('#rate-row [data-rating]').forEach((b) => { const on = Number(b.dataset.rating) <= rating; b.classList.toggle('on', on); b.setAttribute('aria-checked', Number(b.dataset.rating) === rating); });
  $('#rate-level').textContent = rating ? `${rating}/5 · ${LOVE[rating]}` : 'tap a heart';
  $('#rate-send').disabled = !rating;
}
function maybeAskRating() {
  if (IN_APP || !mayInterrupt() || store.get('withlove-rated-at')) return; // answered once: never again
  if (Number(store.get('withlove-exports') || 0) < 1) return; // only after their 1st share/save
  const asks = Number(store.get('withlove-rate-asks') || 0), last = Number(store.get('withlove-rate-last') || 0);
  if (asks >= 3 || Date.now() - last < 3 * 86400e3) return;
  if (!sessionOnce('withlove-rate-asked')) return;
  store.set('withlove-rate-asks', String(asks + 1)); store.set('withlove-rate-last', String(Date.now()));
  usedInterrupt();
  rating = 0; paintHearts();
  document.querySelectorAll('#rate-improve .chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
  $('#rate-message').value = ''; $('#rate-status').textContent = '';
  $('#rate-form').hidden = false; $('#rate-thanks').hidden = true;
  openSheet('#rate-sheet');
  track('feedback_prompt', { action: 'shown' });
}
$('#rate-row').addEventListener('click', (event) => {
  const b = event.target.closest('[data-rating]'); if (!b) return;
  rating = Number(b.dataset.rating); paintHearts();
  b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
});
$('#rate-improve').addEventListener('click', (event) => {
  const c = event.target.closest('[data-improve]'); if (!c) return;
  c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') !== 'true');
});
$('#rate-send').addEventListener('click', async () => {
  if (!rating) return;
  const improve = [...document.querySelectorAll('#rate-improve .chip[aria-pressed="true"]')].map((c) => c.dataset.improve);
  const words = $('#rate-message').value.trim();
  $('#rate-send').disabled = true; $('#rate-status').textContent = 'Sending…';
  try {
    const response = await fetch('/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating, message: words, page: location.pathname, context: { from: 'after_render', improve, photo: state.photoId, template: state.template, video: Boolean(state.video), signedIn: state.signedIn } }) });
    if (!response.ok) throw new Error('send failed');
    store.set('withlove-rated-at', String(Date.now()));
    track('feedback_prompt', { action: 'sent', rating, improve, words: Boolean(words) });
    $('#rate-form').hidden = true; $('#rate-thanks').hidden = false;
  } catch { $('#rate-status').textContent = 'Couldn’t send. Try again in a moment.'; $('#rate-send').disabled = false; }
});

// ---- Home screen: offered after the 3rd With Love they take out ----
// Android Chrome/Edge/Samsung give us a real install prompt; iPhone and the rest get the steps for
// their browser (researched Sep 2026: Apple & Google help pages, iOS 26 Safari's ••• → Share).
let installPrompt = null;
addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event; });
addEventListener('appinstalled', () => { store.set('withlove-home-done', '1'); track('home_screen', { action: 'installed' }); });
// iPhones never say when With Love was added; the first launch from the icon is the sign (the icon
// gets its own storage, so this fires once per install).
if (standalone() && !store.get('withlove-icon-opened')) { store.set('withlove-icon-opened', '1'); track('home_screen', { action: 'first_open', browser: IS_IOS ? 'ios' : 'android' }); }
function browserKind(ua = navigator.userAgent) {
  if (/iPhone|iPod/i.test(ua) || (IS_IOS && ua === navigator.userAgent)) {
    if (/CriOS/i.test(ua)) return 'chrome-ios';
    if (/FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/i.test(ua)) return 'other-ios';
    // Safari 26 reports "Version/26" (the iOS number in its user agent is frozen at 18_x).
    const v = Number((ua.match(/Version\/(\d+)/) || [])[1] || 0);
    return v >= 26 ? 'safari-26' : 'safari';
  }
  if (/Android/i.test(ua)) {
    // Android: Chrome (and Samsung's own browser), which is where almost everyone is.
    return /SamsungBrowser/i.test(ua) ? 'samsung' : 'chrome-android';
  }
  return 'desktop';
}
const GLYPH = {
  share: '<span class="glyph"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v9h14v-9h-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>',
  dots: '<span class="glyph">•••</span>', kebab: '<span class="glyph">⋮</span>', lines: '<span class="glyph">≡</span>',
};
const HOME_STEPS = {
  'safari-26': { pointer: 'bottom right', label: 'tap •••', steps: [`Tap ${GLYPH.dots} next to the address bar<span class="note">At the bottom right. If your address bar is at the top, it’s up there.</span>`, `Tap <b>Share</b> ${GLYPH.share}`, 'Scroll down, tap <b>Add to Home Screen</b>', 'Keep <b>Open as Web App</b> on, then tap <b>Add</b>'] },
  safari: { pointer: 'bottom center', label: 'tap share', steps: [`Tap <b>Share</b> ${GLYPH.share} at the bottom`, 'Scroll down, tap <b>Add to Home Screen</b><span class="note">Not there? Tap Edit Actions at the bottom and add it.</span>', 'Tap <b>Add</b> at the top right'] },
  'chrome-ios': { pointer: 'top right', label: 'tap share', steps: [`Tap <b>Share</b> ${GLYPH.share} on the right of the address bar`, 'Tap <b>Add to Home Screen</b>', 'Tap <b>Add</b>'] },
  'other-ios': { pointer: null, steps: [`Open the browser menu and tap <b>Share</b> ${GLYPH.share}`, 'Tap <b>Add to Home Screen</b>', 'Tap <b>Add</b><span class="note">Easiest in Safari: open With Love.techieslab.app there.</span>'] },
  'chrome-android': { pointer: 'top right', label: 'tap ⋮', steps: [`Tap ${GLYPH.kebab} at the top right`, 'Tap <b>Install app</b> or <b>Add to home screen</b><span class="note">On newer Chrome it says “Install and create shortcut”.</span>', 'Tap <b>Install</b> (or <b>Add</b>)'] },
  samsung: { pointer: 'bottom right', label: 'tap ≡', steps: [`Tap ${GLYPH.lines} at the bottom right`, 'Tap <b>Add page to</b>', 'Tap <b>Home screen</b>, then <b>Add</b>'] },
};
function renderPhoneDemo() {
  // Stand-in icons (colours + names, not the real logos) around With Love.
  const app = (name, bg, fg, glyph) => `<div class="demo-app"><i style="background:${bg};color:${fg}">${glyph}</i>${name}</div>`;
  $('#phone-grid').innerHTML = [
    app('Goodreads', '#f4f1ea', '#553b08', 'g'), '<div class="demo-app With Love"><i><img src="./icon-192.png" alt=""></i><b>With Love</b></div>', app('Pinterest', '#e60023', '#fff', 'P'), app('Spotify', '#1ed760', '#121212', '≋'),
  ].join('');
}
function maybeOfferHomeScreen() {
  if (IN_APP || standalone() || store.get('withlove-home-done') || browserKind() === 'desktop') return;
  if (Number(store.get('withlove-exports') || 0) < 3 || Date.now() < Number(store.get('withlove-home-later') || 0)) return;
  if (!mayInterrupt() || !sessionOnce('withlove-home-asked')) return;
  usedInterrupt();
  renderPhoneDemo();
  $('#home-intro').hidden = false; $('#home-steps').hidden = true;
  $('#home-sheet').hidden = false;
  track('home_screen', { action: 'shown', browser: browserKind() });
}
$('#home-later').addEventListener('click', () => {
  store.set('withlove-home-later', String(Date.now() + 3 * 86400e3)); // ask again after 3 days
  $('#home-sheet').hidden = true;
  track('home_screen', { action: 'later', browser: browserKind() });
});
// The steps (or Android's own install sheet). Reached two ways: "Add it" in the 3rd-download
// modal, or straight from the [add app to phone] button in the header (no yes/no first).
async function showHomeGuide(from) {
  const kind = browserKind();
  track('home_screen', { action: 'add', browser: kind, native: Boolean(installPrompt), from });
  store.set('withlove-home-done', '1'); // they've started it: don't offer the modal again
  if (installPrompt) { // Android: the browser's own install sheet
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
    installPrompt = null;
    track('home_screen', { action: outcome === 'accepted' ? 'native_accepted' : 'native_dismissed', browser: kind });
    if (outcome === 'accepted') { store.set('withlove-home-done', '1'); $('#home-sheet').hidden = true; return; }
  }
  const guide = HOME_STEPS[kind] || HOME_STEPS['other-ios'];
  $('#home-steps-list').innerHTML = guide.steps.map((step) => `<li><span>${step}</span></li>`).join('');
  $('#home-intro').hidden = true; $('#home-steps').hidden = false;
  // No floating arrow: it covered the header button. The numbered steps say where to tap.
  $('#home-sheet').hidden = false;
}
$('#home-add').addEventListener('click', () => showHomeGuide('modal'));
// Signed in, on a phone, not yet on the home screen: the header chip offers the app.
const canAddToPhone = () => !IN_APP && !standalone() && browserKind() !== 'desktop';
$('#home-done').addEventListener('click', () => { $('#home-sheet').hidden = true; track('home_screen', { action: 'steps_done', browser: browserKind() }); });

// Demo sign-in (no Google config) stays on the page, so the saved draft isn't needed.
async function signedInDemo(session) {
  closeSheets();
  await withloveAuth.takeDraft();
  state.signedIn = session.signedIn;
  renderAccount();
  // Draft (photo + fields) is untouched; re-render drops the guest mark.
  rerender('Restoring your draft…');
}

async function signOut() {
  await withLoading('Signing you out…', async () => { await withloveAuth.signOut(); });
  state.signedIn = false;
  state.news = null; newsLoaded = null; newsKnown = false;
  Object.assign(state, { template: state.defaults.template, paper: state.defaults.paper, paperColor: state.defaults.paperColor, vectorColor: state.defaults.vectorColor, color: state.defaults.color });
  renderSwatches(); renderAccount(); renderPickers(); loadFrameQuote(); rerender();
}


// ---- Frame & paper galleries -------------------------------------------------
const gallery = { revision: null, templates: [], papers: [], themes: {}, byKey: {}, paperByKey: {}, theme: 'foryou', masks: new Map(), drawToken: 0 };
window.gallery = gallery;
// Suggestions only use signals we actually have: the chosen feeling and what this device used before.
const FEELING_THEMES = { cozy: ['nature', 'ornaments'], happy: ['stars', 'animals'], calm: ['nature'], nostalgic: ['ornaments'], grateful: ['words', 'nature'], giddy: ['animals', 'quirky'] };
const BOOTH_TILE = '__booth'; // the photobooth's tile under the October chip (booth.js)
const NEW_DROP = 'october'; // the theme of the latest frame drop: boxed and labelled "new drop"
// The October page in parts (Maddy, 11 Oct 2026), by frame key. A new October frame whose key fits none
// of these still shows, under "More October".
// Each part is also a sub-chip under the October chip, in Maddy's order, with "All" (every part) last.
// The photobooth lives in "We fell in love", as its big card on top (Maddy, 11 Oct 2026).
const OCTOBER_GROUPS = [['love', 'We fell in love in October', /^oct-(fell-in-love|so-pretty)/], ['maple', 'Maple leaf', /^oct-(maple|autumn)/], ['halloween', 'Halloween', /^oct-(trick|wink)/], ['sangthu', 'Sang thu', /^oct-sang-thu/]];
const NEW_LANGS = ['vi']; // quote languages wearing a "new" label on their sub-chip
// The quote frames ("words") come in languages (Maddy, 11 Oct 2026): sub-chips English, Vietnamese…, then (+)
// to suggest a quote from your country. A frame is English unless its key says quote-<code>-…
// (quote-vi-tao-ba-khi). A new language shows up as its own sub-chip once its first frame is published.
const QUOTES = 'words', NEW_CHIPS = [NEW_DROP, QUOTES];
const languageName = (code) => { try { return new Intl.DisplayNames([code], { type: 'language' }).of(code).replace(/^./, (c) => c.toUpperCase()); } catch { return code; } };
const quoteLanguage = (key) => /^quote-([a-z]{2})-/.exec(key)?.[1] || 'en';
function quoteLanguages() { const codes = new Set(gallery.templates.filter((t) => t.themes.includes(QUOTES)).map((t) => quoteLanguage(t.key))); return ['en', ...[...codes].filter((c) => c !== 'en').sort()]; }
// The drop's frames come in a different order for each browser (always the same order in that browser),
// so no version gets more taps just for being first: the Frames table on /monitoring compares them fairly.
function dropOrder(keys) {
  let seed = 0;
  try { seed = Number(localStorage.getItem('withlove-drop-order')) || 0; if (!seed) { seed = 1 + Math.floor(Math.random() * 2 ** 31); localStorage.setItem('withlove-drop-order', String(seed)); } } catch { seed = 1 + Math.floor(Math.random() * 2 ** 31); }
  const rank = (k) => { let h = seed; for (const c of k) h = Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0; return h; };
  return [...keys].sort((a, b) => rank(a) - rank(b));
}
const EASY_STARTS = ['stars', 'star-heart', 'sparkle-ring', 'heart'];
// Picked from the camera: stamps first (Stamp landscape is the most-used frame overall), then the
// frames people make the most (render counts, Sep 2026).
const CAMERA_FAVOURITES = ['star-swarm', 'star-confetti', 'five-moons', 'burst', 'star-rain', 'hare-leap'];
const RECENT_KEY = 'withlove-recent-templates';

function readRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } }
function rememberTemplate(key) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([key, ...readRecent().filter((k) => k !== key)].slice(0, 6))); } catch {}
}

function requireLogin(want = 'frame') { openLogin(want); }

// Phones hand over 12MP originals (several MB); the export is only 1080px wide. Shrinking to
// 1600px on the phone makes every upload ~10x smaller, and every re-render reuses it.
const UPLOAD_MAX = 1600;
async function shrinkForUpload(file) {
  try {
    const bitmap = await createImageBitmap(file); // Safari decodes HEIC and applies the EXIF rotation
    const scale = Math.min(1, UPLOAD_MAX / Math.max(bitmap.width, bitmap.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bitmap.width * scale); c.height = Math.round(bitmap.height * scale);
    c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file; // e.g. HEIC in a browser that can't decode it: the server converts the original
  }
}

async function photoForThumbs(file) {
  try { return await createImageBitmap(file, { resizeWidth: 480, resizeQuality: 'medium' }); } catch {}
  try { return await createImageBitmap(file); } catch { return null; } // e.g. HEIC outside Safari: shapes-only previews
}

function maskImage(key) {
  if (!gallery.masks.has(key)) {
    gallery.masks.set(key, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        if (key !== 'stars') {
          img.src = 'template-mask/stars.svg';
        } else {
          reject(new Error(`Failed to load mask: ${key}`));
        }
      };
      const raw = gallery.byKey[key]?.mask || `template-mask/${key}.svg`;
      img.src = raw.replace(/^\//, '').split('?')[0];
    }));
  }
  return gallery.masks.get(key);
}

// Same composition as the export's top panel: mask at 78% of an 8:5 panel, photo shown through it.
async function drawFrameThumb(target, key) {
  const img = await maskImage(key);
  const { width: w, height: h } = target;
  const out = target.getContext('2d');
  out.fillStyle = state.palettes?.paperColor?.[state.paperColor] || '#faf9f6';
  out.fillRect(0, 0, w, h);
  const layer = document.createElement('canvas'); layer.width = w; layer.height = h;
  const lc = layer.getContext('2d');
  const fit = gallery.byKey[key]?.scale ?? 0.78;
  const scale = Math.min((w * fit) / img.naturalWidth, (h * fit) / img.naturalHeight);
  const mw = img.naturalWidth * scale, mh = img.naturalHeight * scale;
  lc.drawImage(img, (w - mw) / 2, (h - mh) / 2, mw, mh);
  lc.globalCompositeOperation = 'source-in';
  const photo = state.photoBitmap;
  if (photo) {
    const cover = Math.max(w / photo.width, h / photo.height);
    lc.drawImage(photo, (w - photo.width * cover) / 2, (h - photo.height * cover) / 2, photo.width * cover, photo.height * cover);
  } else {
    lc.fillStyle = '#4a4038'; lc.fillRect(0, 0, w, h);
  }
  out.drawImage(layer, 0, 0);
}

function paperThumbUrl(key) {
  const raw = gallery.paperByKey[key]?.thumb || `paper-thumb/${key}.jpg`;
  return raw.replace(/^\//, '').split('?')[0];
}

// A frame's words are part of its design: switching frames loads that frame's words,
// which the user can then edit or clear.
function loadFrameQuote() {
  const quote = gallery.byKey[state.template]?.quote;
  $('#quote-card').hidden = !quote;
  ['top', 'bottom'].forEach((panel) => {
    const field = $(`#quote-${panel}`);
    field.hidden = quote?.[panel] == null;
    field.value = quote?.[panel] ?? '';
  });
  $('#quote-hint').hidden = !quote || !Object.values(quote).some((text) => text?.includes('|'));
}

function renderPickers() {
  if (!gallery.byKey[state.template]) return;
  $('#frame-name').textContent = gallery.byKey[state.template].name;
  drawFrameThumb($('#frame-thumb'), state.template).catch((error) => console.warn('frame thumb', error));
  $('#paper-name').textContent = gallery.paperByKey[state.paper]?.name || '';
  $('#pop-row').hidden = Boolean(gallery.byKey[state.template].stamp); // stamps always sit on a shadow
  $('#pop-toggle').setAttribute('aria-checked', state.pop);
  $('#paper-thumb').src = paperThumbUrl(state.paper);
}

function tileHtml(key, name, selected, art) {
  const locked = !canStyle() && !selected;
  return `<button type="button" class="tile${selected ? ' selected' : ''}" data-key="${key}" aria-pressed="${selected}" aria-label="${esc(name)}${locked ? ' (sign in to use)' : ''}">
    <span class="tile-art">${art}<img class="tile-blink" src="./blink.gif" alt="" /></span>${gallery.byKey[key]?.quote ? '<span class="tile-quote" title="comes with words">Aa</span>' : ''}
    <span class="tile-name">${esc(name)}</span></button>`;
}

function frameSections() {
  const all = gallery.templates;
  if (gallery.theme === 'all') return [{ title: `All frames · ${all.length}`, keys: all.map((t) => t.key) }];
  if (gallery.theme !== 'foryou') {
    const keys = all.filter((t) => t.themes.includes(gallery.theme)).map((t) => t.key);
    // October: the photobooth first (booth.js), then the month's frames by kind, each in this browser's order.
    if (gallery.theme === 'october') {
      const left = new Set(keys), parts = OCTOBER_GROUPS.map(([id, title, match]) => ({ id, title, keys: [...(id === 'love' ? [BOOTH_TILE] : []), ...dropOrder(keys.filter((k) => match.test(k) && left.delete(k)))] }));
      const pick = gallery.octoberPart || 'all';
      if (pick === 'all') return [...parts, { title: 'More October', keys: dropOrder([...left]) }].filter((part) => part.keys.length);
      return parts.filter((p) => p.id === pick);
    }
    if (gallery.theme === QUOTES) { const lang = gallery.quoteLang || 'en'; return [{ title: `${gallery.themes[QUOTES]} · ${languageName(lang)}`, keys: keys.filter((k) => quoteLanguage(k) === lang) }]; }
    return [{ title: gallery.themes[gallery.theme], keys: gallery.theme === NEW_DROP ? dropOrder(keys) : keys }];
  }
  const seen = new Set(), sections = [];
  const add = (title, keys, extra = {}) => { const fresh = keys.filter((k) => gallery.byKey[k] && !seen.has(k)); fresh.forEach((k) => seen.add(k)); if (fresh.length) sections.push({ title, keys: fresh, ...extra }); };
  // The newest drop gets its own box further down, so the favourites (stamps, stars) stay up top.
  const drop = dropOrder(all.filter((t) => t.themes.includes(NEW_DROP)).map((t) => t.key)), notDrop = (keys) => keys.filter((k) => !drop.includes(k));
  const addDrop = () => add(gallery.themes[NEW_DROP], drop, { drop: true });
  if (gallery.forCamera) {
    add('Stamps · made for the camera', all.filter((t) => t.stamp).map((t) => t.key));
    add('You used recently', readRecent());
    add('Most loved', CAMERA_FAVOURITES);
    add(gallery.themes.maddy, notDrop(all.filter((t) => t.themes.includes('maddy')).map((t) => t.key)));
    addDrop();
    return sections;
  }
  const feeling = fields.feeling.value.trim().toLowerCase();
  if (FEELING_THEMES[feeling]) add(`Because you feel ${feeling}`, notDrop(all.filter((t) => t.themes.some((th) => FEELING_THEMES[feeling].includes(th))).map((t) => t.key)).slice(0, 6));
  add('You used recently', readRecent());
  add('Most loved · stamps & stars', [...all.filter((t) => t.stamp).map((t) => t.key), ...CAMERA_FAVOURITES]);
  add(gallery.themes.maddy, notDrop(all.filter((t) => t.themes.includes('maddy')).map((t) => t.key)));
  addDrop();
  add('Easy starts', EASY_STARTS);
  return sections;
}

// The October chip wears autumn stickers cut from Maddy's photos (dot-overlay-engine/make_october_stickers.py),
// the way the September recap chip wore gems.
const OCTOBER_STICKERS = [['maple', 4, 18, 24, -18], ['acorn', 30, -6, 17, 12], ['oak', 70, 104, 20, 28], ['pumpkin', 98, 22, 22, 8], ['maple', 88, -4, 14, 40]];
// The photobooth's card: wider than a frame tile, its example With Loves taking turns (couple stills Maddy
// picked, cropped by dot-overlay-engine/make_booth_examples.py), so it reads as something to try, not a frame.
const BOOTH_EXAMPLES = ['pride-prejudice', 'rooftop-camera', 'better-days', '500-days'];
const boothHeroHtml = () => `<button type="button" class="tile booth-hero" data-key="${BOOTH_TILE}" aria-label="Photobooth: two photos on one With Love">
  <span class="booth-hero-cards">${BOOTH_EXAMPLES.map((n, i) => `<img src="./booth/examples/${n}.jpg" alt="" style="--i:${i}" loading="lazy" />`).join('')}</span>
  <span class="booth-hero-text"><b>Photobooth <span class="drop-badge">new</span></b><span>Two photos, one With Love. Snap you, then your person.</span><span class="booth-hero-go">Try it ✦</span></span></button>`;
function decorateOctoberChip(chip) {
  if (chip.dataset.decorated) return; chip.dataset.decorated = '1';
  for (const [name, x, y, size, turn] of OCTOBER_STICKERS) {
    const i = document.createElement('i'); i.className = 'sticker';
    i.style.cssText = `left:${x}%;top:${y}%;width:${size}px;height:${size}px;--r:${turn}deg;background-image:url('october/%24%7bname%7d.png')`;
    chip.appendChild(i);
  }
}
function renderFrameGallery() {
  const themes = Object.entries(gallery.themes); if (!gallery.themes.october) themes.unshift(['october', 'October']); // the photobooth lives under it
  const first = NEW_CHIPS.map((k) => themes.find(([key]) => key === k)).filter(Boolean); // the new ones up front
  const chips = [['foryou', 'For you'], ...first, ['all', 'All'], ...themes.filter(([k]) => !NEW_CHIPS.includes(k))]
    .map(([key, label]) => `<button type="button" class="theme-chip${key === gallery.theme ? ' active' : ''}${key === 'october' ? ' october-chip' : ''}" data-theme="${key}">${label}${NEW_CHIPS.includes(key) ? '<span class="drop-badge">new</span>' : ''}</button>`);
  // The September recap (recap.js) while it runs: a jewelled chip right after "For you" that opens the recap.
  if (typeof recapOn === 'function' && recapOn()) chips.splice(1, 0, '<button type="button" class="theme-chip recap-chip" data-recap="1">September recap ✦</button>');
  $('#theme-chips').innerHTML = chips.join('');
  const recapChip = $('#theme-chips .recap-chip'); if (recapChip) bedazzle(recapChip, CHIP_BEADS);
  const octoberChip = $('#theme-chips .october-chip'); if (octoberChip) decorateOctoberChip(octoberChip);
  $('#frame-hint').textContent = gallery.forCamera ? 'Tap one to shoot with it.' : state.photoBitmap ? 'Previewed with your photo.' : 'Shape previews: your photo shows through the frame.';
  $('#frame-sheet').classList.toggle('october-page', gallery.theme === 'october');
  // Sub-chips: the October parts, or inside the quotes chip one per language then (+) to suggest a quote from your country.
  const sub = $('#quote-chips'); sub.hidden = gallery.theme !== QUOTES && gallery.theme !== 'october';
  // Only parts that have frames (We fell in love always has the photobooth).
  const octKeys = gallery.templates.filter((t) => t.themes.includes('october')).map((t) => t.key);
  if (gallery.theme === 'october') sub.innerHTML = [...OCTOBER_GROUPS.filter(([id, , match]) => id === 'love' || octKeys.some((k) => match.test(k))), ['all', 'All']].map(([id, label]) => `<button type="button" class="theme-chip sub-chip${id === (gallery.octoberPart || 'all') ? ' active' : ''}" data-part="${id}">${label}</button>`).join('');
  if (gallery.theme === QUOTES) sub.innerHTML = [...quoteLanguages().map((c) => `<button type="button" class="theme-chip sub-chip${c === (gallery.quoteLang || 'en') ? ' active' : ''}" data-lang="${c}">${languageName(c)}${NEW_LANGS.includes(c) ? '<span class="drop-badge">new</span>' : ''}</button>`),
    '<button type="button" class="theme-chip sub-chip suggest-chip" data-suggest="quote" aria-label="Suggest a funny quote from your country">+ your country</button>'].join('');
  $('#frame-gallery').innerHTML = frameSections().map(({ title, keys, drop }) => { const grid = `<p class="gallery-section">${title}${drop ? ' <span class="drop-badge">new drop ✦</span>' : ''}</p><div class="tile-grid">${keys
    .map((key) => (key === BOOTH_TILE ? boothHeroHtml() : tileHtml(key, gallery.byKey[key].name, key === state.template, '<canvas width="330" height="206"></canvas>'))).join('')}</div>`; return drop ? `<div class="gallery-drop">${grid}</div>` : grid; }).join('');
  const token = ++gallery.drawToken;
  (async () => {
    // Draw one tile at a time so opening the sheet stays smooth; each tile blinks until its preview lands.
    for (const tile of $('#frame-gallery').querySelectorAll('.tile')) {
      if (token !== gallery.drawToken) return;
      if (tile.dataset.key === BOOTH_TILE) { tile.querySelector('.tile-blink')?.remove(); continue; }
      try { await drawFrameThumb(tile.querySelector('canvas'), tile.dataset.key); } catch (error) { console.warn('thumb', tile.dataset.key, error); }
      tile.querySelector('.tile-blink')?.remove();
    }
  })();
}

// Sparkle dots on the camera's frames button while there's a drop this phone hasn't looked at yet.
// While the September recap runs, the heart stays until this phone has made AND shared or saved a recap.
const dropSeen = () => { try { return localStorage.getItem('withlove-drop-seen') === NEW_DROP; } catch { return true; } };
const recapPending = () => { try { return typeof recapOn === 'function' && recapOn() && !localStorage.getItem('withlove-recap-saved'); } catch { return false; } };
function paintDropDots() { $('#camera-frame .new-dots').hidden = dropSeen() && !recapPending(); }
function openFrameGallery({ camera = false } = {}) {
  try { localStorage.setItem('withlove-drop-seen', NEW_DROP); } catch {}
  paintDropDots();
  gallery.theme = 'foryou'; gallery.forCamera = camera;
  renderFrameGallery();
  openSheet('#frame-sheet');
  $('#frame-gallery').parentElement.scrollTop = 0; $('#theme-chips').scrollLeft = 0;
}

function renderPaperGallery() {
  $('#paper-gallery').innerHTML = gallery.papers.map(({ key, name }) => tileHtml(key, name, key === state.paper, `<img src="${paperThumbUrl(key)}" alt="" onload="this.nextElementSibling?.remove()" />`)).join('');
}

function openPaperGallery() {
  renderPaperGallery();
  openSheet('#paper-sheet');
}

let refreshingCatalog = false;
async function refreshContentCatalog() {
  if (refreshingCatalog) return;
  refreshingCatalog = true;
  try {
    let update = window.CATALOG_DATA;
    try {
      const response = await fetch('catalog.json');
      if (response.ok) update = await response.json();
    } catch {}
    if (!update) return;
    Object.assign(gallery, { revision: update.revision, templates: update.templates, papers: update.papers, themes: update.themes });
    Object.assign(gallery.byKey, Object.fromEntries([...update.templates, ...(update.archivedTemplates || [])].map(t => [t.key, t])));
    Object.assign(gallery.paperByKey, Object.fromEntries([...update.papers, ...(update.archivedPapers || [])].map(p => [p.key, p])));
    state.palettes = { paperColor: update.colors.paper, vectorColor: update.colors.vector, color: update.colors.text };
    gallery.masks.clear(); motifCache.clear(); cam.motifKey = '';
    renderSwatches(); renderPickers();
  } catch {}
  finally { refreshingCatalog = false; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshContentCatalog(); });

async function boot() {
  await withLoading('Waking up the film lab…', async () => {
    let session = { email: 'guest@withlove.local', name: 'Guest', avatar: '', signedIn: true, defaults: { template: 'stars', paper: 'crumpled', paperColor: 'white', vectorColor: 'white', color: 'yellow' }, feedback: false };
    try { session = await withloveAuth.ready(); } catch {}
    let cat = window.CATALOG_DATA;
    if (!cat) {
      try { cat = await fetch('catalog.json').then((r) => r.json()); } catch {}
    }
    const templates = cat?.templates || [];
    const papers = cat?.papers || [];
    const themes = cat?.themes || {};
    const colors = cat?.colors || { paper: { white: '#FAF9F6', yellow: '#FFF1BF', blue: '#D6ECFF', pink: '#FFDDEA', green: '#DDF5DF' }, vector: { white: '#FFFFFF', yellow: '#FFE9A8', blue: '#AEDBFF', pink: '#FFC2DA', green: '#C3F0CA' }, text: { yellow: '#FFE9A8', blue: '#AEDBFF', pink: '#FFC2DA', green: '#C3F0CA' } };
    Object.assign(gallery, { revision: cat?.revision || '1', templates, papers, themes, byKey: Object.fromEntries(templates.map((t) => [t.key, t])), paperByKey: Object.fromEntries(papers.map((p) => [p.key, p])) });
    const defaults = initialDefaults(session.defaults || { template: 'stars', paper: 'crumpled', paperColor: 'white', vectorColor: 'white', color: 'yellow' });
    state.me = { email: session.email, name: session.name, avatar: session.avatar };
    state.surveyed = true;
    state.signedIn = true;
    Object.assign(state, { feedbackOn: false, defaults, template: defaults.template, paper: defaults.paper, paperColor: defaults.paperColor, vectorColor: defaults.vectorColor, color: defaults.color, palettes: { paperColor: colors.paper, vectorColor: colors.vector, color: colors.text } });
  });
  await refreshContentCatalog();
  renderSwatches(); renderAccount(); renderPickers(); loadFrameQuote();
  $('#camera-button')?.addEventListener('click', (e) => { e.preventDefault(); openHome(); });
  $('.home-wordmark')?.addEventListener('click', () => { show('landing'); });
  const draft = await withloveAuth.takeDraft().catch(() => null);
  if (draft?.file) { await applyDraft(draft, 'restore'); return; }
  openHome();
}

// Straight to the photo picker: no With Love sheet in between.
const openLibrary = () => $('#upload-input').click();
$('#camera-button').addEventListener('click', () => openStartChooser()); // recap.js: camera or the September recap

// ---- Camera (in-app and browser) ----
// The viewfinder shows the bottom panel live: the camera image with the frame's motif painted on
// top (in the chosen vector colour). "change frame" opens the frame list with stamps first; in-app
// visitors can pick frames there without using editor changes.
const cam = { stream: null, el: null, running: false, facing: 'environment', requestId: 0, motif: null, motifKey: '', z: 1, lensFactor: 1, digital: 1, lenses: {}, mode: 'photo', recorder: null };
window.cam = cam;
const motifCache = new Map(); // `${template}:${colour}` → tinted canvas
function stopCamera() {
  cam.requestId += 1; // discard a permission request still pending when the user leaves/switches
  cam.running = false;
  cam.stream?.getTracks().forEach((track) => track.stop());
  cam.stream = null;
  if (cam.el) { cam.el.pause(); cam.el.srcObject = null; cam.el.remove(); cam.el = null; }
}
// Let go of the camera whenever the page is hidden (another app, lock screen, another tab) and pick it
// up again on return. Holding it in the background is what left iOS 15/16 Safari stuck with AbortError
// on the next open ("worked the first time, not the second").
let cameraPaused = null;
function pauseCameraForBackground() {
  if (!cam.running || screens.camera.hidden || cam.recorder?.state === 'recording') return;
  cameraPaused = { facing: cam.facing, z: cam.z };
  stopCamera();
}
function resumeCameraAfterBackground() {
  if (!cameraPaused || document.hidden) return;
  const { facing, z } = cameraPaused; cameraPaused = null;
  if (!screens.camera.hidden) openCamera(facing, { z: z || 1 });
}
document.addEventListener('visibilitychange', () => (document.hidden ? pauseCameraForBackground() : resumeCameraAfterBackground()));
addEventListener('pagehide', pauseCameraForBackground);
addEventListener('pageshow', (event) => { if (event.persisted) resumeCameraAfterBackground(); });
function cameraConstraints(facing, exact = false) {
  return { video: { facingMode: exact ? { exact: facing } : { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false };
}
async function requestCamera(facing, deviceId = null) {
  const plain = () => navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: facing }, audio: false });
  try { return await requestCameraOnce(facing, deviceId); } catch (error) {
    // Older iPhones (iOS 16/17) sometimes abort a request with a resolution hint; plain constraints work.
    if (error?.name !== 'AbortError' && error?.name !== 'OverconstrainedError') throw error;
    reportClient('camera-retry', `${error.name}: plain constraints`);
    try { return { stream: await plain(), facing }; } catch (again) {
      // iOS 15/16 Safari: the camera can still be held by an interrupted capture for a moment. Wait, try once more.
      if (again?.name !== 'AbortError' && again?.name !== 'NotReadableError') throw again;
      await new Promise((resolve) => setTimeout(resolve, 600));
      reportClient('camera-retry', `${again.name}: after a pause`);
      return { stream: await plain(), facing };
    }
  }
}
async function requestCameraOnce(facing, deviceId = null) {
  // A specific back lens (0.5× ultra wide / 2× telephoto on iPhone).
  if (deviceId) return { stream: await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false }), facing: 'environment' };
  let stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(facing));
  let actual = stream.getVideoTracks()[0]?.getSettings?.()?.facingMode;
  // Some mobile browsers silently choose the opposite lens for an ideal constraint.
  // Retry with exact only after that has actually happened; desktops may have one camera.
  if ((IS_IOS || /Android/i.test(navigator.userAgent)) && actual && actual !== facing && ['user', 'environment'].includes(actual)) {
    stream.getTracks().forEach((track) => track.stop());
    stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(facing, true));
    actual = stream.getVideoTracks()[0]?.getSettings?.()?.facingMode;
    if (actual && actual !== facing) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error(`Camera opened ${actual} instead of ${facing}`);
    }
  }
  return { stream, facing: ['user', 'environment'].includes(actual) ? actual : facing };
}
async function motifFor(key) {
  // Stamps show a paper-coloured hole; other frames show the motif in the vector colour.
  const colour = gallery.byKey[key]?.stamp ? (state.palettes?.paperColor?.[state.paperColor] || '#faf9f6') : (state.palettes?.vectorColor?.[state.vectorColor] || '#ffffff');
  const id = `${key}:${colour}`;
  if (!motifCache.has(id)) {
    motifCache.set(id, (async () => {
      const mask = await maskImage(key);
      const c = document.createElement('canvas'); c.width = PANEL_W; c.height = PANEL_H;
      const g = c.getContext('2d');
      const fit = gallery.byKey[key]?.scale ?? 0.78;
      const scale = Math.min((PANEL_W * fit) / mask.naturalWidth, (PANEL_H * fit) / mask.naturalHeight);
      const mw = mask.naturalWidth * scale, mh = mask.naturalHeight * scale;
      g.drawImage(mask, (PANEL_W - mw) / 2, (PANEL_H - mh) / 2, mw, mh);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = colour;
      g.fillRect(0, 0, PANEL_W, PANEL_H);
      return c;
    })().catch((error) => { motifCache.delete(id); throw error; }));
  }
  return motifCache.get(id);
}
const cameraKeys = () => (canStyle() ? gallery.templates.map((t) => t.key) : [state.template]);
// Warm the stamps, the frames most people shoot with, so picking one in the camera is instant.
function prefetchNeighbours() {
  gallery.templates.filter((t) => t.stamp).forEach((t) => motifFor(t.key).catch(() => {}));
}
async function showCameraFrame() {
  const key = state.template;
  $('#camera-frame-name').textContent = window.boothLabel?.() ?? (gallery.byKey[key]?.name || '');
  cam.motif = null; cam.motifKey = '';
  const note = $('#viewfinder-note');
  const changing = cam.running && !screens.camera.hidden;
  if (changing) { note.textContent = 'Changing frame…'; note.hidden = false; }
  const motif = await motifFor(key);
  if (key === state.template) { cam.motif = motif; cam.motifKey = key; if (changing) note.hidden = true; }
  prefetchNeighbours();
}
function drawCameraImage(context, video, crop, x, y, width, height, mirror) {
  context.save();
  if (mirror) { context.translate(x + width, y); context.scale(-1, 1); x = 0; y = 0; }
  context.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, x, y, width, height);
  context.restore();
}
function drawViewfinder(requestId) {
  if (!cam.running || requestId !== cam.requestId) return;
  const o = $('#viewfinder').getContext('2d');
  if (cam.el?.readyState >= 2) {
    const crop = zoomCrop(coverCrop(cam.el.videoWidth, cam.el.videoHeight), cam.digital);
    // Photobooth draws the whole two-panel card itself (booth.js); otherwise one panel with the frame.
    if (!(window.boothDraw && window.boothDraw(o, cam.el, crop))) {
      o.clearRect(0, 0, PANEL_W, PANEL_H);
      drawCameraImage(o, cam.el, crop, 0, 0, PANEL_W, PANEL_H, cam.facing === 'user');
      if (cam.motif) o.drawImage(cam.motif, 0, 0);
    }
  }
  requestAnimationFrame(() => drawViewfinder(requestId));
}
async function openCamera(facing = 'environment', { deviceId = null, z = 1 } = {}) {
  cam.idle = false; $('#viewfinder-note').classList.remove('home');
  stopVideo();
  stopCamera(); // iOS needs the old track released before switching lenses
  const requestId = cam.requestId;
  show('camera');
  // No camera API (old browser, or a page not on https): stay on the camera screen and say so,
  // instead of popping the phone's own photo picker.
  if (!navigator.mediaDevices?.getUserMedia) {
    const note = $('#viewfinder-note'); note.hidden = false;
    note.innerHTML = '<span>The camera can’t open on this page.</span><button class="button primary camera-fallback" type="button">Upload a photo</button>';
    note.querySelector('.camera-fallback').addEventListener('click', openLibrary);
    $('#camera-zoom').hidden = true;
    track('camera_blocked', { error: 'no_camera_api' });
    return;
  }
  $('#viewfinder-note').hidden = false; $('#viewfinder-note').textContent = 'starting the camera…';
  $('#camera-flip').disabled = true;
  // In-app visitors can try frames in the camera without using editor changes.
  $('#camera-frame').classList.toggle('locked', !canStyle());
  try {
    const frameKey = state.template;
    const frameReady = showCameraFrame().then(() => true, (error) => { reportClient('camera-frame', error); return false; });
    const { stream, facing: actualFacing } = await requestCamera(facing, deviceId);
    if (requestId !== cam.requestId || screens.camera.hidden) { stream.getTracks().forEach((track) => track.stop()); return; }
    const lensFactor = deviceId && deviceId === cam.lenses['0.5'] ? 0.5 : 1;
    Object.assign(cam, { stream, facing: actualFacing, z: actualFacing === 'user' ? 1 : z, lensFactor, digital: actualFacing === 'user' ? 1 : Math.max(1, z / lensFactor) });
    const el = document.createElement('video');
    Object.assign(el, { muted: true, playsInline: true, autoplay: true });
    el.setAttribute('playsinline', '');
    el.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
    document.body.append(el);
    el.srcObject = stream;
    Object.assign(cam, { el, running: true });
    await el.play();
    if (requestId !== cam.requestId || screens.camera.hidden) return;
    const flipLabel = cam.facing === 'user' ? 'Switch to back camera' : 'Switch to front camera';
    $('#camera-flip').setAttribute('aria-label', flipLabel);
    $('#camera-flip').title = flipLabel;
    $('#camera-flip').disabled = false;
    drawViewfinder(requestId);
    setupZoom().catch((error) => reportClient('camera-zoom', error));
    const focusCaps = stream.getVideoTracks()[0]?.getCapabilities?.()?.focusMode; // keep refocusing as the phone moves
    if (focusCaps?.includes('continuous')) stream.getVideoTracks()[0].applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
    const loaded = await frameReady;
    if (requestId === cam.requestId && state.template === frameKey) {
      if (loaded) $('#viewfinder-note').hidden = true;
      else { $('#viewfinder-note').textContent = 'Frame didn’t load. Try another.'; $('#viewfinder-note').hidden = false; }
    }
  } catch (error) {
    if (requestId !== cam.requestId || screens.camera.hidden) return;
    stopCamera();
    { const v = $('#viewfinder'); v.getContext('2d').clearRect(0, 0, v.width, v.height); } // no frozen last frame behind the message
    reportClient('camera', `${error?.name || 'no name'}: ${error?.message || String(error)}`);
    // Never a dead end: say why, and offer the photo library right there.
    const note = $('#viewfinder-note');
    const retryFacing = cam.facing;
    const retryLabel = facing !== retryFacing ? `Use ${retryFacing === 'user' ? 'front' : 'back'} camera` : 'Try camera again';
    // Threads (and some other in-app browsers) never allow the camera; Settings won't help there.
    if (IN_APP && error?.name === 'NotAllowedError') {
      note.innerHTML = `<span>${IN_APP} doesn’t let websites use the camera. Upload a photo, or open With Love in your browser to shoot.</span><button class="button primary camera-fallback" type="button">Upload a photo</button><a class="button camera-retry" href="${openInBrowserLink()}">Open in browser</a>`;
      note.querySelector('.camera-fallback').addEventListener('click', openLibrary);
      note.querySelector('.camera-retry').addEventListener('click', () => { track('login_open_browser', { inApp: IN_APP, from: 'camera' }); watchHandoff('camera'); });
      $('#camera-flip').disabled = false;
      track('camera_blocked', { error: 'NotAllowedError', inApp: IN_APP });
      return;
    }
    // iOS 15/16 Safari: after the page was in the background the camera can stay stuck until a reload.
    if (error?.name === 'AbortError' || error?.name === 'NotReadableError') {
      note.innerHTML = '<span>The camera got stuck. Reload the page to wake it up.</span><button class="button primary camera-reload" type="button">Reload</button><button class="button camera-fallback" type="button">Upload a photo instead</button>';
      note.querySelector('.camera-reload').addEventListener('click', () => { track('camera_blocked', { error: error.name, action: 'reload' }); location.reload(); });
      note.querySelector('.camera-fallback').addEventListener('click', openLibrary);
      $('#camera-flip').disabled = false;
      track('camera_blocked', { error: error.name });
      return;
    }
    note.innerHTML = `<span>${error?.name === 'NotAllowedError' ? 'Camera access is off (you can turn it on in Settings).' : 'The camera isn’t available here.'}</span><button class="button camera-retry" type="button">${retryLabel}</button><button class="button primary camera-fallback" type="button">Upload a photo instead</button>`;
    note.querySelector('.camera-retry').addEventListener('click', () => openCamera(retryFacing));
    note.querySelector('.camera-fallback').addEventListener('click', openLibrary);
    $('#camera-flip').disabled = false;
    track('camera_blocked', { error: error?.name || 'unknown' });
  }
}
// ---- Home is the camera (no front page) ----
// It starts by itself when this phone already allowed the camera. Otherwise the viewfinder waits for
// one tap, so nobody gets a permission prompt the moment they arrive (docs/product-ux-rules.md).
async function cameraAllowed() {
  try { return (await navigator.permissions?.query({ name: 'camera' }))?.state === 'granted'; } catch { return false; }
}
async function openHome() {
  closeSheets(); stopVideo();
  if (navigator.mediaDevices?.getUserMedia && await cameraAllowed()) return openCamera();
  stopCamera(); show('camera'); cam.idle = true;
  $('#camera-frame').classList.toggle('locked', !canStyle());
  $('#camera-zoom').hidden = true;
  const note = $('#viewfinder-note'); note.hidden = false; note.classList.add('home');
  note.innerHTML = '<button class="button primary camera-start" type="button">tap to start the camera</button><button class="button camera-fallback" type="button">or upload a photo</button>';
  note.querySelector('.camera-start').addEventListener('click', () => openCamera());
  note.querySelector('.camera-fallback').addEventListener('click', openLibrary);
  showCameraFrame().catch((error) => reportClient('camera-frame', error));
}

// A quick press bounce, so every tap visibly registers.
function bump(button) { button.classList.remove('bump'); void button.offsetWidth; button.classList.add('bump'); }

// ---- Modes ----
// A mode is a screen you can switch to from the modes button. Each one registers itself, so
// adding another later is one registerMode() call in that feature's own file: no markup, no
// styles. Modes are filed in folders, and the sheet shows the folders closed.
const MODE_CAMERA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.6" y="7" width="18.8" height="12.4" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.4 7V5.7a1.1 1.1 0 0 1 1.1-1.1h3a1.1 1.1 0 0 1 1.1 1.1V7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="13.3" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="10.2" r=".9" fill="currentColor"/></svg>';
const MODE_FOLDER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 7.4a2 2 0 0 1 2-2h3.2l1.7 2h8.3a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const MODE_GROUPS = [
  { key: 'single', title: '1 photo', note: 'one picture, or a 5-second video', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.2" width="14" height="17.6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="7.3" y="5.5" width="9.4" height="9.4" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7.6 13.2 10 10.9l1.7 1.6 2.1-2.5 2.6 3.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="14.4" cy="8" r=".9" fill="currentColor"/></svg>' },
  { key: 'multi', title: 'multiple photos', note: 'several pictures on one card', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect class="pile-bg" x="3.6" y="7" width="12.4" height="12.4" rx="1.8" transform="rotate(-14 9.8 13.2)"/><rect class="pile-bg" x="8" y="4.6" width="12.4" height="12.4" rx="1.8" transform="rotate(11 14.2 10.8)"/><rect class="pile-bg" x="5.6" y="7.4" width="12.4" height="12.4" rx="1.8"/><path d="M7.6 17.1l2.7-2.7 2 1.8 2.2-2.6 1.5 1.8" fill="none" stroke-width="1.2" stroke-linecap="round"/></g></svg>' },
];
const MODES = [];
function registerMode(mode) { MODES.push(mode); }
const liveModes = () => MODES.filter((mode) => !mode.enabled || mode.enabled());
const currentMode = () => MODES.find((mode) => mode.screen === state.shown) || MODES[0];
// Which folders have something in them right now. An empty one is not shown: when a mode for it
// ships, the folder comes back with it.
function liveFolders() {
  const modes = liveModes();
  return MODE_GROUPS
    .map((group, index) => ({ group, modes: modes.filter((mode) => (mode.group || MODE_GROUPS[0].key) === group.key
      || (index === 0 && !MODE_GROUPS.some((other) => other.key === mode.group))) }))
    .filter((folder) => folder.modes.length);
}
function modeCardHtml(mode, current) {
  const isNew = mode !== current && Boolean(mode.fresh?.());
  return `<button class="mode-card${mode.special ? ' mode-tile-special' : ''}" type="button" role="menuitem" data-mode-go="${mode.key}"${mode === current ? ' aria-current="true"' : ''}>`
    + `<span class="mode-card-art">${mode.icon}</span><b>${mode.label}</b>${mode.note ? `<small>${mode.note}</small>` : ''}`
    + `${isNew ? '<i class="mode-tile-new" aria-hidden="true"></i>' : ''}</button>`;
}
let openFolder = null; // the one folder showing its modes; null means all closed
// The folders share the sheet, closed. Tapping one opens it underneath and closes the other, so
// the sheet stays the same height however many modes we end up with.
function renderStartModes() {
  const folders = liveFolders(), current = currentMode();
  if (!folders.some((folder) => folder.group.key === openFolder)) openFolder = null;
  const row = folders.map(({ group, modes: inside }) => {
    const isNew = inside.some((mode) => mode !== current && Boolean(mode.fresh?.()));
    return `<button class="mode-folder" type="button" data-folder="${group.key}" aria-expanded="${group.key === openFolder}"${inside.includes(current) ? ' aria-current="true"' : ''}>`
      + `<span class="mode-card-art">${group.icon || MODE_FOLDER_ICON}</span><b>${group.title}</b>`
      + `<small>${inside.length} mode${inside.length > 1 ? 's' : ''}</small>`
      + `${isNew ? '<i class="mode-tile-new" aria-hidden="true"></i>' : ''}</button>`;
  }).join('');
  const shown = folders.find((folder) => folder.group.key === openFolder);
  const panel = shown
    ? `<div class="mode-folder-panel">${shown.group.note ? `<p class="mode-group-note">${shown.group.note}</p>` : ''}`
      + `<div class="mode-row">${shown.modes.map((mode) => modeCardHtml(mode, current)).join('')}</div></div>`
    : '';
  $('#start-modes').innerHTML = `<div class="mode-row mode-folders">${row}</div>${panel}`;
}
function openStartChooser() {
  openFolder = null; // every visit to the sheet starts closed
  renderStartModes();
  openSheet('#start-sheet');
  track('modes', { action: 'sheet', modes: liveModes().length });
}
$('#start-modes').addEventListener('click', (event) => {
  const folder = event.target.closest('[data-folder]'); if (!folder) return;
  openFolder = openFolder === folder.dataset.folder ? null : folder.dataset.folder;
  renderStartModes();
});
document.addEventListener('click', (event) => {
  const card = event.target.closest('[data-mode-go]'); if (!card) return;
  closeSheets();
  MODES.find((mode) => mode.key === card.dataset.modeGo)?.open();
});
$('#camera-modes').addEventListener('click', () => { bump($('#camera-modes')); openStartChooser(); });
$('#recap-modes').addEventListener('click', openStartChooser);
// The one every visit starts in.
registerMode({ key: 'camera', label: 'With Love', note: 'photo or video', group: 'single', screen: 'camera', icon: MODE_CAMERA_ICON, open: () => { window.exitBooth?.(); if (screens.camera.hidden) openHome(); } });
$('#camera-flip').addEventListener('click', () => { track('adjust', { camera_flip: cam.facing === 'user' ? 'back' : 'front' }); openCamera(cam.facing === 'user' ? 'environment' : 'user'); });

// ---- Zoom, back camera only: .5 / 1× / 2 pills, or pinch with two fingers (.5 to 5×) ----
// iPhones list each real lens by an English name. .5 switches to "Back Ultra Wide Camera" so it stays
// sharp; anything from 1× up is the main lens, cropped (the telephoto isn't used: its real
// magnification, 2×, 3× or 5×, isn't exposed). Phones whose track has a zoom range (Android) use it.
const MAX_ZOOM = 5;
const zoomCrop = (crop, factor) => factor === 1 ? crop : { sw: crop.sw / factor, sh: crop.sh / factor, sx: crop.sx + crop.sw * (1 - 1 / factor) / 2, sy: crop.sy + crop.sh * (1 - 1 / factor) / 2 };
const zoomRange = () => cam.stream?.getVideoTracks()[0]?.getCapabilities?.().zoom || null;
const minZoom = () => { const range = zoomRange(); return cam.lenses['0.5'] ? 0.5 : range ? Math.max(0.5, range.min) : 1; };
async function setupZoom() {
  const pills = $('#camera-zoom');
  pills.hidden = cam.facing === 'user';
  if (pills.hidden) return;
  if (!cam.lenses.checked) {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    const find = (pattern) => devices.find((d) => pattern.test(d.label))?.deviceId || null;
    // Some iPhones also have a "Front Ultra Wide Camera", so only "Back …" lenses count.
    cam.lenses = { checked: true, '0.5': find(/^back ultra wide camera$/i), 1: find(/^back camera$/i) };
    if (sessionOnce('withlove-lens-log')) { const range = zoomRange(); reportClient('camera-lenses', `${devices.map((d) => d.label).join(' | ')}${range ? ` | zoom ${range.min}-${range.max}` : ' | no zoom range'}`.slice(0, 300)); }
  }
  pills.querySelector('[data-zoom="0.5"]').hidden = minZoom() > 0.5;
  paintZoom();
}
// The pill for the current range lights up and shows the exact value (1.4×), like the iPhone camera.
function paintZoom() {
  const pills = [...$('#camera-zoom').querySelectorAll('[data-zoom]')].filter((b) => !b.hidden);
  const active = pills.filter((b) => Number(b.dataset.zoom) <= cam.z + 0.01).pop() || pills[0];
  const label = (n) => String(Math.round(n * 10) / 10).replace(/^0/, '');
  pills.forEach((b) => {
    const on = b === active;
    b.setAttribute('aria-pressed', on);
    b.textContent = on ? `${label(cam.z)}×` : label(Number(b.dataset.zoom));
  });
}
// Apply zoom level z on the current lens, live (e.g. while pinching). Below the lens's own factor
// (pinching toward .5 on the main lens) the view stays at 1× until the fingers lift and the lens switches.
function applyZoomLive(z) {
  z = Math.min(MAX_ZOOM, Math.max(minZoom(), z));
  const range = zoomRange();
  if (range && !cam.lenses['0.5']) {
    const native = Math.min(range.max, Math.max(range.min, z));
    cam.digital = Math.max(1, z / native);
    if (!cam.zoomPending) { cam.zoomPending = true; cam.stream.getVideoTracks()[0].applyConstraints({ advanced: [{ zoom: native }] }).catch(() => {}).finally(() => { cam.zoomPending = false; }); }
  } else cam.digital = Math.max(1, z / cam.lensFactor);
  cam.z = z; paintZoom();
}
// Settle on z: switch lens if it's on the other side of 1×, otherwise just crop/zoom.
async function setZoom(z) {
  if (!cam.running || cam.facing === 'user') return;
  z = Math.min(MAX_ZOOM, Math.max(minZoom(), z));
  const wantLens = cam.lenses['0.5'] && z < 1 ? 0.5 : 1;
  if (cam.lenses['0.5'] && wantLens !== cam.lensFactor) {
    await openCamera('environment', { deviceId: wantLens === 0.5 ? cam.lenses['0.5'] : cam.lenses[1], z });
  } else applyZoomLive(z);
  cam.z = z; paintZoom();
}
$('#camera-zoom').addEventListener('click', (event) => {
  const b = event.target.closest('[data-zoom]'); if (!b) return;
  bump(b); track('adjust', { camera_zoom: b.dataset.zoom });
  setZoom(Number(b.dataset.zoom)).catch((error) => reportClient('camera-zoom', error));
});
// Pinch on the viewfinder: live crop while the fingers move, lens switch (if any) when they lift.
(() => {
  const vf = $('#viewfinder');
  let pinch = null;
  const gap = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  vf.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 2 || !cam.running || cam.facing === 'user' || cam.recorder) return;
    event.preventDefault();
    pinch = { start: gap(event.touches), z: cam.z, target: cam.z };
  }, { passive: false });
  vf.addEventListener('touchmove', (event) => {
    if (!pinch || event.touches.length !== 2) return;
    event.preventDefault();
    pinch.target = Math.min(MAX_ZOOM, Math.max(minZoom(), pinch.z * gap(event.touches) / pinch.start));
    applyZoomLive(pinch.target);
  }, { passive: false });
  const end = () => {
    if (!pinch) return;
    const z = pinch.target; pinch = null;
    track('adjust', { camera_zoom: 'pinch', z: Math.round(z * 10) / 10 });
    setZoom(z).catch((error) => reportClient('camera-zoom', error));
  };
  vf.addEventListener('touchend', (event) => { if (event.touches.length < 2) end(); });
  vf.addEventListener('touchcancel', end);
})();

// Tap to focus: focus and exposure on that spot where the browser allows it (Android Chrome takes
// points of interest; iPhone Safari keeps its own continuous autofocus), with the focus square either way.
$('#viewfinder').addEventListener('click', (event) => {
  if (cam.idle) { openCamera(); return; } // home, camera not started yet: any tap on the viewfinder starts it
  if (!cam.running || !cam.el) return;
  const box = event.currentTarget.getBoundingClientRect();
  let u = (event.clientX - box.left) / box.width; const v = (event.clientY - box.top) / box.height;
  const ring = $('#focus-ring');
  ring.style.left = `${u * 100}%`; ring.style.top = `${v * 100}%`;
  ring.hidden = false; ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go');
  clearTimeout(cam.focusTimer); cam.focusTimer = setTimeout(() => { ring.hidden = true; }, 1200);
  // Viewfinder spot → spot in the camera's full frame (the view is cropped, zoomed and, for selfies, mirrored).
  if (cam.facing === 'user') u = 1 - u;
  const crop = zoomCrop(coverCrop(cam.el.videoWidth, cam.el.videoHeight), cam.digital);
  const point = { x: (crop.sx + u * crop.sw) / cam.el.videoWidth, y: (crop.sy + v * crop.sh) / cam.el.videoHeight };
  const trackObj = cam.stream?.getVideoTracks()[0], caps = trackObj?.getCapabilities?.() || {};
  if (sessionOnce('withlove-focus-log')) reportClient('camera-focus', JSON.stringify({ focusMode: caps.focusMode, exposureMode: caps.exposureMode, poi: 'pointsOfInterest' in (trackObj?.getSettings?.() || {}) }));
  const want = { pointsOfInterest: [point] };
  if (caps.focusMode?.includes('single-shot')) want.focusMode = 'single-shot';
  if (caps.exposureMode?.includes('single-shot')) want.exposureMode = 'single-shot';
  trackObj?.applyConstraints({ advanced: [want] }).catch(() => {});
  track('adjust', { camera_focus: true });
});
$('#camera-upload').addEventListener('click', () => { if (window.boothActive?.()) { window.boothUpload(); return; } openLibrary(); }); // in the photobooth, a photo fills the half being shot

// ---- Photo / video (up to 5 s, like uploaded clips) ----
const MAX_CLIP_MS = 5000;
function setCameraMode(mode) {
  if (cam.recorder) return;
  cam.mode = mode;
  $('#camera-mode').querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-checked', b.dataset.mode === mode));
  const shutter = $('#camera-shutter');
  shutter.classList.toggle('video', mode === 'video');
  shutter.setAttribute('aria-label', mode === 'video' ? 'Record a video (up to 5 seconds)' : 'Take the picture');
  $('#camera-rec-time').textContent = '';
}
$('#camera-mode').addEventListener('click', (event) => {
  const b = event.target.closest('[data-mode]'); if (!b || b.dataset.mode === cam.mode) return;
  setCameraMode(b.dataset.mode); track('adjust', { camera_mode: b.dataset.mode });
});
function toggleRecording() {
  if (cam.recorder) { track('adjust', { camera_record: 'stopped_early' }); cam.recorder.stop(); return; }
  const type = videoRecorderType();
  if (!cam.stream || !type) { showError('This browser can’t record video. Take a photo, or upload a clip instead.', null); return; }
  const requestId = cam.requestId, chunks = [], shutter = $('#camera-shutter'), started = performance.now();
  const recorder = new MediaRecorder(cam.stream, { mimeType: type });
  cam.recorder = recorder;
  const busy = (on) => { $('#camera-modes').hidden = on; ['#camera-flip', '#camera-upload', '#camera-frame', '#camera-modes', '#me-camera'].forEach((id) => { $(id).disabled = on; }); $('#camera-mode').classList.toggle('busy', on); $('#camera-zoom').classList.toggle('busy', on); shutter.classList.toggle('recording', on); };
  busy(true);
  const tick = () => {
    if (cam.recorder !== recorder) return;
    const ms = Math.min(MAX_CLIP_MS, performance.now() - started);
    shutter.style.setProperty('--p', ms / MAX_CLIP_MS);
    $('#camera-rec-time').textContent = `0:0${Math.floor(ms / 1000)} / 0:05`;
    if (ms >= MAX_CLIP_MS) { recorder.state === 'recording' && recorder.stop(); return; }
    requestAnimationFrame(tick);
  };
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  recorder.onstop = async () => {
    cam.recorder = null; busy(false); shutter.style.removeProperty('--p'); $('#camera-rec-time').textContent = '';
    if (requestId !== cam.requestId || !chunks.length) return; // left the camera mid-recording
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File(chunks, `with-love-camera.${ext}`, { type: type.split(';')[0], lastModified: Date.now() });
    track('camera_shot', { video: true, ms: Math.round(performance.now() - started) });
    stopCamera();
    await startWithFile(file, { source: 'camera' });
  };
  recorder.start(250); track('adjust', { camera_record: 'start' });
  requestAnimationFrame(tick);
}
$('#camera-frame').addEventListener('click', (event) => {
  bump(event.currentTarget);
  if (!canStyle()) { openLogin('frame'); return; }
  openFrameGallery({ camera: true }); track('adjust', { camera_frames: 'open' });
});
function useCameraFrame(key) {
  window.exitBooth?.(); // picking a frame leaves the photobooth
  state.template = key; rememberTemplate(key);
  track('pick_template', { from: 'camera' });
  showCameraFrame().catch((error) => { reportClient('camera-frame', error); $('#viewfinder-note').textContent = 'Frame didn’t load. Try another.'; $('#viewfinder-note').hidden = false; });
  loadFrameQuote(); renderPickers();
}
// Shutter: a full-resolution still (no mask), then the usual editor with the chosen frame.
$('#camera-shutter').addEventListener('click', async (event) => {
  bump(event.currentTarget);
  if (window.boothShutter && window.boothShutter()) return; // photobooth: two shots with a countdown (booth.js)
  if (cam.mode === 'video') { toggleRecording(); return; }
  const el = cam.el;
  if (!el || el.readyState < 2) return;
  const full = zoomCrop({ sx: 0, sy: 0, sw: el.videoWidth, sh: el.videoHeight }, cam.digital); // 2× without a telephoto: the centre
  const c = document.createElement('canvas'); c.width = Math.round(full.sw); c.height = Math.round(full.sh);
  drawCameraImage(c.getContext('2d'), el, full, 0, 0, c.width, c.height, cam.facing === 'user');
  const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.92));
  track('camera_shot');
  stopCamera();
  await startWithFile(new File([blob], 'with-love-camera.jpg', { type: 'image/jpeg', lastModified: Date.now() }), { source: 'camera', line: 'Polishing your photo…' });
});
['#upload-input'].forEach((id) => $(id).addEventListener('change', (event) => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  closeSheets();
  startWithFile(file, { keepDraft: !screens.story.hidden });
}));
// The studio's top-left button goes straight back to the camera for the next shot.
$('#new-photo').addEventListener('click', () => { stopVideo(); state.file = null; track('change_photo', { from: 'studio_camera' }); openCamera(); });
['#account-chip', '#me-landing', '#me-camera'].forEach((id) => $(id).addEventListener('click', openMe));
$('#sheet-backdrop').addEventListener('click', closeSheets);
$('#error-retry').addEventListener('click', () => { closeSheets(); if (state.lastAction) state.lastAction(); });
$('#error-default').addEventListener('click', () => { closeSheets(); Object.assign(state, { template: state.defaults.template, paper: state.defaults.paper }); renderPickers(); loadFrameQuote(); if (state.file) withLoading('Using the default frame…', render).then(() => show('story')).catch(() => showError('Still no luck with this photo.', null)); });
$('#error-new').addEventListener('click', () => { closeSheets(); stopVideo(); state.file = null; openHome(); });

Object.values(fields).forEach((input) => input.addEventListener('change', () => { if (input === fields.feeling) renderChips(); rerender(); }));
$('#feeling-chips').addEventListener('click', (event) => {
  const chip = event.target.closest('.chip'); if (!chip) return;
  fields.feeling.value = fields.feeling.value === chip.dataset.feeling ? '' : chip.dataset.feeling;
  renderChips(); rerender();
});

$('#open-frames').addEventListener('click', openFrameGallery);
['#quote-top', '#quote-bottom'].forEach((id) => $(id).addEventListener('change', () => rerender('Setting your words…')));
$('#quote-reset').addEventListener('click', () => { loadFrameQuote(); rerender('Setting your words…'); });
$('#open-papers').addEventListener('click', openPaperGallery);
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', closeSheets));

// ---- You: profile + mailbox ----
// The round avatar (top right) opens it. A pink heart on the avatar means unread letters. Letters
// come from the With Love team for now (app/mail.json); each one explains a feature and has a live demo.
// Read letters are remembered on this phone.
const mail = { letters: [], read: new Set((() => { try { return JSON.parse(localStorage.getItem('withlove-mail-read') || '[]'); } catch { return []; } })()) };
const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const PERSON_ICON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 19.5c1.2-3.3 3.6-5 6.5-5s5.3 1.7 6.5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
function faceHtml() {
  const me = state.me || {};
  if (!state.signedIn) return PERSON_ICON;
  if (me.avatar) return `<img src="${esc(me.avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode('${esc((me.name || me.email || '?')[0].toUpperCase())}'))" />`;
  const initial = (me.name || me.email || '')[0];
  return initial ? esc(initial.toUpperCase()) : PERSON_ICON;
}
const unreadCount = () => mail.letters.filter((letter) => !mail.read.has(letter.id)).length;
function renderMe() {
  const unread = unreadCount();
  document.querySelectorAll('.me-button').forEach((button) => {
    button.querySelector('.me-face').innerHTML = faceHtml();
    button.classList.toggle('signed-in', Boolean(state.signedIn));
    button.querySelector('.me-heart').hidden = !unread;
    button.setAttribute('aria-label', unread ? `Your profile and mailbox, ${unread} new letter${unread > 1 ? 's' : ''}` : 'Your profile and mailbox');
  });
}
async function loadMail() {
  try { mail.letters = await fetch('/mail').then((response) => response.json()); } catch { mail.letters = []; }
  // Done the survey (on any device, per the server): its letter leaves the mailbox for good.
  if (state.surveyed === true) mail.letters = mail.letters.filter((letter) => letter.opens !== 'survey');
  renderMe();
}
function renderMeSheet() {
  const me = state.me || {};
  const avatar = state.signedIn ? me.avatar || '' : '';
  $('#me-star-img').setAttribute('href', avatar);
  $('#me-star-person').style.display = avatar ? 'none' : '';
  $('#me-star').querySelector('.me-star-edit').hidden = !state.signedIn;
  $('#me-title').textContent = state.signedIn ? (me.name?.split(' ')[0] || 'You') : 'You';
  // gems next to the name (signed in): last known number at once, fresh one when it arrives.
  $('#me-gems').hidden = !state.signedIn;
  $('#me-gems-number').textContent = String(perks.gems || 0);
  if (state.signedIn) fetch('/perks').then((response) => response.json()).then((data) => { Object.assign(perks, data); $('#me-gems-number').textContent = String(perks.gems || 0); }).catch(() => {});
  renderCheckin(); loadCheckin().then(renderCheckin); // checkin.js: the calendar, last known then fresh
  $('#me-email').textContent = state.signedIn ? (me.email || '') : 'Sign in to keep your style and save without limits.';
  $('#me-actions').innerHTML = [
    !state.signedIn && '<button class="pill-button primary" type="button" data-me="signin">Sign in</button>',
    canAddToPhone() && '<button class="pill-button primary" type="button" data-me="phone">Add to phone</button>',
    '<button class="pill-button perks" type="button" data-me="perks">Share for perks</button>',
    state.signedIn && '<button class="pill-button" type="button" data-me="signout">Log out</button>',
  ].filter(Boolean).join('');
  const unread = unreadCount();
  $('#mailbox-heart').hidden = !unread;
  $('#mailbox-count').textContent = !mail.letters.length ? 'empty' : unread ? `${unread} new` : 'all read';
  $('#mail-list').innerHTML = mail.letters.map((letter) => `<button type="button" class="mail-item${mail.read.has(letter.id) ? '' : ' unread'}" data-letter="${esc(letter.id)}">
    <span class="mail-meta">from ${esc(letter.from)}</span>
    <span class="mail-title">${esc(letter.title)}</span>
    <span class="mail-date">${esc(letter.date)}</span>
    ${mail.read.has(letter.id) ? '' : '<span class="mail-dot" aria-label="new"></span>'}</button>`).join('');
  $('#mail-dots').innerHTML = mail.letters.length > 1 ? mail.letters.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('') : '';
  $('#mail-list').scrollLeft = 0; delete $('#mail-list').dataset.swiped;
}
// The dots under the letters follow the one in view.
$('#mail-list').addEventListener('scroll', () => {
  const list = $('#mail-list'), first = list.firstElementChild; if (!first) return;
  const i = Math.round(list.scrollLeft / (first.offsetWidth + 10));
  if (i > 0 && !list.dataset.swiped) { list.dataset.swiped = '1'; track('mailbox', { action: 'swipe' }); }
  $('#mail-dots').querySelectorAll('i').forEach((dot, n) => dot.classList.toggle('on', n === i));
}, { passive: true });
// ---- Share for perks: invite friends, earn gems ----
// Your link is With Love…/m/?invite=<code>. A friend who opens it and then signs in earns you one gems
// (tracked as an 'invite' event; the server counts distinct accounts, never yourself).
const perks = { code: null, gems: 0 };
// The gems, minted: two SVG faces with a stack of thin gold slices between them, so it has real
// thickness when it turns (CSS 3D; vision/coin.svg is the face).
$('#coin3d').innerHTML = `<span class="coin-face"><img src="./vision/coin.svg" alt="" /></span>${Array.from({ length: 16 }, (_, i) => `<span class="coin-slice" style="--i:${i}"></span>`).join('')}<span class="coin-face back"><img src="./vision/coin.svg" alt="" /></span>`;
const inviteLink = () => `${location.origin}/m/?invite=${encodeURIComponent(perks.code)}`;
async function openPerks({ welcome = '', from = 'profile' } = {}) {
  closeSheets(); openSheet('#perks-sheet'); setHow(false); coinify($('#perks-sheet'));
  $('#perks-status').textContent = '';
  $('#perks-welcome').hidden = !welcome; $('#perks-welcome').innerHTML = welcome;
  $('#perks-share').textContent = state.signedIn ? 'Share my invite link' : 'Sign in to get your link';
  track('invite', { action: 'perks_open', from: welcome ? 'welcome' : from });
  if (!state.signedIn) { $('#gems-number').textContent = '0'; return; }
  try { Object.assign(perks, await fetch('/perks').then((response) => response.json())); } catch {}
  $('#gems-number').textContent = String(perks.gems || 0);
}
// How it works: a small card floating over the sheet, so nothing below it moves.
const setHow = (open) => {
  const pop = $('#how-steps'), link = $('#perks-how');
  pop.hidden = !open; link.setAttribute('aria-expanded', open);
  if (!open) return;
  // Sit just under the link (it may wrap to its own line), with the little arrow pointing at it.
  const row = link.parentElement.getBoundingClientRect(), at = link.getBoundingClientRect();
  pop.style.top = `${at.bottom - row.top + 10}px`;
  pop.style.setProperty('--arrow', `${Math.max(14, at.left + at.width / 2 - pop.getBoundingClientRect().left - 7)}px`);
};
$('#perks-how').addEventListener('click', (event) => { event.stopPropagation(); const open = $('#how-steps').hidden; setHow(open); if (open) track('invite', { action: 'how_it_works' }); });
$('#how-close').addEventListener('click', () => setHow(false));
$('#perks-sheet').addEventListener('click', (event) => { if (!event.target.closest('#how-steps, #perks-how')) setHow(false); });
$('#perks-share').addEventListener('click', async () => {
  if (!state.signedIn) { openLogin('perks'); return; }
  if (!perks.code) { $('#perks-status').textContent = 'One moment, getting your link…'; await openPerks(); if (!perks.code) return; }
  const url = inviteLink();
  try {
    if (navigator.share) { await navigator.share({ url, text: 'Make your photos into little With Love stories with me ✦' }); track('invite', { action: 'share', result: 'shared' }); return; }
  } catch (error) { if (error.name === 'AbortError') { track('invite', { action: 'share', result: 'cancelled' }); return; } }
  try { await navigator.clipboard.writeText(url); $('#perks-status').textContent = 'Link copied. Send it to a friend!'; track('invite', { action: 'share', result: 'copied' }); } catch { $('#perks-status').textContent = url; track('invite', { action: 'share', result: 'shown' }); }
});
// Arriving from a friend's link: remember who invited them, and log 'opened' (after /session has
// given this browser its anonymous cookie: the server matches the account to this moment).
function noteInviteOpened() {
  const by = new URLSearchParams(location.search).get('invite');
  if (!by || !/^[\w-]{4,16}$/.test(by)) return;
  // The newest link wins, and opening one re-arms the check (unless this browser was already paid).
  try { localStorage.setItem('withlove-invited-by', by); if (localStorage.getItem('withlove-invite-joined') !== 'paid') localStorage.removeItem('withlove-invite-joined'); } catch {}
  if (!state.signedIn) track('invite', { action: 'opened', by });
}
// Signed in with a friend's code waiting: the server checks it (new account, not yourself, once)
// and pays you both. Only "paid" and "already invited" settle it: a refusal is about the account that
// asked (e.g. the inviter opening their own link, then signing up a new account in the same browser),
// so the next account to sign in here is asked about again. The server never pays twice.
async function reportInviteJoin() {
  if (!state.signedIn) return;
  // No code stored (e.g. the home-screen app, which has its own storage): the server looks up the
  // invite this browser opened by its cookie. Asked once per account on this phone.
  let by = null, done = [];
  try { by = localStorage.getItem('withlove-invited-by'); if (['paid', 'already'].includes(localStorage.getItem('withlove-invite-joined'))) return; done = JSON.parse(localStorage.getItem('withlove-invite-checked') || '[]'); } catch { return; }
  const me = state.me?.email || '';
  if (!by && done.includes(me)) return;
  const asked = `${me}:${by}`;
  if (reportInviteJoin.asked === asked) return; reportInviteJoin.asked = asked; // once per account and code per page
  try {
    const result = await fetch('/invite/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ by }) }).then((response) => response.json());
    if (result.reason === 'unknown_code' && !reportInviteJoin.retried) { reportInviteJoin.retried = true; reportInviteJoin.asked = null; setTimeout(reportInviteJoin, 12e3); return; } // inviter just signed up
    if (['error', 'off', 'signed_out', 'unknown_code'].includes(result.reason)) return; // worth another try next visit
    if (!by && !result.ok) { try { localStorage.setItem('withlove-invite-checked', JSON.stringify([...done, me].slice(-20))); } catch {} }
    if (result.ok || result.reason === 'already') { try { localStorage.setItem('withlove-invite-joined', result.ok ? 'paid' : 'already'); } catch {} }
    if (result.ok) openPerks({ welcome: `Welcome! Your friend invited you, so you <em>both got ${result.reward} gems</em> ✦` });
  } catch {}
}

$('#me-gems')?.addEventListener('click', () => openPerks({ from: 'profile_pill' }));
// Instagram / Threads / X from the profile's connect row.
document.querySelectorAll('.connect-icon[href]').forEach((link) => link.addEventListener('click', () => track('mailbox', { action: 'connect', to: new URL(link.href).hostname.replace(/^www\./, '') })));
// ---- Move photo: drag/pinch the photo inside the frame ----
// The window is the same 8:5 slice the server cuts (x-crop "x,y,zoom": centre 0–1, zoom 1–4). The
// photo is dimmed except where the frame's cut-outs are, so people see exactly what fills them.
// Photobooth halves use it too (move.half): their own photo, their words on top, no dimming.
const move = { bitmap: null, mask: null, draft: null, pointers: new Map(), start: null, half: null, words: null, flipped: false };
const CROP_CENTRE = { x: 0.5, y: 0.5, zoom: 1 };
const MOVE_NOTE = $('#move-sheet .sheet-note').textContent;
const moveWindow = (d) => cropWindow(move.bitmap.width, move.bitmap.height, d);
function cropWindow(bw, bh, d) {
  const base = coverCrop(bw, bh);
  const sw = base.sw / d.zoom, sh = base.sh / d.zoom;
  const cx = Math.max(sw / 2, Math.min(bw - sw / 2, d.x * bw)), cy = Math.max(sh / 2, Math.min(bh - sh / 2, d.y * bh));
  d.x = cx / bw; d.y = cy / bh; // keep the draft inside the photo
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh };
}
function drawMove() {
  if (!move.bitmap) return;
  const c = $('#move-canvas'), g = c.getContext('2d'), w = moveWindow(move.draft);
  g.clearRect(0, 0, c.width, c.height);
  if (move.half != null) {
    g.save(); if (move.flipped) { g.translate(c.width, 0); g.scale(-1, 1); }
    g.drawImage(move.bitmap, w.sx, w.sy, w.sw, w.sh, 0, 0, c.width, c.height); g.restore();
    if (move.words) g.drawImage(move.words, 0, 0, c.width, c.height);
    return;
  }
  g.drawImage(move.bitmap, w.sx, w.sy, w.sw, w.sh, 0, 0, c.width, c.height);
  g.fillStyle = 'rgba(40,28,22,.58)'; g.fillRect(0, 0, c.width, c.height);
  if (move.mask) {
    const off = document.createElement('canvas'); off.width = c.width; off.height = c.height;
    const o = off.getContext('2d');
    o.drawImage(move.bitmap, w.sx, w.sy, w.sw, w.sh, 0, 0, c.width, c.height);
    o.globalCompositeOperation = 'destination-in'; o.drawImage(move.mask, 0, 0, c.width, c.height);
    g.drawImage(off, 0, 0);
  }
}
async function openBoothMove(half) {
  if (!state.booth) return;
  closeSheets(); openSheet('#move-sheet');
  Object.assign(move, { half, bitmap: state.booth.src[half], mask: null, flipped: state.booth.flip[half], draft: { ...(state.booth.crop[half] || CROP_CENTRE) }, words: null });
  $('#move-sheet .sheet-note').textContent = 'Drag to move, pinch to zoom.';
  track('booth', { action: 'move_open', half: half + 1 });
  drawMove();
  move.words = (await window.boothWords().catch(() => []))[half] || null; drawMove();
}
async function openMove() {
  if (!state.file || state.video || state.booth) return;
  move.half = null; $('#move-sheet .sheet-note').textContent = MOVE_NOTE;
  closeSheets(); openSheet('#move-sheet');
  move.draft = { ...(state.crop || CROP_CENTRE) };
  track('adjust', { photo_move: 'open' });
  [move.bitmap, move.mask] = await Promise.all([
    createImageBitmap(state.file, { resizeWidth: 1400, resizeQuality: 'high' }).catch(() => state.photoBitmap),
    loadImage(`/layer/mask/${state.template}.png?v=2`).catch(() => null),
  ]);
  drawMove();
}
$('#move-photo').addEventListener('click', openMove);
$('#change-photo').addEventListener('click', () => { track('change_photo', { from: 'adjust' }); openLibrary(); });
$('#move-reset').addEventListener('click', () => { move.draft = { ...CROP_CENTRE }; drawMove(); });
$('#move-done').addEventListener('click', async () => {
  if (move.half != null) {
    const half = move.half, d = { ...move.draft }; closeSheets(); move.half = null;
    if (!state.booth) return;
    state.booth.crop[half] = d; state.booth.shots[half] = boothShot(half);
    state.file = await stackShots(state.booth.shots); paintBoothFlips();
    track('booth', { action: 'move_done', half: half + 1, zoom: Math.round(d.zoom * 100) / 100 });
    rerender('Moving your photo…');
    return;
  }
  const d = move.draft, centred = Math.abs(d.x - 0.5) < 0.002 && Math.abs(d.y - 0.5) < 0.002 && d.zoom < 1.01;
  const changed = JSON.stringify(state.crop) !== JSON.stringify(centred ? null : d);
  state.crop = centred ? null : { ...d };
  closeSheets();
  track('adjust', { photo_move: 'done', moved: !centred, zoom: Math.round(d.zoom * 100) / 100 });
  if (changed) rerender('Moving your photo…');
});
(() => {
  const c = $('#move-canvas');
  const gap = () => { const [a, b] = [...move.pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  c.addEventListener('pointerdown', (event) => {
    c.setPointerCapture(event.pointerId);
    move.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    move.start = move.pointers.size === 2 ? { gap: gap(), zoom: move.draft.zoom } : null;
  });
  c.addEventListener('pointermove', (event) => {
    const last = move.pointers.get(event.pointerId); if (!last || !move.bitmap) return;
    const now = { x: event.clientX, y: event.clientY };
    if (move.pointers.size === 1) {
      // Dragging moves the photo with the finger: the window slides the other way.
      const w = moveWindow(move.draft), scale = w.sw / c.getBoundingClientRect().width;
      move.draft.x -= ((now.x - last.x) * scale * (move.flipped ? -1 : 1)) / move.bitmap.width;
      move.draft.y -= ((now.y - last.y) * scale) / move.bitmap.height;
    }
    move.pointers.set(event.pointerId, now);
    if (move.pointers.size === 2 && move.start) move.draft.zoom = Math.max(1, Math.min(4, move.start.zoom * gap() / move.start.gap));
    drawMove();
  });
  const up = (event) => { move.pointers.delete(event.pointerId); move.start = null; };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('wheel', (event) => { event.preventDefault(); move.draft.zoom = Math.max(1, Math.min(4, move.draft.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08))); drawMove(); }, { passive: false });
})();

// ---- Survey (signed-in people): early access to video templates for a minute of answers ----
// Questions come from /survey (app/survey.json), one per screen. The popup offers it at most 3 times,
// a day apart; the mailbox letter can open it any time.
const survey = { def: null, step: 0, answers: {} };
const OTHER = 'Something else';
// *word* in survey text → pink keyword; every "gems(s)" gets its little coin.
const COIN = '<img class="coin-inline" src="./vision/coin.svg" alt="" />';
const withCoins = (html) => html.replace(/(^|[^\w-])(gems?)(?![\w-])/gi, (m, pre, word) => `${pre}<span class="kw-coin">${COIN}${word}</span>`);
const rich = (text) => withCoins(esc(text || '').replace(/\*(.+?)\*/g, '<em>$1</em>'));
function coinify(root) { // same coins inside already-rendered text (letters, perks, how it works)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (/gems?/i.test(n.nodeValue) && !n.parentElement.closest('.kw-coin, .gems-count, .me-gems, .survey-cta, script, style, textarea, button.pill-button') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((n) => { const span = document.createElement('span'); span.innerHTML = withCoins(esc(n.nodeValue)); n.replaceWith(...span.childNodes); });
}
// Small previews shown above each feature question, so people answer about something they've seen.
const SURVEY_DEMOS = {
  templates: () => `<video class="demo-video" src="./mail/video-templates.mp4?v=2" poster="./mail/video-templates.jpg" muted loop playsinline autoplay></video>`,
  stampbook: () => `<div class="sd sd-stampbook"><p>my stampbook · September</p><div>${['stamp-duck', 'sticker-lamb', 'stamp-cat', 'sticker-daisies', 'stamp-daisies', 'sticker-cat', 'stamp-lamb', 'sticker-duck'].map((f, i) => `<img src="./vision/${f}.webp" alt="" style="--r:${[-6, 4, -2, 7, -5, 3, 6, -4][i]}deg" />`).join('')}</div></div>`,
  journal: () => `<div class="sd sd-journal"><img src="./vision/stamp-cat.webp" alt="" /><div><p class="sd-date">30.09 · cozy</p><p>Lazy afternoon on the porch. The cat didn't move for two hours and honestly same.</p><p class="sd-lines"><i></i><i></i></p></div></div>`,
  aiframe: () => `<div class="sd sd-ai"><p class="sd-bubble them">How do you feel today, and what are you capturing?</p><p class="sd-bubble me">cozy ☁︎ coffee with friends</p><p class="sd-bubble them">These match you ✦</p><div class="sd-picks"><span><img src="./vision/sticker-daisies.webp" alt="" />Star swarm</span><span><img src="./vision/stamp-cat.webp" alt="" />Stamp</span><span><img src="./vision/sticker-lamb.webp" alt="" />Five moons</span></div></div>`,
  feed: () => `<div class="sd sd-feed">
    <div class="sd-stories">${[['sticker-daisies', 'you'], ['sticker-lamb', 'lan'], ['sticker-cat', 'josh'], ['sticker-duck', 'mai'], ['stamp-cat', 'kim']].map(([a, n], i) => `<span class="${i ? 'new' : ''}"><img src="./vision/${a}.webp" alt="" /><i>${n}</i></span>`).join('')}</div>
    ${[['sticker-lamb', 'lan', '2m', ['stamp-duck', 'sticker-daisies'], 'duck pond after class ♡', 24, 'omg the ducks 😭'],
       ['sticker-cat', 'josh', '1h', ['sticker-cat', 'stamp-daisies', 'sticker-lamb'], 'sunday on the porch', 41, 'need this frame!!'],
    ].map(([a, n, t, pics, cap, likes, comment]) => `<div class="sd-post">
      <p class="sd-head"><img src="./vision/${a}.webp" alt="" /><b>@${n}</b><span>${t}</span></p>
      <div class="sd-pics">${pics.map((p, i) => `<img src="./vision/${p}.webp" alt="" style="--r:${[-7, 5, -3][i]}deg" />`).join('')}</div>
      <p class="sd-cap">${cap}</p>
      <p class="sd-react"><span>♥ ${likes}</span><span>💬 ${Math.round(likes / 8)}</span><span>✉︎ send</span></p>
      <p class="sd-comment"><b>@mai</b> ${comment}</p></div>`).join('')}</div>`,
  letters: () => document.querySelector('.mock-mail')?.outerHTML.replace('class="mock mock-mail"', 'class="mock mock-mail sd-cal"') || '',
  calendar: () => document.querySelector('.mock-cal')?.outerHTML.replace('class="mock mock-cal"', 'class="mock mock-cal sd-cal"') || '',
};
async function openSurvey(from = 'popup') {
  closeSheets(); // everyone sees the intro; sign-in is asked when they tap Start
  try { survey.def = survey.def || await fetch('/survey').then((response) => response.json()); } catch { showError('The survey didn’t load. Try again in a moment.', null); return; }
  const done = state.surveyed || survey.def.done;
  $('#survey-intro').hidden = done; $('#survey-form').hidden = true; $('#survey-thanks').hidden = !done;
  coinify($('#survey-sheet'));
  openSheet('#survey-sheet');
  track('survey', { action: done ? 'reopened_done' : 'shown', from, ui: 'v2' }); // v2 = reward-first intro (30 Sep)
}
// Words for the survey's minimum: spaces split words; Chinese/Japanese/Korean characters count one each.
const surveyWords = (text) => { const t = String(text || '').trim(); if (!t) return 0; const cjk = (t.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g) || []).length; return t.replace(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g, ' ').split(/\s+/).filter(Boolean).length + cjk; };
function renderSurveyStep() {
  const qs = survey.def.questions, q = qs[survey.step], value = survey.answers[q.key];
  // Log each question the first time it's seen: the last one reached shows where people stop.
  survey.seen = survey.seen || new Set();
  if (!survey.seen.has(q.key)) { survey.seen.add(q.key); track('survey', { action: 'step', step: survey.step + 1, key: q.key, of: qs.length }); }
  $('#survey-bar').style.width = `${((survey.step + 1) / qs.length) * 100}%`;
  $('#survey-step').textContent = `${survey.step + 1} of ${qs.length}`;
  $('#survey-question').innerHTML = rich(q.title);
  $('#survey-hint').innerHTML = rich(q.hint || ''); $('#survey-hint').hidden = !q.hint;
  $('#survey-status').textContent = '';
  $('#survey-demo').innerHTML = SURVEY_DEMOS[q.demo]?.() || '';
  $('#survey-answers').innerHTML = q.type === 'text'
    ? `<textarea class="feedback-text" id="survey-text" rows="3" maxlength="${q.maxChars || 1000}" placeholder="${esc(q.placeholder || '')}">${esc(value || '')}</textarea><p class="survey-count" id="survey-count"></p>`
    : (q.groups ? surveyGroups(q, value) : [...q.options, OTHER].map((option) => surveyChip(q, value, option)).join(''))
      + surveyNote(q, value);
  if (q.type === 'text') {
    const count = () => {
      const text = $('#survey-text').value.trim(), words = surveyWords(text);
      $('#survey-count').textContent = q.minWords && (text || !q.optional) ? (words < q.minWords ? `${words}/${q.minWords} words` : `${words} words ✓`) : q.minChars && (text.length || !q.optional) ? (text.length < q.minChars ? `${text.length}/${q.minChars} letters` : `${text.length} letters ✓`) : q.maxWords ? `${words}/${q.maxWords} words` : '';
    };
    count(); $('#survey-text').addEventListener('input', count);
  }
  $('#survey-sheet').scrollTop = 0;
  $('#survey-back').style.visibility = survey.step ? 'visible' : 'hidden';
  $('#survey-next').textContent = survey.step === qs.length - 1 ? 'Send' : 'Next';
}
const surveyPicked = (q, value, option) => (q.type === 'many' ? (value || []).includes(option) : value === option);
const surveyChip = (q, value, option, label = option) => `<button type="button" class="survey-option${option === OTHER ? ' other' : ''}" data-option="${esc(option)}" aria-pressed="${surveyPicked(q, value, option)}">${withCoins(esc(label))}${option === OTHER ? '…' : ''}</button>`;
// Long price lists as a small table: one row per kind of plan, prices as chips ("Weekly  $0.49  $0.99").
function surveyGroups(q, value) {
  const short = (option) => option.replace(/^(Weekly|Monthly|Yearly|Yes),\s*(about\s*)?/, '').replace(/^Pay once,\s*/, '');
  return `<div class="survey-groups">${q.groups.map((g) => `<div class="survey-group"><span class="survey-group-label">${esc(g.label)}</span><div>${g.options.map((o) => surveyChip(q, value, o, short(o))).join('')}</div></div>`).join('')}</div>${surveyChip(q, value, OTHER)}`;
}
// The optional words under a choice: "Something else" → what; Not for me / Nice to have → why.
function surveyNote(q, value) {
  const picked = [].concat(value ?? []), notes = [];
  if (picked.includes(OTHER)) notes.push([`${q.key}_other`, 'Tell us (optional)']);
  const whyPrompt = q.whyFor?.[value];
  if (whyPrompt) notes.push([`${q.key}_why`, `${whyPrompt} (optional)`]);
  return notes.map(([key, label]) => `<label class="survey-note"><span>${esc(label)}</span><input type="text" data-note="${key}" maxlength="300" value="${esc(survey.answers[key] || '')}" /></label>`).join('');
}
function readSurveyText() {
  const q = survey.def.questions[survey.step];
  if (q.type === 'text') survey.answers[q.key] = $('#survey-text').value.trim();
  document.querySelectorAll('#survey-answers [data-note]').forEach((input) => { survey.answers[input.dataset.note] = input.value.trim(); });
}
// Sign-in is asked at the start, never at the end. Answers so far are kept on the phone, so a
// sign-in (which reloads the page) or an expired session picks up at the same question.
const SURVEY_DRAFT = 'withlove-survey-draft';
const saveSurveyDraft = () => { try { localStorage.setItem(SURVEY_DRAFT, JSON.stringify({ step: survey.step, answers: survey.answers })); } catch {} };
$('#survey-start').addEventListener('click', () => {
  if (!state.signedIn) { try { localStorage.setItem('withlove-survey-resume', '1'); } catch {} closeSheets(); openLogin('survey'); return; }
  let draft = null; try { draft = JSON.parse(localStorage.getItem(SURVEY_DRAFT) || 'null'); } catch {}
  survey.step = draft ? Math.min(draft.step, survey.def.questions.length - 1) : 0; if (draft) survey.answers = draft.answers || {};
  $('#survey-intro').hidden = true; $('#survey-form').hidden = false; renderSurveyStep(); track('survey', { action: draft ? 'resumed' : 'started', ui: 'v2' });
});
$('#survey-later').addEventListener('click', () => { closeSheets(); track('survey', { action: 'later' }); });
$('#survey-close').addEventListener('click', () => { if (!$('#survey-form').hidden) track('survey', { action: 'closed', step: survey.step }); closeSheets(); });
$('#survey-answers').addEventListener('click', (event) => {
  const b = event.target.closest('[data-option]'); if (!b) return;
  const q = survey.def.questions[survey.step];
  if (q.type === 'many') { readSurveyText(); const set = new Set(survey.answers[q.key] || []); set.has(b.dataset.option) ? set.delete(b.dataset.option) : set.add(b.dataset.option); survey.answers[q.key] = [...set]; renderSurveyStep(); return; }
  readSurveyText(); survey.answers[q.key] = b.dataset.option; renderSurveyStep();
  if ($('#survey-answers [data-note]')) return; // room to say more: stay on this question (no keyboard until they tap it)
  setTimeout(() => { if (survey.def.questions[survey.step] === q && survey.step < survey.def.questions.length - 1) { survey.step += 1; renderSurveyStep(); } }, 220); // one tap moves on
});
// iPhone: tapping Next while typing first closes the keyboard, the sheet slides down, and the tap
// misses the button. Keeping focus on pointerdown means the first tap always lands.
['#survey-next', '#survey-back'].forEach((id) => $(id).addEventListener('pointerdown', (event) => { if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) event.preventDefault(); }));
$('#survey-back').addEventListener('click', () => { readSurveyText(); survey.step = Math.max(0, survey.step - 1); renderSurveyStep(); });
$('#survey-form').addEventListener('submit', async (event) => {
  event.preventDefault(); readSurveyText();
  const qs = survey.def.questions, q = qs[survey.step], value = survey.answers[q.key];
  if (!q.optional && (value == null || value === '' || (Array.isArray(value) && !value.length))) { $('#survey-status').textContent = q.type === 'text' ? (q.minWords ? `Write at least ${q.minWords} words first.` : 'Write a sentence first.') : 'Pick an answer first.'; return; }
  if (q.type === 'text' && value && (value.length < (q.minChars || 0) || surveyWords(value) < (q.minWords || 0))) { $('#survey-status').textContent = q.minWords ? `A little more please: at least ${q.minWords} words.` : `A little more please (at least ${q.minChars} letters).`; return; }
  if (q.type === 'text' && q.maxWords && value && value.split(/\s+/).length > q.maxWords) { $('#survey-status').textContent = `Please keep it under ${q.maxWords} words.`; return; }
  if (survey.step < qs.length - 1) { survey.step += 1; saveSurveyDraft(); renderSurveyStep(); return; }
  $('#survey-next').disabled = true; $('#survey-status').textContent = 'Sending…';
  try {
    const response = await fetch('/survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: survey.answers }) });
    const body = await response.json();
    if (response.status === 401) { saveSurveyDraft(); try { localStorage.setItem('withlove-survey-resume', '1'); } catch {} state.signedIn = false; closeSheets(); openLogin('survey'); return; } // session ran out: sign in, then carry on
    if (!response.ok) { $('#survey-status').textContent = body.error || 'Couldn’t send.'; const i = qs.findIndex((x) => x.key === body.missing); if (i >= 0) { survey.step = i; renderSurveyStep(); } return; }
    state.surveyed = true; survey.def.done = true;
    mail.letters = mail.letters.filter((letter) => letter.opens !== 'survey'); renderMe();
    try { localStorage.removeItem(SURVEY_DRAFT); } catch {}
    if (body.gems) perks.gems = (perks.gems || 0) + body.gems;
    $('#survey-form').hidden = true; $('#survey-thanks').hidden = false;
  } catch { $('#survey-status').textContent = 'Couldn’t send. Check your connection and try again.'; } finally { $('#survey-next').disabled = false; }
});
// Every signed-in person who hasn't taken it is asked once per visit, but only right after they've
// taken a With Love out (share/save), never when they open the app to shoot. Done = never again.
function resumeSurvey() {
  // Back from signing in to take the survey: straight back into it, at the same question.
  if (!state.signedIn || !store.get('withlove-survey-resume')) return;
  try { localStorage.removeItem('withlove-survey-resume'); } catch {}
  if (state.surveyed !== true) openSurvey('resume').then(() => $('#survey-start').click());
}
function surveyDue() {
  if (!state.signedIn || state.surveyed !== false || IN_APP) return false;
  try { return !sessionStorage.getItem('withlove-survey-shown'); } catch { return true; }
}
function maybeAskSurvey(tries = 0) {
  if (!surveyDue() || !interrupts.cardMade || interrupts.used) return;
  const busy = somethingOpen() || !screens.camera.hidden;
  if (busy) { if (tries < 40) setTimeout(() => maybeAskSurvey(tries + 1), 1500); return; } // e.g. the "Save to Photos" sheet still up
  try { sessionStorage.setItem('withlove-survey-shown', '1'); } catch {}
  usedInterrupt();
  openSurvey('popup');
}

// iPhone keyboard: sheets sit on top of it instead of under it, so the buttons stay reachable.
// visualViewport shrinks when the keyboard opens; --kb is how much of the screen it covers.
if (window.visualViewport) {
  const fitKeyboard = () => {
    const vv = window.visualViewport, covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', `${covered}px`);
    document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
    const field = document.activeElement;
    if (covered && field?.closest?.('.sheet') && /INPUT|TEXTAREA/.test(field.tagName)) field.scrollIntoView({ block: 'nearest' });
  };
  visualViewport.addEventListener('resize', fitKeyboard); visualViewport.addEventListener('scroll', fitKeyboard);
}

// The feedback sheet. from='launch' (the App Store sheet's "Contribute ideas") asks for an idea instead
// and tags the note, so the dashboard can tell where it came from. Guests can send it too.
let feedbackFrom = null;
const FEEDBACK_COPY = {
  default: { title: $('#feedback-title').textContent, note: $('#feedback-sheet .sheet-note').textContent, placeholder: $('#feedback-message').placeholder },
  quote: { title: 'A funny quote from your country', note: 'Something people say where you live, in any language. We turn the best ones into frames.', placeholder: 'e.g. a saying your friends use all the time', button: 'Send my quote', updates: true },
  launch: { title: 'Your idea for With Love', note: 'What should we make next? Write in any language.', placeholder: 'e.g. a frame for rainy days', button: 'Send my idea', updates: true },
};
FEEDBACK_COPY.default.button = $('#feedback-send').textContent;
// The updates box starts ticked (Maddy, 8 Oct 2026), except where the law wants an unticked box (EU/EEA/UK): /config says.
// Never pre-ticked: the email provider counts only an explicit tick as consent (Mailjet, 17 Oct 2026).
const updatesTicked = false;
function openFeedback(from = null) {
  closeSheets();
  feedbackFrom = from;
  const copy = FEEDBACK_COPY[from] || FEEDBACK_COPY.default;
  $('#feedback-title').textContent = copy.title; $('#feedback-sheet .sheet-note').textContent = copy.note; $('#feedback-message').placeholder = copy.placeholder;
  $('#feedback-send').textContent = copy.button;
  $('#feedback-status').textContent = '';
  $('#feedback-form').hidden = false; $('#feedback-thanks').hidden = true; $('#feedback-sheet').classList.remove('sent');
  // Guests sending an idea from the App Store sheet can leave an email for updates. Signed-in people
  // aren't asked: we already have their account email (Maddy, 8 Oct 2026).
  $('#updates-optin').hidden = !copy.updates || Boolean(state.signedIn);
  $('#updates-check').checked = updatesTicked;
  openSheet('#feedback-sheet');
}
$('#connect-feedback').addEventListener('click', () => { openFeedback(); track('mailbox', { action: 'feedback' }); });
// Change the star picture: resized on the phone, saved to their account.
$('#me-star').addEventListener('click', () => { if (!state.signedIn) { openLogin('avatar'); return; } $('#me-photo-input').click(); });
$('#me-photo-input').addEventListener('change', async (event) => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height), c = document.createElement('canvas'); c.width = c.height = 480;
    c.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 480, 480);
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.9));
    const response = await fetch('/profile/avatar', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'upload failed');
    state.me = { ...state.me, avatar: body.avatar };
    renderMe(); renderMeSheet(); track('mailbox', { action: 'avatar' });
  } catch (error) { reportClient('avatar', error); track('mailbox', { action: 'avatar_failed' }); showError('That picture didn’t work. Try another one.', null); }
});
// ---- With Love news emails (app/consent.mjs on the server) ----
// The sign-in sheet's unticked box and the Profile switch. A tick in the sign-in sheet is kept on this
// browser through the Google redirect and recorded once the account is signed in.
const NEWS_VERSION = 'news-v1';
function newsPending(on) { try { if (on) localStorage.setItem('withlove-news-pending', JSON.stringify({ version: NEWS_VERSION, at: Date.now() })); else localStorage.removeItem('withlove-news-pending'); } catch {} }
async function postNews(given, source) {
  const response = await fetch('/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ given, source, version: NEWS_VERSION, page: location.pathname }) });
  if (!response.ok) throw new Error('consent not saved');
  state.news = given; newsKnown = true; newsLoaded = Promise.resolve(); renderNews();
}
// The switch's answer is asked once, when Profile first opens (GET /consent), not on every app start.
let newsLoaded = null, newsKnown = false;
function loadNews() {
  if (!state.signedIn) return Promise.resolve();
  newsLoaded ||= fetch('/consent').then((response) => (response.ok ? response.json() : Promise.reject(new Error('consent not loaded'))))
    .then((body) => { state.news = body.news ?? null; newsKnown = true; })
    .catch((error) => { newsLoaded = null; throw error; })
    .finally(renderNews);
  return newsLoaded;
}
async function sendPendingNews() {
  let pending = null; try { pending = JSON.parse(localStorage.getItem('withlove-news-pending') || 'null'); } catch {}
  if (!pending || !state.signedIn) return;
  if (Date.now() - pending.at > 30 * 60e3) { newsPending(false); return; } // a tick from an abandoned sign-in doesn't count
  try { await postNews(true, 'login'); newsPending(false); } catch (error) { console.warn(error); }
}
function renderNews() {
  $('#privacy-news-row').hidden = !state.signedIn;
  $('#privacy-news').setAttribute('aria-checked', String(state.news === true));
  $('#privacy-news').setAttribute('aria-busy', String(state.signedIn && !newsKnown)); // until the answer is known
}
$('#login-news').addEventListener('change', (event) => newsPending(event.target.checked));
$('#privacy-news').addEventListener('click', async () => {
  try { await loadNews(); await postNews(state.news !== true, 'profile'); } catch { saveToast('That didn’t save', 'Try again in a moment.'); }
});
function openMe() {
  closeSheets(); renderMeSheet(); renderNews(); loadNews().catch(() => {}); openSheet('#me-sheet');
  track('mailbox', { action: 'open', unread: unreadCount() });
}
$('#me-actions').addEventListener('click', (event) => {
  const action = event.target.closest('[data-me]')?.dataset.me; if (!action) return;
  track('mailbox', { action: 'profile', button: action });
  if (action === 'signin') openLogin();
  if (action === 'phone') { closeSheets(); renderPhoneDemo(); $('#home-intro').hidden = true; showHomeGuide('header'); }
  if (action === 'signout') { closeSheets(); signOut(); }
  if (action === 'perks') openPerks({ from: 'profile' });
});
$('#mail-list').addEventListener('click', (event) => {
  const id = event.target.closest('[data-letter]')?.dataset.letter; if (id) openLetter(id);
});

// Demos inside letters: always live, so people see the feature before they try it.
const OCTOBER_DEMO = ['oct-fell-in-love-handwritten', 'oct-sang-thu-handwritten', 'oct-maple-swarm', 'oct-autumn', 'oct-trick-or-treat'];
const BADDIES_DEMO = ['word-idgaf', 'baddie-i-quit', 'word-too-sexy', 'baddie-academic-victim', 'word-woke-up', 'word-whatever'];
const LETTER_DEMOS = {
  checkin: () => `<div class="demo-checkin">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<span class="ck-day${n < 6 ? ' done' : ''}${n === 3 ? ' big' : ''}${n === 6 ? ' today' : ''}" style="animation-delay:${n * 0.35}s"><b>${n}</b>${n < 6 ? `<em><img src="./vision/coin.svg" alt="" />+${n === 3 ? 30 : 10}</em>` : ''}</span>`).join('')}</div><p class="sheet-note small">1 card a day = +10 · 6 cards = +30</p>`,
  recap: () => '<img class="demo-recap" src="./recap/og.jpg" alt="The September recap: six photo stamps and jewelled September so far" />',
  october: () => `<div class="demo-baddies demo-october"><img src="./mail/october-photobooth.webp" alt="" style="animation-delay:0s"/>${OCTOBER_DEMO.map((key, i) => `<img src="./mail/october-${key}.webp" alt="" style="animation-delay:${(i + 1) * 2}s"/>`).join('')}</div>`,
  baddies: () => `<div class="demo-baddies">${BADDIES_DEMO.map((key, i) => `<img src="./mail/baddies-${key}.webp" alt="" style="animation-delay:${i * 2}s"/>`).join('')}</div>`,
  pop: () => `<div class="demo-pop"><img src="./mail/pop-off.webp" alt="Stars lying flat on the paper" /><img class="demo-pop-on" src="./mail/pop-on.webp" alt="The same stars casting a soft shadow" /></div>
    <div class="select-row demo-row"><span>pop <span class="pop-spark" aria-hidden="true">✦</span> <span class="pop-hint">try it</span></span><button type="button" class="toggle" id="demo-pop-toggle" role="switch" aria-checked="true" aria-label="Pop shadow"><span></span></button></div>`,
  grain: () => `<div class="demo-pop"><img src="./mail/grain-off.webp" alt="A sea photo with no grain" /><img class="demo-pop-on" src="./mail/grain-on.webp" alt="The same photo with With Love's usual grain" /></div>
    <div class="select-row demo-row"><span>grain <span class="pop-hint">try it</span></span><button type="button" class="toggle" id="demo-grain-toggle" role="switch" aria-checked="true" aria-label="Grain"><span></span></button></div>`,
  move: () => `<div class="demo-move" id="demo-move"><div class="dm-photo"></div><div class="dm-window"><div class="dm-photo bright"></div></div><span class="dm-hand" aria-hidden="true"></span></div>
    <p class="sheet-note small demo-move-hint">Drag the photo. The bright stamp is what shows.</p>`,
  templates: () => `<video class="demo-video" src="./mail/video-templates.mp4?v=2" poster="./mail/video-templates.jpg" muted loop playsinline autoplay></video>`,
  earned: (letter) => `<div class="demo-earned"><img class="de-coin" src="./vision/coin.svg" alt="" /><b class="de-plus">+${(letter?.title?.match(/\+(\d+)/) || [0, 100])[1]}</b><span class="de-label">gems</span></div>`,
  gems: () => `<div class="demo-invite">
    <div class="di-person"><img src="./vision/sticker-daisies.webp" alt="" /><span>you</span><b class="di-coin"><img src="./vision/coin.svg" alt="" />+100</b></div>
    <div class="di-path"><span class="di-letter" aria-hidden="true">✉</span></div>
    <div class="di-person"><img src="./vision/sticker-lamb.webp" alt="" /><span>your friend</span><b class="di-coin"><img src="./vision/coin.svg" alt="" />+100</b></div>
    <p class="di-step sheet-note small" id="di-step">1. You share your link</p></div>`,
  camera: () => `<div class="demo-cam"><div class="demo-vf"><img src="./lily-strip.jpg" alt="" /><span class="demo-fingers" aria-hidden="true"><i></i><i></i></span></div>
    <div class="zoom-pills demo-pills">${['0.5', '1', '2'].map((z) => `<button type="button" data-demo-zoom="${z}">${z.replace(/^0/, '')}</button>`).join('')}</div>
    <p class="sheet-note small">Tap a zoom, or watch it pinch.</p></div>`,
};
function startDemo(kind, letter) {
  clearInterval(state.demoTimer); state.demoTimer = null;
  const box = $('#letter-demo');
  box.innerHTML = LETTER_DEMOS[kind]?.(letter) || '';
  if (kind === 'pop') {
    const toggle = $('#demo-pop-toggle');
    toggle.addEventListener('click', () => {
      const on = toggle.getAttribute('aria-checked') !== 'true';
      toggle.setAttribute('aria-checked', on); box.querySelector('.demo-pop-on').style.opacity = on ? 1 : 0;
      track('mailbox', { action: 'demo', demo: 'pop', on });
    });
  }
  if (kind === 'grain') {
    const toggle = $('#demo-grain-toggle');
    toggle.addEventListener('click', () => {
      const on = toggle.getAttribute('aria-checked') !== 'true';
      toggle.setAttribute('aria-checked', on); box.querySelector('.demo-pop-on').style.opacity = on ? 1 : 0;
      track('mailbox', { action: 'demo', demo: 'grain', on });
    });
  }
  if (kind === 'move') {
    // The photo glides left and right on its own until you drag it yourself.
    const box = $('#demo-move'), photos = box.querySelectorAll('.dm-photo');
    // Line the bright copy (inside the stamp window) up with the dim photo behind it.
    const win = box.querySelector('.dm-window'), w = box.clientWidth;
    Object.assign(box.querySelector('.dm-photo.bright').style, { left: `${-(win.offsetLeft) - 70}px`, top: `${-(win.offsetTop) - 10}px`, width: `${w + 140}px`, height: `${box.clientHeight + 20}px`, right: 'auto', bottom: 'auto' });
    let x = 0, t = 0, dragging = null;
    const place = () => photos.forEach((p) => { p.style.setProperty('--x', `${x}px`); });
    state.demoTimer = setInterval(() => { if (dragging !== null) return; t += 0.05; x = Math.sin(t) * 38; place(); }, 50);
    box.addEventListener('pointerdown', (event) => { box.setPointerCapture(event.pointerId); dragging = event.clientX - x; box.classList.add('touched'); track('mailbox', { action: 'demo', demo: 'move' }); });
    box.addEventListener('pointermove', (event) => { if (dragging === null) return; x = Math.max(-60, Math.min(60, event.clientX - dragging)); place(); });
    const up = () => { dragging = null; t = Math.asin(Math.max(-1, Math.min(1, x / 38))); };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  }
  if (kind === 'earned') {
    const pop = () => { const b = $('.demo-earned'); if (!b) return; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); };
    pop(); state.demoTimer = setInterval(pop, 2600);
  }
  if (kind === 'gems') {
    const steps = ['1. You share your link', '2. Your friend signs in with Google', '3. You both get 100 gems ✦'];
    let i = 0;
    const show = () => { const box2 = $('.demo-invite'); if (!box2) return; box2.dataset.step = i; $('#di-step').textContent = steps[i]; i = (i + 1) % steps.length; };
    show(); state.demoTimer = setInterval(show, 1800);
  }
  if (kind === 'camera') {
    const zooms = ['0.5', '1', '2'], scale = { 0.5: 1, 1: 1.45, 2: 2.1 };
    let i = 1;
    const set = (z) => {
      box.querySelector('.demo-vf img').style.transform = `scale(${scale[z]})`;
      box.querySelectorAll('[data-demo-zoom]').forEach((b) => { const own = b.dataset.demoZoom.replace(/^0/, ''), on = b.dataset.demoZoom === z; b.setAttribute('aria-pressed', on); b.textContent = on ? `${own}×` : own; });
    };
    set('1');
    state.demoTimer = setInterval(() => { i = (i + 1) % zooms.length; set(zooms[i]); box.querySelector('.demo-fingers').classList.toggle('apart', zooms[i] === '2'); }, 1700);
    box.querySelector('.demo-pills').addEventListener('click', (event) => {
      const b = event.target.closest('[data-demo-zoom]'); if (!b) return;
      clearInterval(state.demoTimer); state.demoTimer = null; set(b.dataset.demoZoom); track('mailbox', { action: 'demo', demo: 'camera', zoom: b.dataset.demoZoom });
    });
  }
}
function openLetter(id) {
  const letter = mail.letters.find((item) => item.id === id); if (!letter) return;
  mail.read.add(id);
  try { localStorage.setItem('withlove-mail-read', JSON.stringify([...mail.read])); } catch {}
  renderMe();
  // Some letters are just a door: the survey letter opens the survey's own intro (video + promise).
  if (letter.opens === 'survey') { track('mailbox', { action: 'read', letter: id }); openSurvey('letter'); return; }
  $('#letter-from').textContent = `from ${letter.from} · ${letter.date}`;
  $('#letter-title').textContent = letter.title;
  $('#letter-body').innerHTML = (letter.lines || []).map((line) => `<p>${esc(line)}</p>`).join('');
  $('#letter-cta').textContent = letter.cta?.label || 'Got it';
  $('#letter-cta').dataset.action = letter.cta?.action || '';
  $('#letter-cta').dataset.url = letter.cta?.url || '';
  closeSheets(); openSheet('#letter-sheet'); coinify($('#letter-sheet'));
  startDemo(letter.demo, letter);
  track('mailbox', { action: 'read', letter: id });
}
$('#letter-back').addEventListener('click', () => { clearInterval(state.demoTimer); track('mailbox', { action: 'back' }); openMe(); });
$('#letter-cta').addEventListener('click', () => {
  const action = $('#letter-cta').dataset.action;
  clearInterval(state.demoTimer); closeSheets();
  track('mailbox', { action: 'cta', cta: action });
  // A link out (e.g. the drop's Instagram post): opens in a new tab, straight from the tap.
  if (action === 'url' && /^https:\/\//.test($('#letter-cta').dataset.url)) window.open($('#letter-cta').dataset.url, '_blank', 'noopener');
  if (action === 'camera') openCamera();
  if (action === 'perks') openPerks({ from: 'letter' });
  if (action === 'survey') openSurvey('letter');
  if (action === 'checkin') { openMe(); setTimeout(() => $('#checkin').scrollIntoView({ behavior: 'smooth', block: 'center' }), 250); }
  if (action === 'recap') openRecap();
  if (action === 'frames') {
    if (!state.file) { openLibrary(); return; } // pick a photo first; the drop leads the frame picker
    show('story'); openFrameGallery();
  }
  if (action === 'move') {
    if (!state.file || state.video) { openLibrary(); return; } // pick a photo first; Move & zoom is in the adjust tab
    show('story'); setTab('adjust'); openMove();
  }
  if (action === 'grain') {
    if (!state.file || state.video) { openLibrary(); return; } // pick a photo first; the grain dial is in the adjust tab
    show('story'); setTab('adjust'); adjustKey = 'grain'; paintAdjust();
  }
  if (action === 'style') {
    if (!state.file) { openLibrary(); return; } // pick a photo first, then the style tab is right there
    show('story'); setTab('style'); setTimeout(() => $('#pop-row').scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  }
});

// Feedback: open from any screen, sent with what the person was looking at.
$('#feedback-open').addEventListener('click', () => { closeSheets(); $('#feedback-status').textContent = ''; openSheet('#feedback-sheet'); $('#feedback-message').focus(); });
$('#feedback-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#feedback-message').value.trim();
  const optin = !$('#updates-optin').hidden && $('#updates-check').checked;
  const email = $('#updates-email').value.trim();
  const updates = optin && Boolean(email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { $('#feedback-status').textContent = 'That email doesn’t look right.'; return; }
  if (!message && !updates) { $('#feedback-status').textContent = 'Write a few words first.'; return; }
  const send = $('#feedback-send'); send.disabled = true; $('#feedback-status').textContent = 'Sending…';
  try {
    const response = await fetch('/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, page: location.pathname, ...(updates && { updates: true, updatesEmail: email || null }), context: { screen: screens.story.hidden ? 'landing' : 'story', photo: state.photoId, template: state.template, paper: state.paper, signedIn: state.signedIn, ...(feedbackFrom && { from: feedbackFrom }) } }) });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'send failed');
    const result = await response.json().catch(() => ({}));
    $('#feedback-message').value = ''; $('#updates-email').value = ''; $('#feedback-status').textContent = '';
    $('#feedback-thanks-note').textContent = result.updatesEmail ? `We read every note. Updates will come to ${result.updatesEmail}.` : 'We read every note.';
    $('#feedback-form').hidden = true; $('#feedback-thanks').hidden = false; $('#feedback-sheet').classList.add('sent');
    if (updates) track('updates', { action: 'subscribed', from: feedbackFrom || 'feedback' });
  } catch (error) { $('#feedback-status').textContent = 'Couldn\'t send. Check your connection and try again.'; } finally { send.disabled = false; }
});
$('#theme-chips').addEventListener('click', (event) => {
  const chip = event.target.closest('.theme-chip'); if (!chip) return;
  if (chip.dataset.recap) { track('recap', { action: 'open', from: gallery.forCamera ? 'camera_frames' : 'frames' }); closeSheets(); openRecap(); return; }
  gallery.theme = chip.dataset.theme; renderFrameGallery();
});
$('#quote-chips').addEventListener('click', (event) => {
  const chip = event.target.closest('.sub-chip'); if (!chip) return;
  if (chip.dataset.suggest) { track('quotes', { action: 'suggest', from: gallery.forCamera ? 'camera_frames' : 'frames' }); openFeedback('quote'); return; }
  if (chip.dataset.part) { gallery.octoberPart = chip.dataset.part; track('october', { action: 'part', part: chip.dataset.part }); }
  else { gallery.quoteLang = chip.dataset.lang; track('quotes', { action: 'language', lang: chip.dataset.lang }); }
  renderFrameGallery(); $('#frame-gallery').parentElement.scrollTop = 0;
});
$('#frame-gallery').addEventListener('click', (event) => {
  const tile = event.target.closest('.tile'); if (!tile) return;
  const key = tile.dataset.key;
  if (key === BOOTH_TILE) { closeSheets(); track('booth', { action: 'tile', from: gallery.forCamera ? 'camera_frames' : 'frames' }); window.openBooth?.(); return; }
  if (key === state.template) { closeSheets(); return; }
  if (!canStyle()) { requireLogin('frame'); return; }
  // From the camera: in-app visitors pick freely (no editor change used), then back to the viewfinder.
  if (gallery.forCamera) { closeSheets(); useCameraFrame(key); return; }
  if (!allowInAppStyleChange('frame')) return;
  state.template = key; track('pick_template', { from: 'gallery' }); rememberTemplate(key); loadFrameQuote(); closeSheets(); renderPickers(); rerender('Trying a new frame…');
});
$('#pop-toggle').addEventListener('click', () => {
  if (!canStyle()) { requireLogin('pop'); return; }
  if (!allowInAppStyleChange('pop')) return;
  state.pop = !state.pop;
  try { localStorage.setItem('withlove-pop', state.pop ? '1' : '0'); } catch {}
  track('pop_toggle', { on: state.pop }); renderPickers();
  rerender(state.pop ? 'Lifting the pieces off the paper…' : 'Laying the pieces flat…');
});
$('#paper-gallery').addEventListener('click', (event) => {
  const tile = event.target.closest('.tile'); if (!tile) return;
  const key = tile.dataset.key;
  if (key !== state.paper && !canStyle()) { requireLogin('paper'); return; }
  const changed = key !== state.paper || state.styleDirty;
  if (key !== state.paper && !allowInAppStyleChange('paper')) return;
  state.paper = key; track('pick_paper'); state.styleDirty = false; closeSheets(); renderPickers();
  if (changed) rerender('Changing the paper…');
});
const SWATCH_LINES = { paperColor: 'Tinting the paper…', vectorColor: 'Recoloring your frame…', color: 'Re-inking your words…' };
document.addEventListener('click', (event) => {
  const swatch = event.target.closest('.swatch'); if (!swatch) return;
  const group = swatch.closest('[data-group]')?.dataset.group; if (!group) return; // recap colour dots have their own handler
  if (!canStyle()) { requireLogin('color'); return; }
  if (state[group] === swatch.dataset.color) return;
  if (!allowInAppStyleChange('color')) return;
  const inPaperGallery = Boolean(swatch.closest('#paper-sheet')); // before renderSwatches() detaches it
  state[group] = swatch.dataset.color; renderSwatches();
  // Inside the paper gallery, only refresh the previews; the story re-renders once the sheet closes.
  if (inPaperGallery) { state.styleDirty = true; renderPaperGallery(); renderPickers(); return; }
  renderPickers(); rerender(SWATCH_LINES[group]);
});
$('#style-card').addEventListener('click', (event) => { if (!canStyle() && event.target.closest('.select-row')) requireLogin(); });
$('#actions').addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'gate') openLogin(event.target.closest('[data-want]')?.dataset.want);
  if (['share', 'animation'].includes(action)) track(action);
  if (action === 'save') track('download'); // counted as downloads in template_usage
  if (action === 'share') share().catch((error) => showError('Sharing failed.', share));
  if (action === 'save') saveCard().catch((error) => { console.error(error); showError('Saving didn’t work.', saveCard); });
  if (action === 'animation') downloadAnimation().catch((error) => { console.error(error); showError(error.message.includes('cannot record') ? 'This browser can’t record video. Try Safari or Chrome on your phone.' : 'The animation didn’t come out.', downloadAnimation); });
});

boot().catch((error) => { console.error(error); showError('With Love couldn\'t start. Check your connection.', () => location.reload()); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch((error) => console.warn('service worker', error));
