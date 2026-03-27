export function normalizePrinters(rows) {
  return [...(Array.isArray(rows) ? rows : [])]
    .map((row) => ({
      id: Number.parseInt(String(row?.id ?? ""), 10),
      name: cleanText(row?.name) || `Impressora ${row?.id ?? ""}`.trim(),
      serial: cleanText(row?.serial),
      otherserial: cleanText(row?.otherserial),
      modelId:
        parseInteger(row?.printermodels_id) ??
        parseInteger(row?.printersmodels_id),
      modelName:
        cleanText(row?.["printermodels_id_dropdown"]) ||
        cleanText(row?.["printersmodels_id_dropdown"]) ||
        cleanText(row?.printermodel) ||
        cleanText(row?.model),
    }))
    .filter((row) => Number.isInteger(row.id))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function formatPrinterLabel(printer) {
  const parts = [printer.name];

  if (printer.modelName) {
    parts.push(printer.modelName);
  }

  if (printer.serial) {
    parts.push(`SN ${printer.serial}`);
  }

  return parts.join(" - ");
}

export function filterVisiblePrinters(rows) {
  const hiddenPatterns = [
    "etiquetas almox",
    "etiquetas pcp",
    "etiquetas pos venda",
  ];

  return [...(Array.isArray(rows) ? rows : [])].filter(
    (printer) => {
      const normalizedName = normalize(printer?.name)
        .replace(/[^a-z0-9 ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return !hiddenPatterns.some((pattern) => normalizedName.includes(pattern));
    },
  );
}

export function getCompatibleCartridgeItemIds(printer, rows) {
  const normalizedPrinterModelId = parseInteger(printer?.modelId);
  const normalizedPrinterModelName = normalize(printer?.modelName);
  const matches = new Set();

  for (const row of Array.isArray(rows) ? rows : []) {
    const printerModelId =
      parseInteger(row?.printermodels_id) ??
      parseInteger(row?.printersmodels_id);
    const printerModelName = normalize(
      row?.["printermodels_id_dropdown"] ??
        row?.["printersmodels_id_dropdown"],
    );
    const cartridgeItemId = parseInteger(row?.cartridgeitems_id);

    if (!Number.isInteger(cartridgeItemId)) {
      continue;
    }

    const sameModelId =
      Number.isInteger(normalizedPrinterModelId) &&
      Number.isInteger(printerModelId) &&
      normalizedPrinterModelId === printerModelId;
    const sameModelName =
      normalizedPrinterModelName &&
      printerModelName &&
      normalizedPrinterModelName === printerModelName;

    if (sameModelId || sameModelName) {
      matches.add(cartridgeItemId);
    }
  }

  return [...matches];
}

export function getCartridgeItemIdsFromPrinterCartridges(rows) {
  const matches = new Set();

  for (const row of Array.isArray(rows) ? rows : []) {
    const cartridgeItemId =
      parseInteger(row?.cartridgeitems_id) ??
      parseInteger(row?.cartridgeitem_id) ??
      parseInteger(row?.["cartridgeitems.id"]);

    if (Number.isInteger(cartridgeItemId)) {
      matches.add(cartridgeItemId);
    }
  }

  return [...matches];
}

export function mergeCartridgeItemIds(...lists) {
  const merged = new Set();

  for (const list of lists) {
    for (const id of Array.isArray(list) ? list : []) {
      if (Number.isInteger(id)) {
        merged.add(id);
      }
    }
  }

  return [...merged];
}

export function countAvailableCartridges(rows) {
  return [...(Array.isArray(rows) ? rows : [])].filter(
    (row) => !isTruthyDate(row?.date_use) && !isTruthyDate(row?.date_out),
  ).length;
}

export function pickAvailableCartridge(rows) {
  const cartridges = Array.isArray(rows) ? rows : [];
  const active = cartridges.find((row) => !isTruthyDate(row?.date_use) && !isTruthyDate(row?.date_out));

  if (active) {
    return active;
  }

  return null;
}

function cleanText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || "";
}

function parseInteger(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function isTruthyDate(value) {
  if (value == null) {
    return false;
  }

  const normalized = String(value).trim();
  return (
    normalized !== "" &&
    normalized !== "0000-00-00" &&
    normalized !== "0000-00-00 00:00:00" &&
    normalized !== "0000-00-00T00:00:00" &&
    normalized !== "0000-00-00T00:00:00Z"
  );
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
