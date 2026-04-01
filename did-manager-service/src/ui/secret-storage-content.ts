export const secretStorageContent = String.raw`
  <div class="layout">
    <section class="left">
      <div id="secretStorageBanner" class="banner info"></div>
      <div class="card notice">
        <h2>Secret Storage</h2>
        <p>Manage local keys independently from DID contract operations. Generating or importing a key does not publish anything on-chain. Keys remain local until a DID operation references them.</p>
      </div>

      <div class="card">
        <h2>Keys</h2>
        <label>id</label><input id="keyId" placeholder="auth-main" />
        <div class="grid2">
          <div><label>crv</label><select id="keyCrv"><option>Ed25519</option><option>Jubjub</option><option>P-256</option></select></div>
          <div><label>kty</label><input id="keyKty" readonly value="OKP" /></div>
        </div>
        <div class="row" style="margin-top:8px;"><button id="keyGenerate" class="primary">Generate</button></div>
        <label>private key hex (import)</label><input id="keyPrivate" class="mono" />
        <button id="keyImport" style="margin-top:8px;">Import</button>
        <label>delete keyRef</label><input id="keyRefDelete" class="mono" />
        <button id="keyDelete" class="danger" style="margin-top:8px;">Delete</button>
      </div>
    </section>

    <section class="right">
      <div class="card">
        <div class="card-header">
          <h2>Key Inventory</h2>
          <button id="keyList" class="icon-button secondary" type="button" aria-label="Refresh key inventory" title="Refresh key inventory">↻</button>
        </div>
        <div id="secretStorageKeyList" class="op-log">
          <div class="op-log-item"><strong>Waiting for keys</strong><p>No keys loaded yet.</p></div>
        </div>
      </div>

      <div class="card">
        <h2>Diagnostics</h2>
        <div class="tab-list" data-tab-group="keys-diag">
          <button class="tab active" type="button" data-tab-group="keys-diag" data-tab="backend">Backend State</button>
          <button class="tab" type="button" data-tab-group="keys-diag" data-tab="result">Last API Result</button>
        </div>
        <div class="tab-panel active" data-tab-group="keys-diag" data-tab-panel="backend">
          <div class="indicator-grid">
            <div class="indicator"><strong>Connection</strong><span id="indicatorConnection" class="mono">-</span></div>
            <div class="indicator"><strong>DID loop</strong><span id="indicatorDid" class="mono">-</span></div>
            <div class="indicator"><strong>Current operation</strong><span id="indicatorOperation" class="mono">idle</span></div>
            <div class="indicator"><strong>Last refresh</strong><span id="indicatorRefresh" class="mono">-</span></div>
          </div>
          <label style="margin-top:10px;">Backend message</label>
          <pre id="backendStateDetails">{"message":"Waiting for first status refresh"}</pre>
        </div>
        <div class="tab-panel" data-tab-group="keys-diag" data-tab-panel="result"><pre id="result">{ "message": "Secret Storage page ready" }</pre></div>
      </div>
    </section>
  </div>
`;
