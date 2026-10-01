const state={index:null,docs:[],installPrompt:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

async function fetchText(path){const r=await fetch(path);if(!r.ok)throw new Error(path);return r.text()}
async function init(){
  try{
    state.index=JSON.parse(await fetchText('/data/memory/creative-index.json'));
    const groups=['worlds','games','stories','making'];
    state.docs=await Promise.all(groups.flatMap(type=>(state.index[type]||[]).map(async item=>({...item,type,text:await fetchText('/'+item.file)}))));
    renderWorlds();renderMemory();
  }catch(e){console.error(e)}
  bind();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
function bind(){
  $('#enterAppBtn').onclick=()=>{$('#welcomeScreen').classList.add('hidden');$('#app').classList.remove('hidden')};
  $$('.tab').forEach(b=>b.onclick=()=>showView(b.dataset.view,b));
  $$('[data-quick]').forEach(b=>b.onclick=()=>sendPreset(b.dataset.quick));
  $$('[data-start]').forEach(b=>b.onclick=()=>sendPreset(b.dataset.start));
  $('#chatForm').addEventListener('submit',onChat);
  $('#chatInput').addEventListener('input',e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;$('#installBtn').classList.remove('hidden');$('#installTopBtn').classList.remove('hidden')});
  $('#installBtn').onclick=installApp;$('#installTopBtn').onclick=installApp;
}
function showView(id,btn){
  $$('.view').forEach(v=>v.classList.remove('active'));$('#'+id).classList.add('active');
  $$('.tab').forEach(t=>t.classList.remove('active'));if(btn)btn.classList.add('active');
}
function sendPreset(text){showView('chatView',$('.tab[data-view="chatView"]'));$('#chatInput').value=text;$('#chatForm').requestSubmit()}
async function installApp(){if(!state.installPrompt)return;state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;$('#installBtn').classList.add('hidden');$('#installTopBtn').classList.add('hidden')}
function renderWorlds(){
  const worlds=state.docs.filter(d=>d.type==='worlds');
  $('#worldCards').innerHTML=worlds.map(d=>'<button class="world-card" data-world="'+d.id+'"><b>'+esc(d.title)+'</b><span>'+esc(summary(d.text))+'</span></button>').join('');
  $$('[data-world]').forEach(b=>b.onclick=()=>sendPreset(b.querySelector('b').textContent+' 세계관 어디까지 만들었는지 알려줘'));
}
function renderMemory(){
  $('#memoryCards').innerHTML=state.docs.map(d=>'<div class="memory-card"><b>'+esc(d.title)+'</b><span>'+esc(label(d.type))+' · '+esc(summary(d.text))+'</span></div>').join('');
}
function label(t){return {worlds:'세계관',games:'게임',stories:'이야기',making:'만들기'}[t]||t}
function summary(text){const l=text.split('\n').map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')&&!x.startsWith('상태:'));return (l[0]||'시현의 창작 기억').replace(/^[-*]\s*/,'').slice(0,72)}
function retrieve(q,limit=4){
  const tokens=[...new Set(q.toLowerCase().split(/[^가-힣a-z0-9]+/).filter(x=>x.length>1))];
  return state.docs.map(d=>{const hay=(d.title+' '+d.text).toLowerCase();let s=0;tokens.forEach(t=>{if(d.title.toLowerCase().includes(t))s+=6;if(hay.includes(t))s+=2});
    if(/메카|폴리스/.test(q)&&d.id==='mecapolis')s+=10;if(/세이버/.test(q)&&d.id==='paper-savers')s+=10;if(/스타|가디언/.test(q)&&d.id==='star-guardians')s+=10;if(/현이마을|검은현/.test(q)&&d.id==='hyuni-village')s+=10;
    return {...d,score:s}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit);
}
async function onChat(e){
  e.preventDefault();const input=$('#chatInput'),msg=input.value.trim();if(!msg)return;
  input.value='';input.style.height='auto';addMessage('user',msg);setTalking(true);
  const related=retrieve(msg);let reply='';
  try{
    const systemPrompt=await fetchText('/prompts/hyuny-system.md');
    const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:msg,context:related.map(d=>({title:d.title,type:d.type,text:d.text.slice(0,4000)})),systemPrompt})});
    if(r.ok){const data=await r.json();reply=data.reply||localReply(msg,related)}else reply=localReply(msg,related);
  }catch{reply=localReply(msg,related)}
  addMessage('ai',reply);$('#botGreeting').textContent=related[0]?'기억 찾았어! 같이 이어가자 😎':'좋아, 같이 만들어보자!';setTalking(false);
}
function localReply(msg,related){
  if(!related.length)return '새로운 아이디어구나! 제목이나 주인공, 어떤 방식으로 놀고 싶은지 말해주면 같이 하나씩 만들어보자.';
  const d=related[0],bullets=d.text.split('\n').map(x=>x.trim()).filter(x=>x.startsWith('- ')).slice(0,5).map(x=>'• '+x.slice(2)).join('\n');
  return '기억에서 **'+d.title+'**를 찾았어.\n\n'+(bullets||summary(d.text))+'\n\n여기서 바로 이어서 만들자!';
}
function addMessage(role,text){const w=document.createElement('div');w.className='message '+role;w.innerHTML='<div class="bubble">'+fmt(text)+'</div>';$('#messages').appendChild(w);$('#messages').scrollTop=$('#messages').scrollHeight}
function setTalking(v){$('#botStage').classList.toggle('bot-stage-talking',v);if(v)$('#botGreeting').textContent='생각 중...'}
function fmt(s){return esc(s).replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>')}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
init();