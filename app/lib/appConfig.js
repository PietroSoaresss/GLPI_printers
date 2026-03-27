import { normalizeClientConfig } from "./clientConfig.js";

const PUBLIC_DEFAULT_CONFIG = {
  glpiBaseUrl: "",
  glpiAppToken: "",
  glpiUserToken: "",
  glpiProfileId: undefined,
  glpiEntityId: undefined,
  glpiEntityRecursive: true,
};

export const APP_CONFIG = normalizeClientConfig({
  ...PUBLIC_DEFAULT_CONFIG,
  ...(globalThis.APP_CONFIG_OVERRIDES ?? {}),
});
