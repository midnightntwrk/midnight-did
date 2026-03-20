# CLI Examples

The CLI package is useful even if you do not want the interactive shell, because the service layer is reusable.

## Construct the CLI service

```ts
import { CliDidService } from "@midnight-ntwrk/midnight-did-cli";
import { FileSecretStore } from "@midnight-ntwrk/midnight-did-secret-storage";
import {
  StandaloneConfig,
  buildFreshWallet,
  configureProviders,
} from "@midnight-ntwrk/midnight-did-api";

const config = new StandaloneConfig();
const wallet = await buildFreshWallet(config);
const providers = await configureProviders(wallet, config);

const secretStorage = new FileSecretStore();
await secretStorage.initialize({
  location: "/tmp/cli-secrets.json",
  passphrase: "dev-secret",
});

const service = new CliDidService({ providers, secretStorage });
```

## Inspect state and hints

```ts
const current = await service.getCurrentState();
const hints = await service.getNextActions();
```

## Add a verification method from a stored key

```ts
await service.addVerificationMethodFromKey({
  methodId: "#auth-main",
  keyRef: "key-1",
});
```

## When to use this package

- deterministic app workflows
- automated tests over CLI behavior
- future UI/application layers that want state-machine guidance
