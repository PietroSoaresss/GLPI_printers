import test from "node:test";
import assert from "node:assert/strict";

import { normalizeClientConfig, validateClientConfig } from "../app/lib/clientConfig.js";

test("normaliza configuracao do app", () => {
  const config = normalizeClientConfig({
    glpiBaseUrl: " https://ti/agross/apirest.php ",
    glpiAppToken: " abc ",
    glpiUserToken: " xyz ",
    glpiItemtype: "",
    glpiProfileId: "7",
    glpiEntityId: "2",
    glpiEntityRecursive: "false",
    glpiDefaultDeviceSimcardId: "1",
    glpiDefaultStateId: "",
    glpiDefaultLocationId: "9",
  });

  assert.deepEqual(config, {
    glpiBaseUrl: "https://ti/agross/apirest.php",
    glpiAppToken: "abc",
    glpiUserToken: "xyz",
    glpiItemtype: "Item_DeviceSimcard",
    glpiProfileId: 7,
    glpiEntityId: 2,
    glpiEntityRecursive: false,
    glpiDefaultDeviceSimcardId: 1,
    glpiDefaultStateId: undefined,
    glpiDefaultLocationId: 9,
    glpiUserSearchField: 1,
    glpiLocationSearchField: 1,
    glpiLineSearchField: 1,
    glpiStateSearchField: 1,
  });
});

test("valida campos obrigatorios da configuracao", () => {
  const validation = validateClientConfig(
    normalizeClientConfig({
      glpiBaseUrl: "",
      glpiUserToken: "",
    }),
  );

  assert.equal(validation.ok, false);
  assert.deepEqual(validation.missing, ["URL do GLPI", "User token"]);
});
