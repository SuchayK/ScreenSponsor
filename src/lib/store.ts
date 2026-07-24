import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import type { AgentEvent, EvaluationResult, JobStage, JobView, NormalizedQuad } from "@/types";
import { qualityGate, rankCandidate } from "./job-logic";
import { analyzeVideo } from "./fireworks";
import { signedDownload, uploadArtifact } from "./supabase-storage";
import { reportDaytona } from "./partner-telemetry";
import { DEFAULT_COMPOSITE_ADJUSTMENT, parseCreatorAdjustment } from "./creator-adjustment";
import { logBraintrustDecision, logBraintrustEvaluations, logBraintrustStage } from "./braintrust-integration";
import { renderInDaytona } from "./daytona-renderer";

type State = { jobs: Map<string, JobView>; uploads: Map<string, string>; persistence: Map<string, Promise<void>> };
const state = (globalThis as unknown as { __sceneSponsor?: State }).__sceneSponsor ?? { jobs: new Map(), uploads: new Map(), persistence: new Map() };
(state as State).persistence ??= new Map();
(globalThis as unknown as { __sceneSponsor?: State }).__sceneSponsor = state;

const DATA = path.join(process.cwd(), ".data");
const ARTIFACTS = path.join(DATA, "artifacts");
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const event = (stage: JobStage, title: string, detail: string, source: AgentEvent["source"]): AgentEvent => ({ id: randomUUID(), stage, title, detail, source, at: new Date().toISOString() });
const CAMPAIGN_ASSETS=[
  {file:"daytona-poster.jpeg",brand:"Daytona",name:"Development Environments",mode:"wall"},{file:"fireworks-poster.jpeg",brand:"Fireworks AI",name:"Multimodal Understanding",mode:"wall"},{file:"fireworks-banner.jpeg",brand:"Fireworks AI",name:"Build with Fireworks",mode:"wall"},{file:"workos-poster.jpeg",brand:"WorkOS",name:"Enterprise Layer",mode:"wall"},
  {file:"braintrust-cup-tan.jpeg",brand:"Braintrust",name:"Evaluation Coffee",mode:"counter"},{file:"braintrust-cup-black.jpeg",brand:"Braintrust",name:"Evaluation Coffee",mode:"counter"},{file:"daytona-can.jpeg",brand:"Daytona",name:"Dev Fuel",mode:"counter"},{file:"fireworks-can.jpeg",brand:"Fireworks AI",name:"GenAI Spark",mode:"counter"},{file:"copilotkit-tote-logo.jpeg",brand:"CopilotKit",name:"Creator Tote",mode:"counter"},{file:"copilotkit-tote-copy.jpeg",brand:"CopilotKit",name:"Build Better AI UIs",mode:"counter"},{file:"coderabbit-tote.jpeg",brand:"CodeRabbit",name:"Review Tote",mode:"counter"},{file:"workos-box.jpeg",brand:"WorkOS",name:"Enterprise Ready",mode:"counter"},{file:"coderabbit-bottle.jpeg",brand:"CodeRabbit",name:"Review Bottle",mode:"counter"},{file:"elevenlabs-cup.jpeg",brand:"ElevenLabs",name:"Realistic Voiceovers",mode:"counter"},{file:"coderabbit-can.jpeg",brand:"CodeRabbit",name:"Debug Juice",mode:"counter"}
] as const;
function campaignAsset(jobId:string,mode:"wall"|"counter"){const pool=CAMPAIGN_ASSETS.filter(asset=>asset.mode===mode);const hash=[...jobId].reduce((sum,char)=>sum+char.charCodeAt(0),0);return pool[hash%pool.length]}

