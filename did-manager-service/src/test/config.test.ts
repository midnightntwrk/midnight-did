import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config.js';

describe('did-manager-service config', () => {
  it('loads defaults', () => {
    const cfg = loadConfig({});
    expect(cfg.host).toBe('127.0.0.1');
    expect(cfg.port).toBe(3010);
    expect(cfg.setupProfile).toBe('standalone');
    expect(cfg.rememberUnlockedSessionDefault).toBe(true);
    expect(cfg.standalone.indexer).toContain('127.0.0.1');
    expect(cfg.preprod.indexer).toContain('preprod');
  });

  it('parses explicit env', () => {
    const cfg = loadConfig({
      DID_MANAGER_HOST: '0.0.0.0',
      DID_MANAGER_PORT: '9999',
      DID_MANAGER_SETUP: 'preprod',
      DID_MANAGER_REMEMBER_UNLOCKED: 'false',
      DID_MANAGER_SESSION_FILE: '/tmp/s.json',
      DID_MANAGER_SECRET_FILE: '/tmp/k.json',
    });
    expect(cfg.host).toBe('0.0.0.0');
    expect(cfg.port).toBe(9999);
    expect(cfg.setupProfile).toBe('preprod');
    expect(cfg.rememberUnlockedSessionDefault).toBe(false);
    expect(cfg.sessionFilePath).toBe('/tmp/s.json');
    expect(cfg.secretStorePath).toBe('/tmp/k.json');
  });
});
