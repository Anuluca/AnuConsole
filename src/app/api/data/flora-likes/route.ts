import { ForbiddenError, requireAdmin, requireUser } from '../../../../lib/auth.ts';
import { parseFloraLikes, validCounts, type LikeCounts } from '../../../../lib/flora-likes.ts';
const headers = {'Cache-Control':'private, no-store'};
const respond = (value:unknown,status=200) => Response.json(value,{status,headers});
async function upstream(update?:{counts:LikeCounts;version:string}) {
  const token = process.env.HOME_FEATURES_TOKEN;
  if (!token || token.length < 32) return respond({error:'likes_not_configured'},503);
  try {
    // 仅服务端持有管理密钥；不接受浏览器传入上游地址。
    const configured = process.env.FLORA_LIKES_URL;
    const base = process.env.HOME_FEATURES_URL || 'https://steam-api.anuluca.com/admin/home-features';
    const endpoint = configured || new URL('/admin/floratrium/likes',base).href;
    const response = await fetch(endpoint,{method:update?'PUT':'GET',headers:{Authorization:`Bearer ${token}`,...(update?{'Content-Type':'application/json'}:{})},body:update?JSON.stringify(update):undefined,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
    if (response.status === 409) return respond({error:'version_conflict'},409);
    if (!response.ok) return respond({error:'likes_unavailable'},502);
    const data = parseFloraLikes(await response.json());
    return data ? respond(data) : respond({error:'likes_unavailable'},502);
  } catch {return respond({error:'likes_unavailable'},502);}
}
export async function GET() {await requireUser();return upstream();}
export async function PUT(request:Request) {
  try {await requireAdmin();} catch(error) {if(error instanceof ForbiddenError)return respond({error:'forbidden'},403);throw error;}
  const origin = request.headers.get('Origin');
  try {
    const source = new URL(origin ?? '');
    if (source.origin !== origin || !['http:','https:'].includes(source.protocol) || source.host !== (request.headers.get('Host') || new URL(request.url).host) || request.headers.get('Sec-Fetch-Site') === 'cross-site') return respond({error:'forbidden_origin'},403);
  } catch {return respond({error:'forbidden_origin'},403);}
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return respond({error:'invalid_content_type'},415);
  const reader=request.body?.getReader(); if(!reader)return respond({error:'invalid_update'},400);
  try {
    let size=0,text='';const decoder=new TextDecoder();
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024){await reader.cancel();return respond({error:'invalid_update'},400);}text+=decoder.decode(value,{stream:true});}
    const body:unknown=JSON.parse(text+decoder.decode());
    if(!body || typeof body!=='object' || !('counts' in body) || !('version' in body) || Object.keys(body).length!==2 || !validCounts(body.counts) || typeof body.version!=='string' || !/^\d+$/.test(body.version))return respond({error:'invalid_update'},400);
    return upstream({counts:body.counts,version:body.version});
  } catch{return respond({error:'invalid_update'},400);}finally{reader.releaseLock();}
}
