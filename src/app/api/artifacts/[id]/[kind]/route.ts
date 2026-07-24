import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { artifactPath } from "@/lib/store";
export async function GET(_:Request,{params}:{params:Promise<{id:string,kind:string}>}) { const {id,kind}=await params; if(!['vision','final'].includes(kind))return NextResponse.json({error:"Not found"},{status:404}); try{return new NextResponse(await readFile(artifactPath(id,kind)),{headers:{"content-type":"video/mp4","cache-control":"private, max-age=600"}});}catch{return NextResponse.json({error:"Artifact not ready"},{status:404});} }
