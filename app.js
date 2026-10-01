const state = {
  index:null,
  docs:[],
  currentType:"worlds",
  history:[]
};

const typeMeta = {
  worlds:{title:"세계관",eyebrow:"WORLDS",icon:"🌌"},
  games:{title:"게임",eyebrow:"GAMES",icon:"🎮"},
  stories:{title:"이야기",eyebrow:"STORIES",icon:"📖"},
  making:{title:"만들기·도안",eyebrow:"MAKING",icon:"✂️"}
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

async function fetchText(path){
  const res = await fetch("/" + path.replace(/^\//,""));
  if(!res.ok) throw new Error(path);
  return await res.text();
}

async function init(){
  try{
    state.index = JSON.parse(await fetchText("data/memory/creative-index.json"));
    await loadDocs();
    renderStats();
    renderRecent();
    await loadCharacters();
    bind();
  }catch(err){
    console.error(err);
    $("#recentGrid").innerHTML = '<p class="muted">데이터를 불러오지 못했어.</p>';
  }
}

async function loadDocs(){
  const groups = ["worlds","games","stories","making"];
  const items = groups.flatMap(type => (state.index[type]||[]).map(item => ({...item,type})));
  state.docs = await Promise.all(items.map(async item => {
    let text="";
    try{text = await fetchText(item.file)}catch(e){}
    return {...item,text};
  }));
}

function renderStats(){
  const labels = [["worlds","세계관"],["games","게임"],["stories","이야기"],["making","만들기"]];
  $("#stats").innerHTML = labels.map(([k,label]) => `
    <div class="stat"><strong>${(state.index[k]||[]).length}</strong><span>${label} 기억</span></div>
  `).join("");
}

function renderRecent(){
  $("#recentGrid").innerHTML = state.docs.slice(0,6).map(cardHTML).join("");
  bindCards($("#recentGrid"));
}

function cardHTML(item){
  const meta = typeMeta[item.type] || {title:item.type,icon:"🧠"};
  const summary = extractSummary(item.text);
  return `<article class="memory-card">
    <span class="type">${meta.icon} ${meta.title}</span>
    <h4>${escapeHtml(item.title)}</h4>
    <p>${escapeHtml(summary)}</p>
    <span class="arrow">→</span>
    <button aria-label="${escapeHtml(item.title)} 열기" data-id="${item.id}" data-type="${item.type}"></button>
  </article>`;
}

function extractSummary(text){
  const lines = text.split("\n").map(x=>x.trim()).filter(Boolean)
    .filter(x=>!x.startsWith("#") && !x.startsWith("상태:") && !x.startsWith(">"));
  return (lines[0] || "시현의 창작 기억").replace(/^[-*]\s*/,"").slice(0,90);
}

function showView(name){
  $$(".view").forEach(v=>v.classList.remove("active"));
  const target = name==="home" ? "#homeView" :
                 name==="chat" ? "#chatView" :
                 name==="characters" ? "#charactersView" :
                 ["worlds","games","stories","making"].includes(name) ? "#listView" : "#homeView";
  $(target).classList.add("active");
  $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  $("#pageTitle").textContent = name==="home" ? "오늘 뭐 만들까?" :
    name==="chat" ? "hyunyAI와 대화" :
    name==="characters" ? "캐릭터 기억" :
    (typeMeta[name]?.title || "hyunyAI");
  if(typeMeta[name]) renderList(name);
}

function renderList(type, query=""){
  state.currentType = type;
  const q = normalize(query);
  const items = state.docs.filter(d=>d.type===type && (!q || normalize(d.title+" "+d.text).includes(q)));
  $("#listEyebrow").textContent = typeMeta[type].eyebrow;
  $("#listTitle").textContent = typeMeta[type].title;
  $("#listCount").textContent = items.length+"개";
  $("#cardGrid").innerHTML = items.length ? items.map(cardHTML).join("") : '<p class="muted">찾은 자료가 없어.</p>';
  bindCards($("#cardGrid"));
}

function bindCards(root){
  root.querySelectorAll("[data-id]").forEach(btn=>{
    btn.onclick=()=>openDoc(btn.dataset.id,btn.dataset.type);
  });
}

function openDoc(id,type){
  const doc=state.docs.find(d=>d.id===id && d.type===type);
  if(!doc) return;
  $$(".view").forEach(v=>v.classList.remove("active"));
  $("#detailView").classList.add("active");
  $("#detailDoc").textContent = doc.text;
  $("#pageTitle").textContent = doc.title;
  $("#backBtn").onclick=()=>showView(type);
}

async function loadCharacters(){
  try{$("#charactersDoc").textContent = await fetchText("data/characters/index.md")}
  catch(e){$("#charactersDoc").textContent="캐릭터 자료를 불러오지 못했어."}
}

function bind(){
  $$(".nav-btn").forEach(btn=>btn.onclick=()=>showView(btn.dataset.view));
  $$("[data-go]").forEach(btn=>btn.onclick=()=>showView(btn.dataset.go));
  $("#globalSearch").addEventListener("input", e=>{
    const q=e.target.value.trim();
    if(!q) return;
    if(!["worlds","games","stories","making"].includes(state.currentType)) state.currentType="worlds";
    showView(state.currentType);
    renderList(state.currentType,q);
  });
  $("#chatForm").addEventListener("submit", onChat);
  $("#chatInput").addEventListener("input", autoGrow);
  $("#chatInput").addEventListener("keydown", e=>{
    if(e.key==="Enter" && !e.shiftKey){
      e.preventDefault();
      $("#chatForm").requestSubmit();
    }
  });
}

function autoGrow(e){
  e.target.style.height="auto";
  e.target.style.height=Math.min(e.target.scrollHeight,140)+"px";
}

async function onChat(e){
  e.preventDefault();
  const input=$("#chatInput");
  const message=input.value.trim();
  if(!message) return;
  input.value=""; input.style.height="auto";
  addMessage("user",message);

  const related = retrieve(message,4);
  renderRelated(related);
  const pending = addMessage("ai","생각 중...");

  let reply="";
  try{
    const systemPrompt = await fetchText("prompts/hyuny-system.md");
    const res = await fetch("/api/chat",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        message,
        history:state.history.slice(-10),
        context:related.map(d=>({title:d.title,type:d.type,text:d.text.slice(0,5000)})),
        systemPrompt:systemPrompt.slice(0,6000)
      })
    });
    if(res.ok){
      const data=await res.json();
      reply=data.reply || localReply(message,related);
      $("#chatMode").textContent="AI 대화 + 창작 기억";
    }else{
      reply=localReply(message,related);
      $("#chatMode").textContent="로컬 기억 모드";
    }
  }catch(err){
    reply=localReply(message,related);
    $("#chatMode").textContent="로컬 기억 모드";
  }
  pending.querySelector(".bubble").innerHTML = formatReply(reply);
  state.history.push({role:"user",content:message},{role:"assistant",content:reply});
  scrollChat();
}

