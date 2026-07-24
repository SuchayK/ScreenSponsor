import { NextResponse } from "next/server";
import { decide, getJob } from "@/lib/store";
import type { JobView } from "@/types";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) { const {id}=await params; const body=await req.json(); const job=getJob(id) ?? (process.env.VERCEL && body.job?.id===id ? body.job as JobView : undefined); if(!job)return NextResponse.json({error:"Job not found"},{status:404}); try{const updated=decide(job,body.action);const response=NextResponse.json(updated);if(body.action==="approve")response.cookies.set("scene_approved",id,{httpOnly:true,sameSite:"strict",secure:!!process.env.VERCEL,maxAge:600,path:"/"});return response;}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Decision failed"},{status:409});} }
