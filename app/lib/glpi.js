class HttpError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "HttpError";
    this.details = details;
  }
}

export class GlpiClient {
  constructor(config, logger = console) {
    this.config = config;
    this.logger = logger;
    this.sessionToken = null;
    this.searchOptionsCache = new Map();
  }

  async initSession() {
    this.ensureRequiredConfig();

    const response = await this.request("GET", "initSession/", {
      headers: {
        Authorization: `user_token ${this.config.glpiUserToken}`,
      },
    });

    const sessionToken = response?.session_token;
    if (!sessionToken) {
      throw new HttpError("GLPI nao retornou session_token.", {
        response,
      });
    }

    this.sessionToken = sessionToken;

    if (this.config.glpiProfileId) {
      await this.changeActiveProfile(this.config.glpiProfileId);
    }

    if (this.config.glpiEntityId) {
      await this.changeActiveEntity(
        this.config.glpiEntityId,
        this.config.glpiEntityRecursive,
      );
    }

    return sessionToken;
  }

  async killSession() {
    if (!this.sessionToken) {
      return;
    }

    try {
      await this.request("GET", "killSession/");
    } catch (error) {
      this.logger.warn("Falha ao encerrar sessao GLPI.", error.message);
    } finally {
      this.sessionToken = null;
    }
  }

  async getItem(itemtype, id, query = {}) {
    return this.request("GET", `${itemtype}/${id}`, { query });
  }

  async listItems(itemtype, query = {}) {
    return this.request("GET", `${itemtype}/`, { query });
  }

  async listSearchOptions(itemtype) {
    if (this.searchOptionsCache.has(itemtype)) {
      return this.searchOptionsCache.get(itemtype);
    }

    const result = await this.request("GET", `listSearchOptions/${itemtype}`, {});
    this.searchOptionsCache.set(itemtype, result);
    return result;
  }

  async searchItems(itemtype, { criteria = [], forcedisplay = [], range = "0-999" } = {}) {
    const query = { range };

    criteria.forEach((criterion, index) => {
      for (const [key, value] of Object.entries(criterion)) {
        if (value == null || value === "") {
          continue;
        }

        query[`criteria[${index}][${key}]`] = value;
      }
    });

    forcedisplay.forEach((fieldId, index) => {
      query[`forcedisplay[${index}]`] = fieldId;
    });

    return this.request("GET", `search/${itemtype}`, { query });
  }

  async getSubItems(itemtype, id, subItemtype, query = {}) {
    return this.request("GET", `${itemtype}/${id}/${subItemtype}`, { query });
  }

  async updateItem(itemtype, id, input) {
    return this.request("PUT", `${itemtype}/${id}`, {
      body: { input: { id, ...input } },
    });
  }

  async listPrinters(range = "0-999") {
    return this.listItems("Printer", {
      get_hateoas: "false",
      expand_dropdowns: "true",
      range,
    });
  }

  async listPrinterCartridges(printerId, range = "0-99") {
    return this.getSubItems("Printer", printerId, "Cartridge", {
      get_hateoas: "false",
      expand_dropdowns: "true",
      range,
    });
  }

  async listCartridgeItemPrinterModelRelations(range = "0-9999") {
    return this.listItems("CartridgeItem_PrinterModel", {
      get_hateoas: "false",
      range,
    });
  }

  async listCartridgesForItem(cartridgeItemId, range = "0-999") {
    const options = await this.listSearchOptions("Cartridge");
    const cartridgeItemFieldId = findSearchOptionId(options, {
      field: "cartridgeitems_id",
      uidIncludes: "cartridgeitems_id",
    });
    const dateUseFieldId = findSearchOptionId(options, {
      field: "date_use",
      uidIncludes: "date_use",
    });
    const dateOutFieldId = findSearchOptionId(options, {
      field: "date_out",
      uidIncludes: "date_out",
    });

    if (!cartridgeItemFieldId) {
      return this.listCartridgesForItemFromSubItems(cartridgeItemId, range);
    }

    try {
      const response = await this.searchItems("Cartridge", {
        criteria: [
          {
            link: "AND",
            itemtype: "Cartridge",
            field: cartridgeItemFieldId,
            searchtype: "equals",
            value: cartridgeItemId,
          },
        ],
        forcedisplay: [dateUseFieldId, dateOutFieldId].filter(Boolean),
        range,
      });

      return normalizeSearchRows(response, {
        dateUseFieldId,
        dateOutFieldId,
      });
    } catch (error) {
      this.logger.warn(
        "Busca search/Cartridge falhou; usando subitens de CartridgeItem.",
        error?.message ?? error,
      );
      return this.listCartridgesForItemFromSubItems(cartridgeItemId, range);
    }
  }

