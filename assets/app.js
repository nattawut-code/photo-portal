const DEFAULT_EVENTS = [{ id: 'science-day-2026', title: 'กิจกรรมวันวิทยาศาสตร์ 2569', date: '24 สิงหาคม 2569', count: 100, albumUrl: 'https://photos.google.com/' }];
let EVENTS = DEFAULT_EVENTS;
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';
let currentEvent, selectedFile, indexData, modelsReady = false;
const $ = (s) => document.querySelector(s);
const screens = ['home', 'search', 'results'];
function go(name) { screens.forEach((id) => $(`#${id}`).classList.toggle('active', id === name)); location.hash = name; window.scrollTo(0, 0); }
function status(text) { $('#search-status').textContent = text; }
function demoImage(id) { return `https://picsum.photos/seed/photo-portal-${id}/500/500`; }
function showEvents() { $('#event-list').innerHTML = EVENTS.map(e => `<button class="event-card" data-event="${e.id}"><strong>${e.title}</strong><span>${e.date} · รูปทดสอบ ${e.count} รูป</span></button>`).join(''); }
async function loadModels() {
  if (modelsReady) return;
  status('กำลังโหลดระบบค้นหาบนเครื่อง…');
  try { await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL), faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)]); modelsReady = true; $('#find-button').disabled = !selectedFile; status('พร้อมค้นหา — รูปจะประมวลผลบนเครื่องนี้'); }
  catch { status('โหลดระบบค้นหาไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'); }
}
async function loadIndex() {
  if (!indexData) {
    indexData = await fetch('data/demo-index.json').then(r => r.json());
    // A 100-item browser-only mock index lets the team measure device speed before real, consented photos are indexed.
    if (!indexData.faces.length) indexData.faces = Array.from({length:100}, (_, i) => ({ photoId:`demo-${i+1}`, url:'https://photos.google.com/', thumbnail:demoImage(`sample-${i+1}`), descriptor:Array.from({length:128}, (_,j)=>Math.sin((i+1)*(j+3))*0.08) }));
  }
  return indexData;
}
function distance(a,b) { let sum=0; for(let i=0;i<a.length;i++) sum+=(a[i]-b[i])**2; return Math.sqrt(sum); }
async function descriptorFrom(file) { const img = await faceapi.bufferToImage(file); const found = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: .45 })).withFaceLandmarks().withFaceDescriptor(); return found?.descriptor; }
async function search() {
  if (!selectedFile || !modelsReady) return; $('#find-button').disabled = true; status('กำลังอ่านใบหน้าและค้นหา…');
  const descriptor = await descriptorFrom(selectedFile); if (!descriptor) { status('ไม่พบใบหน้าชัดเจน ลองใช้รูปที่เห็นหน้าตรงและมีคนเดียว'); $('#find-button').disabled=false; return; }
  const data = await loadIndex(); let matches = data.faces.map(x => ({...x, score: distance(descriptor, x.descriptor)})).sort((a,b)=>a.score-b.score).slice(0, 18).filter(x=>x.score < .75);
  if (!matches.length && data.note) matches = data.faces.slice(0, 12); // mock mode demonstrates the results UI only
  renderResults(matches); go('results'); $('#find-button').disabled=false;
}
function renderResults(matches) { $('#result-event-label').textContent = currentEvent.title; const mock = indexData?.note; $('#result-summary').textContent = mock ? 'โหมดตัวอย่าง: แสดงผล 12 รูปเพื่อทดสอบหน้าจอเท่านั้น' : (matches.length ? `พบ ${matches.length} รูปที่ใกล้เคียงที่สุดจากชุดทดสอบ` : 'ยังไม่พบรูปที่มั่นใจ — ลองใช้รูปอื่น หรือเปิดอัลบั้มทั้งหมด'); $('#results-grid').innerHTML = matches.map((x,i)=>`<a class="result-card" href="${x.url}" target="_blank" rel="noopener"><img src="${x.thumbnail || demoImage(x.photoId)}" alt="รูปผลลัพธ์ ${i+1}"><span>เปิดรูปใน Google Photos ↗</span></a>`).join(''); }
function downloadIndex() { const blob = new Blob([JSON.stringify({version:1, eventId:currentEvent?.id||'new-event', generatedAt:new Date().toISOString(), faces:builtFaces},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='face-index.json'; a.click(); URL.revokeObjectURL(a.href); }
let buildFiles=[], builtFaces=[];
fetch('data/events.json').then(r => r.ok ? r.json() : DEFAULT_EVENTS).then(events => { EVENTS = events; showEvents(); }).catch(showEvents);
document.addEventListener('click', async e => { const card=e.target.closest('[data-event]'); if(card){currentEvent=EVENTS.find(x=>x.id===card.dataset.event); $('#event-label').textContent=currentEvent.title; $('#open-album').onclick=()=>open(currentEvent.albumUrl,'_blank'); $('#results-album').onclick=()=>open(currentEvent.albumUrl,'_blank'); go('search'); loadModels();} const back=e.target.closest('[data-go]');if(back)go(back.dataset.go); });
$('#photo-input').addEventListener('change', e=>{selectedFile=e.target.files[0]; if(!selectedFile)return; $('#preview').src=URL.createObjectURL(selectedFile); $('#preview').classList.remove('hidden'); $('#preview-empty').classList.add('hidden'); $('#find-button').disabled=!modelsReady; status(modelsReady?'พร้อมค้นหา':'กำลังโหลดระบบค้นหา…');});
$('#find-button').onclick=search;
$('#index-input').addEventListener('change',e=>{buildFiles=[...e.target.files].slice(0,100); $('#build-index').disabled=!buildFiles.length; $('#index-status').textContent=`เลือกแล้ว ${buildFiles.length} รูป`;});
$('#build-index').onclick=async()=>{await loadModels(); if(!modelsReady)return; builtFaces=[]; for(let i=0;i<buildFiles.length;i++){ $('#index-status').textContent=`กำลังทำ Index ${i+1}/${buildFiles.length}…`; const d=await descriptorFrom(buildFiles[i]); if(d)builtFaces.push({photoId:`photo-${i+1}`,url:'https://photos.google.com/',thumbnail:'',descriptor:[...d]}); } $('#index-status').textContent=`เสร็จแล้ว ${builtFaces.length} ใบหน้า กำลังดาวน์โหลดไฟล์`; downloadIndex();};
