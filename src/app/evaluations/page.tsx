import { Check, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { SectionShell } from "@/components/section-shell";

const checks=[
  ["Geometry","98","Quad stays inside frame"],["Duration","100","Source duration preserved"],["Audio","100","Original stream preserved"],
  ["Tracking","94","Transform remains stable"],["Brand safety","100","No prohibited context"],["Context relevance","88","Campaign fits the scene"],
];

export default function EvaluationsPage(){return <SectionShell code="EV/06" eyebrow="QUALITY SIGNAL" title="Evaluations" description="Inspect the six checks that stand between a rendered placement and creator approval." asideTitle="Quality gate passed" asideCopy="Every required check is above its threshold. Creator approval is still required before export.">
  <div className="evaluationBanner"><div><ShieldCheck weight="fill"/><span><small>LATEST RUN</small><b>Ready for creator review</b></span></div><strong>6 / 6 PASS</strong></div>
  <div className="evaluationMatrix">{checks.map(([name,score,detail])=><article key={name}><div><span>{name}</span><Check/></div><strong>{score}</strong><div className="signalBar"><i style={{width:`${score}%`}}/></div><p>{detail}</p></article>)}</div>
  <div className="thresholdNote"><span>GATE LOGIC</span><p>Brand safety must score 100. Context relevance must score at least 75. All other checks must score at least 90.</p></div>
</SectionShell>}
