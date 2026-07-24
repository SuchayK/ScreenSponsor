import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { sourceForUpload } from "@/lib/store";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) { const {id}=await params; const p=sourceForUpload(id); if(!p)return NextResponse.json({error:"Not found"},{status:404}); return new NextResponse(await readFile(p),{headers:{"content-type":p.endsWith('.mov')?'video/quicktime':'video/mp4',"cache-control":"private, max-age=600"}}); }
