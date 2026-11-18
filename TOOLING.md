# Tooling — JetBrains tools used for SKY CLUTCH

## The JetBrains tool used: IntelliJ IDEA 2025.3

- **Product:** IntelliJ IDEA 2025.3, build **IU-253.28294.334**
  (bundled JetBrains Runtime 21.0.8).
- **Download source:** the official JetBrains release API —
  `https://data.services.jetbrains.com/products/releases?code=IIC&latest=true&type=release`
  — Linux tarball `idea-2025.3.tar.gz` (1,515,485,267 bytes).
- **Integrity:** SHA-256 verified against JetBrains' published checksum:
  `13f4174ba16c1cef04871cb261433536d002586c269a809392c20ee3f94959f5`.
- **Installed at:** `~/workspace/tools/idea-ce/idea-IU-253.28294.334/`
  (extracted, 4.1 GB; the tarball is kept next to it).
- **License / account:** none. No JetBrains account was created, no trial
  was activated, no license key was entered.

### One honest note about the edition

Since the 2025.x line, JetBrains ships IntelliJ IDEA as a **single unified
download** (the tarball extracts to an `idea-IU-*` folder). The IDE runs
all Community Edition functionality for free without activation; the
Ultimate-only features stay locked behind the "Unlock Ultimate" button
(visible in our screenshots — we never clicked it). Everything this
project used — the code editor, HTML/CSS/JS inspections, and the Shell
Script run configuration — is free Community functionality. So the
statement "built with IntelliJ IDEA Community Edition" is accurate in
substance: no paid feature was used, and no account or trial stands
between the project and the tool.

## What IDEA actually did in this project

1. **Opened and indexed the project.** The project was opened in the IDEA
   GUI (run under Xvfb on this Linux VM; first run needed the system
   libraries `libxtst6`, `libxi6`, `libxrender1`, `libxt6`, installed via
   `apt-get`). The User Agreement v2.0 was accepted in the GUI; for the
   data-sharing prompt we chose **"Don't Send"** (no telemetry).
2. **Edited and viewed the code.** `game.js` was opened in the editor
   (see `verification/idea-editor-gamejs.png`); the project tree, syntax
   highlighting, and on-the-fly analysis were used while fixing the
   inspection findings below.
3. **Validated the code with Inspect Code.** The inspection profile
   `.idea/inspectionProfiles/Project_Default.xml` was run headlessly
   (`idea.sh inspect`) three times; the final clean run is documented in
   `verification/idea-inspection-summary.txt` and the raw XML output is in
   `verification/idea-inspection/`. The first run found 6 real issues in
   `game.js` (a number assigned to `textContent`, an unresolved
   `window.webkitAudioContext`, a dead helper function, two redundant
   local variables, and a `$` helper misread as jQuery). All six were
   fixed in the code; the final run reports **zero code problems** in
   `game.js`, `style.css`, and `index.html` (only prose suggestions and
   spelling false positives remain).
4. **Ran the game.** The run configuration **"Run Local Server"**
   (`.idea/runConfigurations/Run_Local_Server.xml`, a Shell Script
   configuration that runs `python3 -m http.server 8000` in the project
   directory) was executed from IDEA: the server answered HTTP 200 and
   served the game (see `verification/idea-run-server.png`).
5. **Generated the project files.** `.idea/` was created by IDEA itself
   on open/exit and is committed in the repo:
   - `.idea/modules.xml` + `.idea/cloud9-jetbrains.iml` — module definition
   - `.idea/misc.xml`, `.idea/workspace.xml` — project state
     (`workspace.xml` is ignored by IDEA's own `.idea/.gitignore`, as usual)
   - `.idea/inspectionProfiles/Project_Default.xml` — the inspection profile
   - `.idea/runConfigurations/Run_Local_Server.xml` — the run configuration

A full reformat (`Reformat Code`) was **deliberately not applied**: the
code is written in a consistent 2-space style, and IDEA's default
JavaScript style would have re-indented the whole file to 4 spaces for
no benefit. Validation was done with Inspect Code instead, plus the
Playwright end-to-end tests in `verification/`.

## What was NOT used (and why)

- **Junie** and **JetBrains Air** were not used. Both require a JetBrains
  account, and Air additionally needs a trial code that is only issued
  after Devpost registration — which needs the team owner's account.
  Creating accounts is out of scope for this build, and the hackathon
  rules only require *at least one* JetBrains tool, which IntelliJ IDEA
  Community Edition satisfies on its own.
- **No other editor** was used to write the project files: the source
  files were written and then opened, inspected, and validated in IDEA.
  (The automated Playwright tests were run from the terminal, as they
  must be — they drive a real browser.)

## Reproducing the setup

```bash
# Download (about 1.5 GB) and verify
curl -L -o idea-2025.3.tar.gz https://download.jetbrains.com/idea/idea-2025.3.tar.gz
sha256sum idea-2025.3.tar.gz   # expect 13f4174b...f94959f5
tar xzf idea-2025.3.tar.gz

# On a minimal Linux box, IDEA's GUI needs X11 libs:
sudo apt-get install -y libxtst6 libxi6 libxrender1 libxt6 libxext6

# Open the project (or just double-click the folder in the welcome screen)
./idea-IU-*/bin/idea.sh /path/to/cloud9-jetbrains

# Run the game from inside IDEA: select "Run Local Server" and press Run,
# then open http://localhost:8000
```
