// Re-export from the shared standalone-environment package.
// This file exists for backward compatibility with existing imports.
export {
  StandaloneEnvironment as StandaloneProtocolEnvironment,
  type ProtocolDidProfile,
  verifierChallengeForProfile,
  containerRuntimeAvailable,
} from "../../../../standalone-environment/src/index.js";
