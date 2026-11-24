import functools
import os
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
DOCS.mkdir(parents=True, exist_ok=True)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        return


def assert_no_overflow(page, label: str) -> None:
    overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
    if overflow:
        raise AssertionError(f"Horizontal overflow detected on {label}")


def run_e2e() -> None:
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{port}"

    errors = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            # 1. Mock YouTube Watch page + overlay + popover + dock
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            page = ctx.new_page()
            page.on("pageerror", lambda err: errors.append(f"player pageerror: {err}"))
            page.on("console", lambda msg: errors.append(f"player console.{msg.type}: {msg.text}") if msg.type == "error" else None)

            page.goto(f"{base}/tests/mock_youtube.html", wait_until="networkidle")
            page.wait_for_selector(".kls-subtitle-overlay:not(.kls-hidden)")
            reading_txt = page.locator(".kls-overlay-reading").inner_text()
            assert "ソルレジャナ" in reading_txt and "seol-le-ja-na" in reading_txt, f"Unexpected reading text: {reading_txt}"

            # Click word to open analysis popover and save card
            page.locator('.kls-word-btn[data-word="설레잖아"]').click()
            page.wait_for_selector(".kls-popover:not(.kls-hidden)")
            pop_txt = page.locator(".kls-popover").inner_text()
            assert "설레다" in pop_txt and "-잖아" in pop_txt, f"Missing lemma/ending in popover: {pop_txt}"
            assert "[설레자나]" in pop_txt and "seol-le-ja-na" in pop_txt, f"Missing 3-form reading: {pop_txt}"

            page.locator('[data-pop="save"]').click()
            assert "保存しました" in page.locator('[data-pop="save"]').inner_text()

            # Test 1-line repeat, speed toggle, and +0.5s sync offset
            page.locator('[data-act="loop"]').click()
            assert page.locator('[data-act="loop"].is-active').count() == 1
            page.locator('[data-act="speed"]').click()
            assert "0.85x" in page.locator('[data-act="speed"]').inner_text()
            page.locator('[data-act="offset-plus"]').click()
            assert "+0.5s" in page.locator(".kls-offset-row").inner_text()

            assert_no_overflow(page, "player-desktop")
            page.screenshot(path=str(DOCS / "screenshot-player.png"), full_page=False)

            # 2. Studio page (Desktop Light, Dark, Mobile)
            studio = ctx.new_page()
            studio.on("pageerror", lambda err: errors.append(f"studio pageerror: {err}"))
            studio.on("console", lambda msg: errors.append(f"studio console.{msg.type}: {msg.text}") if msg.type == "error" else None)

            studio.goto(f"{base}/studio.html", wait_until="networkidle")
            studio.wait_for_selector("#card-surface")
            studio.locator("#btn-card-reveal").click()
            assert not studio.locator("#card-answer").evaluate("el => el.classList.contains('kls-hidden')")
            assert_no_overflow(studio, "studio-desktop-light")
            studio.screenshot(path=str(DOCS / "screenshot-studio.png"), full_page=False)

            # Test cloze quiz
            studio.locator('[data-stab="cloze"]').click()
            studio.wait_for_selector("#cloze-choices button")
            studio.locator("#cloze-choices button").first.click()
            assert not studio.locator("#cloze-feedback").evaluate("el => el.classList.contains('kls-hidden')")

            # Test list search
            studio.locator('[data-stab="list"]').click()
            studio.fill("#list-search", "설레")
            assert studio.locator("#word-list-container .kls-word-item").count() >= 1

            # 3. Popup & Options (Desktop + Dark + Mobile)
            pop_page = ctx.new_page()
            pop_page.on("pageerror", lambda err: errors.append(f"popup pageerror: {err}"))
            pop_page.goto(f"{base}/popup.html", wait_until="networkidle")
            pop_page.wait_for_selector("#reading-modes button")

            opt_page = ctx.new_page()
            opt_page.on("pageerror", lambda err: errors.append(f"options pageerror: {err}"))
            opt_page.goto(f"{base}/options.html", wait_until="networkidle")
            opt_page.select_option("#opt-theme", "dark")
            assert opt_page.evaluate("document.documentElement.getAttribute('data-theme')") == "dark"
            assert_no_overflow(opt_page, "options-desktop-dark")

            mob_ctx = browser.new_context(viewport={"width": 390, "height": 844})
            mob_studio = mob_ctx.new_page()
            mob_studio.on("pageerror", lambda err: errors.append(f"mobile studio pageerror: {err}"))
            mob_studio.goto(f"{base}/studio.html", wait_until="networkidle")
            assert_no_overflow(mob_studio, "studio-mobile")

            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    if errors:
        raise AssertionError("Playwright errors:\n" + "\n".join(errors))
    print("E2E_OK: player, studio, popup, options (Desktop/Dark/Mobile) passed with 0 errors")


if __name__ == "__main__":
    run_e2e()
