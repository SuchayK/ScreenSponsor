import { NextResponse } from "next/server";
import { decide, getJob } from "@/lib/store";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) { const {id}=await params; const job=getJob(id); if(!job)return NextResponse.json({error:"Job not found"},{status:404}); const {action}=await req.json(); try{return NextResponse.json(decide(job,action));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Decision failed"},{status:409});} }
