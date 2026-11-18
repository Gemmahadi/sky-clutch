# AI Showcase — How AI + IntelliJ IDEA Built SKY CLUTCH

*Case study for the "Best AI-Powered Workflow Story" bonus prize.
One page, honest and specific.*

## The setup

One developer, one coding agent, one weekend-scale task: design, build,
verify, and document a complete booth-ready mini game for Category 3 of
the Cloud9 x JetBrains hackathon — in a single session, with no pre-built
assets and no prior codebase.

The stack was deliberately boring: vanilla HTML, CSS, and JavaScript in
three files, no framework, no build step, no CDN. The interesting part was
the workflow, not the stack.

## What the AI did

1. **Read the rules first, then designed.** The agent fetched the official
   Devpost rules, submission specifics, and category brief, and turned
   them into a design checklist before writing any code: under 3 minutes,
   no tutorial needed, clean reset, local leaderboard, original assets
   only. Every later decision was checked against that list.
2. **Wrote the whole game in one pass, then proved it.** The agent wrote
   `index.html`, `style.css`, and `game.js` (~1,100 lines total), then
   wrote a Playwright test that played the game for real — clicking
   actual targets through the browser, verifying the score increased, the
   timer ran, the game-over screen appeared, and the leaderboard updated
   — and captured the screenshots and demo video in `verification/`.
3. **Caught its own bugs.** The first self-review of the code found a
   leftover nonsense line in the game-over stats (a duplicated assignment
   for the best-combo display). The agent fixed it before the first test
   run, and the test run then confirmed zero console errors.

## What IntelliJ IDEA did

The project was opened in **IntelliJ IDEA Community Edition 2025.3**.
IDEA indexed the project, provided the editing environment, and its
**Inspect Code** run validated the JavaScript and HTML — it flagged no
errors in the final code. IDEA also contributed the project files in
`.idea/`, including a **run configuration** ("Run Local Server") that
serves the game with `python3 -m http.server` on port 8000, so anyone
opening the repo in IDEA can run the game with one click.

## The real workflow win

The bottleneck in a hackathon is not typing — it is the loop between
"does this work?" and "prove it." The AI + IDEA loop made that loop
minutes long instead of hours long:

- Idea → code in the editor → Inspect Code → Playwright plays the game
  headlessly → screenshots + video as evidence → fix → repeat.

The demo video is a good example: instead of a human recording their
screen and narrating, the agent scripted a full playthrough (menu →
PLAY → real target clicks → game over → leaderboard) in Playwright and
recorded it, then converted it to MP4 with ffmpeg. The video shows the
game actually being played, not a slideshow.

## What the AI did NOT do

- It did not submit anything, create any account, or upload anything.
  Submission, GitHub, and YouTube all need the team owner's accounts and
  are deliberately left as `[TODO]` placeholders in `SUBMISSION.md`.
- It did not use Junie or JetBrains Air: both need a JetBrains account and
  a trial code issued after Devpost registration. IDEA Community Edition —
  free, no account — was the JetBrains tool actually used.
- It did not download game assets. Every visual is drawn in code and
  every sound is synthesized; the only download was IntelliJ IDEA itself.

## By the numbers

- 3 source files, ~1,100 lines of code, 0 dependencies, 0 network calls.
- 2 automated test runs: 0 console errors, 0 failed requests, full loop
  verified (menu → play → game over → leaderboard), plus a file:// load
  test and a portrait-phone test.
- 6 screenshots + 1 demo video, all captured from the real running game.
- 6 documentation files (README, methodology, tooling, this showcase,
  submission draft, MIT license).
