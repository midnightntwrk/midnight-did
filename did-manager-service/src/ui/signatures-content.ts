export const signaturesContent = String.raw`
  <div class="layout">
    <section class="left">
      <div id="signaturesBanner" class="banner info"></div>
      <div class="card notice">
        <h2>Sign & Verify</h2>
        <p id="signaturesGateMessage">Loading active session and DID context...</p>
        <div class="value-list">
          <div class="value">
            <strong>Active DID</strong>
            <span id="signatureActiveDid" class="mono">-</span>
          </div>
          <div class="grid2">
            <div class="value">
              <strong>Published verification methods</strong>
              <span id="signaturePublishedMethodCount">0</span>
            </div>
            <div class="value">
              <strong>Local keys</strong>
              <span id="signatureLocalKeyCount">0</span>
            </div>
          </div>
        </div>
      </div>

      <fieldset id="signatureSignPanel" class="left" style="border:0;padding:0;margin:0;min-width:0;">
        <div class="card">
          <h2>Sign Payload</h2>
          <p>Signs the normalized payload with a local key that is already published in the active DID document.</p>
          <label>Available local keys</label>
          <select id="signKeyRefSelect">
            <option value="">Enter manually</option>
          </select>
          <label>keyRef</label>
          <input id="signKeyRef" class="mono" placeholder="local keyRef from Secret Storage" />
          <label>Payload type</label>
          <select id="signPayloadType">
            <option value="string">string</option>
            <option value="json">json</option>
            <option value="bytes">bytes</option>
          </select>
          <label>Payload</label>
          <textarea id="signPayload" class="mono" placeholder='{"hello":"midnight"}'></textarea>
          <p class="muted"><code>json</code> is canonicalized with RFC 8785 before signing. <code>bytes</code> expects lowercase or uppercase hex.</p>
          <div class="row wrap" style="margin-top:8px;">
            <button id="signPayloadButton" class="primary">Sign payload</button>
            <button id="copySignToVerify" class="secondary">Copy sign result to verify</button>
          </div>
        </div>
      </fieldset>

      <div class="card">
        <h2>Verify Payload</h2>
        <p>Verification can use the active local key, a supplied public JWK, or a verification method resolved from a Midnight DID document.</p>
        <label>Verification source</label>
        <select id="verifySource">
          <option value="didDocument">Midnight DID verification method</option>
          <option value="localKey">Local key</option>
          <option value="publicJwk">Public JWK</option>
        </select>

        <div id="verifySourceDidPanel">
          <label>Published verification methods</label>
          <select id="verifyVerificationMethodSelect">
            <option value="">Enter manually</option>
          </select>
          <label>verificationMethodId</label>
          <input id="verifyVerificationMethodId" class="mono" placeholder="did:midnight:...#key-1" />
        </div>

        <div id="verifySourceLocalPanel">
          <label>Available local keys</label>
          <select id="verifyKeyRefSelect">
            <option value="">Enter manually</option>
          </select>
          <label>keyRef</label>
          <input id="verifyKeyRef" class="mono" placeholder="local keyRef from Secret Storage" />
        </div>

        <div id="verifySourceJwkPanel">
          <label>publicJwk JSON</label>
          <textarea id="verifyPublicJwk" class="mono" placeholder='{"kty":"OKP","crv":"Ed25519","x":"..."}'></textarea>
        </div>

        <label>Payload type</label>
        <select id="verifyPayloadType">
          <option value="string">string</option>
          <option value="json">json</option>
          <option value="bytes">bytes</option>
        </select>
        <label>Payload</label>
        <textarea id="verifyPayload" class="mono" placeholder='{"hello":"midnight"}'></textarea>
        <label>Signature (base64url)</label>
        <textarea id="verifySignatureBase64Url" class="mono" placeholder="base64url detached signature"></textarea>
        <div class="row wrap" style="margin-top:8px;">
          <button id="verifyPayloadButton" class="primary">Verify payload</button>
        </div>
      </div>
    </section>

    <section class="right">
      <div class="card">
        <h2>Results</h2>
        <div class="tab-list" data-tab-group="signatures-result">
          <button id="tabSignResult" class="tab active" type="button" data-tab-group="signatures-result" data-tab="sign">Sign Result</button>
          <button id="tabVerifyResult" class="tab" type="button" data-tab-group="signatures-result" data-tab="verify">Verify Result</button>
          <button id="tabSignatureApi" class="tab" type="button" data-tab-group="signatures-result" data-tab="api">Last API Result</button>
        </div>
        <div class="tab-panel active" data-tab-group="signatures-result" data-tab-panel="sign"><pre id="signResult">{ "message": "No signature yet" }</pre></div>
        <div class="tab-panel" data-tab-group="signatures-result" data-tab-panel="verify"><pre id="verifyResult">{ "message": "No verification yet" }</pre></div>
        <div class="tab-panel" data-tab-group="signatures-result" data-tab-panel="api"><pre id="result">{ "message": "Sign & Verify page ready" }</pre></div>
      </div>

      <div class="card">
        <h2>Current DID Context</h2>
        <p>Use this as the source of truth for which verification methods are currently published on the active DID.</p>
        <div id="signaturePublishedMethods" class="op-log">
          <div class="op-log-item"><strong>Waiting for DID context</strong><p>Start a session and join or deploy a DID contract to load published methods.</p></div>
        </div>
      </div>
    </section>
  </div>
`;
