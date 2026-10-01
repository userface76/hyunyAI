export async function onRequestGet({env}){
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
  if(!env.HYUNY_DB) return new Response(JSON.stringify({ok:false,configured:false,binding:'HYUNY_DB'}),{status:503,headers});
  try{
    const row=await env.HYUNY_DB.prepare("SELECT 1 AS alive").first();
    return new Response(JSON.stringify({ok:true,configured:true,alive:row?.alive===1}),{headers});
  }catch(e){
    return new Response(JSON.stringify({ok:false,configured:true,error:String(e).slice(0,200)}),{status:500,headers});
  }
}
