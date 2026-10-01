const state={
  index:null,
  docs:[],
  installPrompt:null,
  history:loadJSON('hyunyAI_history_v2',[]),
  training:loadJSON('hyunyAI_training_v1',[]),
  speaker:localStorage.getItem('hyunyAI_speaker')||'sihyun'
};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

function loadJSON(key,fallback){
  try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}
}
function saveJSON(key,value){
  try{localStorage.setItem(key,JSON.stringify(value))}catch{}
}
async function fetchText(path){const r=await fetch(path);if(!r.ok)throw new Error(path);return r.text()}

async function init(){
  try{
    state.index=JSON.parse(await fetchText('/data/memory/creative-index.json'));
    const groups=['worlds','games','stories','making'];
    state.docs=await Promise.all(groups.flatMap(type=>(state.index[type]||[]).map(async item=>({...item,type,text:await fetchText('/'+item.file)}))));
    renderWorlds();renderMemory();
  }catch(e){console.error(e)}
  bind();
  if(state.history.length) $('#botGreeting').textContent='지난 대화도 기억하고 있어 😎';
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
  $$('[data-world]').forEach(b=>b.onclick=()=>sendPreset(b.querySelector('b').textContent+' 세계관 이어서 놀자'));
}
function renderMemory(){
  $('#memoryCards').innerHTML=state.docs.map(d=>'<div class="memory-card"><b>'+esc(d.title)+'</b><span>'+esc(label(d.type))+' · '+esc(summary(d.text))+'</span></div>').join('');
}
function label(t){return {worlds:'세계관',games:'게임',stories:'이야기',making:'만들기'}[t]||t}
function summary(text){
  const l=text.split('\n').map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')&&!x.startsWith('상태:'));
  return (l[0]||'시현의 창작 기억').replace(/^[-*]\s*/,'').slice(0,72)
}

function retrieve(q,limit=4){
  const tokens=[...new Set(q.toLowerCase().split(/[^가-힣a-z0-9]+/).filter(x=>x.length>1))];
  return state.docs.map(d=>{
    const hay=(d.title+' '+d.text).toLowerCase();let s=0;
    tokens.forEach(t=>{if(d.title.toLowerCase().includes(t))s+=6;if(hay.includes(t))s+=2});
    if(/메카|폴리스/.test(q)&&d.id==='mecapolis')s+=10;
    if(/세이버/.test(q)&&d.id==='paper-savers')s+=10;
    if(/스타|가디언/.test(q)&&d.id==='star-guardians')s+=10;
    if(/현이마을|검은현/.test(q)&&d.id==='hyuni-village')s+=10;
    return {...d,score:s}
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit);
}

function detectSpeaker(msg){
  if(/^(나\s*)?시현이야|^시현인데|^나\s*시현인데/.test(msg.trim())){
    state.speaker='sihyun';
    localStorage.setItem('hyunyAI_speaker','sihyun');
  }
}

function detectMode(msg){
  if(/역할|대화할래|나와|등장|출동|말해봐|뭐해/.test(msg)) return 'roleplay';
  if(/이야기|스토리|다음|그때|이어/.test(msg)) return 'story';
  if(/게임|미니게임|플레이|규칙|점수/.test(msg)) return 'game';
  if(/도안|종이|만들|조립|자석|로봇/.test(msg)) return 'making';
  if(/기억|어디까지|전에|지난번/.test(msg)) return 'memory';
  return 'friend';
}

function conversationMemory(q,limit=4){
  const tokens=q.toLowerCase().split(/[^가-힣a-z0-9]+/).filter(x=>x.length>1);
  const pairs=[];
  for(let i=0;i<state.history.length-1;i++){
    if(state.history[i]?.role!=='user'||state.history[i+1]?.role!=='assistant') continue;
    const text=(state.history[i].content+' '+state.history[i+1].content).toLowerCase();
    let score=0;tokens.forEach(t=>{if(text.includes(t))score++});
    if(score>0)pairs.push({score,user:state.history[i].content,assistant:state.history[i+1].content});
  }
  return pairs.sort((a,b)=>b.score-a.score).slice(0,limit);
}

async function onChat(e){
  e.preventDefault();
  const input=$('#chatInput'),msg=input.value.trim();if(!msg)return;
  detectSpeaker(msg);
  input.value='';input.style.height='auto';addMessage('user',msg);setTalking(true);

  const related=retrieve(msg);
  const past=conversationMemory(msg,4);
  const memoryDocs=[
    ...related.map(d=>({title:d.title,type:d.type,text:d.text.slice(0,4000)})),
    ...past.map((p,i)=>({title:'이전 대화 기억 '+(i+1),type:'conversation',text:'시현: '+p.user+'\nhyunyAI: '+p.assistant}))
  ].slice(0,6);

  const mode=detectMode(msg);
  let reply='';
  try{
    const systemPrompt=await fetchText('/prompts/hyuny-system.md');
    const r=await fetch('/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        message:msg,
        history:state.history.slice(-16),
        context:memoryDocs,
        systemPrompt:systemPrompt+'\n\n현재 대화 모드: '+mode+'\n현재 화자: '+state.speaker
      })
    });
    if(r.ok){const data=await r.json();reply=data.reply||localReply(msg,related,mode)}
    else reply=localReply(msg,related,mode);
  }catch{reply=localReply(msg,related,mode)}

  addMessage('ai',reply);
  state.history.push({role:'user',content:msg},{role:'assistant',content:reply});
  state.history=state.history.slice(-120);
  saveJSON('hyunyAI_history_v2',state.history);
  saveTrainingPair(msg,reply,mode,related);
  $('#botGreeting').textContent=related[0]?'기억 찾았어! 같이 이어가자 😎':'좋아, 같이 만들어보자!';
  setTalking(false);
}

