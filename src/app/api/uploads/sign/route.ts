import { NextResponse } from "next/server";
import { createUpload, MEDIA_BUCKET } from "@/lib/supabase-storage";
export async function POST(req:Request) {
  const body=await req.json().catch(()=>({}));
  if(!["video/mp4","video/quicktime"].includes(body.type)||!Number.isFinite(body.size)||body.size>30_000_000)return NextResponse.json({error:"Use an MP4/MOV under 30MB"},{status:422});
  const ext=body.type==="video/quicktime"?"mov":"mp4"; const path=`uploads/${crypto.randomUUID()}/source.${ext}`;
  try { const signed=await createUpload(path); return NextResponse.json({provider:"supabase",bucket:MEDIA_BUCKET,path,token:signed.token,expiresIn:7200,maxBytes:30_000_000}); }
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not secure upload"},{status:500});}
}
