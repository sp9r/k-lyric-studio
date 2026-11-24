import json
import os
import sys
import threading
import unittest
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "bridge"))
import k_lyric_bridge as bridge  # noqa: E402


class MockLlmHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        _ = self.rfile.read(length)
        body = json.dumps(
            {
                "choices": [
                    {
                        "message": {
                            "content": "基本形은 설레다（ときめく）で、-잖아 は同意や念押しを表す口語語尾です。"
                        }
                    }
                ]
            },
            ensure_ascii=False,
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class BridgeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.llm_server = ThreadingHTTPServer(("127.0.0.1", 0), MockLlmHandler)
        cls.llm_port = cls.llm_server.server_address[1]
        cls.llm_thread = threading.Thread(target=cls.llm_server.serve_forever, daemon=True)
        cls.llm_thread.start()

        os.environ["KLYRIC_LLM_BASE_URL"] = f"http://127.0.0.1:{cls.llm_port}/v1"
        os.environ["KLYRIC_LLM_MODEL"] = "mock-qwen"

        cls.bridge_server = ThreadingHTTPServer(("127.0.0.1", 0), bridge.BridgeHandler)
        cls.bridge_port = cls.bridge_server.server_address[1]
        cls.bridge_thread = threading.Thread(target=cls.bridge_server.serve_forever, daemon=True)
        cls.bridge_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.bridge_server.shutdown()
        cls.bridge_server.server_close()
        cls.llm_server.shutdown()
        cls.llm_server.server_close()

    def test_health_endpoint(self):
        url = f"http://127.0.0.1:{self.bridge_port}/api/health"
        with urllib.request.urlopen(url, timeout=5) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["ok"])
            self.assertEqual(data["llmModel"], "mock-qwen")

    def test_explain_endpoint(self):
        url = f"http://127.0.0.1:{self.bridge_port}/api/explain"
        req = urllib.request.Request(
            url,
            data=json.dumps(
                {
                    "word": "설레잖아",
                    "line": "내 맘이 너한테 설레잖아",
                    "translation": "私の心が君にときめくじゃない",
                    "title": "Magnetic",
                }
            ).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["ok"])
            self.assertIn("설레다", data["explanation"])


if __name__ == "__main__":
    unittest.main()
