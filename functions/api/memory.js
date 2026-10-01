const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});

async function ensureSchema(db){
  const statements=[
    "CREATE TABLE IF NOT EXISTS devices (owner_key TEXT PRIMARY KEY, profile_key TEXT NOT NULL DEFAULT 'sihyun', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS conversations (session_id TEXT PRIMARY KEY, owner_key TEXT NOT NULL, title TEXT, active_mode TEXT DEFAULT 'friend', active_world TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, owner_key TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, mode TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS memories (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_key TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'creative', subject TEXT, content TEXT NOT NULL, source_session_id TEXT, importance INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS training_examples (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_key TEXT NOT NULL, session_id TEXT, mode TEXT, user_text TEXT NOT NULL, assistant_text TEXT NOT NULL, related_worlds TEXT, approved INTEGER NOT NULL DEFAULT 0, quality_score INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE INDEX IF NOT EXISTS idx_messages_owner_time ON messages(owner_key, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_messages_session_time ON messages(session_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_memories_owner_importance ON memories(owner_key, importance DESC, updated_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_training_owner_time ON training_examples(owner_key, created_at DESC)"
  ];
  for(const sql of statements) await db.prepare(sql).run();
}

function clean(v,max=5000){return String(v??'').trim().slice(0,max)}
function explicitMemory(text){
  return /(기억해|저장해|이걸로\s*정하|설정은|이름은|앞으로)/.test(text);
}

export async function onRequest(context){
  const {request,env}=context;
  if(!env.HYUNY_DB) return json({ok:false,configured:false,error:'HYUNY_DB binding is missing'},503);
  const db=env.HYUNY_DB;
  try{await ensureSchema(db)}catch(e){return json({ok:false,error:'DB initialization failed',detail:String(e).slice(0,300)},500)}

  if(request.method==='GET'){
    const url=new URL(request.url);
    const ownerKey=clean(url.searchParams.get('ownerKey'),120);
    if(!ownerKey) return json({ok:false,error:'ownerKey required'},400);

    const recent=await db.prepare(
      "SELECT role,content,mode,created_at FROM messages WHERE owner_key=? ORDER BY id DESC LIMIT 24"
    ).bind(ownerKey).all();

    const memories=await db.prepare(
      "SELECT id,kind,subject,content,importance,updated_at FROM memories WHERE owner_key=? AND status='active' ORDER BY importance DESC,id DESC LIMIT 30"
    ).bind(ownerKey).all();

    return json({
      ok:true,
      configured:true,
      recent:(recent.results||[]).reverse(),
      memories:memories.results||[]
    });
  }

  if(request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);

  let body;
  try{body=await request.json()}catch{return json({ok:false,error:'Invalid JSON'},400)}

  const action=clean(body.action||'save_turn',40);
  const ownerKey=clean(body.ownerKey,120);
  if(!ownerKey) return json({ok:false,error:'ownerKey required'},400);

  await db.prepare(
    "INSERT INTO devices(owner_key,profile_key,last_seen_at) VALUES(?, 'sihyun', CURRENT_TIMESTAMP) ON CONFLICT(owner_key) DO UPDATE SET last_seen_at=CURRENT_TIMESTAMP"
  ).bind(ownerKey).run();

  if(action==='save_turn'){
    const sessionId=clean(body.sessionId,120);
    const user=clean(body.user,6000);
    const assistant=clean(body.assistant,9000);
    const mode=clean(body.mode||'friend',40);
    const related=Array.isArray(body.related)?body.related.slice(0,12).map(x=>clean(x,100)):[];
    if(!sessionId||!user||!assistant) return json({ok:false,error:'sessionId, user, assistant required'},400);

    await db.prepare(
      "INSERT INTO conversations(session_id,owner_key,active_mode,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(session_id) DO UPDATE SET active_mode=excluded.active_mode,updated_at=CURRENT_TIMESTAMP"
    ).bind(sessionId,ownerKey,mode).run();

    await db.batch([
      db.prepare("INSERT INTO messages(session_id,owner_key,role,content,mode) VALUES(?,?,?,?,?)").bind(sessionId,ownerKey,'user',user,mode),
      db.prepare("INSERT INTO messages(session_id,owner_key,role,content,mode) VALUES(?,?,?,?,?)").bind(sessionId,ownerKey,'assistant',assistant,mode),
      db.prepare("INSERT INTO training_examples(owner_key,session_id,mode,user_text,assistant_text,related_worlds,approved) VALUES(?,?,?,?,?,?,0)")
        .bind(ownerKey,sessionId,mode,user,assistant,JSON.stringify(related))
    ]);

    if(explicitMemory(user)){
      await db.prepare(
        "INSERT INTO memories(owner_key,kind,subject,content,source_session_id,importance) VALUES(?,?,?,?,?,?)"
      ).bind(ownerKey,'explicit',related.join(', ')||null,user,sessionId,4).run();
    }

    return json({ok:true,saved:true,trainingCandidate:true});
  }

  if(action==='save_memory'){
    const content=clean(body.content,6000);
    const subject=clean(body.subject,240)||null;
    const kind=clean(body.kind||'creative',40);
    const importance=Math.max(1,Math.min(5,Number(body.importance)||2));
    if(!content) return json({ok:false,error:'content required'},400);
    const result=await db.prepare(
      "INSERT INTO memories(owner_key,kind,subject,content,importance) VALUES(?,?,?,?,?) RETURNING id"
    ).bind(ownerKey,kind,subject,content,importance).first();
    return json({ok:true,id:result?.id});
  }

  return json({ok:false,error:'Unknown action'},400);
}
