import { didContent } from './did-content.js';
import { sharedScript } from './script.js';
import { secretStorageContent } from './secret-storage-content.js';
import { styles } from './styles.js';
import { walletContent } from './wallet-content.js';

const renderPage = (page: 'wallet' | 'secret-storage' | 'did', title: string, intro: string, content: string): string => `<!doctype html>
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
        <div class="hero-copy">
          <h1>Midnight DID Manager</h1>
          <p>${intro}</p>
          <p class="muted"><a href="/docs">Open API docs</a></p>
        </div>
        <div class="nav-shell">
          <div class="tab-nav" role="tablist" aria-label="Primary navigation">
            <a href="/wallet" class="${page === 'wallet' ? 'active' : ''}" aria-current="${page === 'wallet' ? 'page' : 'false'}">Wallet Setup</a>
            <a href="/secret-storage" class="${page === 'secret-storage' ? 'active' : ''}" aria-current="${page === 'secret-storage' ? 'page' : 'false'}">Secret Storage</a>
            <a href="/did" class="${page === 'did' ? 'active' : ''}" aria-current="${page === 'did' ? 'page' : 'false'}">DID Management</a>
          </div>
          <div class="nav-meta">
            <span class="meta-pill">Current setup: <strong id="setupProfileBadge">-</strong></span>
            <button id="profilePopoverToggle" class="profile-trigger" type="button">
              <span class="profile-avatar" id="profileAvatar">-</span>
              <span class="mono" id="profileBadgeText">-</span>
            </button>
          </div>
        </div>
      </section>
      ${content}
    </div>
    <div id="profilePopoverBackdrop" class="popover-backdrop"></div>
    <div id="profilePopover" class="profile-popover">
      <section class="card">
        <h2>Profile & Setup</h2>
        <p>Backend-selected network, active local profile, and runtime configuration.</p>
        <div class="profile-grid">
          <div class="value"><strong>Setup profile</strong><span id="setupProfile" class="mono">-</span></div>
          <div class="value"><strong>Active local profile</strong><span id="setupProfileName" class="mono">-</span></div>
          <div class="value"><strong>Node</strong><span id="setupNode" class="mono">-</span></div>
          <div class="value"><strong>Indexer</strong><span id="setupIndexer" class="mono">-</span></div>
          <div class="value"><strong>Proof server</strong><span id="setupProofServer" class="mono">-</span></div>
          <div class="value"><strong>Funding address</strong><span id="setupFundingAddress" class="mono">-</span></div>
        </div>
      </section>
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

export const secretStoragePage = renderPage(
  'secret-storage',
  'Midnight DID Manager | Secret Storage',
  'Manage the local secret storage used by the current profile. Keys remain local until they are referenced by DID operations.',
  secretStorageContent,
);
