import argparse
import json
import os
import shutil
import subprocess
import tempfile
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

GPU_LOCK = threading.Lock()


def get_config() -> dict:
    return {
        "llm_base_url": os.environ.get("KLYRIC_LLM_BASE_URL", "http://127.0.0.1:8089/v1").rstrip("/"),
        "llm_model": os.environ.get("KLYRIC_LLM_MODEL", "qwen3.6-35b"),
        "llm_api_key": os.environ.get("KLYRIC_LLM_API_KEY", ""),
        "whisper_model": os.environ.get("KLYRIC_WHISPER_MODEL", "small"),
    }


def query_llm_explanation(word: str, line: str, translation: str, title: str, cfg: dict | None = None) -> dict:
    conf = cfg or get_config()
    endpoint = f"{conf['llm_base_url']}/chat/completions"
    prompt = (
        f"動画/曲: {title}\n"
        f"韓国語の文: {line}\n"
        f"日本語訳: {translation}\n"
        f"対象語句: {word}\n\n"
        "この文脈における対象語句の基本形、語尾・助詞の働き、口語・歌詞ならではのニュアンスを"
        "日本語で2〜3文で簡潔に解説してください。"
    )
    payload = json.dumps(
        {
            "model": conf["llm_model"],
            "messages": [
                {"role": "system", "content": "韓国語学習者向けに簡潔で正確な文法・語彙解説を日本語で返してください。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 220,
        }
    ).encode("utf-8")

    headers = {"Content-Type": "application/json"}
    if conf["llm_api_key"]:
        headers["Authorization"] = f"Bearer {conf['llm_api_key']}"

    req = urllib.request.Request(endpoint, data=payload, headers=headers, method="POST")
    with GPU_LOCK:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )
    return {"ok": True, "explanation": content}


def transcribe_youtube_audio(url: str, cfg: dict | None = None) -> dict:
    conf = cfg or get_config()
    yt_dlp = shutil.which("yt-dlp")
    if not yt_dlp:
        return {"ok": False, "error": "yt-dlp が見つかりません"}

    try:
        from faster_whisper import WhisperModel  # type: ignore
    except Exception:
        return {"ok": False, "error": "faster-whisper がインストールされていません"}

    with GPU_LOCK:
        with tempfile.TemporaryDirectory(prefix="klyric_") as tmp:
            audio_tpl = str(Path(tmp) / "audio.%(ext)s")
            subprocess.run(
                [yt_dlp, "-f", "bestaudio/best", "-x", "--audio-format", "mp3", "-o", audio_tpl, url],
                check=True,
                capture_output=True,
                text=True,
            )
            files = list(Path(tmp).glob("audio.*"))
            if not files:
                return {"ok": False, "error": "音声ファイルを取得できませんでした"}

            model = WhisperModel(conf["whisper_model"], device="auto", compute_type="auto")
            segments, _ = model.transcribe(str(files[0]), language="ko")
            cues = []
            for idx, seg in enumerate(segments):
                text = (seg.text or "").strip()
                if not text:
                    continue
                cues.append(
                    {
                        "id": idx,
                        "start": round(float(seg.start), 2),
                        "end": round(float(seg.end), 2),
                        "ko": text,
                        "ja": "",
                    }
                )
            return {"ok": True, "cues": cues}


class BridgeHandler(BaseHTTPRequestHandler):
    def _send_json(self, code: int, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, format: str, *args) -> None:
        return

    def do_OPTIONS(self) -> None:
        self._send_json(204, {})

    def do_GET(self) -> None:
        if self.path.rstrip("/") == "/api/health":
            cfg = get_config()
            self._send_json(
                200,
                {
                    "ok": True,
                    "llmModel": cfg["llm_model"],
                    "whisperModel": cfg["whisper_model"],
                },
            )
            return
        self._send_json(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            data = json.loads(body.decode("utf-8"))
        except Exception:
            self._send_json(400, {"ok": False, "error": "invalid json"})
            return

        if self.path.rstrip("/") == "/api/explain":
            try:
                res = query_llm_explanation(
                    word=str(data.get("word", "")),
                    line=str(data.get("line", "")),
                    translation=str(data.get("translation", "")),
                    title=str(data.get("title", "")),
                )
                self._send_json(200, res)
            except urllib.error.URLError as err:
                self._send_json(502, {"ok": False, "error": f"LLM接続失敗: {err}"})
            except Exception as err:
                self._send_json(500, {"ok": False, "error": str(err)})
            return

        if self.path.rstrip("/") == "/api/transcribe":
            url = str(data.get("url", "")).strip()
            if not url:
                self._send_json(400, {"ok": False, "error": "url is required"})
                return
            try:
                res = transcribe_youtube_audio(url)
                self._send_json(200 if res.get("ok") else 422, res)
            except Exception as err:
                self._send_json(500, {"ok": False, "error": str(err)})
            return

        self._send_json(404, {"ok": False, "error": "not found"})


def main() -> None:
    parser = argparse.ArgumentParser(description="K-Lyric Studio optional local AI bridge")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8788)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), BridgeHandler)
    print(f"K-Lyric Studio bridge listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
