export const resolverPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Midnight DID Resolver</title>
    <style>
      :root {
        --bg: #070b14;
        --surface: #0f1727;
        --surface-2: #141f33;
        --text: #eef4ff;
        --muted: #97a8c7;
        --accent: #6ea8ff;
        --accent-2: #9dd4ff;
        --border: #263756;
        --ok: #87d3a5;
        --warn: #ffd58a;
        --error: #ff9e9e;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        color: var(--text);
        background: radial-gradient(circle at 0% 0%, #1b2d52 0%, var(--bg) 42%);
        min-height: 100vh;
        padding: 20px;
      }
      a { color: var(--accent); text-decoration: none; }
      h1 { margin: 0 0 8px; font-size: 30px; }
      h2 { margin: 0 0 8px; font-size: 16px; }
      p { margin: 0 0 12px; color: var(--muted); }
      .shell {
        max-width: 1420px;
        margin: 0 auto;
        display: grid;
        gap: 14px;
      }
      .hero {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }
      .hero-copy {
        max-width: 760px;
      }
      .nav {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }
      .nav a {
        padding: 10px 14px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: #0a1220;
      }
      .nav a.active {
        background: #17315c;
        border-color: #476a9f;
        color: white;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(15, 23, 39, 0.9);
        color: var(--accent-2);
        font-size: 13px;
      }
      .layout {
        display: grid;
        grid-template-columns: 420px 1fr;
        gap: 14px;
      }
      .left, .right {
        display: grid;
        gap: 12px;
        align-content: start;
      }
      .card {
        background: linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 14px;
      }
      .card.notice {
        border-color: #36527a;
        background: linear-gradient(180deg, #10203c 0%, #10192b 100%);
      }
      .grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      label {
        font-size: 12px;
        color: var(--muted);
        display: block;
        margin: 6px 0 4px;
      }
      input, textarea, button {
        width: 100%;
        border: 1px solid var(--border);
        background: #0a1220;
        color: var(--text);
        border-radius: 10px;
        padding: 10px 11px;
      }
      textarea {
        min-height: 96px;
        resize: vertical;
      }
      button {
        cursor: pointer;
      }
      button.primary {
        background: #2c4f85;
        border-color: #496da6;
      }
      .row {
        display: flex;
        gap: 8px;
      }
      .muted { color: var(--muted); font-size: 12px; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: #0a1220;
        font-size: 12px;
      }
      .status.ok { color: var(--ok); }
      .status.warn { color: var(--warn); }
      .status.error { color: var(--error); }
      .metric {
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: #0a1220;
      }
      .metric strong {
        display: block;
        margin-bottom: 6px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 500;
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        background: #0a1220;
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 12px;
        overflow: auto;
        min-height: 300px;
      }
      .hint-list {
        display: grid;
        gap: 8px;
      }
      .hint {
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: #0a1220;
        color: var(--muted);
        font-size: 13px;
      }
      @media (max-width: 980px) {
        .hero, .layout {
          grid-template-columns: 1fr;
          display: grid;
        }
        .grid2 {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <div class="hero-copy">
          <span class="badge">Midnight DID Resolver</span>
          <h1>Resolve DID Documents from ledger state</h1>
          <p>
            Resolve <span class="mono">did:midnight</span> identifiers through the resolver API,
            inspect resolution metadata, and optionally override indexer endpoints for debugging.
          </p>
        </div>
        <nav class="nav">
          <a class="active" href="/">Resolver</a>
          <a href="/docs">Swagger Docs</a>
          <a href="/health">Health</a>
          <a href="/ready">Ready</a>
        </nav>
      </section>

      <section class="layout">
        <div class="left">
          <div class="card notice">
            <h2>Resolver Input</h2>
            <p>
              The resolver runs against its configured network. Use the override fields only when you
              intentionally want to query a different indexer endpoint.
            </p>
            <div class="status warn" id="statusBadge">Idle</div>
          </div>

          <div class="card">
            <h2>Resolve DID</h2>
            <label for="did">DID</label>
            <input id="did" placeholder="did:midnight:preprod:..." />

            <label for="indexerUrl">Indexer URL override</label>
            <input id="indexerUrl" placeholder="https://.../api/v3/graphql" />

            <label for="indexerWsUrl">Indexer WS URL override</label>
            <input id="indexerWsUrl" placeholder="wss://.../api/v3/graphql/ws" />

            <div class="row" style="margin-top: 10px;">
              <button class="primary" id="resolve">Resolve</button>
              <button id="clear">Clear</button>
            </div>
          </div>

          <div class="card">
            <h2>Resolution Notes</h2>
            <div class="hint-list">
              <div class="hint">Use a canonical Midnight DID subject, for example <span class="mono">did:midnight:preprod:&lt;64-hex&gt;</span>.</div>
              <div class="hint">The GET API endpoint is <span class="mono">/resolve/:did</span>. The POST endpoint accepts JSON body fields for DID and optional indexer overrides.</div>
              <div class="hint">Resolver errors are returned inside DID Resolution metadata. The raw JSON output remains available for debugging.</div>
            </div>
          </div>
        </div>

        <div class="right">
          <div class="card">
            <h2>Summary</h2>
            <div class="grid2">
              <div class="metric">
                <strong>Resolved DID</strong>
                <div class="mono" id="summaryDid">-</div>
              </div>
              <div class="metric">
                <strong>Resolution status</strong>
                <div id="summaryStatus">Idle</div>
              </div>
              <div class="metric">
                <strong>Content type</strong>
                <div class="mono" id="summaryContentType">-</div>
              </div>
              <div class="metric">
                <strong>Resolver error</strong>
                <div class="mono" id="summaryError">-</div>
              </div>
            </div>
          </div>

          <div class="card">
            <h2>Resolution Output</h2>
            <p>Full DID Resolution result returned by the resolver API.</p>
            <pre id="output">{\n  "message": "Enter a DID and click Resolve"\n}</pre>
          </div>
        </div>
      </section>
    </main>

    <script>
      const didInput = document.getElementById("did");
      const indexerUrlInput = document.getElementById("indexerUrl");
      const indexerWsUrlInput = document.getElementById("indexerWsUrl");
      const output = document.getElementById("output");
      const statusBadge = document.getElementById("statusBadge");
      const summaryDid = document.getElementById("summaryDid");
      const summaryStatus = document.getElementById("summaryStatus");
      const summaryContentType = document.getElementById("summaryContentType");
      const summaryError = document.getElementById("summaryError");

      const setStatus = (label, kind) => {
        statusBadge.textContent = label;
        statusBadge.className = "status" + (kind ? " " + kind : "");
      };

      const renderSummary = (payload, httpStatus) => {
        const documentId = payload && payload.didDocument && payload.didDocument.id ? payload.didDocument.id : "-";
        const metadata = payload && payload.didResolutionMetadata ? payload.didResolutionMetadata : {};
        const error = metadata && metadata.error ? String(metadata.error) : "-";
        const contentType = metadata && metadata.contentType ? String(metadata.contentType) : "-";

        summaryDid.textContent = documentId;
        summaryContentType.textContent = contentType;
        summaryError.textContent = error;
        summaryStatus.textContent = httpStatus >= 200 && httpStatus < 300 ? "Success" : "Failed (" + httpStatus + ")";
      };

      const resetSummary = () => {
        summaryDid.textContent = "-";
        summaryStatus.textContent = "Idle";
        summaryContentType.textContent = "-";
        summaryError.textContent = "-";
      };

      document.getElementById("clear").addEventListener("click", () => {
        didInput.value = "";
        indexerUrlInput.value = "";
        indexerWsUrlInput.value = "";
        resetSummary();
        setStatus("Idle", "warn");
        output.textContent = JSON.stringify({ message: "Enter a DID and click Resolve" }, null, 2);
      });

      document.getElementById("resolve").addEventListener("click", async () => {
        const did = (didInput.value || "").trim();
        const indexerUrl = (indexerUrlInput.value || "").trim();
        const indexerWsUrl = (indexerWsUrlInput.value || "").trim();

        if (!did) {
          const errorPayload = { error: "DID is required" };
          setStatus("DID is required", "error");
          resetSummary();
          output.textContent = JSON.stringify(errorPayload, null, 2);
          return;
        }

        setStatus("Resolving...", "warn");

        try {
          const query = new URLSearchParams();
          if (indexerUrl) query.set("indexerUrl", indexerUrl);
          if (indexerWsUrl) query.set("indexerWsUrl", indexerWsUrl);
          const suffix = query.toString() ? "?" + query.toString() : "";
          const res = await fetch("/resolve/" + encodeURIComponent(did) + suffix);
          const json = await res.json();
          output.textContent = JSON.stringify(json, null, 2);
          renderSummary(json, res.status);
          if (res.ok) {
            setStatus("Resolution complete", "ok");
          } else {
            setStatus("Resolution failed", "error");
          }
        } catch (error) {
          const payload = { error: String(error && error.message ? error.message : error) };
          output.textContent = JSON.stringify(payload, null, 2);
          resetSummary();
          setStatus("Request failed", "error");
        }
      });
    </script>
  </body>
</html>`;
