// NOTE: this PIN only hides the admin page from casual visitors — it is visible to
// anyone who reads this file's source, so do not rely on it to protect student photos
// or face data. Change it to something non-obvious, and treat it as a light deterrent,
// not real access control, until this moves behind a real login.
const ADMIN_PIN='1234',MODEL_URL='https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model',DRIVE_SCOPE='https://www.googleapis.com/auth/drive.readonly';
const $=s=>document.querySelector(s);let token='',files=[],faces=[],ready=false;
function show(id){['login','admin'].forEach(x=>$('#'+x).classList.toggle('active',x===id));}function safeId(v){return v.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}function download(name,data){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),700);}
async function currentEvents(){try{const r=await fetch('data/events.json');return r.ok?await r.json():[];}catch{return [];}}
async function models(){if(ready)return true;$('#build-status').textContent='กำลังโหลดระบบ AI บนอุปกรณ์…';try{await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)]);ready=true;return true;}catch{$('#build-status').textContent='โหลดระบบ AI ไม่สำเร็จ';return false;}}
async function getFace(file){const image=await faceapi.bufferToImage(file);return faceapi.detectSingleFace(image,new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:.45})).withFaceLandmarks().withFaceDescriptor();}
$('#login-button').onclick=()=>{$('#pin').value===ADMIN_PIN?(sessionStorage.setItem('photo-portal-admin','1'),show('admin')):$('#login-status').textContent='รหัสไม่ถูกต้อง';};$('#logout').onclick=()=>{sessionStorage.removeItem('photo-portal-admin');show('login');};$('#event-title').oninput=()=>{$('#event-id').value=safeId($('#event-title').value)};
$('#drive-connect').onclick=()=>{const id=$('#google-client-id').value.trim();if(!id.endsWith('.apps.googleusercontent.com')){$('#drive-status').textContent='กรุณาใส่ Google OAuth Client ID';return;}if(!window.google?.accounts?.oauth2){$('#drive-status').textContent='กำลังโหลด Google Sign-In โปรดลองอีกครั้ง';return;}google.accounts.oauth2.initTokenClient({client_id:id,scope:DRIVE_SCOPE,callback:r=>{if(r.error){$('#drive-status').textContent=`เชื่อมไม่สำเร็จ: ${r.error}`;return;}token=r.access_token;$('#drive-load').disabled=false;$('#drive-status').textContent='เชื่อม Google Drive แล้ว';}}).requestAccessToken({prompt:'consent'});};
$('#drive-load').onclick=async()=>{const folder=$('#drive-folder-id').value.trim();if(!folder){$('#drive-status').textContent='กรุณาใส่ Folder ID';return;}$('#drive-status').textContent='กำลังอ่านรูปในโฟลเดอร์…';const q=encodeURIComponent(`'${folder}' in parents and trashed = false`),url=`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=1000&fields=files(id,name,mimeType,webViewLink,thumbnailLink)`;const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok){$('#drive-status').textContent=`อ่าน Drive ไม่สำเร็จ (${r.status})`;return;}files=(await r.json()).files.filter(x=>x.mimeType.startsWith('image/'));$('#drive-status').textContent=`พบรูป ${files.length} รูป`;$('#file-status').textContent=`พร้อมสร้าง Index จาก ${files.length} รูป`;$('#build-index').disabled=!files.length;};
async function getFile(item){const r=await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}?alt=media`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw Error();return new File([await r.blob()],item.name,{type:item.mimeType});}
$('#build-index').onclick=async()=>{if(!$('#event-id').value){$('#build-status').textContent='กรุณาใส่รหัสกิจกรรม';return;}if(!await models())return;faces=[];for(let i=0;i<files.length;i++){try{$('#build-status').textContent=`กำลังสร้าง Index ${i+1}/${files.length}`;const found=await getFace(await getFile(files[i]));if(found)faces.push({photoId:files[i].id,url:files[i].webViewLink||`https://drive.google.com/open?id=${files[i].id}`,thumbnail:files[i].thumbnailLink||'',descriptor:[...found.descriptor]});}catch{}}$('#build-status').textContent=`เสร็จ: พบใบหน้า ${faces.length} จาก ${files.length} รูป`;$('#download-index').disabled=!faces.length;};

// each event now gets its own index file, named after the event id, so multiple
// events' face data never overwrite one another.
function indexFileName(){return `index-${$('#event-id').value||'new-event'}.json`;}
$('#download-index').onclick=()=>download(indexFileName(),{version:1,eventId:$('#event-id').value,generatedAt:new Date().toISOString(),faces});

// appends the new event to whatever is already published in data/events.json,
// instead of replacing the whole list, so earlier events stay searchable.
$('#download-events').onclick=async()=>{
  const existing=await currentEvents();
  const id=$('#event-id').value||'new-event';
  const entry={id,title:$('#event-title').value||'กิจกรรมใหม่',date:$('#event-date').value,albumUrl:`https://drive.google.com/drive/folders/${$('#drive-folder-id').value}`,count:files.length,indexFile:`data/${indexFileName()}`};
  const merged=[...existing.filter(e=>e.id!==id),entry];
  download('events.json',merged);
};
if(sessionStorage.getItem('photo-portal-admin'))show('admin');