function saveTrainingPair(user,assistant,mode,related){
  state.training.push({
    speaker:'sihyun',
    createdAt:new Date().toISOString(),
    mode,
    user,
    assistant,
    related:(related||[]).map(x=>x.id)
  });
  state.training=state.training.slice(-1000);
  saveJSON('hyunyAI_training_v1',state.training);
}

function localReply(msg,related,mode){
  const opens={
    roleplay:['좋아ㅋㅋ 바로 역할놀이 시작!','오케이, 지금부터 그 세계 안으로 들어간다 😎','좋아. 설명 말고 바로 장면으로 가자!'],
    story:['좋아, 그다음 장면부터 이어볼게.','오, 그 전개 재밌다. 바로 다음 장면 가자.','좋아. 이번엔 예상 못 한 사건 하나 넣어볼까?'],
    game:['게임으로 만들면 재밌겠다!','좋아, 플레이 규칙부터 잡아보자.','이번엔 짧게 한 판 할 수 있게 만들어보자.'],
    making:['좋아, 실제로 만들 수 있게 생각해보자.','이번엔 손으로 만들 수 있는 구조로 가자.','오케이. 부품부터 나눠보자.'],
    memory:['기억에서 찾아볼게.','지난 내용부터 이어보자.','전에 했던 설정과 연결해볼게.'],
    friend:['ㅋㅋ 좋아, 그거 해보자.','오? 그거 재밌겠는데.','좋아 시현아, 내가 같이 놀아줄게.']
  };
  const open=pick(opens[mode]||opens.friend);
  if(!related.length){
    return open+'\n\n새 아이디어니까 내가 먼저 하나 던져볼게. 주인공이나 규칙 하나만 정하고 바로 시작하자. 뭐부터 할까?';
  }
  const d=related[0];
  const lines=d.text.split('\n').map(x=>x.trim()).filter(x=>x.startsWith('- ')).map(x=>x.slice(2));
  const one=lines.length?pick(lines):summary(d.text);
  const endings=[
    '이 설정으로 바로 다음 장면 만들어볼까?',
    '여기에 새 캐릭터 하나 끼워 넣어도 재밌겠는데?',
    '이번엔 네가 선택하면 내가 그다음 상황을 만들어볼게.',
    '설명은 여기까지만 하고 바로 놀자. 다음 행동은 뭐야?'
  ];
  return open+'\n\n**'+d.title+'** 기억 중에 지금 연결되는 건 “'+one+'”이야.\n\n'+pick(endings);
}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}
function addMessage(role,text){
  const w=document.createElement('div');w.className='message '+role;
  w.innerHTML='<div class="bubble">'+fmt(text)+'</div>';
  $('#messages').appendChild(w);$('#messages').scrollTop=$('#messages').scrollHeight
}
function setTalking(v){$('#botStage').classList.toggle('bot-stage-talking',v);if(v)$('#botGreeting').textContent='생각 중...'}
function fmt(s){return esc(s).replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>')}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
init();