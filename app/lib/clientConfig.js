const DEFAULTS = {
  glpiBaseUrl: "",
  glpiAppToken: "",
  glpiUserToken: "",
  glpiItemtype: "Item_DeviceSimcard",
  glpiProfileId: undefined,
  glpiEntityId: undefined,
  glpiEntityRecursive: true,
  glpiDefaultDeviceSimcardId: undefined,
  glpiDefaultStateId: undefined,
  glpiDefaultLocationId: undefined,
  glpiUserSearchField: 1,
  glpiLocationSearchField: 1,
  glpiLineSearchField: 1,
  glpiStateSearchField: 1,
};

export function normalizeClientConfig(raw = {}) {
  return {
    glpiBaseUrl: cleanText(raw.glpiBaseUrl),
    glpiAppToken: cleanText(raw.glpiAppToken),
    glpiUserToken: cleanText(raw.glpiUserToken),
    glpiItemtype: cleanText(raw.glpiItemtype) || DEFAULTS.glpiItemtype,
    glpiProfileId: parseInteger(raw.glpiProfileId),
    glpiEntityId: parseInteger(raw.glpiEntityId),
    glpiEntityRecursive: parseBoolean(raw.glpiEntityRecursive, true),
    glpiDefaultDeviceSimcardId: parseInteger(raw.glpiDefaultDeviceSimcardId),
    glpiDefaultStateId: parseInteger(raw.glpiDefaultStateId),
    glpiDefaultLocationId: parseInteger(raw.glpiDefaultLocationId),
    glpiUserSearchField:
      parseInteger(raw.glpiUserSearchField) ?? DEFAULTS.glpiUserSearchField,
    glpiLocationSearchField:
      parseInteger(raw.glpiLocationSearchField) ?? DEFAULTS.glpiLocationSearchField,
    glpiLineSearchField:
      parseInteger(raw.glpiLineSearchField) ?? DEFAULTS.glpiLineSearchField,
    glpiStateSearchField:
      parseInteger(raw.glpiStateSearchField) ?? DEFAULTS.glpiStateSearchField,
  };
}

export function validateClientConfig(config) {
  const missing = [];

  if (!config.glpiBaseUrl) {
    missing.push("URL do GLPI");
  }

  if (!config.glpiUserToken) {
    missing.push("User token");
  }

  return {
    ok: missing.length === 0,
    missing,
  };
}

function cleanText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || "";
}

function parseInteger(value) {
  if (value == null || value === "") {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseBoolean(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}
