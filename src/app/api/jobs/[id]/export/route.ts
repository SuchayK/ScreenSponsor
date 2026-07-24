import { NextResponse } from "next/server";
import { getJob } from "@/lib/store";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) { const {id}=await params; const job=getJob(id); if(!job)return NextResponse.json({error:"Job not found"},{status:404}); if(job.stage!=="completed")return NextResponse.json({error:"Creator approval is required before export"},{status:403}); return NextResponse.redirect(new URL(job.artifacts.final!,req.url)); }
