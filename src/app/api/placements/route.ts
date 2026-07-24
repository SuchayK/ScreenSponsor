import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { PlacementsFileSchema } from "@/lib/placements/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const parsed = PlacementsFileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "public", "placements.json");
  fs.writeFileSync(filePath, JSON.stringify(parsed.data, null, 2));
  return NextResponse.json({ ok: true });
}
