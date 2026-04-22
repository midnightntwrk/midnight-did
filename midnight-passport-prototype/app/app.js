const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  events: $("#events"),
  proofStatus: $("#proofStatus"),
  flowMode: $("#flowMode"),
  walletStatus: $("#walletStatus"),
  settlementStep: $("#settlementStep"),
  settlementSummary: $("#settlementSummary"),
  passportHolderName: $("#passportHolderName"),
  passportSummary: $("#passportSummary"),
  profileId: $("#profileId"),
  passkeyCredentialId: $("#passkeyCredentialId"),
  walletSeedHash: $("#walletSeedHash"),
  secretStoreStatus: $("#secretStoreStatus"),
  holderBindingStatus: $("#holderBindingStatus"),
  nationalIdStatus: $("#nationalIdStatus"),
  complianceStatus: $("#complianceStatus"),
  verifierStatus: $("#verifierStatus"),
  nationalIdCard: $("#nationalIdCard"),
  complianceCard: $("#complianceCard"),
  verifierCard: $("#verifierCard"),
  willProveList: $("#willProveList"),
  willNotShareList: $("#willNotShareList"),
  issuerProtocolList: $("#issuerProtocolList"),
  verifierProtocolList: $("#verifierProtocolList"),
  timelineWallet: $("#timelineWallet"),
  timelineRequest: $("#timelineRequest"),
  timelineProof: $("#timelineProof"),
  resetFlow: $("#resetFlow"),
  initializeWallet: $("#initializeWallet"),
  lockWallet: $("#lockWallet"),
  unlockWallet: $("#unlockWallet"),
  issueNationalId: $("#issueNationalId"),
  issueCompliance: $("#issueCompliance"),
  prepareProof: $("#prepareProof"),
  approveProof: $("#approveProof"),
  settleInvestment: $("#settleInvestment"),
  runHappyPath: $("#runHappyPath"),
  reviewDisclosure: $("#reviewDisclosure"),
  runDeniedPath: $("#runDeniedPath"),
};

let prototypeState;

