import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets:["latin"], variable:"--font-sans" });
const mono = Geist_Mono({ subsets:["latin"], variable:"--font-mono" });
export const metadata: Metadata = { title:"SceneSponsor — Broadcast Control", description:"Creator-controlled, in-scene sponsorship agent" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body className={`${geist.variable} ${mono.variable}`}>{children}</body></html>; }
