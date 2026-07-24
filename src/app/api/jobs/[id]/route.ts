import { NextResponse } from "next/server";
import { getJob } from "@/lib/store";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) { const {id}=await params; const job=await getJob(id); return job?NextResponse.json(job):NextResponse.json({error:"Job not found"},{status:404}); }
