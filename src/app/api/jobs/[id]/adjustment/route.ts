import { after, NextResponse } from "next/server";
import { flushJobPersistence, getJob, resumeRender, updateCompositeAdjustment } from "@/lib/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  try {
    const body = await req.json();
    if (typeof body.instruction !== "string") {
      return NextResponse.json({ error: "A creator instruction is required" }, { status: 422 });
    }
    const updated = updateCompositeAdjustment(job, body.instruction);
    await flushJobPersistence(id);
    after(() => resumeRender(updated));
    return NextResponse.json(updated, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Adjustment failed" }, { status: 422 });
  }
}
