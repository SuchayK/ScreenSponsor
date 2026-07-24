"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FilmStrip, Gauge, House, SlidersHorizontal, Sparkle } from "@phosphor-icons/react";

const controlLinks = [
  { href:"/", label:"Control room", shortLabel:"Control", icon:House },
  { href:"/placements", label:"Placements", shortLabel:"Placements", count:"01", icon:FilmStrip },
  { href:"/campaigns", label:"Campaigns", shortLabel:"Campaigns", count:"03", icon:Sparkle },
];

const systemLinks = [
  { href:"/evaluations", label:"Evaluations", shortLabel:"Evals", icon:Gauge },
  { href:"/settings", label:"Settings", shortLabel:"Settings", icon:SlidersHorizontal },
];

function NavLink({item,mobile=false}:{item:(typeof controlLinks)[number]|(typeof systemLinks)[number];mobile?:boolean}) {
  const pathname=usePathname(); const Icon=item.icon; const selected=pathname===item.href;
  return <Link className={selected?"selected":""} href={item.href} aria-current={selected?"page":undefined}><Icon/><span>{mobile?item.shortLabel:item.label}</span>{!mobile&&"count" in item&&item.count&&<em>{item.count}</em>}</Link>;
}

export function AppNavigation() {
  return <>
    <nav className="sidebar" aria-label="Primary navigation">
      <div className="navGroup"><small>CONTROL</small>{controlLinks.map(item=><NavLink item={item} key={item.href}/>)}</div>
      <div className="navGroup"><small>SYSTEM</small>{systemLinks.map(item=><NavLink item={item} key={item.href}/>)}</div>
    </nav>
    <nav className="mobileNav" aria-label="Mobile navigation">{[...controlLinks,...systemLinks].map(item=><NavLink item={item} mobile key={item.href}/>)}</nav>
  </>;
}
