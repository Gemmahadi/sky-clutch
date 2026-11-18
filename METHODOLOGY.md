# Methodology — SKY CLUTCH

## The problem (Category 3 — Event Mini Game)

A booth game at a live event is not a normal game. It has to survive
conditions a living-room game never faces:

1. **A stranger walks up cold.** There is no tutorial, no onboarding, no
   account, and no patience. The game must be understood in under five
   seconds by watching it — or by reading exactly one sentence.
2. **A session must be short.** People are in a queue. The brief asks for
   under three minutes; a 60-second round plus a 10-second score screen
   keeps the whole visit under 90 seconds.
3. **It must run for hours without a babysitter.** A booth game that
   crashes, soft-locks, or accumulates state between players is a dead
   booth. Every player must get a clean, identical start.
4. **It must work offline.** Event Wi-Fi is famously unreliable, so the
   leaderboard — the thing that makes people queue again — cannot depend
   on a server.
5. **It must be original.** The brief allows inspiration from Cloud9,
   JetBrains, VALORANT, and League of Legends, but forbids copying their
   names, artwork, logos, or music.

## Our approach

**One mechanic, zero learning curve.** SKY CLUTCH has exactly one verb:
click the thing that glows. The menu explains the whole game in one
sentence — *"Pop the glowing sky orbs. Dodge the storm clouds. Catch the
Golden Cloud."* — and the first orb appears within half a second of
pressing PLAY, so the player learns by doing, not by reading.

**Aim trainer, not a shooter.** We chose an aim/reaction format (the
brief's own example) because it is the most booth-friendly genre: no
movement keys to explain, no camera to control, no fail state that
embarrasses a first-time player in front of a queue. Mouse, touch, and
keyboard all work; the only keyboard keys are Space/Enter to start.

**A complete loop with a clean reset.** The state machine has four states
— menu, playing, game over, leaderboard — and starting a game re-creates
every piece of run state from scratch (score, combo, targets, particles,
timer, gold bonuses, the name form). There is no "continue" path that
could leak a previous player's score into the next round, and there are no
lives, so a round can never end early in a confusing way.

**Difficulty that ramps inside the round.** Spawn interval shrinks from
~600 ms to ~350 ms, targets drift faster, live shorter, and storm clouds
get more common as the 60 seconds pass. A first-time player still scores
in the first ten seconds; a returning player finds the last ten seconds
genuinely hard. That ramp is what makes the game replayable in a queue:
your second run is always a different game from your first.

**Skill expression without punishment.** The combo multiplier (up to ×5)
rewards accuracy and rhythm; the storm cloud punishes careless clicking
(−15 points, combo reset) but never ends the run. Missing the sky only
hurts accuracy. A booth game should make a stranger feel good, not make
them fail in public.

**The leaderboard is the retention loop.** A top-10 daily board stored in
`localStorage` needs no Wi-Fi, no backend, and no account — and it is
exactly what the brief calls out as a big plus. A separate display mode
(`?board=1`) turns a second monitor into a live leaderboard that refreshes
every five seconds, so a crowd can watch the top scores while the next
player plays. Staff can reset the day's board with one key (`R`).

## Originality

Everything in the game is original and made in code: the sky, the clouds,
the mascot **Nimbus** (a small cloud pilot with goggles and a yellow
scarf), the lightning, the sounds (all synthesized with WebAudio). No
Riot artwork, no Cloud9 logo, no third-party images, no copyrighted music.
The blue/white sky palette nods to the Cloud9 spirit without copying any
trademark. The name "SKY CLUTCH" is original; "clutch" is generic
competitive-gaming vocabulary for a high-pressure play.

## Engineering choices

- **Vanilla HTML/CSS/JS, zero dependencies.** A static site cannot break
  because a CDN went down, a package updated, or the venue Wi-Fi died.
  It also means the game runs from a USB stick (`file://`) as well as
  from any static host.
- **Canvas for the playfield, DOM for the UI.** Canvas gives smooth
  animation and cheap particles; DOM gives accessible buttons, crisp text,
  and a name input that works with a real keyboard.
- **Deterministic, testable core.** The timer is driven by
  `performance.now()` with pause-on-hidden-tab handling, so a round is
  always exactly 60 seconds of *active* play. A `?debug=fast` flag shrinks
  a round to 10 seconds so the whole loop can be exercised by automated
  tests (see `verification/`).
- **Separation of concerns.** `game.js` is organized into sections —
  config, state, audio, leaderboard, rendering, game flow, events — so a
  future contributor can change scoring or spawning without touching the
  UI.

## What we would do with more time

- A second mode (e.g. a "storm survival" variant) selectable from the
  menu, reusing the same engine.
- Sound toggle button on the HUD (today it is the `M` key).
- A weekly board alongside the daily board.
- A printable QR code on the leaderboard screen linking to the public
  demo URL.
