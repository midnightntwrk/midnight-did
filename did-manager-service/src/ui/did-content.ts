export const didContent = String.raw`
  <div class="layout">
    <section class="left">
      <div id="didBanner" class="banner info"></div>
      <div class="card notice">
        <h2>DID Management</h2>
        <p id="didGateMessage">Checking wallet readiness...</p>
        <div class="row">
          <a href="/wallet">Go to wallet setup</a>
        </div>
      </div>

      <fieldset id="didActions" class="left" style="border:0;padding:0;margin:0;min-width:0;">
        <div class="card">
          <h2>DID Contract</h2>
        <div class="row wrap">
          <button id="deploy">Deploy DID Contract</button>
          <button id="refreshDid" class="secondary">Refresh DID</button>
        </div>
        <label>Stored contracts</label>
        <select id="contractAddressSelect">
          <option value="">No available stored contracts</option>
        </select>
        <details class="advanced-section">
          <summary>Advanced: join by contract address</summary>
          <label>Join contract address</label>
          <input id="contractAddress" class="mono" placeholder="64-byte hex" />
        </details>
        <p class="muted" id="knownContractsSummary">Stored contracts from this setup will appear here.</p>
        <div class="contract-list" id="storedContractStatusList"></div>
        <button id="join" class="primary" style="margin-top:8px;">Join DID Contract</button>
        <button id="deactivate" class="danger" style="margin-top:8px;">Deactivate DID</button>
      </div>

        <div class="card">
          <h2>Verification Method</h2>
          <label>existing methods</label><select id="vmMethodSelect"><option value="">Enter manually</option></select>
          <label>methodId</label><input id="vmMethodId" class="mono" placeholder="#key-1" />
          <label>available local keys</label><select id="vmKeyRefSelect"><option value="">Enter manually</option></select>
          <label>keyRef</label><input id="vmKeyRef" class="mono" />
          <div class="row" style="margin-top:8px;"><button id="vmAdd">Add</button><button id="vmUpdate">Update</button><button id="vmRemove" class="danger">Remove</button></div>
        </div>

        <div class="card">
          <h2>Verification Method Relation</h2>
          <label>existing methods</label><select id="relMethodSelect"><option value="">Select a verification method</option></select>
          <label>methodId</label><input id="relMethodId" class="mono" placeholder="#key-1" />
          <label>relation</label>
          <select id="vmRelation"><option>Authentication</option><option>AssertionMethod</option><option>KeyAgreement</option><option>CapabilityInvocation</option><option>CapabilityDelegation</option></select>
          <div class="row" style="margin-top:8px;"><button id="relAdd">Add relation</button><button id="relRemove" class="danger">Remove relation</button></div>
        </div>

        <div class="card">
          <h2>Services</h2>
          <label>existing services</label><select id="svcSelect"><option value="">Enter manually</option></select>
          <label>service id</label><input id="svcId" class="mono" placeholder="#service-1" />
          <label>service type</label><input id="svcType" placeholder="LinkedDomains" />
          <label>service endpoint (JSON or string)</label><textarea id="svcEndpoint" class="mono">"https://example.com"</textarea>
          <div class="row" style="margin-top:8px;"><button id="svcAdd">Add service</button><button id="svcUpdate">Update service</button><button id="svcRemove" class="danger">Remove service</button></div>
        </div>

        <div class="card">
          <h2>Aliases</h2>
          <label>existing aliases</label><select id="akaSelect"><option value="">Enter manually</option></select>
          <label>alsoKnownAs value</label><input id="akaValue" placeholder="https://example.org/profile" />
          <div class="row" style="margin-top:8px;"><button id="akaAdd">Add alias</button><button id="akaRemove" class="danger">Remove alias</button></div>
        </div>
      </fieldset>
    </section>

    <section class="right">
      <div class="card">
        <h2>DID</h2>
        <div class="tab-list" data-tab-group="did">
          <button id="tabDidDocument" class="tab active" type="button" data-tab-group="did" data-tab="document">Document</button>
          <button id="tabDidSummary" class="tab" type="button" data-tab-group="did" data-tab="summary">Summary</button>
        </div>
        <div id="panelDidDocument" class="tab-panel active" data-tab-group="did" data-tab-panel="document"><pre id="didDocument">{}</pre></div>
        <div id="panelDidSummary" class="tab-panel" data-tab-group="did" data-tab-panel="summary">
          <div class="value-list">
            <div class="value"><strong>Contract address</strong><span id="didSummaryContract" class="mono">-</span></div>
            <div class="grid3">
              <div class="value"><strong>Status</strong><span id="didSummaryStatus">No DID</span></div>
              <div class="value"><strong>Version</strong><span id="didSummaryVersion">-</span></div>
              <div class="value"><strong>Operation count</strong><span id="didSummaryOperations">-</span></div>
            </div>
            <div class="grid3">
              <div class="value"><strong>Methods</strong><span id="didSummaryMethods">0</span></div>
              <div class="value"><strong>Services</strong><span id="didSummaryServices">0</span></div>
              <div class="value"><strong>Aliases</strong><span id="didSummaryAliases">0</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <h2>Next Actions</h2>
        <div id="nextActions" class="hint-list">
          <div class="hint-item"><strong>Loading state</strong><p>Waiting for wallet and DID state before suggesting the next valid action.</p></div>
        </div>
      </div>
      <div class="card">
        <h2>Diagnostics</h2>
        <div class="tab-list" data-tab-group="diag">
          <button id="tabDiagBackend" class="tab active" type="button" data-tab-group="diag" data-tab="backend">Backend State</button>
          <button id="tabDiagSummary" class="tab" type="button" data-tab-group="diag" data-tab="summary">Summary</button>
          <button id="tabDiagResult" class="tab" type="button" data-tab-group="diag" data-tab="result">Last API Result</button>
          <button id="tabDiagState" class="tab" type="button" data-tab-group="diag" data-tab="state">Rendered DID State</button>
        </div>
        <div id="panelDiagBackend" class="tab-panel active" data-tab-group="diag" data-tab-panel="backend">
          <div class="indicator-grid">
            <div class="indicator"><strong>Connection</strong><span id="indicatorConnection" class="mono">-</span></div>
            <div class="indicator"><strong>DID loop</strong><span id="indicatorDid" class="mono">-</span></div>
            <div class="indicator"><strong>Current operation</strong><span id="indicatorOperation" class="mono">idle</span></div>
            <div class="indicator"><strong>Last indexed refresh</strong><span id="indicatorRefresh" class="mono">-</span></div>
          </div>
          <label style="margin-top:10px;">Backend message</label>
          <pre id="backendStateDetails">{"message":"Waiting for first status refresh"}</pre>
        </div>
        <div id="panelDiagSummary" class="tab-panel" data-tab-group="diag" data-tab-panel="summary">
          <div class="value-list">
            <div class="value"><strong>Current operation</strong><span id="diagOperation">idle</span></div>
            <div class="value"><strong>Indexer freshness</strong><span id="diagIndexer">Waiting for first DID refresh</span></div>
          </div>
        </div>
        <div id="panelDiagResult" class="tab-panel" data-tab-group="diag" data-tab-panel="result"><pre id="result">{ "message": "DID page ready" }</pre></div>
        <div id="panelDiagState" class="tab-panel" data-tab-group="diag" data-tab-panel="state"><pre id="didState">{}</pre></div>
      </div>
      <div class="card">
        <h2>Operation Log</h2>
        <div id="operationLog" class="op-log">
          <div class="op-log-item"><strong>Waiting for activity</strong><p>No operations recorded yet.</p></div>
        </div>
      </div>
    </section>
  </div>
`;