function retrieve(query,limit=4){
  const tokens = tokenize(query);
  return state.docs.map(doc=>{
    const hay=normalize(doc.title+" "+doc.text);
    let score=0;
    for(const t of tokens){
      if(normalize(doc.title).includes(t)) score+=6;
      if(hay.includes(t)) score+=2;
    }
    if(/메카|폴리스/.test(query) && doc.id==="mecapolis") score+=10;
    if(/세이버/.test(query) && doc.id==="paper-savers") score+=10;
    if(/스타|가디언/.test(query) && doc.id==="star-guardians") score+=10;
    if(/현이마을|검은현/.test(query) && doc.id==="hyuni-village") score+=10;
    if(/게임/.test(query) && doc.type==="games") score+=4;
    if(/도안|종이|만들/.test(query) && doc.type==="making") score+=4;
    return {...doc,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit);
}

function localReply(message,related){
  if(!related.length){
    return "아직 저장된 기억에서 딱 맞는 내용을 못 찾았어. 새 아이디어라면 같이 정리해보자. 제목이랑 어떤 걸 만들고 싶은지 말해줘!";
  }
  const best=related[0];
  const bullets=best.text.split("\n").map(x=>x.trim())
    .filter(x=>x.startsWith("- ")).slice(0,5)
    .map(x=>x.replace(/^[-]\s*/,"• ")).join("\n");
  if(/어디까지|기억|뭐였|보여|정리/.test(message)){
    return `응, 기억에서 **${best.title}**를 찾았어.\n\n${bullets || extractSummary(best.text)}\n\n이 설정에서 바로 이어서 만들 수 있어.`;
  }
  return `관련 기억으로 **${best.title}**가 가장 가까워.\n\n${bullets || extractSummary(best.text)}\n\n이걸 바탕으로 네 아이디어를 이어가자!`;
}

function renderRelated(items){
  $("#relatedMemory").innerHTML = items.length ? items.map(x=>`
    <div class="related-item">
      <b>${escapeHtml(x.title)}</b>
      <span>${escapeHtml(typeMeta[x.type]?.title || x.type)}</span>
    </div>
  `).join("") : '<p class="muted">아직 관련 기억을 못 찾았어.</p>';
}

function addMessage(role,text){
  const wrap=document.createElement("div");
  wrap.className="message "+role;
  wrap.innerHTML=`<div class="bubble">${formatReply(text)}</div>`;
  $("#messages").appendChild(wrap);
  scrollChat();
  return wrap;
}

function formatReply(text){
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g,"<b>$1</b>")
    .replace(/\n/g,"<br/>");
}

function tokenize(s){
  return [...new Set(normalize(s).split(/[^가-힣a-z0-9]+/).filter(x=>x.length>1))];
}
function normalize(s){return (s||"").toLowerCase().replace(/\s+/g," ")}
function escapeHtml(s){return (s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function scrollChat(){const el=$("#messages");el.scrollTop=el.scrollHeight}

init();