function renderList(list, values) {
  if (!list) return;
  list.replaceChildren(
    ...values.map((value) => {
      const item = document.createElement("li");
      item.textContent = value;
      return item;
    }),
  );
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function setDisabled(element, disabled) {
  if (element) element.disabled = disabled;
}

function setCardState(card, enabled) {
  card?.classList.toggle("is-complete", enabled);
}

function setTimelineState(step, state) {
  if (!step) return;
  step.classList.toggle("done", state === "done");
  step.classList.toggle("active", state === "active");
}

function renderPrototypeState(state) {
  prototypeState = state;
  const actors = state.actors;
  const actions = state.actions;
  const [nationalId, compliance] = state.credentials;

  setText(elements.flowMode, state.mode);
  setText(elements.passportHolderName, state.wallet.displayName);
  setText(elements.profileId, state.wallet.did ?? state.wallet.profileId);
  setText(elements.passkeyCredentialId, state.wallet.passkeyCredentialId ?? "Not created");
  setText(
    elements.walletSeedHash,
    state.wallet.walletSeedHash
      ? `${state.wallet.walletSeedHash.slice(0, 12)}…`
      : "Not generated",
  );
  setText(elements.walletStatus, state.wallet.status);
  setText(elements.nationalIdStatus, nationalId?.status ?? "Not issued");
  setText(elements.complianceStatus, compliance?.status ?? "Not issued");
  setText(
    elements.verifierStatus,
    actors.denied
      ? "Denied"
      : actors.proofApproved
        ? "Approved"
        : actors.proofPrepared
          ? "Proof ready"
          : "Waiting",
  );
  setText(
    elements.proofStatus,
    actors.denied
      ? "Denied"
      : actors.transferSettled
        ? "Settled"
        : actors.proofApproved
          ? "Approved"
          : actors.proofPrepared
            ? "Prepared"
            : "Idle",
  );
  setText(
    elements.passportSummary,
    `${actors.nationalIdIssued ? "National ID issued" : "No National ID"} · ${
      actors.complianceIssued ? "Compliance ready" : "No compliance"
    } · Holder hidden`,
  );
  setText(
    elements.secretStoreStatus,
    actors.walletInitialized
      ? "Encrypted and readable from passkey-derived keys"
      : "Waiting for passkey-derived key",
  );
  setText(
    elements.holderBindingStatus,
    actors.walletInitialized
      ? "Blinded secret holder binding enabled"
      : "Not created yet",
  );
  setText(
    elements.settlementSummary,
    state.investment.settlement
      ? `${state.investment.settlement.amount} units sent to ${state.investment.settlement.to}.`
      : "Crypto wallet remains separate from identity wallet.",
  );

  elements.proofStatus?.classList.toggle(
    "success",
    actors.proofApproved || actors.transferSettled,
  );
  elements.proofStatus?.classList.toggle("danger", actors.denied);
  elements.flowMode?.classList.toggle("success", state.mode === "Happy path");
  elements.flowMode?.classList.toggle("danger", state.mode === "Denied path");

  setCardState(elements.nationalIdCard, actors.nationalIdIssued);
  setCardState(elements.complianceCard, actors.complianceIssued);
  setCardState(elements.verifierCard, actors.proofApproved);

  setTimelineState(elements.timelineWallet, actors.walletInitialized ? "done" : "active");
  setTimelineState(
    elements.timelineRequest,
    actors.complianceIssued ? "done" : actors.nationalIdIssued ? "active" : "idle",
  );
  setTimelineState(
    elements.timelineProof,
    actors.proofApproved ? "done" : actors.proofPrepared ? "active" : "idle",
  );
  setTimelineState(
    elements.settlementStep,
    actors.transferSettled ? "done" : actors.proofApproved ? "active" : "idle",
  );

  setDisabled(elements.initializeWallet, !actions.initializeWallet);
  setDisabled(elements.lockWallet, !actions.lockWallet);
  setDisabled(elements.unlockWallet, !actions.unlockWallet);
  setDisabled(elements.issueNationalId, !actions.issueNationalId);
  setDisabled(elements.issueCompliance, !actions.issueCompliance);
  setDisabled(elements.prepareProof, !actions.prepareProof);
  setDisabled(elements.approveProof, !actions.approveProof);
  setDisabled(elements.settleInvestment, !actions.settleInvestment);
  setDisabled(elements.runHappyPath, !actions.runHappyPath);
  setDisabled(elements.runDeniedPath, !actions.runDeniedPath);

  renderList(elements.willProveList, state.disclosure.willProve);
  renderList(elements.willNotShareList, state.disclosure.willNotShare);
  renderList(elements.issuerProtocolList, state.protocol.issuerMessages);
  renderList(elements.verifierProtocolList, state.protocol.verifierMessages);
  renderList(elements.events, state.events);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    const message = payload.error ?? `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function loadPrototypeState() {
  try {
    if (await acceptCredentialOfferRedirect()) return;
    renderPrototypeState(await fetchJson("/api/state"));
  } catch (apiError) {
    try {
      const response = await fetch("./prototype-state.json", { cache: "no-store" });
      renderPrototypeState(await response.json());
    } catch (fallbackError) {
      console.warn("Unable to load prototype state", apiError, fallbackError);
    }
  }
}

async function acceptCredentialOfferRedirect() {
  const params = new URLSearchParams(window.location.search);
  const credentialOfferUri = params.get("credential_offer_uri");
  if (!credentialOfferUri) return false;

  const state = await fetchJson("/api/issuer/national-id/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      credentialOfferUri,
      issuerSessionId: params.get("issuer_session"),
      state: params.get("state"),
    }),
  });
  window.history.replaceState({}, document.title, "/");
  renderPrototypeState(state);
  document.querySelector("#credentials")?.scrollIntoView({ behavior: "smooth" });
  return true;
}

async function performAction(action) {
  try {
    const state = await fetchJson(`/api/actions/${action}`, { method: "POST" });
    renderPrototypeState(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed";
    renderList(elements.events, [message, ...(prototypeState?.events ?? [])]);
  }
}

async function startNationalIdIssuance() {
  try {
    const result = await fetchJson("/api/issuer/national-id/start", {
      method: "POST",
    });
    window.location.href = result.redirectUrl;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "National ID issuance failed";
    renderList(elements.events, [message, ...(prototypeState?.events ?? [])]);
  }
}

async function reviewDisclosure() {
  if (prototypeState?.actions.prepareProof) {
    await performAction("prepareProof");
  }
  document.querySelector("#consent")?.scrollIntoView({ behavior: "smooth" });
}

const sections = $$('section[id]');
const tabs = $$(".stage-tab");

function updateActiveTab() {
  const current = sections
    .map((section) => ({
      id: section.id,
      distance: Math.abs(section.getBoundingClientRect().top - 120),
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.getAttribute("href") === `#${current.id}`);
  });
}

elements.resetFlow?.addEventListener("click", () => performAction("reset"));
elements.initializeWallet?.addEventListener("click", () => performAction("initializeWallet"));
elements.lockWallet?.addEventListener("click", () => performAction("lockWallet"));
elements.unlockWallet?.addEventListener("click", () => performAction("unlockWallet"));
elements.issueNationalId?.addEventListener("click", startNationalIdIssuance);
elements.issueCompliance?.addEventListener("click", () => performAction("issueCompliance"));
elements.prepareProof?.addEventListener("click", () => performAction("prepareProof"));
elements.approveProof?.addEventListener("click", () => performAction("approveProof"));
elements.settleInvestment?.addEventListener("click", () => performAction("settleInvestment"));
elements.runHappyPath?.addEventListener("click", () => performAction("runHappyPath"));
elements.runDeniedPath?.addEventListener("click", () => performAction("runDeniedPath"));
elements.reviewDisclosure?.addEventListener("click", reviewDisclosure);

window.addEventListener("scroll", updateActiveTab, { passive: true });
updateActiveTab();
loadPrototypeState();
