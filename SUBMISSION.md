# SUBMISSION DRAFT — Devpost (copy-paste ready)

> **Status: DRAFT — do not submit yet.**
> Placeholders marked `[TODO: ...]` need the team owner's accounts
> (GitHub, YouTube, hosting). Everything else is final text, in English,
> ready to paste into the Devpost form.

---

## Title

**SKY CLUTCH — Cloud9 Booth Aim Challenge**

## Tagline

A 60-second booth aim challenge: pop sky orbs, dodge storm clouds, chase
the Golden Cloud — with a local leaderboard that needs no Wi-Fi.

## Category

**Category 3 (Event Mini Game)**

## Description

SKY CLUTCH is a fast, replayable aim / reaction mini game designed for a
live event booth.

You have 60 seconds. Glowing sky orbs drift across the screen — click or
tap them to pop them for points. Chain pops to build a combo multiplier up
to ×5. Dark storm clouds are decoys: click one and you lose 15 points and
your combo. Rare Golden Clouds are worth big points and add 2 bonus seconds
(max twice per game). When time runs out you get your score, accuracy, best
combo, and a rank from Rookie up to SKY'S THE LIMIT — then one big PLAY
AGAIN button resets everything cleanly for the next player.

Why it fits a booth:

- **Under 3 minutes:** a full visit (round + score screen) is under
  90 seconds.
- **Zero learning curve:** one verb — click what glows. The whole game is
  explained in a single sentence on the menu; the first target appears
  within half a second of pressing PLAY.
- **Clean reset:** every run rebuilds all state from scratch, so players
  never inherit the previous player's score.
- **Offline leaderboard:** a daily top-10 board stored locally on the
  machine, plus a big-board display mode (`?board=1`) for a second
  monitor — no Wi-Fi, no backend, no account.
- **No fail state:** there are no lives, so a first-time player never
  fails in public in front of a queue.

Everything is original and made in code: the sky, the clouds, the mascot
Nimbus (a small cloud pilot with goggles and a yellow scarf), and all
sounds (synthesized with WebAudio). No third-party artwork, no logos, no
copyrighted music. The game is a static site — vanilla HTML/CSS/JS, zero
dependencies, zero network calls — so it runs from any static host or even
straight from disk.

**Controls:** mouse, touch, or keyboard (Space / Enter to start and
replay). Responsive from a 1280×720 booth monitor down to a portrait
phone.

## Methodology

See `METHODOLOGY.md` in the repository (full write-up). In short: we
designed from the Category 3 brief backwards — cold walk-up, short
session, hours of unattended use, offline venue, original assets only —
and chose an aim-trainer format because it needs no movement keys, no
camera, and no tutorial. Difficulty ramps inside the round (faster spawns,
faster and shorter-lived targets, more storm clouds), the combo system
rewards accuracy without punishing beginners, and the local leaderboard is
the retention loop that makes people queue again.

## Tooling explanation

The project was built with **IntelliJ IDEA Community Edition 2025.3**
(the JetBrains tool used). The project was opened, indexed, and edited in
IDEA; the code was validated with IDEA's **Inspect Code**; and the repo
includes the IDEA project files (`.idea/`), among them a run
configuration ("Run Local Server") that serves the game on
`http://localhost:8000`. An AI coding agent assisted with writing the
code and the automated Playwright verification; the AI workflow is
documented in `AI_SHOWCASE.md`. Junie and JetBrains Air were not used —
both require a JetBrains account and a trial code issued after Devpost
registration.

## Links

- **GitHub repository:** [TODO: GitHub URL — create a public repo, push this folder, paste the URL here]
- **Live demo / hosted game:** [TODO: demo URL — host the static files (GitHub Pages / Netlify / any static host) and paste the URL here]
- **Demo video (YouTube, public, ≤ 3 min):** [TODO: YouTube video URL — upload verification/demo-video.mp4 (or a re-recorded version) as Public/Unlisted and paste the URL here]
- **License:** MIT (see `LICENSE` in the repository)

## Demo video plan (≤ 3 minutes)

`verification/demo-video.mp4` in the repository (~90–120 seconds) shows:
menu → PLAY → real gameplay (orb pops, combo building, a storm-cloud
penalty, a Golden Cloud) → game-over screen with rank → callsign saved →
leaderboard display mode. Recorded from the real running game with
Playwright.

## Submission checklist (before pressing Submit on Devpost)

- [ ] Public GitHub repo created, all files pushed (including `.idea/`),
      MIT license present.
- [ ] Demo URL live and playable (static hosting, no login).
- [ ] Demo video uploaded to YouTube as Public (≤ 3 minutes).
- [ ] Category set to **Category 3 (Event Mini Game)**.
- [ ] Description, methodology, and tooling sections pasted from above.
- [ ] AI Showcase (`AI_SHOWCASE.md`) linked or summarized for the
      Best AI-Powered Workflow Story bonus, if applying for it.
