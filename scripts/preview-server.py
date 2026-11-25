# DEV ONLY: serves dist/ with the chrome.* shim injected into sidepanel.html. Usage: python3 scripts/preview-server.py [port]
import http.server, os, sys, glob
ROOT = os.path.join(os.path.dirname(__file__), '..')
DIST = os.path.join(ROOT, 'dist')
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=DIST, **k)
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/__shim.js':
            body = open(os.path.join(ROOT, 'scripts/preview-shim.js'), 'rb').read()
            return self._send(body, 'text/javascript')
        if path == '/__inbox':
            return self._send(open(os.path.join(ROOT, 'scripts/inbox-mock.html'), 'rb').read(), 'text/html')
        if path == '/__mail':
            return self._send(open(os.path.join(ROOT, 'scripts/mail-mock.html'), 'rb').read(), 'text/html')
        if path == '/__samples.js':
            body = open(os.path.join(ROOT, 'src/samples.js'), 'rb').read()
            return self._send(body, 'text/javascript')
        if path in ('/', '/sidepanel.html'):
            html = open(os.path.join(DIST, 'sidepanel.html')).read()
            inject = '<script>window.__samplesUrl="/__samples.js"</script><script src="/__shim.js"></script>'
            html = html.replace('<head>', '<head>' + inject, 1)
            return self._send(html.encode(), 'text/html')
        return super().do_GET()
    def _send(self, body, ctype):
        self.send_response(200); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 5180), H).serve_forever()
