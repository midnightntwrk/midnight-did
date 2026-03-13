const styles = `
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
  h1 { margin: 0 0 8px; font-size: 28px; }
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
  .nav {
    display: flex;
    gap: 10px;
    align-items: center;
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
  .left {
    display: grid;
    gap: 12px;
    align-content: start;
  }
  .right {
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
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .steps {
    display: grid;
    gap: 8px;
  }
  .step {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 10px;
    align-items: start;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: #0a1220;
  }
  .step-index {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid var(--border);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 12px;
  }
  .step strong {
    display: block;
    margin-bottom: 4px;
    font-size: 13px;
  }
  .step p {
    margin: 0;
    font-size: 12px;
  }
  .step.done {
    border-color: #305d46;
    background: rgba(20, 45, 28, 0.45);
  }
  .step.done .step-index {
    color: var(--ok);
    border-color: #3f7a59;
  }
  .step.active {
    border-color: #516f9e;
    background: rgba(23, 49, 92, 0.45);
  }
  .step.active .step-index {
    color: var(--accent-2);
    border-color: #5a82bb;
  }
  label { font-size: 12px; color: var(--muted); display: block; margin: 6px 0 4px; }
  input, select, textarea, button {
    width: 100%;
    border: 1px solid var(--border);
    background: #0a1220;
    color: var(--text);
    border-radius: 10px;
    padding: 10px 11px;
  }
  textarea { min-height: 70px; }
  input[readonly] { color: #d7e6ff; }
  button { cursor: pointer; }
  button.primary { background: #2c4f85; border-color: #496da6; }
  .row { display: flex; gap: 8px; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .muted { color: var(--muted); font-size: 12px; }
  .value-list { display: grid; gap: 8px; }
  .value {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: #0a1220;
  }
  .value strong {
    display: block;
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 6px;
    font-weight: 500;
  }
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
  .gated {
    opacity: 0.52;
    pointer-events: none;
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
    min-height: 180px;
  }
  @media (max-width: 980px) {
    .hero, .layout { grid-template-columns: 1fr; display: grid; }
    .nav { flex-wrap: wrap; }
  }
`;

const walletContent = `
  <div class="layout">
    <section class="left">
      <div class="card notice">
        <h2>Wallet Setup</h2>
        <p>Prepare the Midnight wallet first. DID operations stay unavailable until the wallet is unlocked for the current setup.</p>
        <div class="status warn" id="walletStatusBadge">Loading wallet status...</div>
      </div>

      <div class="card">
        <h2>Wallet Flow</h2>
        <div class="steps">
          <div class="step" id="stepPrepare">
            <span class="step-index">1</span>
            <div>
              <strong>Prepare shared seed</strong>
              <p>Generate or reuse the same seed for the Midnight wallet and the DID lifecycle.</p>
            </div>
          </div>
          <div class="step" id="stepFund">
            <span class="step-index">2</span>
            <div>
              <strong>Fund the wallet</strong>
              <p>Copy the prepared unshielded address and top it up with tNight for the current setup.</p>
            </div>
          </div>
          <div class="step" id="stepUnlock">
            <span class="step-index">3</span>
            <div>
              <strong>Unlock the session</strong>
              <p>Once the funds are available, unlock the wallet and continue to DID management.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Profile</h2>
        <label>Active profile</label>
        <select id="profileSelect"></select>
        <label>Create or switch profile</label>
        <input id="profileName" placeholder="default" />
        <div class="row" style="margin-top:8px;">
          <button id="selectProfile">Use profile</button>
          <button id="refreshProfiles">Refresh profiles</button>
        </div>
      </div>

      <div class="card">
        <h2>Seed</h2>
        <label>Seed mode</label>
        <select id="seedMode">
          <option value="reuse">reuse</option>
          <option value="generated">generated</option>
          <option value="provided">provided</option>
        </select>
        <label>Seed (provided mode)</label>
        <input id="seed" class="mono" placeholder="hex seed" />
        <label>Secret passphrase</label>
        <input id="passphrase" placeholder="optional override" />
        <label>Remember unlocked</label>
        <select id="remember"><option value="true">true</option><option value="false">false</option></select>
        <div class="row" style="margin-top:8px;">
          <button id="prepareFunding">Prepare funding</button>
          <button id="unlock" class="primary">Unlock</button>
        </div>
        <div class="row" style="margin-top:8px;">
          <button id="lock">Lock</button>
          <button id="status">Refresh status</button>
        </div>
      </div>

      <div class="card">
        <h2>Funding</h2>
        <label>Prepared funding address</label>
        <input id="fundingAddress" class="mono" readonly placeholder="prepare funding to populate" />
        <div class="row" style="margin-top:8px;">
          <button id="copyFundingAddress">Copy address</button>
        </div>
        <label>Faucet</label>
        <input id="faucetUrl" readonly placeholder="available for preprod" />
        <p class="muted">The same seed is used for the Midnight wallet and the Midnight DID lifecycle.</p>
      </div>
    </section>

    <section class="right">
      <div class="card">
        <h2>Current Setup</h2>
        <div class="value-list">
          <div class="value"><strong>Setup profile</strong><span id="setupProfile" class="mono">-</span></div>
          <div class="value"><strong>Node</strong><span id="setupNode" class="mono">-</span></div>
          <div class="value"><strong>Indexer</strong><span id="setupIndexer" class="mono">-</span></div>
          <div class="value"><strong>Proof server</strong><span id="setupProofServer" class="mono">-</span></div>
        </div>
      </div>

      <div class="card">
        <h2>Wallet Session</h2>
        <div class="value-list">
          <div class="value"><strong>Session file</strong><span class="mono">Configured on backend</span></div>
          <div class="value"><strong>Active profile</strong><span id="walletProfileName">-</span></div>
          <div class="value"><strong>Seed continuity</strong><span id="walletSeedContinuity">The same seed will be reused for wallet + DID.</span></div>
          <div class="value"><strong>Unlock state</strong><span id="walletUnlockState">-</span></div>
          <div class="value"><strong>Stored contract</strong><span id="walletContractAddress" class="mono">-</span></div>
          <div class="value"><strong>Known contracts</strong><span id="walletKnownContracts" class="mono">-</span></div>
        </div>
      </div>

      <div class="card">
        <h2>Last API Result</h2>
        <pre id="result">{ "message": "Wallet page ready" }</pre>
      </div>
    </section>
  </div>
`;

