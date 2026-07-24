import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { artifactPath } from "@/lib/store";
import { videoResponse } from "@/lib/video-response";
export async function GET(req:Request,{params}:{params:Promise<{id:string,kind:string}>}) { const {id,kind}=await params; if(!['vision','final'].includes(kind))return NextResponse.json({error:"Not found"},{status:404}); try{return videoResponse(await readFile(artifactPath(id,kind)),req);}catch{return NextResponse.json({error:"Artifact not ready"},{status:404});} }
