import { after, NextResponse } from "next/server";
import { createJob, getJob, processJob } from "@/lib/store";
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}) { const {id}=await params; const old=await getJob(id); if(!old)return NextResponse.json({error:"Job not found"},{status:404}); const next=createJob(undefined,false,old.artifacts.original,old.sourceDurationMs);after(()=>processJob(next.id));return NextResponse.json(next,{status:202}); }