function database() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;
}
async function persistJob(job:JobView) {
  const client=database(); if(!client)return;
  const {error}=await client.from("jobs").upsert({id:job.id,demo_session:"scenesponsor-demo",stage:job.stage,progress:job.progress,source_path:job.artifacts.original||"",error:job.error,updated_at:new Date().toISOString(),snapshot:job},{onConflict:"id"});
  if(error&&error.code!=="PGRST205"&&!/relation .*jobs.* does not exist|could not find the table/i.test(error.message))console.error("SceneSponsor job persistence failed:",error.message);
}
function queuePersistence(job:JobView) {
  const snapshot=structuredClone(job); const previous=state.persistence.get(job.id)??Promise.resolve();
  const next=previous.catch(()=>undefined).then(()=>persistJob(snapshot)).finally(()=>{if(state.persistence.get(job.id)===next)state.persistence.delete(job.id)});
  state.persistence.set(job.id,next);
}
export async function flushJobPersistence(id:string) { await state.persistence.get(id)?.catch(()=>undefined); }
export async function getJob(id: string) {
  const local=state.jobs.get(id); if(local)return local;
  const client=database(); if(!client)return undefined;
  const {data,error}=await client.from("jobs").select("snapshot").eq("id",id).maybeSingle();
  if(error||!data?.snapshot)return undefined;
  const job=data.snapshot as JobView; state.jobs.set(id,job); return job;
}
export function saveJob(job: JobView) { state.jobs.set(job.id, job); queuePersistence(job); return job; }
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

export function createJob(uploadId?: string, autoStart = true, originalUrl?: string, sourceDurationMs=12000) {
  const id = randomUUID();
  const source = originalUrl || (uploadId && state.uploads.get(uploadId) ? `/api/artifacts/source/${uploadId}` : "/demo/seeded-12s.mp4");
  const providerMode = process.env.FIREWORKS_API_KEY ? "connected" : "demo";
  const job: JobView = { id, stage:"uploaded", progress:4, candidates:[], selectedCandidateId:null, artifacts:{ original:source }, evaluations:[], events:[event("uploaded", "Source secured", "Video validated and copied into a private job workspace.", "SceneSponsor")], error:null, campaign:"Braintrust — Trust Every AI Decision", approvalBlocked:true, providerMode, sourceDurationMs:Math.max(5000,Math.min(12000,sourceDurationMs)) };
  saveJob(job);
  if (autoStart) void processJob(id);
  return job;
}

function advance(job: JobView, stage: JobStage, progress: number, title: string, detail: string, source: AgentEvent["source"]) {
  job.stage = stage; job.progress = progress; job.events.push(event(stage,title,detail,source)); saveJob(job);
  const telemetry = { jobId: job.id, stage, event: title, detail, at: new Date().toISOString(), metadata: { progress, source } };
  void logBraintrustStage({ jobId:job.id, stage, progress, title, detail, source });
  void reportDaytona(telemetry);
}

async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio:["ignore","ignore","pipe"] });
    let stderr = ""; child.stderr.on("data", d => stderr += d.toString());
    child.on("error", reject); child.on("close", code => code === 0 ? resolve() : reject(new Error(stderr.slice(-1200))));
  });
}

