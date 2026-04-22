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
  verifyNationalId: $("#verifyNationalId"),
  runSanctions: $("#runSanctions"),
  runPep: $("#runPep"),
  approveProfile: $("#approveProfile"),
  completeIssuance: $("#completeIssuance"),
};

const checkButtons = {
  nationalIdPresentationVerified: elements.verifyNationalId,
  sanctionsChecked: elements.runSanctions,
  pepChecked: elements.runPep,
  profileApproved: elements.approveProfile,
};

const checkLabels = {
  nationalIdPresentationVerified: "Verify National ID presentation",
  sanctionsChecked: "Run sanctions screening",
  pepChecked: "Run PEP screening",
  profileApproved: "Approve compliance profile",
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
  elements.proofStatus.classList.toggle(
    "success",
    session.status === "checks_completed",
  );

  Object.entries(checkButtons).forEach(([check, button]) => {
    button.disabled = Boolean(session.checks[check]);
    button.textContent = session.checks[check]
      ? `${checkLabels[check]} ✓`
      : checkLabels[check];
  });

  const completed = Object.values(session.checks).every(Boolean);
  elements.completeIssuance.disabled = !completed;
  renderEvents([
    session.checks.nationalIdPresentationVerified
      ? "National ID presentation verified: age and holder binding context accepted."
      : "Waiting for National ID presentation.",
    session.checks.sanctionsChecked
      ? "Sanctions screening passed: mocked provider returned no match."
      : "Waiting for sanctions screening.",
    session.checks.pepChecked
      ? "PEP screening passed: mocked provider returned false."
      : "Waiting for PEP screening.",
    session.checks.profileApproved
      ? "Compliance profile approved: issuer can mint a Screening VC offer."
      : "Waiting for compliance profile approval.",
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
  renderSession(await fetchJson(`/api/issuer/screening/sessions/${sessionId}`));
}

async function completeCheck(check) {
  if (!sessionId) return;
  renderSession(
    await fetchJson(`/api/issuer/screening/sessions/${sessionId}/checks/${check}`, {
      method: "POST",
    }),
  );
}

async function completeIssuance() {
  if (!sessionId) return;
  const result = await fetchJson(
    `/api/issuer/screening/sessions/${sessionId}/complete`,
    {
      method: "POST",
    },
  );
  window.location.href = result.redirectUrl;
}

elements.verifyNationalId?.addEventListener("click", () =>
  completeCheck("nationalIdPresentationVerified"),
);
elements.runSanctions?.addEventListener("click", () =>
  completeCheck("sanctionsChecked"),
);
elements.runPep?.addEventListener("click", () => completeCheck("pepChecked"));
elements.approveProfile?.addEventListener("click", () =>
  completeCheck("profileApproved"),
);
elements.completeIssuance?.addEventListener("click", completeIssuance);

loadSession();
