import { NextResponse } from "next/server";
import { createJob } from "@/lib/store";
export const runtime = "nodejs";
export async function POST(req: Request) { const body=await req.json().catch(()=>({})); return NextResponse.json(createJob(body.uploadId),{status:202}); }