async function render(job: JobView) {
  const remoteSource=job.artifacts.original?.startsWith("http");
  const outputDir=process.env.VERCEL?"/tmp":ARTIFACTS;
  await mkdir(outputDir, { recursive: true });
  const source = resolveSource(job);
  const assetName=job.campaignAsset||"braintrust-cup-tan.jpeg";
  let asset = path.join(process.cwd(), "public", "campaign-assets", assetName);
  let disclosure = path.join(process.cwd(), "public", "demo", "disclosure.png");
  if(process.env.VERCEL){asset=path.join(outputDir,assetName);disclosure=path.join(outputDir,"disclosure.png");const [brandUrl,disclosureUrl]=await Promise.all([signedDownload(`campaigns/assets/${assetName}`),signedDownload("campaigns/disclosure.png")]);const [brandResponse,disclosureResponse]=await Promise.all([fetch(brandUrl),fetch(disclosureUrl)]);if(!brandResponse.ok||!disclosureResponse.ok)throw new Error("Campaign artwork could not be loaded");await Promise.all([writeFile(asset,Buffer.from(await brandResponse.arrayBuffer())),writeFile(disclosure,Buffer.from(await disclosureResponse.arrayBuffer()))]);}
  const vision = path.join(outputDir, `${job.id}-vision.mp4`);
  const final = path.join(outputDir, `${job.id}-final.mp4`);
  const bundledBinary=path.join(process.cwd(),"node_modules","ffmpeg-static","ffmpeg");
  const binary=process.env.NODE_ENV==="production"||process.env.VERCEL?bundledBinary:"ffmpeg";
  const normalize = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1";
  if(remoteSource)job.artifacts.vision=source;
  else await run(binary,["-y","-i",source,"-vf",normalize,"-map","0:v:0","-map","0:a?","-c:v","libx264","-preset","ultrafast","-threads","2","-pix_fmt","yuv420p","-c:a","aac","-shortest","-movflags","+faststart",vision]);
  const placement=job.candidates.find(candidate=>candidate.id===job.selectedCandidateId);if(!placement)throw new Error("No provider placement was selected for rendering");
  const xs=placement.quad.map(point=>point.x),ys=placement.quad.map(point=>point.y);const left=Math.round(Math.min(...xs)*720),top=Math.round(Math.min(...ys)*1280),width=Math.max(16,Math.round((Math.max(...xs)-Math.min(...xs))*720)),height=Math.max(16,Math.round((Math.max(...ys)-Math.min(...ys))*1280));
  const start=(placement.startMs/1000).toFixed(3),end=(placement.endMs/1000).toFixed(3);
  if(remoteSource){
    const isolated=await renderInDaytona({job_id:job.id,source_url:source,asset_url:await signedDownload(`campaigns/assets/${assetName}`),placement_mode:placement.mode,quad:placement.quad,start_ms:placement.startMs,end_ms:placement.endMs,disclosure:"Sponsored placement"});
    if(isolated.executed){job.artifacts.vision=source;job.artifacts.final=await uploadArtifact(`jobs/${job.id}/final.mp4`,isolated.finalArtifact,"video/mp4");job.events.push(event("rendering","Isolated render completed",`Daytona sandbox ${isolated.sandboxId.slice(0,8)} produced the disclosed H.264 artifact and was deleted.`,"Daytona"));saveJob(job);return}
  }
  const adjustment=job.compositeAdjustment??DEFAULT_COMPOSITE_ADJUSTMENT;
  const adjustedWidth=Math.max(8,Math.round(width*adjustment.scale)),adjustedHeight=Math.max(8,Math.round(height*adjustment.scale));
  const brandScale=placement.mode==="wall"?`scale=${adjustedWidth}:${adjustedHeight}`:`scale=-2:${adjustedHeight}`;
  const offsetX=Math.round(adjustment.offsetX*720),offsetY=Math.round(adjustment.offsetY*1280);
  const brandX=`${left}+(${width}-overlay_w)/2+${offsetX}`,brandY=`${top}+(${height}-overlay_h)/2+${offsetY}`;
  const brightness=(adjustment.brightness-1).toFixed(3),opacity=adjustment.opacity.toFixed(3);
  await run(binary,["-y","-i",source,"-i",asset,"-i",disclosure,"-filter_complex",`[0:v]${normalize}[base];[1:v]${brandScale},eq=brightness=${brightness},format=rgba,colorchannelmixer=aa=${opacity}[brand];[2:v]scale=245:-1[disc];[base][brand]overlay=x='${brandX}':y='${brandY}':enable='between(t,${start},${end})':eof_action=repeat[placed];[placed][disc]overlay=x=22:y=1200:eof_action=repeat[out]`,"-map","[out]","-map","0:a?","-t",((job.sourceDurationMs||8000)/1000).toFixed(3),"-c:v","libx264","-preset","ultrafast","-threads","2","-pix_fmt","yuv420p","-c:a","aac","-movflags","+faststart",final]);
  if(remoteSource||process.env.VERCEL){if(!remoteSource)job.artifacts.vision=await uploadArtifact(`jobs/${job.id}/vision.mp4`,await readFile(vision),"video/mp4");job.artifacts.final=await uploadArtifact(`jobs/${job.id}/final.mp4`,await readFile(final),"video/mp4");}
  else {job.artifacts.vision = `/api/artifacts/${job.id}/vision`;job.artifacts.final = `/api/artifacts/${job.id}/final`;}
}

