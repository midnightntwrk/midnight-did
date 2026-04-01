export const walletContent = String.raw`
  <div class="layout">
    <section class="left">
      <div id="walletBanner" class="banner info"></div>
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
        <h2>Wallet Context</h2>
        <div class="value-list">
          <div class="value"><strong>Session file</strong><span class="mono">Configured on backend</span></div>
          <div class="value"><strong>Seed continuity</strong><span id="walletSeedContinuity">The same seed will be reused for wallet + DID.</span></div>
          <div class="value"><strong>Known Midnight DID Contracts</strong><span id="walletKnownContracts" class="mono">-</span></div>
        </div>
      </div>

      <div class="card">
        <h2>Backend State</h2>
        <div class="indicator-grid">
          <div class="indicator"><strong>Connection</strong><span id="indicatorConnection" class="mono">-</span></div>
          <div class="indicator"><strong>DID loop</strong><span id="indicatorDid" class="mono">-</span></div>
          <div class="indicator"><strong>Current operation</strong><span id="indicatorOperation" class="mono">idle</span></div>
          <div class="indicator"><strong>Last refresh</strong><span id="indicatorRefresh" class="mono">-</span></div>
        </div>
        <label style="margin-top:10px;">Backend message</label>
        <pre id="backendStateDetails">{"message":"Waiting for first status refresh"}</pre>
      </div>

      <div class="card">
        <h2>Last API Result</h2>
        <pre id="result">{ "message": "Wallet page ready" }</pre>
      </div>
    </section>
  </div>
`;
