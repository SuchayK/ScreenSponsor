"use client";

import { useEffect, useState } from "react";
import { SectionShell } from "@/components/section-shell";

const FIREWORKS_SETTING = "scenesponsor:fireworks-enabled";

export default function SettingsPage(){const [fireworksEnabled,setFireworksEnabled]=useState(true);useEffect(()=>setFireworksEnabled(localStorage.getItem(FIREWORKS_SETTING)!=="false"),[]);const setFireworks=(enabled:boolean)=>{localStorage.setItem(FIREWORKS_SETTING,String(enabled));setFireworksEnabled(enabled)};return <SectionShell code="ST/CO" eyebrow="CREATOR CONTROLS" title="Settings" description="Set the boundaries the agent must respect before it analyzes or modifies a clip." asideTitle="Creator rules lead" asideCopy="These controls are a frontend preview. They show how creator preferences will govern matching and export.">
  <div className="settingsLayout"><section className="settingsPanel"><div className="settingsTitle"><span>PLACEMENT RULES</span><b>Scene behavior</b></div>
    <Toggle label="Use Fireworks AI" detail={fireworksEnabled?"New analyses use the live provider.":"New analyses play the seeded 01 → 02 → 03 sequence."} checked={fireworksEnabled} onChange={setFireworks}/>
    <label className="field"><span>Allowed surfaces</span><select defaultValue="wall-counter"><option value="wall-counter">Walls and counters</option><option value="wall">Walls only</option><option value="all">All safe surfaces</option></select></label>
    <label className="field"><span>Minimum confidence</span><div className="rangeField"><input type="range" min="50" max="100" defaultValue="85"/><b>85%</b></div></label>
    <Toggle label="Require disclosure on every frame" detail="Keep the sponsored label visible for the full placement." checked/>
    <Toggle label="Allow motion-tracked placements" detail="Let approved assets follow a stable surface." checked/>
  </section><section className="settingsPanel"><div className="settingsTitle"><span>CREATOR SAFETY</span><b>Approval boundaries</b></div>
    <Toggle label="Always require my approval" detail="Never unlock export automatically." checked/>
    <Toggle label="Block regulated categories" detail="Reject alcohol, gambling, political and medical campaigns." checked/>
    <Toggle label="Allow back-catalog matching" detail="Suggest placements for previously uploaded videos."/>
    <label className="field"><span>Blocked brands</span><input type="text" placeholder="Add a brand name"/></label>
    <button className="saveSettings">Save changes</button>
  </section></div>
</SectionShell>}

function Toggle({label,detail,checked=false,onChange}:{label:string;detail:string;checked?:boolean;onChange?:(checked:boolean)=>void}){return <label className="toggleRow"><span><b>{label}</b><small>{detail}</small></span><input type="checkbox" {...(onChange?{checked,onChange:(event:React.ChangeEvent<HTMLInputElement>)=>onChange(event.target.checked)}:{defaultChecked:checked})}/><i/></label>}
