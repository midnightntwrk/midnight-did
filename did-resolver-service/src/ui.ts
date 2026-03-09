export const resolverPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Midnight DID Resolver</title>
    <style>
      :root {
        --bg: #f4f7fb;
        --card: #ffffff;
        --text: #172033;
        --muted: #4a5b7d;
        --accent: #0f6fff;
        --border: #d5dfef;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        background: radial-gradient(circle at 15% 20%, #dce9ff 0%, var(--bg) 45%);
        color: var(--text);
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: min(920px, 100%);
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 16px;
        box-shadow: 0 12px 36px rgba(12, 30, 72, 0.08);
        padding: 24px;
      }
      h1 { margin: 0 0 12px; font-size: 28px; }
      p { margin: 0 0 16px; color: var(--muted); }
      .row { display: flex; gap: 12px; flex-wrap: wrap; }
      input {
        flex: 1;
        min-width: 260px;
        padding: 12px 14px;
        border: 1px solid var(--border);
        border-radius: 10px;
        font-size: 14px;
      }
      button {
        border: none;
        border-radius: 10px;
        background: var(--accent);
        color: #fff;
        padding: 12px 16px;
        font-weight: 600;
        cursor: pointer;
      }
      pre {
        margin-top: 16px;
        background: #0f172a;
        color: #d6e2ff;
        border-radius: 10px;
        padding: 14px;
        min-height: 220px;
        overflow: auto;
      }
      .links { margin-top: 12px; font-size: 14px; }
      a { color: var(--accent); text-decoration: none; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Midnight DID Resolver</h1>
      <p>Resolve DID Documents from on-ledger state.</p>
      <div class="row">
        <input id="did" placeholder="did:midnight:devnet:..." />
        <input id="indexerUrl" placeholder="optional indexer URL (http://.../graphql)" />
        <button id="resolve">Resolve</button>
      </div>
      <div class="links"><a href="/docs">Open Swagger docs</a></div>
      <pre id="output">{ "message": "Enter a DID and click Resolve" }</pre>
    </main>
    <script>
      const didInput = document.getElementById("did");
      const indexerUrlInput = document.getElementById("indexerUrl");
      const output = document.getElementById("output");
      document.getElementById("resolve").addEventListener("click", async () => {
        const did = (didInput.value || "").trim();
        const indexerUrl = (indexerUrlInput.value || "").trim();
        if (!did) {
          output.textContent = JSON.stringify({ error: "DID is required" }, null, 2);
          return;
        }
        try {
          const query = new URLSearchParams();
          if (indexerUrl) query.set("indexerUrl", indexerUrl);
          const suffix = query.toString() ? "?" + query.toString() : "";
          const res = await fetch("/resolve/" + encodeURIComponent(did) + suffix);
          const json = await res.json();
          output.textContent = JSON.stringify(json, null, 2);
        } catch (error) {
          output.textContent = JSON.stringify(
            { error: String(error && error.message ? error.message : error) },
            null,
            2,
          );
        }
      });
    </script>
  </body>
</html>`;
