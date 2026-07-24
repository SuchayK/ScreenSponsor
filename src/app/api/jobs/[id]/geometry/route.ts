import { NextResponse } from "next/server";
import { getJob, updateGeometry } from "@/lib/store";
import type { NormalizedQuad } from "@/types";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) { const {id}=await params; const job=getJob(id); if(!job)return NextResponse.json({error:"Job not found"},{status:404}); const {quad}=await req.json(); if(!Array.isArray(quad)||quad.length!==4||quad.some(p=>typeof p?.x!=="number"||typeof p?.y!=="number"||p.x<0||p.x>1||p.y<0||p.y>1))return NextResponse.json({error:"Four normalized corners required"},{status:422}); return NextResponse.json(updateGeometry(job,quad as NormalizedQuad)); }
