#!/usr/bin/env python3
"""Record the SKY CLUTCH demo video (<=3 min, target ~90-120 s).

Plays a REAL full 60-second round in Chromium via Playwright (video
recording on), then: saves the score, shows the leaderboard display mode,
and converts the recording to MP4 with ffmpeg.

Run:  python3 verification/record_video.py
Needs: the game files in this repo root; ffmpeg on PATH.
"""
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERIF = ROOT / "verification"
PORT = 8124
BASE = f"http://127.0.0.1:{PORT}"


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
        print("server up", flush=True)
        video_path = None
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            ctx = browser.new_context(
                viewport={"width": 1280, "height": 720},
                record_video_dir=str(VERIF / "video-raw"),
                record_video_size={"width": 1280, "height": 720},
            )
            page = ctx.new_page()
            page.goto(BASE + "/index.html")
            page.wait_for_function("window.__SKYCLUTCH_READY__ === true")
            page.wait_for_timeout(7000)  # attract mode: mascot + menu
            print("menu shown", flush=True)

            page.click("#playBtn")
            page.wait_for_function("SkyClutch.getState() === 'playing'")
            print("game started (full 60s round)", flush=True)
            t_start = time.time()
            storm_clicked = False
            while True:
                if page.evaluate("SkyClutch.getState()") != "playing":
                    break
                if time.time() - t_start > 90:
                    raise AssertionError("game did not end within 90s")
                targets = page.evaluate("SkyClutch.getTargets()")
                rect = page.evaluate(
                    "() => { const r = document.getElementById('gameCanvas')"
                    ".getBoundingClientRect(); return {x: r.left, y: r.top}; }")
                if targets:
                    gold = [t for t in targets if t["type"] == "gold"]
                    orbs = [t for t in targets if t["type"] == "orb"]
                    storms = [t for t in targets if t["type"] == "storm"]
                    pick = None
                    if gold:
                        pick = gold[0]
                    elif orbs:
                        pick = orbs[0]
                    elif storms and not storm_clicked and time.time() - t_start > 25:
                        pick = storms[0]
                        storm_clicked = True
                    if pick:
                        page.mouse.click(rect["x"] + pick["x"], rect["y"] + pick["y"])
                page.wait_for_timeout(200)

            stats = page.evaluate("SkyClutch.getStats()")
            score = page.evaluate("SkyClutch.getScore()")
            print(f"game over: score={score} hits={stats['hits']} "
                  f"stormHits={stats['stormHits']} gold={stats['goldPopped']}", flush=True)
            page.wait_for_timeout(2000)
            page.fill("#nameInput", "ACE")
            page.click("#saveScoreBtn")
            page.wait_for_timeout(3000)
            page.click("#menuBtn")
            page.wait_for_timeout(1200)
            page.click("#boardBtn")
            page.wait_for_timeout(8000)  # big leaderboard display
            print("leaderboard display shown", flush=True)
            video_path = page.video.path()
            ctx.close()
            browser.close()
        print("raw video:", video_path, flush=True)

        # Convert to MP4 (H.264, web-friendly).
        out = VERIF / "demo-video.mp4"
        subprocess.run([
            "ffmpeg", "-y", "-i", str(video_path),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23",
            "-movflags", "+faststart", str(out),
        ], check=True, capture_output=True)
        probe = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(out),
        ], capture_output=True, text=True, check=True)
        dur = float(probe.stdout.strip())
        size = out.stat().st_size
        print(f"demo video: {out} duration={dur:.1f}s size={size} bytes", flush=True)
        assert dur <= 180, f"video too long: {dur}s"
        assert size > 100_000, "video suspiciously small"
        print("VIDEO OK", flush=True)
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except Exception:
            server.kill()


if __name__ == "__main__":
    main()
