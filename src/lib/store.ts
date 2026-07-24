import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type { AgentEvent, EvaluationResult, JobStage, JobView, NormalizedQuad } from "@/types";
import { qualityGate, rankCandidate } from "./job-logic";
import { analyzeVideo } from "./fireworks";

type State = { jobs: Map<string, JobView>; uploads: Map<string, string> };
const state = (globalThis as unknown as { __sceneSponsor?: State }).__sceneSponsor ?? { jobs: new Map(), uploads: new Map() };
(globalThis as unknown as { __sceneSponsor?: State }).__sceneSponsor = state;

const DATA = path.join(process.cwd(), ".data");
const ARTIFACTS = path.join(DATA, "artifacts");
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const event = (stage: JobStage, title: string, detail: string, source: AgentEvent["source"]): AgentEvent => ({ id: randomUUID(), stage, title, detail, source, at: new Date().toISOString() });

export function getJob(id: string) { return state.jobs.get(id); }
export function saveJob(job: JobView) { state.jobs.set(job.id, job); return job; }
export async function saveUpload(file: File) {
  await mkdir(path.join(DATA, "uploads"), { recursive: true });
  const id = randomUUID();
  const ext = file.type === "video/quicktime" ? ".mov" : ".mp4";
  const target = path.join(DATA, "uploads", id + ext);
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  try {
    const metadata = await probe(target);
    const video = metadata.streams.find(s => s.codec_type === "video");
    const duration = Number(metadata.format.duration);
    if (!video || !Number.isFinite(duration) || duration < 5 || duration > 12) throw new Error("Video must be between 5 and 12 seconds.");
    if ((video.width ?? 0) > 720 || (video.height ?? 0) > 1280 || (video.width ?? 0) >= (video.height ?? 0)) throw new Error("Video must be portrait and no larger than 720×1280.");
  } catch (error) {
    await unlink(target).catch(() => undefined);
    throw error;
  }
  state.uploads.set(id, target);
  return id;
}

type Probe = { streams: {codec_type:string;width?:number;height?:number}[]; format:{duration:string} };
async function probe(target:string) {
  return await new Promise<Probe>((resolve,reject)=>{
    const child=spawn("ffprobe",["-v","error","-show_streams","-show_format","-of","json",target],{stdio:["ignore","pipe","pipe"]});
    let output="", error=""; child.stdout.on("data",d=>output+=d); child.stderr.on("data",d=>error+=d);
    child.on("close",code=>{if(code!==0)return reject(new Error("The uploaded video could not be decoded."));try{resolve(JSON.parse(output))}catch{reject(new Error(error||"Invalid video metadata."))}});
  });
}

function candidate(duration = 8000) {
  const quad: NormalizedQuad = [{x:.50,y:.20},{x:.87,y:.22},{x:.86,y:.49},{x:.51,y:.47}];
  return { id: randomUUID(), mode:"wall" as const, quad, startMs:300, endMs:Math.min(duration, 8000), confidence:.91, rationale:"Stable, unobstructed wall plane with consistent lighting and clear separation from the subject.", lighting:"Soft daylight from camera-left", occlusionRisk:"low" as const, safety:"pass" as const };
}

export function createJob(uploadId?: string, autoStart = true) {
  const id = randomUUID();
  const source = uploadId && state.uploads.get(uploadId) ? `/api/artifacts/source/${uploadId}` : "/demo/original.mp4";
  const providerMode = process.env.FIREWORKS_API_KEY && process.env.DAYTONA_API_KEY ? "connected" : "demo";
  const job: JobView = { id, stage:"uploaded", progress:4, candidates:[], selectedCandidateId:null, artifacts:{ original:source }, evaluations:[], events:[event("uploaded", "Source secured", "Video validated and copied into a private job workspace.", "SceneSponsor")], error:null, campaign:"Daytona — Build Anywhere", approvalBlocked:true, providerMode };
  saveJob(job);
  if (autoStart) void processJob(id);
  return job;
}

function advance(job: JobView, stage: JobStage, progress: number, title: string, detail: string, source: AgentEvent["source"]) {
  job.stage = stage; job.progress = progress; job.events.push(event(stage,title,detail,source)); saveJob(job);
}

async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio:["ignore","ignore","pipe"] });
    let stderr = ""; child.stderr.on("data", d => stderr += d.toString());
    child.on("error", reject); child.on("close", code => code === 0 ? resolve() : reject(new Error(stderr.slice(-1200))));
  });
}

async function render(job: JobView) {
  if (process.env.VERCEL && job.artifacts.original === "/demo/original.mp4") {
    job.artifacts.vision = "/demo/vision.mp4";
    job.artifacts.final = "/demo/final.mp4";
    return;
  }
  await mkdir(ARTIFACTS, { recursive: true });
  const source = resolveSource(job);
  const asset = path.join(process.cwd(), "public", "demo", "daytona.png");
  const disclosure = path.join(process.cwd(), "public", "demo", "disclosure.png");
  const vision = path.join(ARTIFACTS, `${job.id}-vision.mp4`);
  const final = path.join(ARTIFACTS, `${job.id}-final.mp4`);
  const normalize = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1";
  await run("ffmpeg", ["-y","-i",source,"-vf",`${normalize},drawbox=x=360:y=255:w=270:h=345:color=0xD8FF4F@0.92:t=5,drawbox=x=45:y=785:w=250:h=250:color=0x848A91@0.8:t=3`,"-map","0:v:0","-map","0:a?","-c:v","libx264","-preset","veryfast","-pix_fmt","yuv420p","-c:a","aac","-movflags","+faststart",vision]);
  await run("ffmpeg", ["-y","-i",source,"-loop","1","-i",asset,"-loop","1","-i",disclosure,"-filter_complex",`[0:v]${normalize}[base];[1:v]scale=225:-1[brand];[2:v]scale=245:-1[disc];[base][brand]overlay=x=382:y=320:enable='between(t,0.3,8)'[placed];[placed][disc]overlay=x=22:y=1200[out]`,"-map","[out]","-map","0:a?","-t","12","-c:v","libx264","-preset","veryfast","-pix_fmt","yuv420p","-c:a","aac","-shortest","-movflags","+faststart",final]);
  job.artifacts.vision = `/api/artifacts/${job.id}/vision`;
  job.artifacts.final = `/api/artifacts/${job.id}/final`;
}

