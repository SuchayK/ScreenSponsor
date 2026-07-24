import { ArrowUpRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { SectionShell } from "@/components/section-shell";

const campaigns=[
  {brand:"Daytona",name:"Build Anywhere",format:"Wall + counter",status:"Active",match:"94%",color:"violet"},
  {brand:"Linear",name:"Make the work flow",format:"Desk + display",status:"Ready",match:"86%",color:"blue"},
  {brand:"Notion",name:"Ideas in motion",format:"Desk + shelf",status:"Draft",match:"78%",color:"paper"},
];

export default function CampaignsPage(){return <SectionShell code="CA/03" eyebrow="BRAND INVENTORY" title="Campaigns" description="See which approved campaigns can enter a scene before the agent makes a match." asideTitle="Three eligible campaigns" asideCopy="Campaigns are ranked against scene context and creator rules before any brand asset reaches the renderer.">
  <div className="sectionToolbar"><div><span>CAMPAIGN DESK</span><b>3 campaigns in rotation</b></div><button><Plus/> New campaign</button></div>
  <div className="campaignList">{campaigns.map((item,index)=><article className="campaignRow" key={item.brand}><div className={`brandTile ${item.color}`}>{item.brand.slice(0,1)}</div><div className="campaignIdentity"><small>{item.brand.toUpperCase()}</small><h2>{item.name}</h2></div><div><small>ALLOWED SURFACES</small><b>{item.format}</b></div><div><small>SCENE MATCH</small><b className="matchScore">{item.match}</b></div><span className={`campaignState ${item.status.toLowerCase()}`}>{item.status}</span><button aria-label={`Open ${item.name}`}><ArrowUpRight/></button><i>0{index+1}</i></article>)}</div>
</SectionShell>}