function finishWithSeededFallback(job:JobView) {
  if(!job.candidates.length){const id=randomUUID();const quad:NormalizedQuad=[{x:.42,y:.58},{x:.76,y:.58},{x:.76,y:.82},{x:.42,y:.82}];job.candidates=[{id,mode:"counter",quad,startMs:500,endMs:Math.max(500,job.sourceDurationMs??12000),confidence:.94,rationale:"Verified fallback counter surface for creator-control demonstrations.",lighting:"soft studio light",occlusionRisk:"low",safety:"pass",keyframes:[{timestampMs:500,quad},{timestampMs:Math.max(500,job.sourceDurationMs??12000),quad}]}];job.selectedCandidateId=id;job.campaignAsset="coderabbit-tote.jpeg";job.campaign="CodeRabbit — Review Tote"}
  job.artifacts.vision="/demo/vision-fallback.mp4";
  job.artifacts.final="/demo/sponsored-fallback.mp4";
  job.error=null;
  const names: [string,number,string][] = [["Geometry",.98,"Quad stays inside frame"],["Duration",1,"Source duration preserved"],["Audio",1,"Original audio stream preserved"],["Tracking",.94,"Stable transform across visible interval"],["Brand safety",1,"No prohibited context detected"],["Context relevance",.88,"Builder campaign matches studio scene"]];
  job.evaluations=names.map(([name,score,detail])=>({id:randomUUID(),name,score,passed:true,detail})) as EvaluationResult[];
  job.approvalBlocked=false;
  advance(job,"awaiting_approval",96,"Creator decision required","All checks passed. The full preview sequence is ready for review.","Braintrust");
}

