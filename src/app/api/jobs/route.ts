import { after, NextResponse } from "next/server";
import { createJob, processJob } from "@/lib/store";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) { const body=await req.json().catch(()=>({})); const job=createJob(body.uploadId,false); if(process.env.VERCEL) await processJob(job.id); else after(()=>processJob(job.id)); return NextResponse.json(job,{status:202}); }
