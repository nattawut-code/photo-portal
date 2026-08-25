const DEFAULT_EVENTS = [{ id: 'science-day-2026', title: 'กิจกรรมวันวิทยาศาสตร์ 2569', date: '24 สิงหาคม 2569', count: 100, albumUrl: 'https://photos.google.com/', indexFile: 'data/demo-index.json' }];
let EVENTS = DEFAULT_EVENTS;
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';
const MY_FACE_KEY = 'photo-portal-my-descriptor';
let currentEvent, selectedFile, modelsReady = false, myDescriptor = null;
const $ = (s) => document.querySelector(s);
const screens = ['home', 'search', 'results'];
function go(name) { screens.forEach((id) => $(`#${id}`).classList.toggle('active', id === name)); location.hash = name; window.scrollTo(0, 0); }
function status(text) { $('#search-status').textContent = text; }
function demoImage(id) { return `https://picsum.photos/seed/photo-portal-${id}/500/500`; }

// --- saved face (register once, reuse every visit) ---
function loadSavedFace() { try { const raw = localStorage.getItem(MY_FACE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function saveFace(descriptor) { try { localStorage.setItem(MY_FACE_KEY, JSON.stringify([...descriptor])); } catch { /* storage unavailable, ignore */ } }
function clearSavedFace() { try { localStorage.removeItem(MY_FACE_KEY); } catch { /* ignore */ } }

function showEvents() {
  $('#event-list').innerHTML = EVENTS.map(e => `<button class="event-card" data-event="${e.id}"><strong>${e.title}</strong><span>${e.date} · รูปทดสอบ ${e.count} รูป</span></button>`).join('');
  const saved = loadSavedFace();
  $('#quick-search').classList.toggle('hidden', !saved);
  $('#find-all-button').textContent = saved ? 'ค้นหารูปของฉันจากทุกกิจกรรม (ใช้ใบหน้าที่บันทึกไว้)' : 'ค้นหารูปของฉันจากทุกกิจกรรม';
}

async function loadModels() {
  if (modelsReady) return;
  status('กำลังโหลดระบบค้นหาบนเครื่อง…');
  try { await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL), faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)]); modelsReady = true; $('#find-button').disabled = !selectedFile; status('พร้อมค้นหา — รูปจะประมวลผลบนเครื่องนี้'); }
  catch { status('โหลดระบบค้นหาไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'); }
}

// each event may point at its own index file; fall back to the legacy shared demo-index.json
async function loadEventIndex(event) {
  const url = event.indexFile || 'data/demo-index.json';
  try {
    const data = await fetch(url).then(r => r.json());
    if (!data.faces?.length) return { faces: [] };
    return data;
  } catch { return { faces: [] }; }
}

function distance(a, b) { let sum = 0; for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2; return Math.sqrt(sum); }
async function descriptorFrom(file) { const img = await faceapi.bufferToImage(file); const found = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: .45 })).withFaceLandmarks().withFaceDescriptor(); return found?.descriptor; }

function matchAgainst(descriptor, faces) {
  return faces.map(x => ({ ...x, score: distance(descriptor, x.descriptor) })).sort((a, b) => a.score - b.score).filter(x => x.score < .75);
}

// search within one event only
async function searchSingleEvent(descriptor) {
  const data = await loadEventIndex(currentEvent);
  let matches = matchAgainst(descriptor, data.faces).slice(0, 18);
  if (!matches.length && data.note) matches = data.faces.slice(0, 12); // mock mode demonstrates the results UI only
  renderResults(matches, false);
}

// search across every event's index in one pass
async function searchAllEvents(descriptor) {
  const perEvent = await Promise.all(EVENTS.map(async (e) => {
    const data = await loadEventIndex(e);
    const matches = matchAgainst(descriptor, data.faces).slice(0, 12);
    return { event: e, matches };
  }));
  const grouped = perEvent.filter(g => g.matches.length);
  renderResults(grouped, true);
}

