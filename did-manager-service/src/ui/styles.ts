export const styles = String.raw`
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
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px;
    align-items: start;
  }
  .hero-copy {
    min-width: 0;
  }
  .nav-shell {
    display: grid;
    gap: 10px;
    justify-items: end;
    min-width: 0;
  }
  .tab-nav {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .nav-meta {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .tab-nav a {
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: #0a1220;
  }
  .tab-nav a.active {
    background: #17315c;
    border-color: #476a9f;
    color: white;
  }
  .meta-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: rgba(15, 23, 39, 0.9);
    color: var(--accent-2);
    font-size: 13px;
    min-height: 44px;
  }
  .profile-trigger {
    width: auto;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: rgba(10, 18, 32, 0.95);
    color: var(--text);
    min-height: 44px;
    max-width: 100%;
  }
  .profile-avatar {
    width: 26px;
    height: 26px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #17315c;
    border: 1px solid #476a9f;
    font-size: 12px;
    font-weight: 700;
    color: white;
  }
  .popover-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(4, 9, 16, 0.45);
    z-index: 20;
    display: none;
  }
  .popover-backdrop.open {
    display: block;
  }
  .profile-popover {
    position: fixed;
    top: 78px;
    right: 20px;
    width: min(460px, calc(100vw - 40px));
    z-index: 30;
    display: none;
  }
  .profile-popover.open {
    display: block;
  }
  .profile-grid {
    display: grid;
    gap: 8px;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
    gap: 14px;
  }
  .left {
    display: grid;
    gap: 12px;
    align-content: start;
    min-width: 0;
  }
  .right {
    display: grid;
    gap: 12px;
    align-content: start;
    min-width: 0;
  }
  .card {
    background: linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 14px;
    min-width: 0;
  }
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }
  .card-header h2 {
    margin-bottom: 0;
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
  button {
    cursor: pointer;
    transition: transform 100ms ease, background-color 160ms ease, border-color 160ms ease, opacity 160ms ease;
  }
  button:hover:not(:disabled) {
    border-color: #4f6ea0;
    background: #10203a;
  }
  button:active:not(:disabled) {
    transform: scale(0.98);
  }
  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  button.primary { background: #2c4f85; border-color: #496da6; }
  button.primary:hover:not(:disabled) {
    background: #365f9f;
    border-color: #5d82ba;
  }
  .icon-button {
    width: auto;
    min-width: 36px;
    max-width: 36px;
    min-height: 36px;
    padding: 6px;
    border-radius: 999px;
    font-size: 15px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .check-row {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    color: var(--text);
    font-size: 13px;
  }
  .check-row input[type="checkbox"] {
    width: auto;
    margin: 0;
  }
  .link-field {
    display: block;
    border: 1px solid var(--border);
    background: #0a1220;
    color: var(--accent-2);
    border-radius: 10px;
    padding: 10px 11px;
    text-decoration: none;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .link-field:hover {
    border-color: #4f6ea0;
    background: #10203a;
  }
  .link-field.disabled {
    color: var(--muted);
    pointer-events: none;
    cursor: default;
  }
  .row { display: flex; gap: 8px; }
  .row.wrap { flex-wrap: wrap; }
  .row > * { min-width: 0; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .muted { color: var(--muted); font-size: 12px; }
  .value-list { display: grid; gap: 8px; }
  .contract-list { display: grid; gap: 8px; }
  .contract-chip {
    display: grid;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: #0a1220;
    min-width: 0;
  }
  .contract-chip.active { border-color: #3f7a59; }
  .contract-chip.missing { border-color: #7a4b3f; }
  .contract-chip .mono {
    display: block;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .contract-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 11px;
    color: var(--muted);
  }
  .value {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: #0a1220;
    min-width: 0;
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
  .status.info { color: var(--accent-2); }
  .status.error { color: #ff9b9b; }
  .banner {
    display: none;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: #0a1220;
    font-size: 13px;
  }
  .banner.open { display: block; }
  .banner.info { border-color: #476a9f; color: var(--accent-2); }
  .banner.success { border-color: #3f7a59; color: var(--ok); }
  .banner.warn { border-color: #9a7a3e; color: var(--warn); }
  .banner.error { border-color: #8a4a4a; color: #ffb0b0; }
  .hint-list, .op-log {
    display: grid;
    gap: 8px;
  }
  .hint-item, .op-log-item {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: #0a1220;
    min-width: 0;
  }
  .hint-item strong, .op-log-item strong {
    display: block;
    font-size: 12px;
    margin-bottom: 4px;
  }
  .hint-item p, .op-log-item p {
    margin: 0;
    font-size: 12px;
  }
  .hint-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .hint-actions button {
    width: auto;
    padding: 7px 10px;
    font-size: 12px;
  }
  .hint-item code, .op-log-item code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .op-log-item small {
    color: var(--muted);
    display: block;
    margin-top: 4px;
    font-size: 11px;
  }
  .danger {
    background: #4c1f24;
    border-color: #8a4a4a;
    color: #ffd7d7;
  }
  .secondary {
    background: #111b2e;
    border-color: #344b72;
    color: var(--accent-2);
  }
  .tab-list {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .tab {
    width: auto;
    padding: 8px 12px;
    border-radius: 999px;
    background: #0a1220;
    border: 1px solid var(--border);
    color: var(--muted);
  }
  .tab.active {
    background: #17315c;
    border-color: #476a9f;
    color: white;
  }
  .tab-panel {
    display: none;
  }
  .tab-panel.active {
    display: block;
  }
  .advanced-section {
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: #0a1220;
  }
  .advanced-section summary {
    cursor: pointer;
    color: var(--accent-2);
    font-size: 12px;
    list-style: none;
  }
  .advanced-section summary::-webkit-details-marker {
    display: none;
  }
  .advanced-section[open] summary {
    margin-bottom: 8px;
  }
  .gated {
    opacity: 0.52;
    pointer-events: none;
  }
  .indicator-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .indicator {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: #0a1220;
  }
  .indicator strong {
    display: block;
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 6px;
    font-weight: 500;
  }
  .indicator .mono {
    display: block;
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    background: #0a1220;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px;
    overflow: auto;
    min-height: 180px;
  }
  #knownContractsSummary,
  #didGateMessage,
  #walletSeedContinuity,
  #walletKnownContracts,
  #didSummaryContract,
  .value span,
  .muted,
  .op-log-item p,
  .hint-item p {
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  @media (max-width: 980px) {
    .hero, .layout { grid-template-columns: 1fr; display: grid; }
    .nav-shell, .tab-nav, .nav-meta { justify-items: stretch; justify-content: flex-start; }
    .tab-nav a, .meta-pill, .profile-trigger { width: 100%; justify-content: space-between; }
  }
  @media (max-width: 1240px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
`;