const didContent = `
  <div class="layout">
    <section class="left">
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
          <div class="row">
            <button id="deploy">Deploy DID</button>
            <button id="refreshDid">Refresh DID</button>
          </div>
          <label>Stored contracts</label>
          <select id="contractAddressSelect">
            <option value="">Enter manually</option>
          </select>
          <label>Join contract address</label>
          <input id="contractAddress" class="mono" placeholder="64-byte hex" />
          <p class="muted" id="knownContractsSummary">Stored contracts from this setup will appear here.</p>
          <button id="join" style="margin-top:8px;">Join DID</button>
          <button id="deactivate" style="margin-top:8px;">Deactivate DID</button>
        </div>

        <div class="card">
          <h2>Keys</h2>
          <label>id</label><input id="keyId" placeholder="auth-main" />
          <div class="grid2">
            <div><label>crv</label><select id="keyCrv"><option>Ed25519</option><option>Jubjub</option><option>P-256</option></select></div>
            <div><label>kty</label><input id="keyKty" readonly value="OKP" /></div>
          </div>
          <div class="row" style="margin-top:8px;"><button id="keyGenerate">Generate</button><button id="keyList">List</button></div>
          <label>private key hex (import)</label><input id="keyPrivate" class="mono" />
          <button id="keyImport" style="margin-top:8px;">Import</button>
          <label>delete keyRef</label><input id="keyRefDelete" class="mono" />
          <button id="keyDelete" style="margin-top:8px;">Delete</button>
        </div>

        <div class="card">
          <h2>Verification Method</h2>
          <label>methodId</label><input id="vmMethodId" class="mono" placeholder="#key-1" />
          <label>keyRef</label><input id="vmKeyRef" class="mono" />
          <div class="row" style="margin-top:8px;"><button id="vmAdd">Add</button><button id="vmUpdate">Update</button><button id="vmRemove">Remove</button></div>
        </div>

        <div class="card">
          <h2>Verification Method Relation</h2>
          <label>methodId</label><input id="relMethodId" class="mono" placeholder="#key-1" />
          <label>relation</label>
          <select id="vmRelation"><option>Authentication</option><option>AssertionMethod</option><option>KeyAgreement</option><option>CapabilityInvocation</option><option>CapabilityDelegation</option></select>
          <div class="row" style="margin-top:8px;"><button id="relAdd">Add relation</button><button id="relRemove">Remove relation</button></div>
        </div>

        <div class="card">
          <h2>Services & Aliases</h2>
          <label>service id</label><input id="svcId" class="mono" placeholder="#service-1" />
          <label>service type</label><input id="svcType" placeholder="LinkedDomains" />
          <label>service endpoint (JSON or string)</label><textarea id="svcEndpoint" class="mono">"https://example.com"</textarea>
          <div class="row" style="margin-top:8px;"><button id="svcAdd">Add service</button><button id="svcUpdate">Update service</button><button id="svcRemove">Remove service</button></div>
          <label>alsoKnownAs value</label><input id="akaValue" placeholder="https://example.org/profile" />
          <div class="row" style="margin-top:8px;"><button id="akaAdd">Add alias</button><button id="akaRemove">Remove alias</button></div>
        </div>
      </fieldset>
    </section>

    <section class="right">
      <div class="card">
        <h2>Current Setup</h2>
        <div class="value-list">
          <div class="value"><strong>Setup profile</strong><span id="setupProfile" class="mono">-</span></div>
          <div class="value"><strong>Node</strong><span id="setupNode" class="mono">-</span></div>
          <div class="value"><strong>Indexer</strong><span id="setupIndexer" class="mono">-</span></div>
          <div class="value"><strong>Proof server</strong><span id="setupProofServer" class="mono">-</span></div>
        </div>
      </div>
      <div class="card">
        <h2>DID Summary</h2>
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
      <div class="card"><h2>Last API Result</h2><pre id="result">{ "message": "DID page ready" }</pre></div>
      <div class="card"><h2>Rendered DID State</h2><pre id="didState">{}</pre></div>
      <div class="card"><h2>DID Resolution Result</h2><pre id="didDocument">{}</pre></div>
    </section>
  </div>
`;

