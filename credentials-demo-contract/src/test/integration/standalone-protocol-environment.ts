// Re-export from the shared standalone-environment package.
// This file exists for backward compatibility with existing imports.
export {
  containerRuntimeAvailable,
  type ProtocolDidProfile,
  StandaloneEnvironment as StandaloneProtocolEnvironment,
  verifierChallengeForProfile,
} from "../../../../standalone-environment/src/index.js";
