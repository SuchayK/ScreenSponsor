import { ArrowUpRight, CheckCircle, Clock } from "@phosphor-icons/react/dist/ssr";
import { SectionShell } from "@/components/section-shell";

const placements=[
  {name:"Studio wall",scene:"Creator workspace",status:"Approved",score:"94",mode:"wall",window:"00:00.3–00:08.0"},
  {name:"Counter edge",scene:"Kitchen setup",status:"Needs review",score:"73",mode:"counter",window:"00:01.2–00:07.4"},
  {name:"Desk corner",scene:"Podcast frame",status:"Draft",score:"68",mode:"desk",window:"00:00.8–00:06.1"},
];

export default function PlacementsPage(){return <SectionShell code="PL/01" eyebrow="SURFACE INVENTORY" title="Placements" description="Review every surface the agent can turn into creator-approved sponsorship space." asideTitle="One active placement" asideCopy="The studio wall is the only placement currently cleared for rendering. The other surfaces remain review-only.">
  <div className="sectionToolbar"><div><span>PLACEMENT LIBRARY</span><b>3 detected surfaces</b></div><button>Filter surfaces</button></div>
  <div className="placementGrid">{placements.map((item,index)=><article className="placementCard" key={item.name}>
    <div className={`surfacePreview surface${index+1}`}><span className="surfaceBox">{item.mode.toUpperCase()} · {item.score}%</span><i>0{index+1}</i></div>
    <div className="placementCopy"><div><span className={`state ${item.status==="Approved"?"good":""}`}>{item.status==="Approved"?<CheckCircle/>:<Clock/>}{item.status}</span><small>{item.window}</small></div><h2>{item.name}</h2><p>{item.scene}</p><button>Open review <ArrowUpRight/></button></div>
  </article>)}</div>
</SectionShell>}
