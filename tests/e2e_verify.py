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
            # Each syllable column holds hangul / katakana / romanization on separate rows.
            cols = page.evaluate("""() => [...document.querySelectorAll('.kls-word-btn[data-word="설레잖아"] .kls-al-col')].map(c => {
                const r = c.querySelector('.kls-al-ko').getBoundingClientRect();
                const k = c.querySelector('.kls-al-kana').getBoundingClientRect();
                const m = c.querySelector('.kls-al-roman').getBoundingClientRect();
                return { ko: c.querySelector('.kls-al-ko').textContent, kana: c.querySelector('.kls-al-kana').textContent,
                         roman: c.querySelector('.kls-al-roman').textContent,
                         centerDiff: Math.max(Math.abs((r.left + r.right) / 2 - (k.left + k.right) / 2), Math.abs((r.left + r.right) / 2 - (m.left + m.right) / 2)),
                         stacked: r.bottom <= k.top + 1 && k.bottom <= m.top + 1 };
            })""")
            assert [c["ko"] for c in cols] == ["설", "레", "잖", "아"], cols
            assert "".join(c["kana"] for c in cols) == "ソルレジャナ", cols
            assert "-".join(c["roman"] for c in cols) == "seol-le-ja-na", cols
            assert all(c["stacked"] and c["centerDiff"] < 1 for c in cols), f"Readings not stacked/centered under syllables: {cols}"

            # Check known / learning / seen (gradient) / unseen (plain) markers in both overlay and dock
            ov_mark = page.evaluate("""() => {
                const v = document.getElementById("mock-video");
                const prevT = v.currentTime;
                v.currentTime = 39.0;
                window.KLyricContent.syncToCurrentTime();
                const btn = (w) => document.querySelector(`.kls-word-btn[data-word="${w}"]`);
                const dockWord = (w) => document.querySelector(`.kls-dock .kls-al-word[data-word="${w}"]`);
                const res = {
                    ovKnown: btn("좋아해")?.classList.contains("is-known"),
                    ovSeen: btn("정말")?.classList.contains("is-seen"),
                    ovSeenStyle: btn("정말")?.getAttribute("style") || "",
                    dockKnown: dockWord("좋아해")?.classList.contains("is-known"),
                    dockLearning: dockWord("같이")?.classList.contains("is-learning"),
                    dockSeen1: dockWord("오늘")?.style.getPropertyValue("--kls-seen-t"),
                    dockSeen5: dockWord("연습")?.style.getPropertyValue("--kls-seen-t"),
                    dockSeen10: dockWord("정말")?.style.getPropertyValue("--kls-seen-t"),
                    dockUnseenCls: dockWord("힘들었어")?.className || ""
                };
                v.currentTime = prevT;
                window.KLyricContent.syncToCurrentTime();
                return res;
            }""")
            assert ov_mark["ovKnown"] is True and ov_mark["ovSeen"] is True, ov_mark
            assert "--kls-seen-t:1" in ov_mark["ovSeenStyle"], ov_mark
            assert ov_mark["dockKnown"] is True and ov_mark["dockLearning"] is True, ov_mark
            assert float(ov_mark["dockSeen1"]) < float(ov_mark["dockSeen5"]) < float(ov_mark["dockSeen10"]), ov_mark
            assert "is-known" not in ov_mark["dockUnseenCls"] and "is-learning" not in ov_mark["dockUnseenCls"] and "is-seen" not in ov_mark["dockUnseenCls"], ov_mark

            # Click word to open analysis popover and save card
            page.locator('.kls-word-btn[data-word="설레잖아"]').click()
            page.wait_for_selector(".kls-popover:not(.kls-hidden)")
            pop_txt = page.locator(".kls-popover").inner_text()
            assert "설레다" in pop_txt and "-잖아" in pop_txt, f"Missing lemma/ending in popover: {pop_txt}"
            pop_rows = page.evaluate("""() => ['pron', 'kana', 'roman'].map(r => [...document.querySelectorAll('.kls-popover .kls-al-' + r)].map(e => e.textContent).join(r === 'roman' ? '-' : ''))""")
            assert pop_rows == ["설레자나", "ソルレジャナ", "seol-le-ja-na"], f"Missing 3-form reading: {pop_rows}"

            page.locator('[data-pop="save"]').click()
            assert "保存しました" in page.locator('[data-pop="save"]').inner_text()

            # Test 1-line repeat, speed toggle, and +0.5s sync offset
            page.locator('[data-act="loop"]').click()
            assert page.locator('[data-act="loop"].is-active').count() == 1
            page.locator('[data-act="speed"]').click()
            assert "0.85x" in page.locator('[data-act="speed"]').inner_text()
            page.locator('[data-act="offset-plus"]').click()
            assert "+0.5s" in page.locator(".kls-offset-row").inner_text()
            page.locator('[data-act="loop"]').click()

            # Subtitle on/off toggle hides only the video overlay, not the panel
            page.locator('[data-act="overlay"]').click()
            page.wait_for_selector(".kls-subtitle-overlay.kls-hidden", state="attached")
            assert "(非表示)" in page.locator('[data-act="overlay"]').inner_text()
            assert page.locator(".kls-dock:not(.kls-hidden)").count() == 1
            page.locator('[data-act="overlay"]').click()
            page.wait_for_selector(".kls-subtitle-overlay:not(.kls-hidden)")

            # Display rule row is shown with the reason (mock title contains ILLIT)
            assert "ILLIT" in page.locator(".kls-activation-row").inner_text()

            # Frequent vocab book shortcut button sits next to studio button and triggers kls:open-studio {tab: "freq"}
            assert page.locator('[data-act="vocab-book"]').inner_text().strip() == "頻出単語帳"
            assert page.locator('[data-act="toggle-lrc"]').inner_text().strip() == "字幕・LRC貼付"
            cov_text = page.locator(".kls-cov-wrap").inner_text()
            assert "語彙カバー" in cov_text and "既知" in cov_text and "学習中" in cov_text and "既出" in cov_text and "新出" in cov_text, cov_text
            assert page.locator(".kls-cov-bar .kls-cov-seen").count() == 1

            # Quick-record card-menu buttons: sit outside <a> and thumbnail, normal click works without force=True
            page.wait_for_selector('.kls-card-rec[data-kls-vid="quick_done_1"].is-recorded')
            page.wait_for_selector('.kls-card-rec[data-kls-vid="quick_new_1"]:not(.is-recorded)')
            outside_ok = page.evaluate("""() => [...document.querySelectorAll('.kls-card-rec')].every(b => !b.closest('a, ytd-thumbnail, yt-thumbnail-view-model'))""")
            assert outside_ok, "Quick-record button must stay outside <a> and thumbnail elements"
            page.locator('.kls-card-rec[data-kls-vid="quick_done_1"]').click()
            assert page.evaluate("window.__KLS_QUICK_CALLS__.length") == 0, "Already recorded video should skip fetch"
            page.locator('.kls-card-rec[data-kls-vid="quick_new_1"]').click()
            page.wait_for_selector('.kls-card-rec[data-kls-vid="quick_new_1"].is-recorded')
            assert "mock_youtube.html" in page.url, "Quick record must not navigate away"
            assert page.evaluate("window.__KLS_QUICK_CALLS__") == ["quick_new_1"]
            assert page.evaluate("Boolean(JSON.parse(localStorage.getItem('kls:vocabLog') || '{}').videos?.quick_new_1)") is True
            # Clicking again on the newly recorded video skips duplicate fetch
            page.locator('.kls-card-rec[data-kls-vid="quick_new_1"]').click()
            assert page.evaluate("window.__KLS_QUICK_CALLS__.length") == 1, "Second click on recorded video must skip"
            sent_msg = page.evaluate("""() => {
                let captured = null;
                window.chrome = { runtime: { sendMessage: (m, cb) => { captured = m; if (cb) cb({ ok: true }); } } };
                document.querySelector('[data-act="vocab-book"]').click();
                delete window.chrome;
                return captured;
            }""")
            assert sent_msg == {"type": "kls:open-studio", "tab": "freq"}, f"Unexpected vocab-book message: {sent_msg}"

            # The playing line sits second from the bottom, with the next line visible below it
            page.evaluate("""() => {
                const cues = Array.from({ length: 24 }, (_, i) => ({ id: i, start: i * 4, end: i * 4 + 3.8, ko: '이번엔 정말 좋아해 ' + (i + 1), ja: '今度は本当に好きだよ' }));
                window.KLyricContent.loadCuesForTest(cues, 'スクロール確認');
                document.getElementById('mock-video').currentTime = 12 * 4 + 1;
                window.KLyricContent.syncToCurrentTime();
            }""")
            pos = page.evaluate("""() => {
                const list = document.querySelector('.kls-lines');
                const lr = list.getBoundingClientRect();
                const cur = list.querySelector('.kls-line-row.is-current');
                const next = cur.nextElementSibling;
                const cr = cur.getBoundingClientRect(), nr = next.getBoundingClientRect();
                return { idx: cur.dataset.cueIdx, curVisible: cr.top >= lr.top - 1 && cr.bottom <= lr.bottom + 1,
                         nextVisible: nr.top >= lr.top - 1 && nr.bottom <= lr.bottom + 1,
                         nextNearBottom: lr.bottom - nr.bottom < 12, scrolled: list.scrollTop > 0 };
            }""")
            assert pos["idx"] == "12" and pos["curVisible"] and pos["nextVisible"] and pos["nextNearBottom"] and pos["scrolled"], f"Current line position wrong: {pos}"

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

            # Test frequent vocab log tab (seeded into localStorage) with multi-video title links
            studio.evaluate("""() => {
                localStorage.setItem('kls:vocabLog', JSON.stringify({
                    version: 1,
                    videos: {
                        'v1': { videoId: 'v1', title: 'ILLIT - Magnetic MV', site: 'youtube', recordedAt: 1000, uniqueWords: 2, wordKeys: ['설레다', '기분'], wordCounts: { '설레다': 2, '기분': 1 } },
                        'v2': { videoId: 'v2', title: 'ILLIT - Cherish', site: 'music', recordedAt: 2000, uniqueWords: 1, wordKeys: ['설레다'], wordCounts: { '설레다': 1 } }
                    },
                    words: {
                        '설레다': {
                            key: '설레다', lemma: '설레다', surfaceSample: '설레잖아', meaning: 'ときめく', pos: '動詞',
                            videoCount: 2, totalCount: 3, lastSeenAt: 2000,
                            occurrences: [
                                { videoId: 'v1', title: 'ILLIT - Magnetic MV', isMusic: false, sec: 42, url: 'https://www.youtube.com/watch?v=v1&t=42s', surface: '설레잖아', context: '설레잖아' },
                                { videoId: 'v2', title: 'ILLIT - Cherish', isMusic: true, sec: 65, url: 'https://music.youtube.com/watch?v=v2&t=65s', surface: '설레고', context: '설레고' }
                            ]
                        },
                        '기분': {
                            key: '기분', lemma: '기분', surfaceSample: '기분', meaning: '気分', pos: '名詞',
                            videoCount: 1, totalCount: 1, lastSeenAt: 1000,
                            occurrences: [
                                { videoId: 'v1', title: 'ILLIT - Magnetic MV', isMusic: false, sec: 18, url: 'https://www.youtube.com/watch?v=v1&t=18s', surface: '기분', context: '기분 좋아' }
                            ]
                        }
                    }
                }));
            }""")
            studio.reload(wait_until="networkidle")
            # Advance past '같이' (due from mock) so the queued starter/saved card '설레잖아' is shown,
            # verifying vocabLog occurrences merge into both Card and Cloze tabs.
            while studio.locator("#card-surface").inner_text().strip() != "설레잖아":
                studio.locator('.grade-btn[data-grade="4"]').click()
            studio.wait_for_selector("#card-occurrences .kls-occ-link")
            card_occ_links = studio.eval_on_selector_all(
                "#card-occurrences .kls-occ-link",
                "els => els.map(e => ({ text: e.textContent, href: e.getAttribute('href') }))"
            )
            assert any("ILLIT - Magnetic MV" in l["text"] and "&t=42s" in l["href"] for l in card_occ_links), card_occ_links
            assert not studio.locator("#btn-card-video").evaluate("el => el.classList.contains('kls-hidden')")
            studio.screenshot(path=str(DOCS / "screenshot-studio.png"), full_page=False)
            studio.locator('[data-stab="cloze"]').click()
            for _ in range(3):
                if studio.locator("#cloze-occurrences .kls-occ-link").count() > 0:
                    break
                studio.locator("#btn-cloze-next").click()
            studio.wait_for_selector("#cloze-occurrences .kls-occ-link")
            cloze_href = studio.locator("#btn-cloze-video").get_attribute("href")
            assert cloze_href and "&t=" in cloze_href, cloze_href

            studio.locator('[data-stab="freq"]').click()
            studio.wait_for_selector("#freq-word-list .kls-occ-link")
            occ_links = studio.eval_on_selector_all(
                "#freq-word-list .kls-occ-link",
                "els => els.map(e => ({ text: e.textContent, href: e.getAttribute('href') }))"
            )
            assert any("ILLIT - Magnetic MV" in l["text"] and "&t=42s" in l["href"] for l in occ_links), occ_links
            assert any("ILLIT - Cherish" in l["text"] and "&t=65s" in l["href"] for l in occ_links), occ_links
            assert_no_overflow(studio, "studio-freq")

            # Add an unlearned frequent word into study cards and verify it appears in list with timestamped link
            studio.locator('[data-fadd="기분"]').click()
            assert "追加しました" in studio.locator("#freq-status").inner_text()
            studio.locator('[data-stab="list"]').click()
            studio.fill("#list-search", "기분")
            list_occ = studio.eval_on_selector_all(
                "#word-list-container .kls-occ-link",
                "els => els.map(e => ({ text: e.textContent, href: e.getAttribute('href') }))"
            )
            assert any("ILLIT - Magnetic MV" in l["text"] and "&t=18s" in l["href"] for l in list_occ), list_occ

            # 3. Direct hash route studio.html#freq + hashchange
            freq_page = ctx.new_page()
            freq_page.on("pageerror", lambda err: errors.append(f"studio#freq pageerror: {err}"))
            freq_page.on("console", lambda msg: errors.append(f"studio#freq console.{msg.type}: {msg.text}") if msg.type == "error" else None)
            freq_page.goto(f"{base}/studio.html#freq", wait_until="networkidle")
            freq_page.wait_for_selector('[data-stab="freq"].is-active')
            assert not freq_page.locator("#pane-freq").evaluate("el => el.classList.contains('kls-hidden')")
            assert_no_overflow(freq_page, "studio-hash-freq")
            freq_page.goto(f"{base}/studio.html", wait_until="networkidle")
            freq_page.wait_for_selector('[data-stab="card"].is-active')
            freq_page.evaluate("() => { location.hash = '#freq'; }")
            freq_page.wait_for_selector('[data-stab="freq"].is-active')
            assert not freq_page.locator("#pane-freq").evaluate("el => el.classList.contains('kls-hidden')")

            # 4. Popup (with vocabLog count + 1-click freq shortcut)
            pop_page = ctx.new_page()
            pop_page.on("pageerror", lambda err: errors.append(f"popup pageerror: {err}"))
            pop_page.on("console", lambda msg: errors.append(f"popup console.{msg.type}: {msg.text}") if msg.type == "error" else None)
            pop_page.goto(f"{base}/popup.html", wait_until="networkidle")
            pop_page.wait_for_selector("#reading-modes button")
            assert "2語" in pop_page.locator("#popup-freq-stats").inner_text()
            assert_no_overflow(pop_page, "popup-desktop")
            pop_page.locator("#btn-open-freq").click()
            pop_page.wait_for_url("**/studio.html#freq")
            pop_page.wait_for_selector('[data-stab="freq"].is-active')

            # 5. Options (Light/Dark x 1280x900, 640x800, 390x844 + auto-save + #freq link)
            def check_options_layout(vp_w: int, vp_h: int, theme: str) -> None:
                opt_ctx = browser.new_context(viewport={"width": vp_w, "height": vp_h})
                op = opt_ctx.new_page()
                op.on("pageerror", lambda err: errors.append(f"options({theme},{vp_w}x{vp_h}) pageerror: {err}"))
                op.on("console", lambda msg: errors.append(f"options({theme},{vp_w}x{vp_h}) console.{msg.type}: {msg.text}") if msg.type == "error" else None)
                op.goto(f"{base}/options.html", wait_until="networkidle")
                op.select_option("#opt-theme", theme)
                assert op.evaluate("document.documentElement.getAttribute('data-theme')") == theme
                assert_no_overflow(op, f"options-{theme}-{vp_w}x{vp_h}")
                rows = op.evaluate("""() => [...document.querySelectorAll('.kls-check-row')].map(row => {
                    const cb = row.querySelector('input[type="checkbox"]').getBoundingClientRect();
                    const sp = row.querySelector('span').getBoundingClientRect();
                    return { id: row.querySelector('input').id, cbTop: cb.top, spTop: sp.top, cbRight: cb.right, spLeft: sp.left, topDiff: Math.abs(cb.top - sp.top) };
                })""")
                assert len(rows) == 7, f"Expected 7 check rows, got {len(rows)}"
                for r in rows:
                    assert r["topDiff"] <= 6 and r["cbRight"] <= r["spLeft"], f"Checkbox misaligned at {theme} {vp_w}x{vp_h}: {r}"
                if vp_w >= 640:
                    bridge_diff = op.evaluate("""() => {
                        const inp = document.getElementById('opt-bridge-url').getBoundingClientRect();
                        const btn = document.getElementById('btn-test-bridge').getBoundingClientRect();
                        return Math.abs(inp.bottom - btn.bottom);
                    }""")
                    assert bridge_diff <= 4, f"Bridge input and button misaligned ({bridge_diff}px) at {theme} {vp_w}x{vp_h}"
                opt_ctx.close()

            for theme in ("light", "dark"):
                for vp_w, vp_h in ((1280, 900), (640, 800), (390, 844)):
                    check_options_layout(vp_w, vp_h, theme)

            opt_page = ctx.new_page()
            opt_page.on("pageerror", lambda err: errors.append(f"options pageerror: {err}"))
            opt_page.on("console", lambda msg: errors.append(f"options console.{msg.type}: {msg.text}") if msg.type == "error" else None)
            opt_page.goto(f"{base}/options.html", wait_until="networkidle")
            opt_page.select_option("#opt-reading", "katakana")
            for cid in ("#opt-gloss", "#opt-quick-record", "#opt-autopause", "#opt-shortcuts", "#opt-bridge"):
                opt_page.locator(cid).click()
            saved = opt_page.evaluate("() => JSON.parse(localStorage.getItem('kls:settings') || '{}')")
            assert saved["readingMode"] == "katakana" and saved["showGloss"] is False and saved["showQuickRecord"] is False and saved["autoPauseOnClick"] is False and saved["shortcutsEnabled"] is False and saved["enableBridge"] is True, saved
            opt_page.locator('a[href="studio.html#freq"]').click()
            opt_page.wait_for_url("**/studio.html#freq")
            opt_page.wait_for_selector('[data-stab="freq"].is-active')

            mob_ctx = browser.new_context(viewport={"width": 390, "height": 844})
            mob_studio = mob_ctx.new_page()
            mob_studio.on("pageerror", lambda err: errors.append(f"mobile studio pageerror: {err}"))
            mob_studio.on("console", lambda msg: errors.append(f"mobile studio console.{msg.type}: {msg.text}") if msg.type == "error" else None)
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
