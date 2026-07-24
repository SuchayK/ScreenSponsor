import { NextResponse } from "next/server";
export async function POST() { return NextResponse.json({ uploadUrl:"/api/uploads", expiresIn:600, maxBytes:30_000_000, accepted:["video/mp4","video/quicktime"] }); }
