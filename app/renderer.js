import { APP_CONFIG } from "./lib/appConfig.js";
import { validateClientConfig } from "./lib/clientConfig.js";
import { GlpiClient } from "./lib/glpi.js";
import {
  countAvailableCartridges,
  filterVisiblePrinters,
  formatPrinterLabel,
  getCartridgeItemIdsFromPrinterCartridges,
  getCompatibleCartridgeItemIds,
  mergeCartridgeItemIds,
  normalizePrinters,
  pickAvailableCartridge,
} from "./lib/printerWorkflow.js";

const actionForm = document.getElementById("action-form");
const printerSelect = document.getElementById("printerId");
const removeTonerButton = document.getElementById("remove-toner");
const statusPanel = document.getElementById("status-panel");

let printersById = new Map();

wireEvents();
boot();

function wireEvents() {
  actionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const printerId = Number.parseInt(printerSelect.value, 10);
    if (!Number.isInteger(printerId)) {
      setStatus("Selecao obrigatoria", "Escolha uma impressora antes de continuar.", "error");
      return;
    }

    const validation = validateClientConfig(APP_CONFIG);
    if (!validation.ok) {
      setStatus(
        "Configuracao fixa incompleta",
        "Preencha o arquivo app/app-config.local.js.",
        "error",
      );
      return;
    }

    removeTonerButton.disabled = true;
    setStatus("Registrando uso", "Procurando toner compativel para a impressora selecionada.", "");

    const client = new GlpiClient(APP_CONFIG);

    try {
      await client.initSession();

      const printerResponse = await client.getItem("Printer", printerId, {
        get_hateoas: "false",
      });
      const printer = {
        ...(printersById.get(printerId) ?? {}),
        ...(normalizePrinters([printerResponse])[0] ?? {}),
      };

      const printerCartridges = await client.listPrinterCartridges(printerId);
      const cartridgeItemIdsFromPrinter = getCartridgeItemIdsFromPrinterCartridges(printerCartridges);

      const relations = await client.listCartridgeItemPrinterModelRelations();
      const compatibleCartridgeItemIds = getCompatibleCartridgeItemIds(printer, relations);

      const candidateCartridgeItemIds = mergeCartridgeItemIds(
        cartridgeItemIdsFromPrinter,
        compatibleCartridgeItemIds,
      );

      if (candidateCartridgeItemIds.length === 0) {
        setStatus(
          "Tipo de toner nao encontrado",
          "O GLPI nao retornou um tipo de cartucho compativel para essa impressora.",
          "error",
        );
        return;
      }

      let cartridge = null;
      let remainingCompatibleStock = 0;

      for (const cartridgeItemId of candidateCartridgeItemIds) {
        const cartridges = await client.listCartridgesForItem(cartridgeItemId);
        remainingCompatibleStock += countAvailableCartridges(cartridges);
        cartridge = pickAvailableCartridge(cartridges);

        if (cartridge) {
          break;
        }
      }

      if (!cartridge) {
        setStatus(
          "Sem toner disponivel",
          `Nao ha toner disponivel para ${printer?.name ?? printerId}.`,
          "error",
        );
        return;
      }

      await client.markCartridgeAsUsed(cartridge.id, printerId);
      const remainingAfterUse = Math.max(remainingCompatibleStock - 1, 0);

      setStatus(
        "Toner marcado como usado",
        `Cartucho ${cartridge.id} associado a ${printer?.name ?? printerId}. Restam ${remainingAfterUse} toner(es) compativeis.`,
        "success",
      );

      await loadPrinters({ keepSelectedId: printerId });
    } catch (error) {
      setStatus("Falha ao registrar", extractErrorMessage(error), "error");
    } finally {
      await client.killSession();
      removeTonerButton.disabled = false;
    }
  });
}

async function boot() {
  const validation = validateClientConfig(APP_CONFIG);
  if (!validation.ok) {
    printerSelect.innerHTML = `<option value="">Preencha app/app-config.local.js</option>`;
    setStatus(
      "Configuracao fixa incompleta",
      "Preencha o arquivo app/app-config.local.js.",
      "error",
    );
    return;
  }

  try {
    window.localStorage.removeItem("glpi-android-negative-balance:v1");
  } catch {
    // Ignore stale local storage cleanup failures.
  }

  await loadPrinters();
}

async function loadPrinters(options = {}) {
  printerSelect.disabled = true;
  removeTonerButton.disabled = true;
  printerSelect.innerHTML = `<option value="">Carregando impressoras...</option>`;

  const client = new GlpiClient(APP_CONFIG);

  try {
    await client.initSession();
    const printers = filterVisiblePrinters(
      normalizePrinters(await client.listPrinters()),
    );
    printersById = new Map(printers.map((printer) => [printer.id, printer]));

    if (printers.length === 0) {
      printerSelect.innerHTML = `<option value="">Nenhuma impressora encontrada</option>`;
      setStatus("Sem impressoras", "O GLPI nao retornou impressoras para essa conta.", "error");
      return;
    }

    printerSelect.innerHTML = [
      `<option value="">Selecione uma impressora</option>`,
      ...printers.map(
        (printer) =>
          `<option value="${printer.id}">${escapeHtml(formatPrinterLabel(printer))}</option>`,
      ),
    ].join("");

    const selectedId = options.keepSelectedId ?? printers[0].id;
    printerSelect.value = String(selectedId);
    setStatus("Impressoras carregadas", `${printers.length} impressora(s) disponiveis.`, "success");
  } catch (error) {
    printerSelect.innerHTML = `<option value="">Falha ao carregar</option>`;
    setStatus("Falha ao listar impressoras", extractErrorMessage(error), "error");
  } finally {
    await client.killSession();
    printerSelect.disabled = false;
    removeTonerButton.disabled = false;
  }
}

function setStatus(title, message, tone) {
  statusPanel.className = `status-panel${tone ? ` ${tone}` : ""}`;
  statusPanel.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
}

function extractErrorMessage(error) {
  if (error?.details?.body) {
    const body = error.details.body;

    if (Array.isArray(body) && body.length > 1) {
      return body.join(" ");
    }

    if (typeof body === "string") {
      return body;
    }

    if (body?.message) {
      return body.message;
    }
  }

  return error?.message ?? "Erro desconhecido.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