  async markCartridgeAsUsed(cartridgeId, printerId) {
    return this.updateItem("Cartridge", cartridgeId, {
      date_use: todayAsIsoDate(),
      printers_id: printerId,
    });
  }

  async uninstallCartridge(cartridgeId, pages) {
    const input = {
      date_out: todayAsIsoDate(),
    };

    if (pages != null) {
      input.pages = pages;
    }

    return this.updateItem("Cartridge", cartridgeId, input);
  }

  async listCartridgesForItemFromSubItems(cartridgeItemId, range = "0-999") {
    const response = await this.getSubItems("CartridgeItem", cartridgeItemId, "Cartridge", {
      get_hateoas: "false",
      range,
    });

    return normalizeCartridgeRows(response);
  }

  async request(method, endpoint, options = {}) {
    const baseUrl = this.config.glpiBaseUrl.replace(/\/+$/, "");
    const url = new URL(`${baseUrl}/${endpoint.replace(/^\/+/, "")}`);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value == null || value === "") {
          continue;
        }

        url.searchParams.append(key, String(value));
      }
    }

    const headers = {
      "Content-Type": "application/json",
      ...(this.config.glpiAppToken ? { "App-Token": this.config.glpiAppToken } : {}),
      ...(this.sessionToken ? { "Session-Token": this.sessionToken } : {}),
      ...(options.headers ?? {}),
    };

    const response = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const parsedBody = await parseResponseBody(response);

    if (!response.ok) {
      throw new HttpError(
        `GLPI respondeu ${response.status} ${response.statusText} em ${endpoint}`,
        {
          status: response.status,
          endpoint,
          body: parsedBody,
        },
      );
    }

    return parsedBody;
  }

  async changeActiveProfile(profileId) {
    return this.request("POST", "changeActiveProfile/", {
      body: { profiles_id: profileId },
    });
  }

  async changeActiveEntity(entityId, recursive) {
    return this.request("POST", "changeActiveEntities/", {
      body: {
        entities_id: entityId,
        is_recursive: Boolean(recursive),
      },
    });
  }

  ensureRequiredConfig() {
    const missing = [];

    if (!this.config.glpiBaseUrl) {
      missing.push("GLPI_BASE_URL");
    }

    if (!this.config.glpiUserToken) {
      missing.push("GLPI_USER_TOKEN");
    }

    if (missing.length > 0) {
      throw new Error(
        `Configuracao GLPI incompleta. Defina: ${missing.join(", ")}`,
      );
    }
  }
}

function todayAsIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function parseResponseBody(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function findSearchOptionId(options, matcher) {
  for (const [id, option] of Object.entries(options ?? {})) {
    const field = String(option?.field ?? "").trim().toLowerCase();
    const uid = String(option?.uid ?? "").trim().toLowerCase();

    if (matcher.field && field === matcher.field.toLowerCase()) {
      return Number.parseInt(id, 10);
    }

    if (matcher.uidIncludes && uid.includes(matcher.uidIncludes.toLowerCase())) {
      return Number.parseInt(id, 10);
    }
  }

  return undefined;
}

function normalizeSearchRows(response, fieldIds) {
  const rawRows = response?.data ?? {};
  const rows = [];

  for (const [id, row] of Object.entries(rawRows)) {
    rows.push({
      id: Number.parseInt(id, 10),
      date_use: readSearchValue(row, fieldIds.dateUseFieldId),
      date_out: readSearchValue(row, fieldIds.dateOutFieldId),
    });
  }

  return rows.filter((row) => Number.isInteger(row.id));
}

function normalizeCartridgeRows(response) {
  const rows = Array.isArray(response) ? response : [];

  return rows
    .map((row) => ({
      ...row,
      id: parseInteger(row?.id),
      date_use: row?.date_use,
      date_out: row?.date_out,
    }))
    .filter((row) => Number.isInteger(row.id));
}

function readSearchValue(row, fieldId) {
  if (!fieldId) {
    return undefined;
  }

  return row?.[String(fieldId)];
}

function parseInteger(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
