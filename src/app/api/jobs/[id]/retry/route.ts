import { NextResponse } from "next/server";
import { createJob, getJob } from "@/lib/store";
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}) { const {id}=await params; const old=getJob(id); if(!old)return NextResponse.json({error:"Job not found"},{status:404}); return NextResponse.json(createJob(),{status:202}); }
