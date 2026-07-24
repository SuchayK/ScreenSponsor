import Link from "next/link";
import { ArrowLeft, Broadcast } from "@phosphor-icons/react/dist/ssr";
import { AppNavigation } from "./app-navigation";

export function SectionShell({code,eyebrow,title,description,asideTitle,asideCopy,children}:{code:string;eyebrow:string;title:string;description:string;asideTitle:string;asideCopy:string;children:React.ReactNode}) {
  return <main className="app sectionApp">
    <header className="topbar"><div className="wordmark"><span className="mark"><Broadcast weight="fill"/></span><b>SCENE<span>SPONSOR</span></b></div><div className="signal"><i/><span>STUDIO READY</span><em>LOCAL VERIFIED MODE</em></div><Link className="quiet" href="/"><ArrowLeft/> Control room</Link></header>
    <AppNavigation/>
    <section className="workspace sectionWorkspace">
      <header className="sectionHero"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div><strong aria-hidden="true">{code}</strong></header>
      {children}
    </section>
    <aside className="trace sectionAside"><div className="traceHead"><div><p className="eyebrow">WORKSPACE NOTE</p><h2>{asideTitle}</h2></div><span>PREVIEW</span></div><div className="sectionAsideBody"><Broadcast/><p>{asideCopy}</p><dl><div><dt>Mode</dt><dd>Creator controlled</dd></div><div><dt>Disclosure</dt><dd>Required</dd></div><div><dt>Export</dt><dd>Approval gated</dd></div></dl></div></aside>
  </main>;
}
