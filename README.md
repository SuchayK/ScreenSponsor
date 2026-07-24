# SceneSponsor

> Advertising that becomes part of the content, not an interruption to it.

**Built for Daytona HackSprint #5 with Braintrust — San Francisco, July 24, 2026.**

## Runnable MVP

The Broadcast Control MVP is implemented in this repository. Run `npm install && npm run dev`, open `http://localhost:3000`, and select **Analyze clip** for the verified end-to-end flow. It creates real 720×1280 H.264/AAC artifacts locally with FFmpeg, evaluates them, requires creator approval, and only then unlocks export.

See [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) for the exact provider status and setup boundaries. The interface explicitly distinguishes local verified rendering from credential-backed provider runs.

SceneSponsor is an advertising platform concept that places relevant branded products naturally inside existing short-form videos and digital content. Instead of stopping a viewer's experience with a dedicated ad, SceneSponsor turns suitable surfaces and spaces within the content into tasteful, measurable sponsorship opportunities.

A blank wall could feature a Trader Joe's bag. A kitchen counter could hold a Chipotle bag. A desk, shelf, table, or background could become a natural place for a brand to appear without requiring the creator to reshoot, read a script, or interrupt their audience.

## Sponsor technologies

| Technology | How SceneSponsor uses it |
| --- | --- |
| **Fireworks AI** | Multimodal scene understanding and placement planning with strict JSON validation, retry handling, and an operator-controlled live/fallback switch. |
| **Daytona** | Isolated worker contract for rendering jobs plus optional workspace-event telemetry for reproducible execution. |
| **Braintrust** | Agent decision trace, six-part quality gate, and optional job-stage telemetry for evaluable placement decisions. |
| **CopilotKit** | Human-in-the-loop agent interaction model: the creator reviews the reasoning, changes geometry, and approves or rejects the result. |
| **CodeRabbit** | Development review workflow for maintaining implementation quality during rapid product iteration. |

## The Problem

Traditional digital advertising creates friction for everyone involved:

- Viewers skip, block, or ignore disruptive ads.
- Creators must spend extra time filming sponsorship segments and revising content.
- Brands compete for attention in formats audiences have learned to tune out.
- Platforms sacrifice engagement when ads interrupt the viewing experience.

People want to enjoy content without being pulled away from it. Creators want to earn more without turning every sponsorship into additional production work. Brands want memorable visibility that feels native to the environment.

## The Solution

SceneSponsor integrates branded objects and placements directly into content after it has been created. The platform identifies visually appropriate locations in a scene, matches them with compatible campaigns, and adds the sponsored product in a way that respects the original composition.

The result is brand exposure that feels contextual rather than disruptive, while giving creators a new source of sponsorship income with little to no additional work.

## How It Works

1. **A creator connects or uploads content.** The original video remains the creative foundation.
2. **SceneSponsor understands the scene.** Visual analysis identifies suitable surfaces, spaces, lighting, perspective, and moments for placement.
3. **A relevant campaign is matched.** Brands define their audience, product assets, placement rules, and campaign goals.
4. **The product is integrated.** The branded object is positioned and rendered to fit the scene naturally.
5. **The creator reviews and approves.** Nothing is published without creator control.
6. **Performance is measured.** Brands receive placement-level reporting, and creators receive sponsorship revenue.

## The SceneSponsor Agent

SceneSponsor is designed as an autonomous, human-supervised advertising agent. It does more than generate an image overlay: it reasons about whether a placement belongs in a scene, which campaign is appropriate, how the object should appear, and whether the result is safe to present for approval.

For every piece of content, the agent:

1. Inspects the video and identifies stable, visible placement zones.
2. Understands the scene, creator context, and potential brand-safety risks.
3. Selects a compatible product from eligible campaigns.
4. Plans position, scale, perspective, lighting, occlusion, and duration.
5. Produces a composited preview in an isolated rendering environment.
6. Evaluates visual quality, disclosure, and policy compliance.
7. Explains its decision and requests creator approval before export.

The agent can reject a campaign or decline to modify a scene when a placement would be misleading, unsafe, visually poor, or inconsistent with creator preferences.

## Example Placements

| Content scene | Potential integration |
| --- | --- |
| Creator speaking in front of a blank wall | Branded tote, poster, or wall-mounted product |
| Food or lifestyle video with an open counter | Restaurant bag, beverage, or packaged product |
| Podcast or desk setup | Laptop sticker, drink, notebook, or small device |
| Bedroom or studio background | Apparel, decor, beauty product, or shopping bag |
| Fitness content | Water bottle, shoes, apparel, or equipment |

## Value for Everyone

### For creators

- Earn sponsorship revenue from content they already make.
- Avoid scripts, reshoots, and dedicated ad segments.
- Keep final approval over every brand and placement.
- Monetize both new content and eligible back catalogs.

### For brands

- Build awareness without interrupting the audience.
- Appear inside relevant cultural and creator-led moments.
- Target campaigns by audience, creator, context, and scene.
- Measure exposure at the individual placement level.

### For viewers

- Experience fewer disruptive ad breaks.
- Continue watching without being taken out of the content.
- See brand integrations that fit the context of the scene.
- Receive clear disclosure without sacrificing the viewing experience.

### For platforms

- Create a new native advertising inventory layer.
- Improve monetization without adding more interruptions.
- Share revenue with creators and strengthen the creator economy.
- Preserve watch time and audience engagement.

## Product Principles

SceneSponsor is designed around five core principles:

1. **Creator control** — creators choose eligible content, approve participating brands, and review final placements.
2. **Natural integration** — placements should match the scene's lighting, scale, perspective, motion, and visual style.
3. **Clear disclosure** — sponsored integrations should be transparently labeled in accordance with platform rules and advertising law.
4. **Brand safety** — campaigns should only appear in suitable, approved content and contexts.
5. **Audience respect** — monetization should enhance the economics of content without degrading the experience of watching it.

## Platform Vision

SceneSponsor would operate as a marketplace connecting creators, brands, agencies, and content platforms.

Brands provide approved product assets, campaign requirements, budgets, and targeting criteria. Creators establish their preferences, pricing, and brand exclusions. SceneSponsor handles scene analysis, campaign matching, visual integration, review, attribution, reporting, and payouts.

Over time, the platform could support:

- Short-form video, long-form video, livestream replays, and creator archives
- Static and motion-aware product placement
- Campaign targeting by audience, topic, location, and visual context
- Creator-controlled brand allowlists and blocklists
- Placement previews and approval workflows
- Dynamic campaign rotation where rights and formats permit it
- Exposure, attention, recall, engagement, and conversion reporting
- Automated revenue sharing between brands, creators, and platforms

## Business Model

SceneSponsor can generate revenue through a percentage of each completed sponsorship campaign. Additional revenue opportunities may include managed campaigns, agency tools, premium measurement, enterprise integrations, and platform licensing.

The core model is aligned: SceneSponsor earns when creators earn and brands receive approved placements.

## Hackathon Architecture

The HackSprint prototype is intended to demonstrate a complete agent loop rather than a UI-only mockup:

```text
Creator video
     │
     ▼
Scene analysis ──► Campaign matching ──► Placement planning
                                               │
                                               ▼
Creator approval ◄── Safety evaluation ◄── Isolated render
     │
     ▼
Exported sponsored video + decision trace
```





---

**SceneSponsor** — Make the brand part of the scene.
