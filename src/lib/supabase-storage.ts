import { createClient } from "@supabase/supabase-js";

export const MEDIA_BUCKET = "scenesponsor-media";
function admin() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("Supabase storage is not configured");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function createUpload(path:string) {
  const {data,error}=await admin().storage.from(MEDIA_BUCKET).createSignedUploadUrl(path,{upsert:false});
  if(error)throw error; return data;
}
export async function signedDownload(path:string,expires=3600) {
  const {data,error}=await admin().storage.from(MEDIA_BUCKET).createSignedUrl(path,expires);
  if(error)throw error; return data.signedUrl;
}
export async function uploadArtifact(path:string,body:Buffer,contentType:string) {
  const {error}=await admin().storage.from(MEDIA_BUCKET).upload(path,body,{contentType,upsert:true,cacheControl:"600"});
  if(error)throw error; return signedDownload(path);
}