async function search() {
  if (!selectedFile || !modelsReady) return;
  $('#find-button').disabled = true; status('กำลังอ่านใบหน้าและค้นหา…');
  const descriptor = await descriptorFrom(selectedFile);
  if (!descriptor) { status('ไม่พบใบหน้าชัดเจน ลองใช้รูปที่เห็นหน้าตรงและมีคนเดียว'); $('#find-button').disabled = false; return; }
  saveFace(descriptor); myDescriptor = descriptor;
  if (currentEvent) await searchSingleEvent(descriptor); else await searchAllEvents(descriptor);
  go('results'); $('#find-button').disabled = false;
}

async function quickSearchAll() {
  const saved = loadSavedFace();
  if (!saved) return go('search');
  currentEvent = null;
  $('#event-label').textContent = 'ทุกกิจกรรม';
  go('search'); status('กำลังใช้ใบหน้าที่บันทึกไว้ค้นหาทุกกิจกรรม…');
  await loadModels();
  await searchAllEvents(saved);
  go('results');
}

function renderResults(payload, isAllEvents) {
  $('#results-grid').classList.toggle('stacked', isAllEvents);
  if (isAllEvents) {
    $('#result-event-label').textContent = 'ทุกกิจกรรม';
    const total = payload.reduce((n, g) => n + g.matches.length, 0);
    $('#result-summary').textContent = total ? `พบรูปของคุณใน ${payload.length} กิจกรรม (${total} รูป)` : 'ยังไม่พบรูปที่มั่นใจในกิจกรรมใดเลย — ลองใช้รูปอื่น';
    $('#results-grid').innerHTML = payload.map(({ event, matches }) => `
      <div class="result-group">
        <h3 class="result-group-title">${event.title}</h3>
        <div class="results-grid">
          ${matches.map((x, i) => `<a class="result-card" href="${x.url}" target="_blank" rel="noopener"><img src="${x.thumbnail || demoImage(x.photoId)}" alt="รูปผลลัพธ์ ${i + 1}"><span>เปิดรูปใน Google Photos ↗</span></a>`).join('')}
        </div>
      </div>`).join('');
    $('#results-album').classList.add('hidden');
  } else {
    $('#result-event-label').textContent = currentEvent.title;
    $('#result-summary').textContent = payload.length ? `พบ ${payload.length} รูปที่ใกล้เคียงที่สุดจากชุดทดสอบ` : 'ยังไม่พบรูปที่มั่นใจ — ลองใช้รูปอื่น หรือเปิดอัลบั้มทั้งหมด';
    $('#results-grid').innerHTML = payload.map((x, i) => `<a class="result-card" href="${x.url}" target="_blank" rel="noopener"><img src="${x.thumbnail || demoImage(x.photoId)}" alt="รูปผลลัพธ์ ${i + 1}"><span>เปิดรูปใน Google Photos ↗</span></a>`).join('');
    $('#results-album').classList.remove('hidden');
    $('#results-album').onclick = () => open(currentEvent.albumUrl, '_blank');
  }
}

fetch('data/events.json').then(r => r.ok ? r.json() : DEFAULT_EVENTS).then(events => { EVENTS = events; showEvents(); }).catch(showEvents);

document.addEventListener('click', async e => {
  const card = e.target.closest('[data-event]');
  if (card) { currentEvent = EVENTS.find(x => x.id === card.dataset.event); $('#event-label').textContent = currentEvent.title; $('#open-album').onclick = () => open(currentEvent.albumUrl, '_blank'); go('search'); loadModels(); }
  const back = e.target.closest('[data-go]'); if (back) go(back.dataset.go);
});

$('#find-all-button').onclick = () => {
  const saved = loadSavedFace();
  if (saved) return quickSearchAll();
  currentEvent = null; $('#event-label').textContent = 'ทุกกิจกรรม'; go('search'); loadModels();
};
$('#forget-face').onclick = () => { clearSavedFace(); showEvents(); };

$('#photo-input').addEventListener('change', e => { selectedFile = e.target.files[0]; if (!selectedFile) return; $('#preview').src = URL.createObjectURL(selectedFile); $('#preview').classList.remove('hidden'); $('#preview-empty').classList.add('hidden'); $('#find-button').disabled = !modelsReady; status(modelsReady ? 'พร้อมค้นหา' : 'กำลังโหลดระบบค้นหา…'); });
$('#find-button').onclick = search;
