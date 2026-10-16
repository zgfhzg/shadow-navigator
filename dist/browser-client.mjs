// Static deployments run the same engine in a background worker. Local Node
// development keeps using its existing HTTP API. No provider key is bundled.
let backend,worker,serial=0;const pending=new Map();
async function selectBackend(){
  try{const response=await fetch('/api/config');if(response.ok&&response.headers.get('content-type')?.includes('application/json')){const config=await response.json();if(config.routingEngine==='shadow')return 'server';}}catch{}
  return 'browser';
}
export async function api(path,params={}){
  backend??=selectBackend();
  if(await backend==='server'){
    const response=await fetch(path+'?'+new URLSearchParams(params)),data=await response.json();if(!response.ok)throw new Error(data.error||'요청에 실패했습니다.');return data;
  }
  if(!worker){
    worker=new Worker(new URL('./runtime/routing/browser-worker.mjs',import.meta.url),{type:'module'});
    worker.onmessage=event=>{const job=pending.get(event.data.id);if(!job)return;clearTimeout(job.timer);pending.delete(event.data.id);event.data.error?job.reject(new Error(event.data.error)):job.resolve(event.data.result);};
    worker.onerror=()=>{for(const job of pending.values()){clearTimeout(job.timer);job.reject(new Error('경로 계산을 시작하지 못했습니다. 새로고침 후 다시 시도해 주세요.'));}pending.clear();worker.terminate();worker=undefined;};
  }
  return new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(new Error('계산 시간이 초과되었습니다. 다시 시도해 주세요.'));},45000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,path,params});});
}