const sharedScript = (page: 'wallet' | 'did') => `
  <script>
    const currentPage = ${JSON.stringify(page)};
    const resultEl = document.getElementById('result');
    const didStateEl = document.getElementById('didState');
    const didDocEl = document.getElementById('didDocument');
    const fundingAddressEl = document.getElementById('fundingAddress');
    const faucetUrlEl = document.getElementById('faucetUrl');
    const didActionsEl = document.getElementById('didActions');
    const didGateMessageEl = document.getElementById('didGateMessage');
    const seedModeEl = document.getElementById('seedMode');
    const seedEl = document.getElementById('seed');
    const profileSelectEl = document.getElementById('profileSelect');

    const setJson = (el, value) => {
      if (el) el.textContent = JSON.stringify(value, null, 2);
    };
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value ?? '-';
    };
    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value ?? '';
    };
    const parseMaybeJson = (value) => {
      const trimmed = (value || '').trim();
      if (!trimmed) return '';
      try { return JSON.parse(trimmed); } catch { return trimmed; }
    };
    const curveToKeyType = (curve) => curve === 'P-256' || curve === 'Jubjub' ? 'EC' : 'OKP';
    const contractAddressPattern = /^[0-9a-f]{64}$/;
    const hasUriScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
    const keyFragmentPattern = /^[a-zA-Z0-9.\\-_:%]+$/;
    const syncDerivedKeyType = () => {
      const curve = document.getElementById('keyCrv')?.value;
      const keyTypeEl = document.getElementById('keyKty');
      if (curve && keyTypeEl) keyTypeEl.value = curveToKeyType(curve);
    };
    const formatContracts = (values) =>
      Array.isArray(values) && values.length > 0 ? values.join(', ') : '-';
    const ensure = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const isAbsoluteUri = (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    };
    const isRelativeReference = (value) => {
      if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) return false;
      if (hasUriScheme.test(value) || value.startsWith('//')) return false;
      try {
        new URL(value, 'https://example.org');
        return true;
      } catch {
        return false;
      }
    };
    const isDidUrlWithFragment = (value) => {
      if (typeof value !== 'string' || !value.startsWith('did:')) return false;
      const parts = value.split(':');
      if (parts.length < 3) return false;
      const fragmentIndex = value.indexOf('#');
      if (fragmentIndex < 0 || fragmentIndex === value.length - 1) return false;
      return keyFragmentPattern.test(value.slice(fragmentIndex + 1));
    };
    const isMethodReference = (value) => {
      if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
      if (value.startsWith('#')) return keyFragmentPattern.test(value.slice(1));
      if (isDidUrlWithFragment(value)) return true;
      return isRelativeReference(value) && keyFragmentPattern.test(value.replace(/^#/, '').split('#').pop());
    };
    const isServiceReference = (value) => {
      if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
      if (value.startsWith('did:')) return isDidUrlWithFragment(value) || !/[?#]$/.test(value);
      return isRelativeReference(value);
    };
    const validateHexPrivateKey = (value) => /^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0;
    const validateServiceEndpoint = (value) => {
      if (typeof value === 'string') return isAbsoluteUri(value);
      if (Array.isArray(value)) return value.length > 0 && value.every((entry) => typeof entry === 'string' ? isAbsoluteUri(entry) : entry && typeof entry === 'object' && !Array.isArray(entry));
      return value && typeof value === 'object' && !Array.isArray(value);
    };
    const readTrimmed = (id) => (document.getElementById(id)?.value || '').trim();
    const request = async (url, init = {}) => {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => ({}));
      const out = { status: res.status, body };
      setJson(resultEl, out);
      return out;
    };
    const body = (obj) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) });
    const setStepState = (id, state) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('done', 'active');
      if (state === 'done') el.classList.add('done');
      if (state === 'active') el.classList.add('active');
    };

    const setSetupState = (payload) => {
      const data = payload?.data || payload;
      setText('setupProfile', data?.profile || '-');
      setText('setupProfileBadge', data?.profile || '-');
      setText('setupNode', data?.endpoints?.node || '-');
      setText('setupIndexer', data?.endpoints?.indexer || '-');
      setText('setupProofServer', data?.endpoints?.proofServer || '-');
      if (faucetUrlEl && !faucetUrlEl.value) faucetUrlEl.value = data?.faucetUrl || '';
    };

    const setProfilesState = (payload) => {
      const data = payload?.data || payload;
      if (!profileSelectEl) return;
      profileSelectEl.innerHTML = '';
      for (const profileName of data?.availableProfileNames || []) {
        const option = document.createElement('option');
        option.value = profileName;
        option.textContent = profileName;
        profileSelectEl.appendChild(option);
      }
      if (data?.activeProfileName) {
        profileSelectEl.value = data.activeProfileName;
        const profileNameEl = document.getElementById('profileName');
        if (profileNameEl && !profileNameEl.value) profileNameEl.value = data.activeProfileName;
      }
    };

    const setSessionState = (payload) => {
      const data = payload?.data?.status || payload?.data || payload;
      setValue('fundingAddress', data?.unshieldedAddress || '');
      setValue('faucetUrl', data?.faucetUrl || '');
      setText('walletUnlockState', data?.unlocked ? 'Unlocked' : 'Locked');
      setText('walletProfileName', data?.profileName || '-');
      setText('walletContractAddress', data?.contractAddress || '-');
      setText('walletKnownContracts', formatContracts(data?.knownContractAddresses));
      const knownContractsSummary = document.getElementById('knownContractsSummary');
      if (knownContractsSummary) {
        knownContractsSummary.textContent = Array.isArray(data?.knownContractAddresses) && data.knownContractAddresses.length > 0
          ? 'Known contracts for this setup: ' + data.knownContractAddresses.join(', ')
          : 'Stored contracts from this setup will appear here.';
      }
      const knownContractsEl = document.getElementById('contractAddressSelect');
      if (knownContractsEl) {
        knownContractsEl.innerHTML = '';
        const manualOption = document.createElement('option');
        manualOption.value = '';
        manualOption.textContent = 'Enter manually';
        knownContractsEl.appendChild(manualOption);
        for (const address of data?.knownContractAddresses || []) {
          const option = document.createElement('option');
          option.value = address;
          option.textContent = address;
          knownContractsEl.appendChild(option);
        }
      }
      setText(
        'walletSeedContinuity',
        data?.seedAvailable
          ? 'Stored shared seed is available and can be reused for wallet + DID.'
          : 'No shared seed prepared yet. Generate or provide one first.',
      );

      if (seedModeEl && data?.seedAvailable && !data?.unlocked && !seedEl?.value) {
        seedModeEl.value = 'reuse';
      }

      if (didActionsEl) {
        didActionsEl.disabled = !data?.unlocked;
        didActionsEl.classList.toggle('gated', !data?.unlocked);
      }
      if (didGateMessageEl) {
        didGateMessageEl.textContent = data?.unlocked
          ? 'Wallet is unlocked. DID management is available for the current setup.'
          : 'Wallet is not unlocked for the current setup. Go to Wallet Setup first.';
      }
      const badge = document.getElementById('walletStatusBadge');
      if (badge) {
        badge.textContent = data?.unlocked
          ? 'Wallet unlocked for current setup'
          : data?.seedAvailable
            ? 'Seed prepared, funding/unlock pending'
            : 'No wallet prepared yet';
        badge.className = data?.unlocked ? 'status ok' : 'status warn';
      }

      if (data?.unlocked) {
        setStepState('stepPrepare', 'done');
        setStepState('stepFund', 'done');
        setStepState('stepUnlock', 'done');
      } else if (data?.seedAvailable) {
        setStepState('stepPrepare', 'done');
        setStepState('stepFund', 'active');
        setStepState('stepUnlock', '');
      } else {
        setStepState('stepPrepare', 'active');
        setStepState('stepFund', '');
        setStepState('stepUnlock', '');
      }
    };

    const setDidSummary = (payload) => {
      const data = payload?.data || payload;
      const state = data?.didState;
      if (!state) {
        setText('didSummaryContract', '-');
        setText('didSummaryStatus', 'No DID');
        setText('didSummaryVersion', '-');
        setText('didSummaryOperations', '-');
        setText('didSummaryMethods', '0');
        setText('didSummaryServices', '0');
        setText('didSummaryAliases', '0');
        return;
      }
      setText('didSummaryContract', data?.contractAddress || '-');
      setText('didSummaryStatus', state.deactivated ? 'Deactivated' : state.active ? 'Active' : 'Inactive');
      setText('didSummaryVersion', String(state.version ?? '-'));
      setText('didSummaryOperations', String(state.operationCount ?? '-'));
      setText('didSummaryMethods', String(state.verificationMethods?.length ?? 0));
      setText('didSummaryServices', String(state.services?.length ?? 0));
      setText('didSummaryAliases', String(state.alsoKnownAs?.length ?? 0));
    };

    const refreshDidViews = async () => {
      if (!didStateEl || !didDocEl) return;
      const state = await request('/api/did/state');
      setJson(didStateEl, state.body);
      setDidSummary(state.body);
      const doc = await request('/api/did/document');
      setJson(didDocEl, doc.body);
    };

    const loadInitialState = async () => {
      const setup = await request('/api/setup');
      setSetupState(setup.body);
      const profiles = await request('/api/profiles');
      setProfilesState(profiles.body);
      const session = await request('/api/session');
      setSessionState(session.body);
    };

    const attachWalletHandlers = () => {
      const selectProfile = document.getElementById('selectProfile');
      if (selectProfile) {
        selectProfile.onclick = async () => {
          const name = readTrimmed('profileName') || profileSelectEl?.value || 'default';
          const response = await request('/api/profiles/select', body({ name }));
          const profiles = await request('/api/profiles');
          setProfilesState(profiles.body);
          setSessionState(response.body);
        };
      }

      const refreshProfiles = document.getElementById('refreshProfiles');
      if (refreshProfiles) {
        refreshProfiles.onclick = async () => {
          const profiles = await request('/api/profiles');
          setProfilesState(profiles.body);
        };
      }

      if (profileSelectEl) {
        profileSelectEl.onchange = () => {
          const profileNameEl = document.getElementById('profileName');
          if (profileNameEl) profileNameEl.value = profileSelectEl.value || '';
        };
      }

      const unlock = document.getElementById('unlock');
      if (unlock) {
        unlock.onclick = async () => {
          const response = await request('/api/session/unlock', body({
            seedMode: document.getElementById('seedMode').value,
            seed: document.getElementById('seed').value || undefined,
            passphrase: document.getElementById('passphrase').value || undefined,
            rememberUnlockedSession: document.getElementById('remember').value === 'true',
          }));
          setSessionState(response.body);
        };
      }

      const prepareFunding = document.getElementById('prepareFunding');
      if (prepareFunding) {
        prepareFunding.onclick = async () => {
          const response = await request('/api/session/prepare-funding', body({
            seedMode: document.getElementById('seedMode').value,
            seed: document.getElementById('seed').value || undefined,
          }));
          if (response.body?.ok && response.body?.data?.generatedSeed) {
            document.getElementById('seed').value = response.body.data.generatedSeed;
            document.getElementById('seedMode').value = 'provided';
          }
          setSessionState(response.body);
        };
      }

      const lock = document.getElementById('lock');
      if (lock) {
        lock.onclick = async () => {
          const response = await request('/api/session/lock', { method: 'POST' });
          setSessionState(response.body);
        };
      }

      const status = document.getElementById('status');
      if (status) {
        status.onclick = async () => {
          const response = await request('/api/session');
          setSessionState(response.body);
        };
      }

      const copyFundingAddress = document.getElementById('copyFundingAddress');
      if (copyFundingAddress) {
        copyFundingAddress.onclick = async () => {
          const value = fundingAddressEl?.value || '';
          if (!value) return;
          await navigator.clipboard.writeText(value).catch(() => undefined);
        };
      }
    };

    const attachDidHandlers = () => {
      syncDerivedKeyType();
      document.getElementById('keyCrv').addEventListener('change', syncDerivedKeyType);
      document.getElementById('contractAddressSelect').addEventListener('change', (event) => {
        const value = event.target.value || '';
        if (value) document.getElementById('contractAddress').value = value;
      });

      const clickDid = async (url, init) => {
        await request(url, init);
        const session = await request('/api/session');
        setSessionState(session.body);
        await refreshDidViews();
      };
      document.getElementById('deploy').onclick = async () => clickDid('/api/did/deploy', { method: 'POST' });
      document.getElementById('join').onclick = async () => {
        const contractAddress = readTrimmed('contractAddress');
        ensure(contractAddressPattern.test(contractAddress), 'Join contract address must be a 64-character lowercase hex string.');
        await clickDid('/api/did/join', body({ contractAddress }));
      };
      document.getElementById('refreshDid').onclick = refreshDidViews;
      document.getElementById('deactivate').onclick = async () => clickDid('/api/did/deactivate', { method: 'POST' });

      document.getElementById('keyGenerate').onclick = async () => {
        const id = readTrimmed('keyId');
        const crv = document.getElementById('keyCrv').value;
        ensure(id.length > 0, 'Key id is required.');
        await request('/api/keys/generate', body({
          id,
          kty: curveToKeyType(crv),
          crv,
        }));
      };
      document.getElementById('keyImport').onclick = async () => {
        const id = readTrimmed('keyId');
        const crv = document.getElementById('keyCrv').value;
        const privateKey = readTrimmed('keyPrivate');
        ensure(id.length > 0, 'Key id is required.');
        ensure(validateHexPrivateKey(privateKey), 'Private key must be an even-length hex string.');
        await request('/api/keys/import', body({
          id,
          kty: curveToKeyType(crv),
          crv,
          privateKey: Array.from(privateKey.match(/.{1,2}/g) || []).map((x) => parseInt(x, 16)),
        }));
      };
      document.getElementById('keyList').onclick = async () => request('/api/keys');
      document.getElementById('keyDelete').onclick = async () => {
        const keyRef = readTrimmed('keyRefDelete');
        ensure(keyRef.length > 0, 'delete keyRef is required.');
        await request('/api/keys/' + encodeURIComponent(keyRef), { method: 'DELETE' });
      };

      document.getElementById('vmAdd').onclick = async () => {
        const methodId = readTrimmed('vmMethodId');
        const keyRef = readTrimmed('vmKeyRef');
        ensure(isMethodReference(methodId), 'Verification method id must be a DID URL or relative DID fragment reference.');
        ensure(keyRef.length > 0, 'Verification method keyRef is required.');
        await clickDid('/api/did/verification-methods', body({ methodId, keyRef }));
      };
      document.getElementById('vmUpdate').onclick = async () => {
        const methodId = readTrimmed('vmMethodId');
        const keyRef = readTrimmed('vmKeyRef');
        ensure(isMethodReference(methodId), 'Verification method id must be a DID URL or relative DID fragment reference.');
        ensure(keyRef.length > 0, 'Verification method keyRef is required.');
        await clickDid('/api/did/verification-methods/' + encodeURIComponent(methodId), {
          method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keyRef }),
        });
      };
      document.getElementById('vmRemove').onclick = async () => {
        const methodId = readTrimmed('vmMethodId');
        ensure(isMethodReference(methodId), 'Verification method id must be a DID URL or relative DID fragment reference.');
        await clickDid('/api/did/verification-methods/' + encodeURIComponent(methodId), { method: 'DELETE' });
      };

      document.getElementById('relAdd').onclick = async () => {
        const methodId = readTrimmed('relMethodId');
        const relation = document.getElementById('vmRelation').value;
        ensure(isMethodReference(methodId), 'Relation methodId must be a DID URL or relative DID fragment reference.');
        await clickDid('/api/did/relations', body({ methodId, relation }));
      };
      document.getElementById('relRemove').onclick = async () => {
        const methodId = readTrimmed('relMethodId');
        const relation = document.getElementById('vmRelation').value;
        ensure(isMethodReference(methodId), 'Relation methodId must be a DID URL or relative DID fragment reference.');
        await clickDid('/api/did/relations', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ methodId, relation }) });
      };

      document.getElementById('svcAdd').onclick = async () => {
        const id = readTrimmed('svcId');
        const type = readTrimmed('svcType');
        const serviceEndpoint = parseMaybeJson(document.getElementById('svcEndpoint').value);
        ensure(isServiceReference(id), 'Service id must be a DID URL or relative service reference.');
        ensure(type.length > 0, 'Service type is required.');
        ensure(validateServiceEndpoint(serviceEndpoint), 'Service endpoint must be an absolute URI, JSON object, or non-empty array of unique URI/object values.');
        await clickDid('/api/did/services', body({ id, type, serviceEndpoint }));
      };
      document.getElementById('svcUpdate').onclick = async () => {
        const id = readTrimmed('svcId');
        const type = readTrimmed('svcType');
        const serviceEndpoint = parseMaybeJson(document.getElementById('svcEndpoint').value);
        ensure(isServiceReference(id), 'Service id must be a DID URL or relative service reference.');
        ensure(type.length > 0, 'Service type is required.');
        ensure(validateServiceEndpoint(serviceEndpoint), 'Service endpoint must be an absolute URI, JSON object, or non-empty array of unique URI/object values.');
        await clickDid('/api/did/services/' + encodeURIComponent(id), {
          method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, serviceEndpoint }),
        });
      };
      document.getElementById('svcRemove').onclick = async () => {
        const id = readTrimmed('svcId');
        ensure(isServiceReference(id), 'Service id must be a DID URL or relative service reference.');
        await clickDid('/api/did/services/' + encodeURIComponent(id), { method: 'DELETE' });
      };

      document.getElementById('akaAdd').onclick = async () => {
        const value = readTrimmed('akaValue');
        ensure(isAbsoluteUri(value), 'alsoKnownAs must be an absolute URI.');
        await clickDid('/api/did/also-known-as', body({ value }));
      };
      document.getElementById('akaRemove').onclick = async () => {
        const value = readTrimmed('akaValue');
        ensure(isAbsoluteUri(value), 'alsoKnownAs must be an absolute URI.');
        await clickDid('/api/did/also-known-as', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value }) });
      };
    };

    window.addEventListener('load', async () => {
      await loadInitialState();
      attachWalletHandlers();
      if (currentPage === 'did') {
        attachDidHandlers();
        await refreshDidViews().catch(() => undefined);
      }
    });
  </script>
`;

const renderPage = (page: 'wallet' | 'did', title: string, intro: string, content: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>${styles}</style>
  </head>
  <body>
    <div class="shell">
      <section class="card hero">
        <div>
          <h1>Midnight DID Manager</h1>
          <p>${intro}</p>
          <p class="muted"><a href="/docs">Open API docs</a></p>
        </div>
        <div class="nav">
          <a href="/wallet" class="${page === 'wallet' ? 'active' : ''}">Wallet Setup</a>
          <a href="/did" class="${page === 'did' ? 'active' : ''}">DID Management</a>
          <span class="badge">Current setup: <strong id="setupProfileBadge">-</strong></span>
        </div>
      </section>
      ${content}
    </div>
    ${sharedScript(page)}
  </body>
</html>`;

export const walletPage = renderPage(
  'wallet',
  'Midnight DID Manager | Wallet',
  'Prepare the Midnight wallet for the configured backend setup and persist the shared seed/address before DID operations.',
  walletContent,
);

export const didPage = renderPage(
  'did',
  'Midnight DID Manager | DID',
  'Manage the DID only after the wallet has been prepared and unlocked for the configured backend setup.',
  didContent,
);