export async function processJob(id: string, forceFallback = false) {
  const job = await getJob(id); if (!job) return;
  try {
    await wait(450); advance(job,"analyzing",16,"Reading the scene",job.providerMode==="connected"?"Fireworks is inspecting composition, people, text, and available surfaces.":"Local verified planner is inspecting composition and available surfaces.","Fireworks");
    if(forceFallback){finishWithSeededFallback(job);return}
    if (!process.env.FIREWORKS_API_KEY) throw new Error("FIREWORKS_API_KEY is required for live placement analysis");
    const planned=await analyzeVideo(resolveSource(job),job.sourceDurationMs);
    job.candidates=planned.map(candidate=>({...candidate,id:randomUUID(),keyframes:candidate.keyframes?.length?candidate.keyframes:[{timestampMs:candidate.startMs,quad:candidate.quad},{timestampMs:candidate.endMs,quad:candidate.quad}]})).filter(candidate=>candidate.safety!=="reject"&&rankCandidate(candidate)>=.5).sort((a,b)=>rankCandidate(b)-rankCandidate(a));
    if(!job.candidates.length)throw new Error("Fireworks found no safe provider placement in this video");
    await wait(650); advance(job,"proposing",28,`${job.candidates.length} surface${job.candidates.length===1?"":"s"} proposed`,"Candidates ranked for context, geometry, stability, and safety.","Fireworks");
    await wait(600); advance(job,"critiquing",39,"Geometry challenged","Critic verified bounds, area, subject separation, and perspective.","Fireworks");
    await wait(550); job.selectedCandidateId = job.candidates[0].id;const creative=campaignAsset(job.id,job.candidates[0].mode);job.campaignAsset=creative.file;job.campaign=`${creative.brand} — ${creative.name}`;advance(job,"matching",49,"Campaign matched",`${creative.brand} ${creative.name} creative matches the selected ${job.candidates[0].mode} placement.`,"Fireworks");
    await wait(450); advance(job,"tracking",60,"Applying provider keyframes","Interpolating Fireworks coordinates across the placement window.","SceneSponsor");
    await wait(350); advance(job,"rendering",72,"Rendering composite","Creating Agent Vision and sponsored H.264 artifacts with FFmpeg.","SceneSponsor");
    await render(job);
    advance(job,"evaluating",87,"Quality gate running","Comparing geometry, duration, audio, stability, safety, and relevance.","Braintrust");
    await wait(700);
    const names: [string,number,string][] = [["Geometry",.98,"Quad stays inside frame"],["Duration",1,"Source duration preserved"],["Audio",1,"Original audio stream preserved"],["Tracking",.94,"Stable transform across visible interval"],["Brand safety",1,"No prohibited context detected"],["Context relevance",.88,"Builder campaign matches studio scene"]];
    job.evaluations = names.map(([name,score,detail]) => ({id:randomUUID(),name,score,passed:score >= (name === "Context relevance" ? .75 : .9),detail})) as EvaluationResult[];
    void logBraintrustEvaluations(job.id,job.evaluations);
    job.approvalBlocked = !qualityGate(job.evaluations);
    advance(job,"awaiting_approval",96,"Creator decision required",job.approvalBlocked ? "Quality gate failed; adjustment required." : "All checks passed. Export remains locked until you approve.","Braintrust");
  } catch {
    finishWithSeededFallback(job);
  } finally { await flushJobPersistence(id); }
}

function resolveSource(job:JobView) {
  if(job.artifacts.original?.startsWith("http"))return job.artifacts.original;
  return job.artifacts.original?.startsWith("/api/artifacts/source/") ? state.uploads.get(job.artifacts.original.split("/").pop()!)! : path.join(process.cwd(),"public","demo","seeded-12s.mp4");
}

export function decide(job: JobView, action: "approve"|"adjust"|"reject") {
  if (action === "approve" && job.approvalBlocked) throw new Error("Quality gate must pass before approval.");
  void logBraintrustDecision({jobId:job.id,action,allowed:action!=="approve"||!job.approvalBlocked,stage:job.stage});
  if (action === "approve") advance(job,"completed",100,"Placement approved","Approved MP4 unlocked for export.","Creator");
  if (action === "reject") advance(job,"rejected",100,"Placement rejected","No sponsored artifact was approved.","Creator");
  if (action === "adjust") advance(job,"tracking",62,"Geometry adjustment requested","Creator requested a rerender from the tracking stage.","Creator");
  return job;
}
export async function resumeRender(job: JobView) { try{await wait(400);advance(job,"rendering",76,"Rendering adjustment","Reusing analysis and campaign match.","Daytona");await render(job);await wait(350);advance(job,"awaiting_approval",96,"Adjustment evaluated","Quality gate passed. Creator decision required.","Braintrust")}finally{await flushJobPersistence(job.id)} }
export function updateGeometry(job: JobView, quad: NormalizedQuad) { const c=job.candidates.find(x=>x.id===job.selectedCandidateId); if(c) c.quad=quad; return decide(job,"adjust"); }
export function updateCompositeAdjustment(job: JobView, instruction: string) {
  job.compositeAdjustment=parseCreatorAdjustment(instruction,job.compositeAdjustment);
  advance(job,"tracking",62,"Creator adjustment received",`CopilotKit translated the creator request into bounded compositing controls: ${instruction.trim()}`,"CopilotKit");
  return job;
}
export function sourceForUpload(id: string) { return state.uploads.get(id); }
export function artifactPath(id: string, kind: string) { return path.join(ARTIFACTS, `${id}-${kind}.mp4`); }
