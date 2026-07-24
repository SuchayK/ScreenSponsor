import { NextResponse } from "next/server";
import { saveUpload } from "@/lib/store";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const data = await req.formData(); const file = data.get("file");
  if (!(file instanceof File)) return NextResponse.json({error:"Video is required"},{status:400});
  if (!['video/mp4','video/quicktime'].includes(file.type) || file.size > 30_000_000) return NextResponse.json({error:"Use an MP4/MOV under 30MB"},{status:422});
  try { return NextResponse.json({ uploadId:await saveUpload(file), name:file.name, size:file.size },{status:201}); }
  catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Video validation failed"},{status:422}); }
}
