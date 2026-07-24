import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { sourceForUpload } from "@/lib/store";
import { videoResponse } from "@/lib/video-response";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) { const {id}=await params; const p=sourceForUpload(id); if(!p)return NextResponse.json({error:"Not found"},{status:404}); return videoResponse(await readFile(p),req,p.endsWith('.mov')?'video/quicktime':'video/mp4'); }
