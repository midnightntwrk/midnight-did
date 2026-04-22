const $ = (selector) => document.querySelector(selector);

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session");

const elements = {
  sessionId: $("#issuerSessionId"),
  status: $("#issuerStatus"),
  issuerDid: $("#issuerDid"),
  issuerMethodId: $("#issuerMethodId"),
  proofStatus: $("#issuerProofStatus"),
  events: $("#issuerEvents"),
  uploadDocuments: $("#uploadDocuments"),
  passLiveness: $("#passLiveness"),
  approveProfile: $("#approveProfile"),
  completeIssuance: $("#completeIssuance"),
};

const checkButtons = {
  documentsUploaded: elements.uploadDocuments,
  livenessPassed: elements.passLiveness,
  profileApproved: elements.approveProfile,
};

const checkLabels = {
  documentsUploaded: "Upload documents",
  livenessPassed: "Pass liveness check",
  profileApproved: "Approve profile",
};

function renderEvents(values) {
  elements.events?.replaceChildren(
    ...values.map((value) => {
      const item = document.createElement("li");
      item.textContent = value;
      return item;
    }),
  );
}

function renderSession(session) {
  elements.sessionId.textContent = session.id;
  elements.status.textContent = session.status;
  elements.issuerDid.textContent = session.issuerDid;
  elements.issuerMethodId.textContent = `${session.issuerMethodId.slice(0, 16)}…`;
  elements.proofStatus.textContent =
    session.status === "checks_completed" ? "Ready" : "Waiting";
  elements.proofStatus.classList.toggle("success", session.status === "checks_completed");

  Object.entries(checkButtons).forEach(([check, button]) => {
    button.disabled = Boolean(session.checks[check]);
    button.textContent = session.checks[check]
      ? `${checkLabels[check]} ✓`
      : checkLabels[check];
  });

  const completed = Object.values(session.checks).every(Boolean);
  elements.completeIssuance.disabled = !completed;
  renderEvents([
    session.checks.documentsUploaded
      ? "Documents uploaded: mocked document capture complete."
      : "Waiting for document upload.",
    session.checks.livenessPassed
      ? "Liveness check passed: mocked biometric verification complete."
      : "Waiting for liveness check.",
    session.checks.profileApproved
      ? "Profile approved: issuer can mint a credential offer."
      : "Waiting for profile approval.",
  ]);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with ${response.status}`);
  }
  return payload;
}

async function loadSession() {
  if (!sessionId) {
    renderEvents(["Missing issuer session id."]);
    return;
  }
  renderSession(await fetchJson(`/api/issuer/national-id/sessions/${sessionId}`));
}

async function completeCheck(check) {
  if (!sessionId) return;
  renderSession(
    await fetchJson(`/api/issuer/national-id/sessions/${sessionId}/checks/${check}`, {
      method: "POST",
    }),
  );
}

async function completeIssuance() {
  if (!sessionId) return;
  const result = await fetchJson(`/api/issuer/national-id/sessions/${sessionId}/complete`, {
    method: "POST",
  });
  window.location.href = result.redirectUrl;
}

elements.uploadDocuments?.addEventListener("click", () =>
  completeCheck("documentsUploaded"),
);
elements.passLiveness?.addEventListener("click", () =>
  completeCheck("livenessPassed"),
);
elements.approveProfile?.addEventListener("click", () =>
  completeCheck("profileApproved"),
);
elements.completeIssuance?.addEventListener("click", completeIssuance);

loadSession();
