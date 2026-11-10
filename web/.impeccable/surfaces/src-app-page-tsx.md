---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/dashboard/page.tsx","src/app/room/[id]/page.tsx","src/app/(auth)/login/page.tsx","src/app/(auth)/register/page.tsx","src/components/conference/ConferenceRoom.tsx"]
---

# MyScreen — repaginação completa

## Scope and visitor mode

All web surfaces of the product, replaced from absolute zero: `layout.tsx`, `globals.css`, the
landing page, login, register, dashboard, the room entry page, the Navbar, the error boundaries,
and the whole `src/components/conference/` set (ConferenceRoom, GreenRoom, MediaControls,
SettingsModal, LocalRecorder, TrackStatsDropdown, ParticipantsList, ChatSidebar). Preserved and
untouched: `src/app/api/`, `src/lib/`, `prisma/`, the security tests, and the `livekit-client`
SDK calls. Two modes share one world: **Persuade** on the landing, **Operate** everywhere else.

## Audience, job, action

A technical person who runs their own server, alone at a desk, about to show a screen to one or
two people. Job: make the transmission legible and audible, first try, behind whatever NAT. The
action on the landing is not "sign up" — it is *choose the encoding settings and see what they
do*. The action everywhere else is a task, not a pitch.

## Direction chosen

**A Cut Sheet** — the broadcast edit decision list. Seed key `2a49043a`, rolled and locked with
the user. Judged against the six catalog challengers on audience identification and product
clarity; `pop-culture-shelf-cassette-futurism-deck` and `paper-folds-pleats-deployable-miura-orbit-sheet`
were competitive and are carried as full alternates. The darkroom, cracktro, j-card and cloud
quarry were declined; each contributed one raised discipline, listed below.

## Memorable moment

The hero is not a picture of the product. The hero **is** the control surface: a real, working
ruled row of cells — resolution, frame rate, content type, audio — that you can change, where
the value and the consequence update on the spot. The page demonstrates quality-as-a-control
instead of claiming it in a headline.

## Unresolved

Dark theme is explicitly deferred, not pending. The read-only `/api/health` endpoint is real and
usable as a status row. There is no logo, no screenshot and no social proof anywhere in the
repo, so no section may imply any of those exist.

---

## Direction contract

**THESIS.** A Cut Sheet. The category always ships a dark video-call clone: hero headline, three
icon cards, blue button. This page refuses the card grid entirely and prints the product as the
artifact its audience already reads — a timecoded, column-ruled decision sheet. Every control is
a cell holding a typed value, never a toggle with a caption.

**OWN-WORLD.** Cool neutral paper ground, sheets lifted a hair off it. Hairline rules in warm
gray, near-black ink for body, pencil gray for anything unmeasured, and exactly one accent — a
deep printed leader blue — reserved for the primary action and for live state. Archivo for
headings and body with real cap discipline; Spline Sans Mono for every id, timecode and value,
right-aligned tight to the margin. No shadows doing structural work, no radii above 4px: depth
comes from rules and paper lift.

**STORY.** The visitor understands that transmission quality is something they operate, not
something a vendor promises. They believe it because the mechanism is on screen and adjustable
in the first viewport. They do one thing: set the encoding and go.

**FIRST VIEWPORT.** The header is the sheet's own head: wordmark left, one hairline rule, session
controls right. Below, at working scale, a single ruled band carrying resolution, frame rate,
content type and audio as live cells with mono values, and the primary action aligned to the
right margin. No hero image, no device mock, no logo cloud.

**FORM.** Cells, rules and amendment marks. Changing a value amends the sheet and leaves a visible
change mark, the way an editor marks a cutting sheet — that is the signature interaction and it
repeats on every surface. Below the band, discrete ruled blocks with real air between them;
never one continuous surface.

**REACH AND RISK.** The sheet grammar carries the lobby, the live room, settings, the honest
stats panel and the dashboard, so the world is not landing-only. The honest risk: loose ruling
turns this into a spreadsheet and it loses the authority of paper — the rules and the module
grid are load-bearing, not decoration.