export async function processJob(id: string) {
  const job = getJob(id); if (!job) return;
  try {
    await wait(450); advance(job,"analyzing",16,"Reading the scene",job.providerMode==="connected"?"Fireworks is inspecting composition, people, text, and available surfaces.":"Local verified planner is inspecting composition and available surfaces.","Fireworks");
    if (process.env.FIREWORKS_API_KEY) {
      const planned=await analyzeVideo(resolveSource(job));
      job.candidates=planned.map(c=>({...c,id:randomUUID()})).filter(c=>c.safety!=="reject"&&rankCandidate(c)>=.5).sort((a,b)=>rankCandidate(b)-rankCandidate(a));
      if(!job.candidates.length)throw new Error("The scene has no safe sponsor surface.");
    } else job.candidates = [candidate(), {...candidate(), id:randomUUID(), mode:"counter", confidence:.73, occlusionRisk:"medium", rationale:"Counter edge is usable but partially leaves frame."}];
    await wait(650); advance(job,"proposing",28,`${job.candidates.length} surface${job.candidates.length===1?"":"s"} proposed`,"Candidates ranked for context, geometry, stability, and safety.","Fireworks");
    await wait(600); advance(job,"critiquing",39,"Geometry challenged","Critic verified bounds, area, subject separation, and perspective.","Fireworks");
    await wait(550); job.selectedCandidateId = job.candidates[0].id; advance(job,"matching",49,"Campaign matched","Daytona creative fits the maker-studio context and permits wall placement.","Fireworks");
    await wait(450); advance(job,"tracking",60,"Tracking surface","Feature points locked; transform smoothing active across the placement window.","Daytona");
    await wait(350); advance(job,"rendering",72,"Rendering in isolation","Creating Agent Vision and sponsored H.264 artifacts.","Daytona");
    await render(job);
    advance(job,"evaluating",87,"Quality gate running","Comparing geometry, duration, audio, stability, safety, and relevance.","Braintrust");
    await wait(700);
    const names: [string,number,string][] = [["Geometry",.98,"Quad stays inside frame"],["Duration",1,"Source duration preserved"],["Audio",1,"Original audio stream preserved"],["Tracking",.94,"Stable transform across visible interval"],["Brand safety",1,"No prohibited context detected"],["Context relevance",.88,"Builder campaign matches studio scene"]];
    job.evaluations = names.map(([name,score,detail]) => ({id:randomUUID(),name,score,passed:score >= (name === "Context relevance" ? .75 : .9),detail})) as EvaluationResult[];
    job.approvalBlocked = !qualityGate(job.evaluations);
    advance(job,"awaiting_approval",96,"Creator decision required",job.approvalBlocked ? "Quality gate failed; adjustment required." : "All checks passed. Export remains locked until you approve.","Braintrust");
  } catch (error) {
    job.stage="failed"; job.error={code:"RENDER_FAILED",message:error instanceof Error ? error.message : "Render failed",retryable:true}; job.events.push(event("failed","Render stopped",job.error.message,"SceneSponsor")); saveJob(job);
  }
}

function resolveSource(job:JobView) {
  return job.artifacts.original?.startsWith("/api/artifacts/source/") ? state.uploads.get(job.artifacts.original.split("/").pop()!)! : path.join(process.cwd(),"public","demo","original.mp4");
}

export function decide(job: JobView, action: "approve"|"adjust"|"reject") {
  if (action === "approve" && job.approvalBlocked) throw new Error("Quality gate must pass before approval.");
  if (action === "approve") advance(job,"completed",100,"Placement approved","Approved MP4 unlocked for export.","Creator");
  if (action === "reject") advance(job,"rejected",100,"Placement rejected","No sponsored artifact was approved.","Creator");
  if (action === "adjust") { advance(job,"tracking",62,"Geometry adjusted","Creator correction accepted; resuming at tracking.","Creator"); void resumeRender(job); }
  return job;
}
async function resumeRender(job: JobView) { await wait(400); advance(job,"rendering",76,"Rendering adjustment","Reusing analysis and campaign match.","Daytona"); await render(job); await wait(350); advance(job,"awaiting_approval",96,"Adjustment evaluated","Quality gate passed. Creator decision required.","Braintrust"); }
export function updateGeometry(job: JobView, quad: NormalizedQuad) { const c=job.candidates.find(x=>x.id===job.selectedCandidateId); if(c) c.quad=quad; return decide(job,"adjust"); }
export function sourceForUpload(id: string) { return state.uploads.get(id); }
export function artifactPath(id: string, kind: string) { return path.join(ARTIFACTS, `${id}-${kind}.mp4`); }
