#!/usr/bin/env python3
"""Automated verification for SKY CLUTCH (Cloud9 x JetBrains, Category 3).

Serves the game on localhost, drives it with Playwright, and checks:
  (a) 0 console errors + 0 failed requests on load
  (b) full loop: menu -> PLAY -> real target clicks -> score rises ->
      timer runs -> game-over screen -> leaderboard saves
  (c) clean reset via PLAY AGAIN
  (d) leaderboard display mode (?board=1)
  (e) file:// load works (no modules / no fetch by design)
  (f) portrait phone viewport loads and starts

Writes screenshots + test-log.txt into verification/.
Run:  python3 verification/verify.py
"""
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERIF = ROOT / "verification"
PORT = 8123
BASE = f"http://127.0.0.1:{PORT}"

LOG = []


def log(msg):
    print(msg, flush=True)
    LOG.append(msg)


def wait_for_server(url, timeout=15):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(0.3)
    return False


def main():
    from playwright.sync_api import sync_playwright

    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        assert wait_for_server(BASE + "/index.html"), "local server did not come up"
        log(f"server up on {BASE}")

        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            errors, failed = [], []

            # ---------- (a)+(b) fast game, desktop 1280x720 ----------
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("requestfailed", lambda r: failed.append(r.url))
            page.goto(BASE + "/index.html?debug=fast")
            page.wait_for_function("window.__SKYCLUTCH_READY__ === true")
            log("page ready, state=" + page.evaluate("SkyClutch.getState()"))
            page.wait_for_timeout(2500)  # let attract mode animate
            page.screenshot(path=str(VERIF / "01-menu.png"))
            log("screenshot 01-menu.png")

            page.click("#playBtn")
            page.wait_for_function("SkyClutch.getState() === 'playing'")
            log("game started (debug=fast, 10s round)")
            t0 = page.evaluate("SkyClutch.getTimeLeft()")

            storm_clicked = False
            shot_mid = False
            t_start = time.time()
            while True:
                st = page.evaluate("SkyClutch.getState()")
                if st != "playing":
                    break
                if time.time() - t_start > 30:
                    raise AssertionError("game did not end within 30s")
                targets = page.evaluate("SkyClutch.getTargets()")
                rect = page.evaluate(
                    "() => { const r = document.getElementById('gameCanvas')"
                    ".getBoundingClientRect(); return {x: r.left, y: r.top}; }")
                if targets:
                    # Prefer gold, then orbs; click one storm once on purpose.
                    gold = [t for t in targets if t["type"] == "gold"]
                    orbs = [t for t in targets if t["type"] == "orb"]
                    storms = [t for t in targets if t["type"] == "storm"]
                    pick = None
                    if gold:
                        pick = gold[0]
                    elif orbs:
                        pick = orbs[0]
                    elif storms and not storm_clicked:
                        pick = storms[0]
                        storm_clicked = True
                    if pick:
                        page.mouse.click(rect["x"] + pick["x"], rect["y"] + pick["y"])
                if not shot_mid and time.time() - t_start > 4:
                    page.screenshot(path=str(VERIF / "02-gameplay.png"))
                    log("screenshot 02-gameplay.png (mid-game)")
                    shot_mid = True
                page.wait_for_timeout(120)

            stats = page.evaluate("SkyClutch.getStats()")
            final_score = page.evaluate("SkyClutch.getScore()")
            t1 = page.evaluate("SkyClutch.getTimeLeft()")
            log(f"game over: score={final_score} hits={stats['hits']} "
                f"shots={stats['shots']} stormHits={stats['stormHits']} "
                f"gold={stats['goldPopped']} bestCombo={stats['bestCombo']} "
                f"timer {t0:.1f} -> {t1:.1f}")
            assert final_score > 0, "score never increased"
            assert stats["hits"] > 0, "no targets were popped"
            assert t1 < t0, "timer did not run down"
            page.wait_for_timeout(600)
            page.screenshot(path=str(VERIF / "03-gameover.png"))
            log("screenshot 03-gameover.png")
            assert page.is_visible("#overScreen"), "game-over screen not visible"
            assert page.is_visible("#finalScore"), "final score not shown"

            # Save to leaderboard.
            page.fill("#nameInput", "TST")
            page.click("#saveScoreBtn")
            page.wait_for_timeout(400)
            board = page.evaluate("SkyClutch.getBoard()")
            log("leaderboard after save: " + json.dumps(board))
            assert board and board[0]["name"] == "TST" and board[0]["score"] == final_score, \
                "leaderboard did not record the saved score"
            assert page.is_visible("#savedMsg"), "saved confirmation not shown"

            # (c) clean reset via PLAY AGAIN.
            page.click("#againBtn")
            page.wait_for_function("SkyClutch.getState() === 'playing'")
            assert page.evaluate("SkyClutch.getScore()") == 0, "score not reset"
            assert abs(page.evaluate("SkyClutch.getTimeLeft()") - 10) < 1.5, \
                "timer not reset to 10s (debug)"
            log("PLAY AGAIN reset verified: score=0, timer back to 10s")
            page.wait_for_function("SkyClutch.getState() === 'over'", timeout=30000)
            log("second fast round completed (reset loop works end-to-end)")

            # ---------- (d) leaderboard display mode ----------
            # Same page (same browser context) so localStorage is shared,
            # exactly like a second monitor on the same booth machine.
            page.goto(BASE + "/index.html?board=1")
            page.wait_for_function("window.__SKYCLUTCH_READY__ === true")
            page.wait_for_timeout(800)
            assert page.is_visible("#boardScreen"), "board screen not visible"
            rows = page.eval_on_selector_all("#bigBoard li", "els => els.length")
            assert rows >= 1, "big board shows no entries"
            page.screenshot(path=str(VERIF / "04-leaderboard.png"))
            log(f"screenshot 04-leaderboard.png ({rows} board rows)")

            # ---------- (e) file:// ----------
            file_page = browser.new_page(viewport={"width": 1280, "height": 720})
            file_errors = []
            file_page.on("pageerror", lambda e: file_errors.append(str(e)))
            file_page.on("console", lambda m: file_errors.append(m.text) if m.type == "error" else None)
            file_page.goto((ROOT / "index.html").as_uri())
            file_page.wait_for_function("window.__SKYCLUTCH_READY__ === true")
            file_page.wait_for_timeout(1000)
            log("file:// load OK, state=" + file_page.evaluate("SkyClutch.getState()")
                + f", console errors={len(file_errors)}")
            assert not file_errors, f"file:// console errors: {file_errors}"

            # ---------- (f) portrait phone ----------
            mob = browser.new_page(viewport={"width": 390, "height": 844},
                                   is_mobile=True, has_touch=True)
            mob.on("pageerror", lambda e: errors.append("mobile: " + str(e)))
            mob.goto(BASE + "/index.html?debug=fast")
            mob.wait_for_function("window.__SKYCLUTCH_READY__ === true")
            mob.wait_for_timeout(1500)
            mob.screenshot(path=str(VERIF / "05-mobile-menu.png"))
            mob.tap("#playBtn")
            mob.wait_for_function("SkyClutch.getState() === 'playing'")
            log("mobile portrait: menu + PLAY tap OK")
            mob.screenshot(path=str(VERIF / "06-mobile-gameplay.png"))

            browser.close()

        log(f"console errors: {len(errors)} {errors}")
        log(f"failed requests: {len(failed)} {failed}")
        assert not errors, f"console errors: {errors}"
        assert not failed, f"failed requests: {failed}"
        log("ALL CHECKS PASSED")
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except Exception:
            server.kill()
    (VERIF / "test-log.txt").write_text("\n".join(LOG) + "\n")
    log("log written to verification/test-log.txt")


if __name__ == "__main__":
    main()
