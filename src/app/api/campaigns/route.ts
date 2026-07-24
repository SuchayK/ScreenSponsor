import { NextResponse } from "next/server";
export async function POST(req:Request){const body=await req.json();return NextResponse.json({id:crypto.randomUUID(),active:true,...body},{status:201});}
