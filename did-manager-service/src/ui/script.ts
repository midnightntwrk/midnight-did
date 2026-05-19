export const sharedScript = (page: 'wallet' | 'secret-storage' | 'signatures' | 'did'): string => String.raw`
  <script>
    const currentPage = ${JSON.stringify(page)};
    const resultEl = document.getElementById('result');
    const didStateEl = document.getElementById('didState');
    const didDocEl = document.getElementById('didDocument');
    const signResultEl = document.getElementById('signResult');
    const verifyResultEl = document.getElementById('verifyResult');
    const fundingAddressEl = document.getElementById('fundingAddress');
    const faucetUrlEl = document.getElementById('faucetUrl');
    const faucetRowEl = document.getElementById('faucetRow');
    const fundingGuidanceEl = document.getElementById('fundingGuidance');
    const didActionsEl = document.getElementById('didActions');
    const didGateMessageEl = document.getElementById('didGateMessage');
    const seedModeEl = document.getElementById('seedMode');
    const seedEl = document.getElementById('seed');
    const profileSelectEl = document.getElementById('profileSelect');
    let sessionPollTimer = null;
    let operationPollTimer = null;
    let heartbeatTimer = null;
    let postOperationRefreshTimer = null;
    let lastSessionPayload = null;
    let lastOperationPayload = null;
    let lastContractsPayload = null;
    let lastOperationsPayload = null;
    let lastDidStatePayload = null;
    let lastDidDocumentPayload = null;
    let lastKeysPayload = null;
    let lastSignPayload = null;
    let lastVerifyPayload = null;
    let lastSignRequest = null;
    let lastStoredContractsSignature = null;
    let selectedStoredContractAddress = '';
    let lastDidRefreshAt = null;
    let postOperationRefreshCount = 0;
    let lastIndexedVersion = null;
    const uiEventLog = [];
    const seenOperationLogStates = new Set();

    const setJson = (el, value) => {
      if (el) el.textContent = JSON.stringify(value, null, 2);
    };
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value ?? '-';
    };
    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      if ('value' in el) {
        el.value = value ?? '';
        return;
      }
      if (el.tagName === 'A') {
        const anchor = el;
        const url = typeof value === 'string' ? value.trim() : '';
        if (url) {
          anchor.href = url;
          anchor.textContent = url;
          anchor.classList.remove('disabled');
        } else {
          anchor.removeAttribute('href');
          anchor.textContent = 'Unavailable for this setup';
          anchor.classList.add('disabled');
        }
      }
    };
    const setChecked = (id, checked) => {
      const el = document.getElementById(id);
      if (el && 'checked' in el) el.checked = Boolean(checked);
    };
    const parseMaybeJson = (value) => {
      const trimmed = (value || '').trim();
      if (!trimmed) return '';
      try { return JSON.parse(trimmed); } catch { return trimmed; }
    };
    const curveToKeyType = (curve) => curve === 'P-256' || curve === 'Jubjub' ? 'EC' : 'OKP';
    const contractAddressPattern = /^[0-9a-f]{64}$/;
    const hasUriScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
    const keyFragmentPattern = /^[A-Za-z0-9._:%-]+$/;
    const syncDerivedKeyType = () => {
      const curve = document.getElementById('keyCrv')?.value;
      const keyTypeEl = document.getElementById('keyKty');
      if (curve && keyTypeEl) keyTypeEl.value = curveToKeyType(curve);
    };
    const formatContracts = (values) =>
      Array.isArray(values) && values.length > 0 ? values.join(', ') : '-';
    const formatBalance = (value) => {
      if (value === null || value === undefined || value === '') return 'Unavailable';
      try {
        return BigInt(value).toLocaleString();
      } catch {
        return String(value);
      }
    };
    const formatDuration = (value) => {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '-';
      const totalSeconds = Math.floor(value / 1000);
      const seconds = totalSeconds % 60;
      const totalMinutes = Math.floor(totalSeconds / 60);
      const minutes = totalMinutes % 60;
      const hours = Math.floor(totalMinutes / 60);
      if (hours > 0) return hours + 'h ' + minutes + 'm ' + seconds + 's';
      if (minutes > 0) return minutes + 'm ' + seconds + 's';
      return seconds + 's';
    };
    const formatConnectionTiming = (connection) => {
      if (!connection) return '-';
      const elapsed = formatDuration(connection.phaseElapsedMs);
      const started = connection.phaseStartedAt ? 'since ' + new Date(connection.phaseStartedAt).toLocaleTimeString() : 'start unknown';
      return connection.phase + ' for ' + elapsed + ' (' + started + ')';
    };
    const setFundingUiForProfile = (profile) => {
      const normalized = String(profile || '').toLowerCase();
      if (faucetRowEl) {
        faucetRowEl.style.display = normalized === 'mainnet' ? 'none' : '';
      }
      if (fundingGuidanceEl) {
        if (normalized === 'mainnet') {
          fundingGuidanceEl.textContent =
            'Mainnet has no faucet. Use the same seed as your funded Midnight Wallet, then start the session.';
        } else if (normalized === 'preprod') {
          fundingGuidanceEl.textContent =
            'Use the same seed for the Midnight wallet and DID lifecycle. Preprod can be funded via faucet.';
        } else {
          fundingGuidanceEl.textContent =
            'Use the same seed for the Midnight wallet and DID lifecycle in this standalone environment.';
        }
      }
    };
    const formatWalletSessionState = (data) => {
      const connectionPhase = data?.connection?.phase || 'locked';
      if (data?.unlocked) return 'Ready';
      switch (connectionPhase) {
        case 'starting':
          return 'Starting';
        case 'restoring':
          return 'Restoring persisted state';
        case 'syncing':
          return 'Syncing';
        case 'waitingForFunds':
          return 'Waiting for funds';
        case 'configuringProviders':
          return 'Configuring providers';
        case 'joiningContract':
          return 'Joining DID contract';
        case 'error':
          return 'Failed';
        default:
          return 'Session closed';
      }
    };
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
    const readChecked = (id) => Boolean(document.getElementById(id)?.checked);
    const request = async (url, init = {}, options = {}) => {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => ({}));
      const out = { status: res.status, body };
      if (!options.silent) setJson(resultEl, out);
      return out;
    };
    const body = (obj) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) });
    const isTransitionalConnectionPhase = (phase) =>
      ['starting', 'restoring', 'syncing', 'waitingForFunds', 'configuringProviders', 'joiningContract'].includes(phase);
    const stopSessionPolling = () => {
      if (sessionPollTimer !== null) {
        clearInterval(sessionPollTimer);
        sessionPollTimer = null;
      }
    };
    const stopOperationPolling = () => {
      if (operationPollTimer !== null) {
        clearInterval(operationPollTimer);
        operationPollTimer = null;
      }
    };
    const stopHeartbeat = () => {
      if (heartbeatTimer !== null) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };
    const stopPostOperationRefresh = () => {
      if (postOperationRefreshTimer !== null) {
        clearInterval(postOperationRefreshTimer);
        postOperationRefreshTimer = null;
      }
      postOperationRefreshCount = 0;
    };
    const setStepState = (id, state) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('done', 'active');
      if (state === 'done') el.classList.add('done');
      if (state === 'active') el.classList.add('active');
    };
    const nowLabel = () => new Date().toLocaleTimeString();
    const formatEventTimestamp = (value) => new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const setBanner = (level, message) => {
      const bannerId = currentPage === 'did'
        ? 'didBanner'
        : currentPage === 'signatures'
          ? 'signaturesBanner'
          : 'walletBanner';
      const banner = document.getElementById(bannerId);
      if (!banner || !message) return;
      banner.className = 'banner open ' + level;
      banner.textContent = message;
    };
    const pushUiLog = (level, title, message, at = new Date().toISOString()) => {
      const key = level + '|' + title + '|' + message + '|' + at;
      if (uiEventLog.some((entry) => entry.key === key)) return;
      uiEventLog.unshift({ key, level, title, message, at });
      if (uiEventLog.length > 30) uiEventLog.length = 30;
    };
    const formatOperationMessage = (operation) => {
      const type = operation?.type || 'operation';
      if (operation?.status === 'running') return { level: 'info', title: type, message: 'Accepted and running.' };
      if (operation?.status === 'failed') return { level: 'error', title: type, message: operation?.error?.message || 'Failed.' };
      const result = operation?.result || {};
      switch (type) {
        case 'unlock':
          return {
            level: 'success',
            title: 'Start session',
            message: result?.status?.connection?.reusedPersistedState
              ? 'Session restored from persisted state.'
              : 'Session started.',
          };
        case 'deployDid':
          return { level: 'success', title: 'deployDid', message: result?.contractAddress ? 'DID contract deployed: ' + result.contractAddress : 'DID contract deployed.' };
        case 'joinDid':
          return { level: 'success', title: 'joinDid', message: result?.contractAddress ? 'DID contract joined: ' + result.contractAddress : 'DID contract joined.' };
        case 'generateKey':
          return { level: 'success', title: 'generateKey', message: result?.keyRef ? 'Key generated: ' + result.keyRef : 'Key generated.' };
        case 'addVerificationMethod':
          return { level: 'success', title: 'addVerificationMethod', message: 'Verification method added.' };
        case 'updateVerificationMethod':
          return { level: 'success', title: 'updateVerificationMethod', message: 'Verification method updated.' };
        case 'removeVerificationMethod':
          return { level: 'success', title: 'removeVerificationMethod', message: 'Verification method removed.' };
        case 'addRelation':
          return { level: 'success', title: 'addRelation', message: 'Verification method relation added.' };
        case 'removeRelation':
          return { level: 'success', title: 'removeRelation', message: 'Verification method relation removed.' };
        case 'addService':
          return { level: 'success', title: 'addService', message: 'Service added.' };
        case 'updateService':
          return { level: 'success', title: 'updateService', message: 'Service updated.' };
        case 'removeService':
          return { level: 'success', title: 'removeService', message: 'Service removed.' };
        case 'addAlsoKnownAs':
          return { level: 'success', title: 'addAlsoKnownAs', message: 'Alias added.' };
        case 'removeAlsoKnownAs':
          return { level: 'success', title: 'removeAlsoKnownAs', message: 'Alias removed.' };
        case 'deactivateDid':
          return { level: 'warn', title: 'deactivateDid', message: 'DID deactivated.' };
        default:
          return { level: operation?.status === 'failed' ? 'error' : 'success', title: type, message: operation?.status === 'succeeded' ? 'Completed.' : 'Updated.' };
      }
    };
    const renderOperationLog = () => {
      const container = document.getElementById('operationLog');
      if (!container) return;
      for (const operation of lastOperationsPayload?.data || []) {
        const stamp = operation.completedAt || operation.submittedAt;
        const key = operation.id + ':' + operation.status;
        if (!seenOperationLogStates.has(key)) {
          const formatted = formatOperationMessage(operation);
          pushUiLog(formatted.level, formatted.title, formatted.message, stamp);
          seenOperationLogStates.add(key);
        }
      }
      const top = [...uiEventLog].sort((left, right) => (right.at || '').localeCompare(left.at || '')).slice(0, 10);
      container.innerHTML = top.length === 0
        ? '<div class="op-log-item"><strong>Waiting for activity</strong><p>No operations recorded yet.</p></div>'
        : top.map((entry) => (
          '<div class="op-log-item">'
            + '<strong>' + entry.title + '</strong>'
            + '<p>' + entry.message + '</p>'
            + '<small>' + formatEventTimestamp(entry.at) + '</small>'
          + '</div>'
        )).join('');
    };
    const setOptions = (id, values, placeholder, labelFn = (value) => value) => {
      const select = document.getElementById(id);
      if (!select) return;
      const current = select.value;
      select.innerHTML = '<option value="">' + placeholder + '</option>';
      for (const value of values) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = labelFn(value);
        select.appendChild(option);
      }
      if (values.includes(current)) select.value = current;
    };
    const setDiagnosticsSummary = () => {
      const operation = lastOperationPayload?.data || lastOperationPayload;
      setText('diagOperation', !operation ? 'idle' : operation.type + ' · ' + operation.status);
      setText('diagIndexer', lastDidRefreshAt ? 'Last refreshed at ' + lastDidRefreshAt : 'Waiting for first DID refresh');
    };
    const activateTab = (groupName, tabName) => {
      for (const button of document.querySelectorAll('.tab[data-tab-group="' + groupName + '"]')) {
        button.classList.toggle('active', button.dataset.tab === tabName);
      }
      for (const panel of document.querySelectorAll('.tab-panel[data-tab-group="' + groupName + '"]')) {
        panel.classList.toggle('active', panel.dataset.tabPanel === tabName);
      }
    };
    const isDidContextPage = () => currentPage === 'did' || currentPage === 'signatures';
    const setSignatureSourcePanels = () => {
      const source = document.getElementById('verifySource')?.value || 'didDocument';
      const visibility = {
        verifySourceDidPanel: source === 'didDocument',
        verifySourceLocalPanel: source === 'localKey',
        verifySourceJwkPanel: source === 'publicJwk',
      };
      for (const [id, visible] of Object.entries(visibility)) {
        const el = document.getElementById(id);
        if (el) el.style.display = visible ? '' : 'none';
      }
    };
    const setSignaturePageState = () => {
      const doc = lastDidDocumentPayload?.data?.didDocument;
      const methods = Array.isArray(doc?.verificationMethod) ? doc.verificationMethod : [];
      const keys = Array.isArray(lastKeysPayload?.data) ? lastKeysPayload.data : [];
      setText('signatureActiveDid', doc?.id || '-');
      setText('signaturePublishedMethodCount', String(methods.length));
      setText('signatureLocalKeyCount', String(keys.length));
      const listEl = document.getElementById('signaturePublishedMethods');
      if (listEl) {
        listEl.innerHTML = methods.length === 0
          ? '<div class="op-log-item"><strong>No published verification methods</strong><p>Publish a verification method on the DID Management tab before signing with it.</p></div>'
          : methods.map((entry) => (
            '<div class="op-log-item">'
              + '<strong class="mono">' + (entry.id || 'unknown') + '</strong>'
              + '<div class="contract-meta">'
              + ['kty=' + (entry.publicKeyJwk?.kty || '?'), 'curve=' + (entry.publicKeyJwk?.crv || '?')]
                .map((value) => '<span>' + value + '</span>')
                .join('')
              + '</div>'
            + '</div>'
          )).join('');
      }
      const session = lastSessionPayload?.data?.status || lastSessionPayload?.data || lastSessionPayload;
      const signPanel = document.getElementById('signatureSignPanel');
      const signReady = Boolean(session?.unlocked && session?.did?.phase === 'joined' && methods.length > 0);
      if (signPanel) {
        signPanel.disabled = !signReady;
        signPanel.classList.toggle('gated', !signReady);
      }
      const gateEl = document.getElementById('signaturesGateMessage');
      if (gateEl) {
        gateEl.textContent = signReady
          ? 'The active DID can sign with any local key that is already published as a verification method.'
          : !session?.unlocked
            ? 'Start a session first. Verification by DID document remains available without a local signing session.'
            : session?.did?.phase !== 'joined'
              ? 'Deploy or join a DID contract before signing with DID-associated keys.'
              : 'Publish at least one verification method before signing.';
      }
    };
    const setSignatureResultState = (kind, payload) => {
      if (kind === 'sign') {
        lastSignPayload = payload;
        setJson(signResultEl, payload?.data || payload);
      } else {
        lastVerifyPayload = payload;
        setJson(verifyResultEl, payload?.data || payload);
      }
    };
    const setBackendIndicators = () => {
      const session = lastSessionPayload?.data?.status || lastSessionPayload?.data || lastSessionPayload;
      const operation = lastOperationPayload?.data || lastOperationPayload;
      const connectionPhase = session?.connection?.phase || 'locked';
      const didPhase = session?.did?.phase || 'none';
      const operationLabel = !operation
        ? 'idle'
        : operation.status === 'running'
          ? operation.type + ' · running'
          : operation.status === 'failed'
            ? operation.type + ' · failed'
            : operation.type + ' · succeeded';
      setText('indicatorConnection', formatConnectionTiming(session?.connection));
      setText('indicatorDid', didPhase);
      setText('indicatorOperation', operationLabel);
      setText('indicatorRefresh', lastDidRefreshAt || nowLabel());
      setJson(document.getElementById('backendStateDetails'), {
        connection: session?.connection || null,
        did: session?.did || null,
        contracts: lastContractsPayload?.data || null,
        currentOperation: operation || null,
      });
      setDiagnosticsSummary();
    };

    const setDisabled = (id, disabled) => {
      const el = document.getElementById(id);
      if (el && 'disabled' in el) {
        el.disabled = Boolean(disabled);
      }
    };

    const updateSeedModeAvailability = () => {
      if (!seedModeEl) return;
      const session = lastSessionPayload?.data?.status || lastSessionPayload?.data || lastSessionPayload;
      const canReuse = Boolean(session?.seedAvailable);
      const reuseOption = seedModeEl.querySelector('option[value="reuse"]');
      if (reuseOption) {
        reuseOption.disabled = !canReuse;
        reuseOption.title = canReuse
          ? 'Reuse the stored profile seed.'
          : 'Available after this profile has a prepared seed.';
      }
      if (!canReuse && seedModeEl.value === 'reuse') {
        seedModeEl.value = 'generated';
      }
      const seedModeHintEl = document.getElementById('seedModeHint');
      if (seedModeHintEl) {
        seedModeHintEl.textContent = canReuse
          ? 'Reuse is available for this profile because a shared seed is stored.'
          : 'This profile is new. Choose generated or provided, then click Prepare funding.';
      }
    };

    const updateWalletActionState = () => {
      const session = lastSessionPayload?.data?.status || lastSessionPayload?.data || lastSessionPayload;
      const operation = lastOperationPayload?.data || lastOperationPayload;
      const running = operation?.status === 'running';
      const unlocked = Boolean(session?.unlocked);
      const seedMode = seedModeEl?.value || 'reuse';
      const seedValue = readTrimmed('seed');
      const hasFundingAddress = Boolean((fundingAddressEl?.value || '').trim());
      const fundingPrepared = Boolean(session?.fundingPrepared);

      setDisabled('prepareFunding', running || (seedMode === 'provided' && seedValue.length === 0));
      setDisabled('startSession', running || unlocked || !fundingPrepared);
      setDisabled('closeSession', !running && !unlocked);
      setDisabled('copyFundingAddress', !hasFundingAddress);
      setDisabled('selectProfile', running || unlocked);
      setDisabled('refreshProfiles', running || unlocked);
      setDisabled('profileSelect', running || unlocked);
      setDisabled('profileName', running || unlocked);
      setDisabled('seedMode', running || unlocked);
      setDisabled('seed', running || unlocked);
      setDisabled('passphrase', running || unlocked);
      setDisabled('remember', running || unlocked);
      setDisabled('status', running);
    };

    const updateSecretStorageActionState = () => {
      const session = lastSessionPayload?.data?.status || lastSessionPayload?.data || lastSessionPayload;
      const operation = lastOperationPayload?.data || lastOperationPayload;
      const running = operation?.status === 'running';
      const unlocked = Boolean(session?.unlocked);
      const disabled = running || !unlocked;
      setDisabled('keyId', disabled);
      setDisabled('keyCrv', disabled);
      setDisabled('keyPrivate', disabled);
      setDisabled('keyRefDelete', disabled);
      setDisabled('keyGenerate', disabled);
      setDisabled('keyImport', disabled);
      setDisabled('keyDelete', disabled);
      setDisabled('keyList', disabled);
    };

    const updateDidActionState = () => {
      const session = lastSessionPayload?.data?.status || lastSessionPayload?.data || lastSessionPayload;
      const operation = lastOperationPayload?.data || lastOperationPayload;
      const running = operation?.status === 'running';
      const unlocked = Boolean(session?.unlocked);
      if (didActionsEl) {
        didActionsEl.disabled = !unlocked || running;
        didActionsEl.classList.toggle('gated', !unlocked || running);
      }
    };

    const updateSignatureActionState = () => {
      const session = lastSessionPayload?.data?.status || lastSessionPayload?.data || lastSessionPayload;
      const operation = lastOperationPayload?.data || lastOperationPayload;
      const running = operation?.status === 'running';
      const verifySource = document.getElementById('verifySource')?.value || 'didDocument';
      const signReady = Boolean(session?.unlocked && session?.did?.phase === 'joined');
      const hasSignInput = readTrimmed('signKeyRef').length > 0 && document.getElementById('signPayload')?.value.length > 0;
      const hasVerifyCommonInput = document.getElementById('verifyPayload')?.value.length > 0
        && readTrimmed('verifySignatureBase64Url').length > 0;
      const hasVerifySourceInput =
        (verifySource === 'localKey' && readTrimmed('verifyKeyRef').length > 0 && Boolean(session?.unlocked)) ||
        (verifySource === 'publicJwk' && readTrimmed('verifyPublicJwk').length > 0) ||
        (verifySource === 'didDocument' && readTrimmed('verifyVerificationMethodId').length > 0);

      setDisabled('signKeyRefSelect', running || !signReady);
      setDisabled('signKeyRef', running || !signReady);
      setDisabled('signPayloadType', running || !signReady);
      setDisabled('signPayload', running || !signReady);
      setDisabled('signPayloadButton', running || !signReady || !hasSignInput);
      setDisabled('copySignToVerify', !lastSignPayload?.data && !lastSignPayload);

      setDisabled('verifySource', running);
      setDisabled('verifyVerificationMethodSelect', running || verifySource !== 'didDocument');
      setDisabled('verifyVerificationMethodId', running || verifySource !== 'didDocument');
      setDisabled('verifyKeyRefSelect', running || verifySource !== 'localKey' || !session?.unlocked);
      setDisabled('verifyKeyRef', running || verifySource !== 'localKey' || !session?.unlocked);
      setDisabled('verifyPublicJwk', running || verifySource !== 'publicJwk');
      setDisabled('verifyPayloadType', running);
      setDisabled('verifyPayload', running);
      setDisabled('verifySignatureBase64Url', running);
      setDisabled('verifyPayloadButton', running || !hasVerifyCommonInput || !hasVerifySourceInput);

      setSignatureSourcePanels();
    };

    const updateActionState = () => {
      updateSeedModeAvailability();
      updateWalletActionState();
      updateSecretStorageActionState();
      updateDidActionState();
      updateSignatureActionState();
    };

    const setSetupState = (payload) => {
      const data = payload?.data || payload;
      setText('setupProfile', data?.profile || '-');
      setText('setupProfileBadge', data?.profile || '-');
      setText('setupNode', data?.endpoints?.node || '-');
      setText('setupIndexer', data?.endpoints?.indexer || '-');
      setText('setupProofServer', data?.endpoints?.proofServer || '-');
      setText('profileBadgeText', data?.profile || '-');
      if (faucetUrlEl) {
        const currentFaucetText = faucetUrlEl.textContent || '';
        if (!currentFaucetText || currentFaucetText === 'Unavailable for this setup') {
          setValue('faucetUrl', data?.faucetUrl || '');
        }
      }
      setFundingUiForProfile(data?.profile);
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
      updateWalletActionState();
    };

    const setSessionState = (payload) => {
      lastSessionPayload = payload;
      const data = payload?.data?.status || payload?.data || payload;
      setValue('fundingAddress', data?.unshieldedAddress || '');
      setValue('faucetUrl', data?.faucetUrl || '');
      setFundingUiForProfile(data?.profile);
      setChecked('remember', data?.rememberUnlockedSession ?? true);
      const connectionPhase = data?.connection?.phase || 'locked';
      setText('setupProfileName', data?.profileName || '-');
      setText('setupFundingAddress', data?.unshieldedAddress || '-');
      setText('walletKnownContracts', formatContracts(data?.knownContractAddresses));
      setText('walletNightBalance', formatBalance(data?.walletBalances?.night));
      setText('walletDustBalance', formatBalance(data?.walletBalances?.dust));
      setText('walletConnectionTiming', formatConnectionTiming(data?.connection));
      setText('profileBadgeText', data?.profileName ? data.profile + ' / ' + data.profileName : data?.profile || '-');
      setText('profileAvatar', (data?.profileName || data?.profile || '-').slice(0, 2).toUpperCase());
      const knownContractsSummary = document.getElementById('knownContractsSummary');
      if (knownContractsSummary) {
        knownContractsSummary.textContent = Array.isArray(data?.knownContractAddresses) && data.knownContractAddresses.length > 0
          ? 'Known contracts for this setup: ' + data.knownContractAddresses.join(', ')
          : 'Stored contracts from this setup will appear here.';
      }
      setText(
        'walletSeedContinuity',
        data?.fundingPrepared
          ? 'Shared seed and prepared funding address are available for this profile.'
          : data?.seedAvailable
            ? 'A shared seed is stored, but funding is not prepared. Click Prepare funding.'
            : 'No shared seed prepared yet. Generate or provide one first.',
      );

      updateDidActionState();
      if (didGateMessageEl) {
        const operation = lastOperationPayload?.data || lastOperationPayload;
        const running = operation?.status === 'running';
        didGateMessageEl.textContent = !data?.unlocked
          ? 'Session is not started for the current setup. Go to Wallet Setup first.'
          : running
            ? 'A backend operation is running. DID controls are temporarily read-only.'
            : 'Session is started. DID management is available for the current setup.';
      }
      const badge = document.getElementById('walletStatusBadge');
      if (badge) {
        const connectionElapsed = formatDuration(data?.connection?.phaseElapsedMs);
        const connectionElapsedSuffix = connectionElapsed === '-' ? '' : ' for ' + connectionElapsed;
        badge.textContent = data?.unlocked
          ? 'Wallet session is ready for DID operations'
          : connectionPhase === 'error'
            ? 'Wallet session failed: ' + (data?.connection?.lastError || 'check session status')
            : isTransitionalConnectionPhase(connectionPhase)
                ? 'Wallet session is ' + formatWalletSessionState(data).toLowerCase()
                  + connectionElapsedSuffix
                  + (connectionPhase === 'syncing' ? '. Preprod/mainnet restores can take several minutes.' : '')
                : data?.fundingPrepared
                ? 'Funding prepared, start-session pending'
                : data?.seedAvailable
                ? 'Seed selected, prepare-funding pending'
                : 'No wallet prepared yet';
        badge.className = data?.unlocked ? 'status ok' : 'status warn';
      }

      if (data?.unlocked) {
        setStepState('stepPrepare', 'done');
        setStepState('stepFund', 'done');
        setStepState('stepUnlock', 'done');
      } else if (isTransitionalConnectionPhase(connectionPhase)) {
        setStepState('stepPrepare', 'done');
        setStepState('stepFund', 'done');
        setStepState('stepUnlock', 'active');
      } else if (data?.fundingPrepared) {
        setStepState('stepPrepare', 'done');
        setStepState('stepFund', 'active');
        setStepState('stepUnlock', '');
      } else if (data?.seedAvailable) {
        setStepState('stepPrepare', 'active');
        setStepState('stepFund', '');
        setStepState('stepUnlock', '');
      } else {
        setStepState('stepPrepare', 'active');
        setStepState('stepFund', '');
        setStepState('stepUnlock', '');
      }

      if (isTransitionalConnectionPhase(connectionPhase)) {
        if (sessionPollTimer === null) {
          sessionPollTimer = setInterval(async () => {
            const response = await request('/api/session', {}, { silent: true });
            setSessionState(response.body);
          }, 2_000);
        }
      } else {
        stopSessionPolling();
      }
      if (data?.unlocked && data?.connection?.reusedPersistedState) {
        setBanner('info', 'Wallet session restored from persisted state.');
      }
      renderNextActions();
      setSignaturePageState();
      setBackendIndicators();
      updateActionState();
    };

    const setStoredContractsState = (payload) => {
      lastContractsPayload = payload;
      const contracts = payload?.data || [];
      const signature = JSON.stringify(contracts.map((entry) => ({
        address: entry.address,
        selected: entry.selected,
        available: entry.available,
        deactivated: entry.deactivated,
        version: entry.version,
        operationCount: entry.operationCount,
        message: entry.message,
      })));
      const selectEl = document.getElementById('contractAddressSelect');
      if (selectEl) {
        const available = contracts.filter((entry) => entry.available === true);
        const joinedAddress = contracts.find((entry) => entry.selected === true)?.address || '';
        const manualAddress = document.getElementById('contractAddress')?.value || '';
        const current = selectedStoredContractAddress || manualAddress || joinedAddress || '';
        const shouldRebuild = signature !== lastStoredContractsSignature && document.activeElement !== selectEl;
        if (shouldRebuild) {
          selectEl.innerHTML = '';
          const placeholder = document.createElement('option');
          placeholder.value = '';
          placeholder.textContent = available.length > 0 ? 'Select an available stored contract' : 'No available stored contracts';
          selectEl.appendChild(placeholder);
          for (const entry of available) {
            const option = document.createElement('option');
            option.value = entry.address;
            option.textContent = entry.selected ? entry.address + ' (current)' : entry.address;
            selectEl.appendChild(option);
          }
          if (available.some((entry) => entry.address === current)) {
            selectEl.value = current;
            selectedStoredContractAddress = current;
          } else if (joinedAddress && available.some((entry) => entry.address === joinedAddress)) {
            selectEl.value = joinedAddress;
            selectedStoredContractAddress = joinedAddress;
          } else {
            selectEl.value = '';
          }
        }
      }
      const listEl = document.getElementById('storedContractStatusList');
      if (listEl) {
        listEl.innerHTML = '';
        for (const entry of contracts) {
          const item = document.createElement('div');
          item.className = 'contract-chip ' + (entry.available === true ? 'active' : entry.available === false ? 'missing' : '');
          const meta = [];
          if (entry.selected) meta.push('current');
          if (entry.available === true) meta.push('available');
          if (entry.available === false) meta.push('missing');
          if (entry.deactivated === true) meta.push('deactivated');
          if (entry.version !== null && entry.version !== undefined) meta.push('v=' + entry.version);
          if (entry.operationCount !== null && entry.operationCount !== undefined) meta.push('ops=' + entry.operationCount);
          item.innerHTML = '<span class="mono">' + entry.address + '</span>'
            + '<div class="contract-meta">' + meta.map((value) => '<span>' + value + '</span>').join('') + '</div>'
            + (entry.message ? '<div class="muted">' + entry.message + '</div>' : '');
          listEl.appendChild(item);
        }
      }
      lastStoredContractsSignature = signature;
      renderNextActions();
      setBackendIndicators();
    };

    const setKeysState = (payload) => {
      lastKeysPayload = payload;
      const keys = payload?.data || [];
      const keyRefs = keys.map((entry) => entry.keyRef).filter(Boolean);
      setOptions('vmKeyRefSelect', keyRefs, 'Enter manually');
      setOptions('signKeyRefSelect', keyRefs, 'Enter manually');
      setOptions('verifyKeyRefSelect', keyRefs, 'Enter manually');
      const keyListEl = document.getElementById('secretStorageKeyList');
      if (keyListEl) {
        keyListEl.innerHTML = keys.length === 0
          ? '<div class="op-log-item"><strong>No keys stored</strong><p>Generate or import a key to make it available for DID operations.</p></div>'
          : keys.map((entry) => (
            '<div class="op-log-item">'
              + '<strong>' + (entry.keyRef || 'unknown') + '</strong>'
              + '<div class="contract-meta">'
                + [entry.id ? 'id=' + entry.id : null, entry.kty ? 'type=' + entry.kty : null, entry.crv ? 'curve=' + entry.crv : null]
                  .filter(Boolean)
                  .map((value) => '<span>' + value + '</span>')
                  .join('')
              + '</div>'
            + '</div>'
          )).join('');
      }
      setSignaturePageState();
      updateActionState();
    };

    const syncDidSelectors = () => {
      const doc = lastDidDocumentPayload?.data?.didDocument;
      const methods = Array.isArray(doc?.verificationMethod) ? doc.verificationMethod : [];
      const services = Array.isArray(doc?.service) ? doc.service : [];
      const aliases = Array.isArray(doc?.alsoKnownAs) ? doc.alsoKnownAs : [];
      const methodIds = methods.map((entry) => entry.id).filter(Boolean);
      const serviceIds = services.map((entry) => entry.id).filter(Boolean);
      setOptions('vmMethodSelect', methodIds, 'Enter manually');
      setOptions('relMethodSelect', methodIds, 'Select a verification method');
      setOptions('verifyVerificationMethodSelect', methodIds, 'Enter manually');
      setOptions('svcSelect', serviceIds, 'Enter manually');
      setOptions('akaSelect', aliases, 'Enter manually');
      setSignaturePageState();
      updateActionState();
    };

    const renderNextActions = () => {
      const container = document.getElementById('nextActions');
      if (!container) return;
      const session = lastSessionPayload?.data?.status || lastSessionPayload?.data || lastSessionPayload;
      const didState = lastDidStatePayload?.data?.didState;
      const contracts = lastContractsPayload?.data || [];
      const actions = [];

      if (!session?.unlocked) {
        actions.push({ title: 'Start session', rationale: 'DID operations remain unavailable until the wallet session is ready.', action: 'goto-wallet' });
      } else if (session?.connection?.phase !== 'ready') {
        actions.push({ title: 'Wait for connection', rationale: 'The wallet session is not fully ready yet: ' + (session?.connection?.phase || 'unknown') + '.' });
      }

      const availableContract = contracts.find((entry) => entry.available === true && entry.selected !== true);
      if (session?.unlocked && session?.did?.phase !== 'joined') {
        if (session?.contractAddress) {
          actions.push({ title: 'Join current contract', rationale: 'A stored contract is available for this profile but is not joined in the current session.', action: 'join-current-contract' });
        } else if (availableContract) {
          actions.push({ title: 'Join stored contract', rationale: 'A validated contract is available on the active network.', action: 'join-stored-contract' });
        } else {
          actions.push({ title: 'Deploy DID contract', rationale: 'No joined DID is available yet for this session.', action: 'deploy-contract' });
        }
      }

      if (didState && !didState.deactivated) {
        if ((didState.verificationMethods?.length || 0) === 0) {
          actions.push({ title: 'Open Secret Storage', rationale: 'Create or import a local key before publishing the first verification method.', action: 'goto-secret-storage' });
          actions.push({ title: 'Add verification method', rationale: 'Publish the first verification method after generating or importing a key.', action: 'focus-add-method' });
        } else if ((didState.authenticationRelation?.length || 0) === 0) {
          actions.push({ title: 'Add authentication relation', rationale: 'Existing methods are present, but none are bound to authentication.', action: 'add-auth-relation' });
        }
        if ((didState.services?.length || 0) === 0) {
          actions.push({ title: 'Add service', rationale: 'Publish a service endpoint so relying parties can discover your app endpoints.', action: 'focus-add-service' });
        }
      }

      if (didState?.deactivated) {
        actions.length = 0;
        actions.push({ title: 'Join or deploy another contract', rationale: 'This DID is deactivated. Further updates are terminally blocked.', action: 'join-stored-contract' });
      }

      container.innerHTML = actions.length === 0
        ? '<div class="hint-item"><strong>No pending actions</strong><p>The current session looks complete. Use the forms below for additional edits.</p></div>'
        : actions.slice(0, 5).map((entry) => (
          '<div class="hint-item"><strong>' + entry.title + '</strong><p>' + entry.rationale + '</p>'
            + (entry.action ? '<div class="hint-actions"><button type="button" class="secondary" data-next-action="' + entry.action + '">Do this</button></div>' : '')
          + '</div>'
        )).join('');
    };

    const setDidSummary = (payload) => {
      lastDidStatePayload = payload;
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
        renderNextActions();
        return;
      }
      setText('didSummaryContract', data?.contractAddress || '-');
      setText('didSummaryStatus', state.deactivated ? 'Deactivated' : state.active ? 'Active' : 'Inactive');
      setText('didSummaryVersion', String(state.version ?? '-'));
      setText('didSummaryOperations', String(state.operationCount ?? '-'));
      setText('didSummaryMethods', String(state.verificationMethods?.length ?? 0));
      setText('didSummaryServices', String(state.services?.length ?? 0));
      setText('didSummaryAliases', String(state.alsoKnownAs?.length ?? 0));
      if (state.version !== undefined && state.version !== null) {
        const versionKey = String(state.version) + '|' + String(state.updated || '');
        if (versionKey !== lastIndexedVersion && lastIndexedVersion !== null) {
          pushUiLog('info', 'indexed', 'DID state indexed at version ' + String(state.version) + '.', new Date().toISOString());
          setBanner('info', 'DID state refreshed from the indexer.');
          renderOperationLog();
        }
        lastIndexedVersion = versionKey;
      }
      renderNextActions();
    };

    const refreshDidContext = async () => {
      const state = await request('/api/did/state', {}, { silent: true });
      setJson(didStateEl, state.body);
      setDidSummary(state.body);
      const doc = await request('/api/did/document', {}, { silent: true });
      lastDidDocumentPayload = doc.body;
      setJson(didDocEl, doc.body);
      const keys = await request('/api/keys', {}, { silent: true });
      setKeysState(keys.body);
      syncDidSelectors();
      const contracts = await request('/api/contracts', {}, { silent: true });
      setStoredContractsState(contracts.body);
      lastDidRefreshAt = nowLabel();
      setBackendIndicators();
      setSignaturePageState();
      updateActionState();
    };

    const setOperationState = (payload) => {
      lastOperationPayload = payload;
      const operation = payload?.data || payload;
      if (operation?.status && operation?.type) {
        const formatted = formatOperationMessage(operation);
        setBanner(formatted.level, formatted.message);
      }
      setBackendIndicators();
      updateActionState();
    };

    const setOperationsState = (payload) => {
      lastOperationsPayload = payload;
      renderOperationLog();
      setBackendIndicators();
    };

    const shouldRefreshDidState = () => {
      const session = lastSessionPayload?.data?.status || lastSessionPayload?.data || lastSessionPayload;
      if (!isDidContextPage()) return false;
      if (!session?.unlocked) return false;
      if (session?.did?.phase === 'joined') return true;
      return false;
    };

    const startPostOperationRefresh = () => {
      stopPostOperationRefresh();
      if (!shouldRefreshDidState()) return;
      postOperationRefreshTimer = setInterval(async () => {
        postOperationRefreshCount += 1;
        await refreshDidContext().catch(() => undefined);
        if (postOperationRefreshCount >= 10) {
          stopPostOperationRefresh();
        }
      }, 3_000);
    };

    const heartbeat = async () => {
      const session = await request('/api/session', {}, { silent: true });
      setSessionState(session.body);
      const operation = await request('/api/operations/current', {}, { silent: true });
      setOperationState(operation.body);
      const operations = await request('/api/operations', {}, { silent: true });
      setOperationsState(operations.body);
      if (currentPage === 'secret-storage') {
        const keys = await request('/api/keys', {}, { silent: true });
        setKeysState(keys.body);
      }
      if (shouldRefreshDidState()) {
        await refreshDidContext().catch(() => undefined);
      } else if (currentPage === 'did') {
        const contracts = await request('/api/contracts', {}, { silent: true });
        setStoredContractsState(contracts.body);
      } else if (currentPage === 'signatures') {
        const sessionData = session.body?.data?.status || session.body?.data || session.body;
        if (sessionData?.unlocked) {
          const keys = await request('/api/keys', {}, { silent: true });
          setKeysState(keys.body);
        } else {
          setSignaturePageState();
        }
      }
    };

    const startHeartbeat = () => {
      stopHeartbeat();
      heartbeatTimer = setInterval(() => {
        heartbeat().catch(() => undefined);
      }, 4_000);
    };

    const pollOperation = async (operationId, onComplete) => {
      stopOperationPolling();
      const poll = async () => {
      const response = await request('/api/operations/' + encodeURIComponent(operationId), {}, { silent: true });
      const operation = response.body?.data;
      setOperationState(response.body);
      const operations = await request('/api/operations', {}, { silent: true });
      setOperationsState(operations.body);
      setJson(resultEl, response);
      if (!operation || operation.status === 'running') return;
      stopOperationPolling();
      const session = await request('/api/session', {}, { silent: true });
      setSessionState(session.body);
        if (isDidContextPage()) {
          await refreshDidContext().catch(() => undefined);
          startPostOperationRefresh();
        }
        if (typeof onComplete === 'function') onComplete(operation);
      };
      await poll();
      operationPollTimer = setInterval(poll, 1_500);
    };

    const loadInitialState = async () => {
      const setup = await request('/api/setup', {}, { silent: true });
      setSetupState(setup.body);
      const profiles = await request('/api/profiles', {}, { silent: true });
      setProfilesState(profiles.body);
      const session = await request('/api/session', {}, { silent: true });
      setSessionState(session.body);
      const operation = await request('/api/operations/current', {}, { silent: true });
      setOperationState(operation.body);
      const operations = await request('/api/operations', {}, { silent: true });
      setOperationsState(operations.body);
      if (currentPage === 'secret-storage') {
        const keys = await request('/api/keys', {}, { silent: true });
        setKeysState(keys.body);
      }
      if (currentPage === 'signatures') {
        const sessionData = session.body?.data?.status || session.body?.data || session.body;
        if (sessionData?.unlocked) {
          const keys = await request('/api/keys', {}, { silent: true });
          setKeysState(keys.body);
        } else {
          setSignaturePageState();
        }
      }
      if (operation.body?.data?.status === 'running') {
        await pollOperation(operation.body.data.id);
      }
      setJson(resultEl, session);
    };

    const attachWalletHandlers = () => {
      if (seedModeEl) {
        seedModeEl.addEventListener('change', () => {
          updateActionState();
        });
      }
      seedEl?.addEventListener('input', updateActionState);
      document.getElementById('remember')?.addEventListener('change', updateActionState);

      const applyGeneratedSeedResult = (generatedSeed) => {
        if (!generatedSeed) return;
        if (seedEl) seedEl.value = generatedSeed;
        if (seedModeEl) {
          seedModeEl.value = 'provided';
        }
        setBanner('info', 'Generated seed captured and switched to provided mode for consistent session start.');
        updateActionState();
      };

      const selectProfile = document.getElementById('selectProfile');
      if (selectProfile) {
        selectProfile.onclick = async () => {
          const name = readTrimmed('profileName') || profileSelectEl?.value || 'default';
          const response = await request('/api/profiles/select', body({ name }));
          const profiles = await request('/api/profiles', {}, { silent: true });
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

      const popoverToggle = document.getElementById('profilePopoverToggle');
      const popover = document.getElementById('profilePopover');
      const popoverBackdrop = document.getElementById('profilePopoverBackdrop');
      const togglePopover = (open) => {
        popover?.classList.toggle('open', open);
        popoverBackdrop?.classList.toggle('open', open);
      };
      popoverToggle?.addEventListener('click', () => {
        togglePopover(!popover?.classList.contains('open'));
      });
      popoverBackdrop?.addEventListener('click', () => togglePopover(false));

      const startSession = document.getElementById('startSession');
      if (startSession) {
        startSession.onclick = async () => {
          const response = await request('/api/session/start', body({
            seedMode: document.getElementById('seedMode').value,
            seed: document.getElementById('seed').value || undefined,
            passphrase: document.getElementById('passphrase').value || undefined,
            rememberUnlockedSession: readChecked('remember'),
          }));
          if (response.body?.data?.id) {
            await pollOperation(response.body.data.id, (operation) => {
              applyGeneratedSeedResult(operation?.result?.generatedSeed);
            });
          } else {
            setSessionState(response.body);
          }
        };
      }

      const prepareFunding = document.getElementById('prepareFunding');
      if (prepareFunding) {
        prepareFunding.onclick = async () => {
          const response = await request('/api/session/prepare-funding', body({
            seedMode: document.getElementById('seedMode').value,
            seed: document.getElementById('seed').value || undefined,
          }));
          if (response.body?.data?.id) {
            await pollOperation(response.body.data.id, (operation) => {
              applyGeneratedSeedResult(operation?.result?.generatedSeed);
            });
          } else {
            setSessionState(response.body);
          }
        };
      }

      const closeSession = document.getElementById('closeSession');
      if (closeSession) {
        closeSession.onclick = async () => {
          const response = await request('/api/session/close', { method: 'POST' });
          setSessionState(response.body);
          const operation = await request('/api/operations/current', {}, { silent: true });
          setOperationState(operation.body);
          const operations = await request('/api/operations', {}, { silent: true });
          setOperationsState(operations.body);
          setBanner('info', 'Session closed. Backend resources were released.');
        };
      }

      const status = document.getElementById('status');
      if (status) {
        status.onclick = async () => {
          const response = await request('/api/session', {}, { silent: true });
          setSessionState(response.body);
          setJson(resultEl, response);
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

    const attachKeyHandlers = () => {
      if (!document.getElementById('keyCrv')) return;
      syncDerivedKeyType();
      document.getElementById('keyCrv').addEventListener('change', syncDerivedKeyType);

      document.getElementById('keyGenerate').onclick = async () => {
        const id = readTrimmed('keyId');
        const crv = document.getElementById('keyCrv').value;
        ensure(id.length > 0, 'Key id is required.');
        const response = await request('/api/keys/generate', body({
          id,
          kty: curveToKeyType(crv),
          crv,
        }));
        if (response.body?.data?.id) await pollOperation(response.body.data.id);
      };
      document.getElementById('keyImport').onclick = async () => {
        const id = readTrimmed('keyId');
        const crv = document.getElementById('keyCrv').value;
        const privateKey = readTrimmed('keyPrivate');
        ensure(id.length > 0, 'Key id is required.');
        ensure(validateHexPrivateKey(privateKey), 'Private key must be an even-length hex string.');
        const response = await request('/api/keys/import', body({
          id,
          kty: curveToKeyType(crv),
          crv,
          privateKey: Array.from(privateKey.match(/.{1,2}/g) || []).map((x) => parseInt(x, 16)),
        }));
        if (response.body?.data?.id) await pollOperation(response.body.data.id);
      };
      document.getElementById('keyList').onclick = async () => request('/api/keys');
      document.getElementById('keyDelete').onclick = async () => {
        const keyRef = readTrimmed('keyRefDelete');
        ensure(keyRef.length > 0, 'delete keyRef is required.');
        const response = await request('/api/keys/' + encodeURIComponent(keyRef), { method: 'DELETE' });
        if (response.body?.data?.id) await pollOperation(response.body.data.id);
      };
    };

    const attachSignatureHandlers = () => {
      if (!document.getElementById('signPayloadButton')) return;

      const syncSelectToInput = (selectId, inputId) => {
        document.getElementById(selectId)?.addEventListener('change', (event) => {
          const value = event.target.value || '';
          if (value) document.getElementById(inputId).value = value;
          updateActionState();
        });
      };

      syncSelectToInput('signKeyRefSelect', 'signKeyRef');
      syncSelectToInput('verifyKeyRefSelect', 'verifyKeyRef');
      syncSelectToInput('verifyVerificationMethodSelect', 'verifyVerificationMethodId');

      document.getElementById('verifySource')?.addEventListener('change', () => {
        setSignatureSourcePanels();
        updateActionState();
      });
      [
        'signKeyRef',
        'signPayloadType',
        'signPayload',
        'verifyKeyRef',
        'verifyVerificationMethodId',
        'verifyPublicJwk',
        'verifyPayloadType',
        'verifyPayload',
        'verifySignatureBase64Url',
      ].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', updateActionState);
        document.getElementById(id)?.addEventListener('change', updateActionState);
      });

      document.getElementById('signPayloadButton').onclick = async () => {
        const requestPayload = {
          keyRef: readTrimmed('signKeyRef'),
          payloadType: document.getElementById('signPayloadType').value,
          payload: document.getElementById('signPayload').value,
        };
        const response = await request('/api/signatures/sign', body(requestPayload));
        lastSignRequest = requestPayload;
        setSignatureResultState('sign', response.body);
        activateTab('signatures-result', 'sign');
      };

      document.getElementById('copySignToVerify').onclick = async () => {
        const signed = lastSignPayload?.data || lastSignPayload;
        if (!signed || !lastSignRequest) return;
        document.getElementById('verifySource').value = 'didDocument';
        document.getElementById('verifyVerificationMethodId').value = signed.verificationMethodId || '';
        document.getElementById('verifyPayloadType').value = lastSignRequest.payloadType;
        document.getElementById('verifyPayload').value = lastSignRequest.payload;
        document.getElementById('verifySignatureBase64Url').value = signed.signatureBase64Url || '';
        document.getElementById('verifyPublicJwk').value = JSON.stringify(signed.publicJwk || {}, null, 2);
        setSignatureSourcePanels();
        activateTab('signatures-result', 'verify');
        updateActionState();
      };

      document.getElementById('verifyPayloadButton').onclick = async () => {
        const verifySource = document.getElementById('verifySource').value;
        const requestPayload = {
          payloadType: document.getElementById('verifyPayloadType').value,
          payload: document.getElementById('verifyPayload').value,
          signatureBase64Url: readTrimmed('verifySignatureBase64Url'),
        };
        if (verifySource === 'localKey') {
          requestPayload.keyRef = readTrimmed('verifyKeyRef');
        } else if (verifySource === 'publicJwk') {
          requestPayload.publicJwk = parseMaybeJson(document.getElementById('verifyPublicJwk').value);
        } else {
          requestPayload.verificationMethodId = readTrimmed('verifyVerificationMethodId');
        }
        const response = await request('/api/signatures/verify', body(requestPayload));
        setSignatureResultState('verify', response.body);
        activateTab('signatures-result', 'verify');
      };

      setSignatureSourcePanels();
      updateActionState();
    };

    const attachTabHandlers = () => {
      document.querySelectorAll('.tab').forEach((button) => {
        button.addEventListener('click', () => activateTab(button.dataset.tabGroup, button.dataset.tab));
      });
    };

    const attachDidHandlers = () => {
      document.getElementById('nextActions')?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-next-action]');
        if (!button) return;
        const action = button.dataset.nextAction;
        const methods = lastDidDocumentPayload?.data?.didDocument?.verificationMethod || [];
        const availableContracts = lastContractsPayload?.data?.filter((entry) => entry.available === true) || [];
        if (action === 'goto-wallet') {
          window.location.href = '/wallet';
          return;
        }
        if (action === 'goto-secret-storage') {
          window.location.href = '/secret-storage';
          return;
        }
        if (action === 'deploy-contract') {
          await document.getElementById('deploy').onclick();
          return;
        }
        if (action === 'join-current-contract' || action === 'join-stored-contract') {
          const selected = lastSessionPayload?.data?.contractAddress || availableContracts[0]?.address || '';
          if (selected) {
            document.getElementById('contractAddress').value = selected;
            await document.getElementById('join').onclick();
          }
          return;
        }
        if (action === 'focus-add-method') {
          document.getElementById('vmMethodId').focus();
          if (!document.getElementById('vmMethodId').value) {
            document.getElementById('vmMethodId').value = '#auth-main';
          }
          return;
        }
        if (action === 'add-auth-relation') {
          const firstMethod = methods[0]?.id || '';
          if (firstMethod) {
            document.getElementById('relMethodId').value = firstMethod;
            document.getElementById('vmRelation').value = 'Authentication';
            await document.getElementById('relAdd').onclick();
          }
          return;
        }
        if (action === 'focus-add-service') {
          document.getElementById('svcId').focus();
          if (!document.getElementById('svcId').value) {
            document.getElementById('svcId').value = '#profile';
          }
        }
      });
      document.getElementById('contractAddressSelect').addEventListener('change', (event) => {
        const value = event.target.value || '';
        selectedStoredContractAddress = value;
        if (value) {
          document.getElementById('contractAddress').value = value;
        }
      });
      document.getElementById('contractAddress').addEventListener('input', (event) => {
        const value = (event.target.value || '').trim();
        if (value !== selectedStoredContractAddress) {
          selectedStoredContractAddress = '';
          const selectEl = document.getElementById('contractAddressSelect');
          if (selectEl && document.activeElement !== selectEl) {
            selectEl.value = '';
          }
        }
      });
      document.getElementById('vmMethodSelect').addEventListener('change', (event) => {
        const value = event.target.value || '';
        if (value) document.getElementById('vmMethodId').value = value;
      });
      document.getElementById('vmKeyRefSelect').addEventListener('change', (event) => {
        const value = event.target.value || '';
        if (value) document.getElementById('vmKeyRef').value = value;
      });
      document.getElementById('relMethodSelect').addEventListener('change', (event) => {
        const value = event.target.value || '';
        if (value) document.getElementById('relMethodId').value = value;
      });
      document.getElementById('svcSelect').addEventListener('change', (event) => {
        const value = event.target.value || '';
        if (!value) return;
        document.getElementById('svcId').value = value;
        const services = lastDidDocumentPayload?.data?.didDocument?.service || [];
        const selected = services.find((entry) => entry.id === value);
        if (selected) {
          document.getElementById('svcType').value = selected.type || '';
          document.getElementById('svcEndpoint').value = JSON.stringify(selected.serviceEndpoint, null, 2);
        }
      });
      document.getElementById('akaSelect').addEventListener('change', (event) => {
        const value = event.target.value || '';
        if (value) document.getElementById('akaValue').value = value;
      });

      const clickDid = async (url, init) => {
        const response = await request(url, init);
        if (response.body?.data?.id) {
          await pollOperation(response.body.data.id);
          return;
        }
        const session = await request('/api/session', {}, { silent: true });
        setSessionState(session.body);
        await refreshDidContext();
      };
      document.getElementById('deploy').onclick = async () => clickDid('/api/did/deploy', { method: 'POST' });
      document.getElementById('join').onclick = async () => {
        const contractAddress = readTrimmed('contractAddress');
        ensure(contractAddressPattern.test(contractAddress), 'Join contract address must be a 64-character lowercase hex string.');
        await clickDid('/api/did/join', body({ contractAddress }));
      };
      document.getElementById('refreshDid').onclick = refreshDidContext;
      document.getElementById('deactivate').onclick = async () => clickDid('/api/did/deactivate', { method: 'POST' });

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
      startHeartbeat();
      attachWalletHandlers();
      attachTabHandlers();
      attachKeyHandlers();
      attachSignatureHandlers();
      if (currentPage === 'did') {
        attachDidHandlers();
      }
      if (isDidContextPage()) {
        await refreshDidContext().catch(() => undefined);
      }
    });
  </script>
`;
