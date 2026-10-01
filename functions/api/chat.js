export async function onRequestPost(context){
  const { request, env } = context;

  if(!env.AI_API_URL || !env.AI_API_KEY || !env.AI_MODEL){
    return Response.json({configured:false,error:"AI provider is not configured"},{status:503});
  }

  let body;
  try{ body = await request.json(); }
  catch{ return Response.json({error:"Invalid JSON"},{status:400}); }

  const message = String(body.message || "").slice(0,4000);
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const contextDocs = Array.isArray(body.context) ? body.context.slice(0,4) : [];
  const basePrompt = String(body.systemPrompt || "").slice(0,6000);

  const memoryText = contextDocs.map((d,i)=>
    `[기억 ${i+1}: ${d.title}]\n${String(d.text||"").slice(0,5000)}`
  ).join("\n\n");

  const system = `${basePrompt}

아래는 현재 질문과 관련해서 검색된 hyunyAI 저장 기억이다.
저장된 사실과 새 아이디어를 구분해서 말한다.
기억에 없는 내용을 과거 설정인 것처럼 꾸며내지 않는다.

${memoryText}`;

  const messages = [
    {role:"system",content:system},
    ...history
      .filter(x=>x && (x.role==="user" || x.role==="assistant"))
      .map(x=>({role:x.role,content:String(x.content||"").slice(0,3000)})),
    {role:"user",content:message}
  ];

  try{
    const upstream = await fetch(env.AI_API_URL,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        "authorization":`Bearer ${env.AI_API_KEY}`
      },
      body:JSON.stringify({
        model:env.AI_MODEL,
        messages,
        temperature:0.8
      })
    });

    if(!upstream.ok){
      const text = await upstream.text();
      return Response.json({error:"AI provider error",detail:text.slice(0,500)},{status:502});
    }

    const data = await upstream.json();
    const reply = data?.choices?.[0]?.message?.content;
    if(!reply) return Response.json({error:"No AI reply"},{status:502});

    return Response.json({configured:true,reply});
  }catch(err){
    return Response.json({error:"AI request failed",detail:String(err).slice(0,300)},{status:502});
  }
}
