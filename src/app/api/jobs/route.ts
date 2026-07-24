import { after, NextResponse } from "next/server";
import { createJob, processJob } from "@/lib/store";
import { signedDownload } from "@/lib/supabase-storage";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(req: Request) { const body=await req.json().catch(()=>({})); const originalUrl=body.uploadPath?await signedDownload(body.uploadPath):undefined; const job=createJob(body.uploadId,false,originalUrl,Number(body.durationMs)||12000); after(()=>processJob(job.id,body.forceFallback===true)); return NextResponse.json(job,{status:202}); }
