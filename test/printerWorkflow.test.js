import test from "node:test";
import assert from "node:assert/strict";

import {
  countAvailableCartridges,
  filterVisiblePrinters,
  formatPrinterLabel,
  getCartridgeItemIdsFromPrinterCartridges,
  getCompatibleCartridgeItemIds,
  mergeCartridgeItemIds,
  normalizePrinters,
  pickAvailableCartridge,
} from "../app/lib/printerWorkflow.js";

test("normaliza e ordena impressoras", () => {
  const printers = normalizePrinters([
    { id: 2, name: "Zebra", printermodels_id: 8, printermodels_id_dropdown: "LaserJet", serial: "ABC" },
    { id: 1, name: "Brother", printermodels_id: 7, printermodels_id_dropdown: "HL-1112" },
  ]);

  assert.deepEqual(printers.map((row) => row.id), [1, 2]);
  assert.equal(printers[0].modelId, 7);
  assert.equal(formatPrinterLabel(printers[0]), "Brother - HL-1112");
  assert.equal(formatPrinterLabel(printers[1]), "Zebra - LaserJet - SN ABC");
});

test("remove impressoras ocultas da listagem do app", () => {
  const printers = filterVisiblePrinters([
    { id: 1, name: "ETIQUETAS ALMOX" },
    { id: 2, name: "Etiquetas PCP" },
    { id: 3, name: "Etiquetas pos venda" },
    { id: 4, name: "Etiquetas - Pos Venda" },
    { id: 5, name: "Etiquetas / Pos Venda" },
    { id: 6, name: "Etiquetas Pos Venda 01" },
    { id: 7, name: "ALMOX" },
  ]);

  assert.deepEqual(printers.map((row) => row.id), [7]);
});

test("seleciona cartucho novo disponivel para marcar como usado", () => {
  const cartridge = pickAvailableCartridge([
    { id: 10, date_use: "", date_out: "" },
    { id: 11, date_use: "2026-03-20", date_out: "" },
    { id: 12, date_use: "", date_out: "2026-03-25" },
  ]);

  assert.equal(cartridge.id, 10);
});

test("conta quantos cartuchos novos ainda estao disponiveis", () => {
  const total = countAvailableCartridges([
    { id: 10, date_use: "", date_out: "" },
    { id: 11, date_use: "2026-03-20", date_out: "" },
    { id: 12, date_use: "", date_out: "2026-03-25" },
    { id: 13, date_use: "0000-00-00 00:00:00", date_out: "0000-00-00 00:00:00" },
  ]);

  assert.equal(total, 2);
});

test("retorna nulo se nao houver cartucho novo disponivel", () => {
  const cartridge = pickAvailableCartridge([
    { id: 11, date_use: "2026-03-20", date_out: "" },
    { id: 12, date_use: "", date_out: "2026-03-25" },
  ]);

  assert.equal(cartridge, null);
});

test("trata zero timestamp do GLPI como cartucho ainda disponivel", () => {
  const cartridge = pickAvailableCartridge([
    { id: 21, date_use: "0000-00-00 00:00:00", date_out: "0000-00-00 00:00:00" },
    { id: 22, date_use: "2026-03-20", date_out: "" },
  ]);

  assert.equal(cartridge.id, 21);
});

test("identifica os tipos de cartucho compativeis pelo modelo da impressora", () => {
  const compatibleIds = getCompatibleCartridgeItemIds(
    {
      id: 4,
      modelId: 18,
      modelName: "HP Laser 107a",
    },
    [
      { cartridgeitems_id: 9, printermodels_id: 18, printermodels_id_dropdown: "HP Laser 107a" },
      { cartridgeitems_id: 12, printermodels_id: 18, printermodels_id_dropdown: "HP Laser 107a" },
      { cartridgeitems_id: 12, printermodels_id: 18, printermodels_id_dropdown: "HP Laser 107a" },
      { cartridgeitems_id: 22, printermodels_id: 99, printermodels_id_dropdown: "Brother 1617" },
    ],
  );

  assert.deepEqual(compatibleIds, [9, 12]);
});

test("faz fallback para o nome do modelo quando o id nao vier preenchido", () => {
  const compatibleIds = getCompatibleCartridgeItemIds(
    {
      id: 4,
      modelName: "HP Laser 107a",
    },
    [
      { cartridgeitems_id: 9, printermodels_id_dropdown: "HP Laser 107A" },
      { cartridgeitems_id: 22, printermodels_id_dropdown: "Brother 1617" },
    ],
  );

  assert.deepEqual(compatibleIds, [9]);
});

test("extrai tipos de cartucho a partir do historico da impressora", () => {
  const cartridgeItemIds = getCartridgeItemIdsFromPrinterCartridges([
    { id: 10, cartridgeitems_id: 7 },
    { id: 11, cartridgeitem_id: 8 },
    { id: 12, "cartridgeitems.id": 7 },
    { id: 13 },
  ]);

  assert.deepEqual(cartridgeItemIds, [7, 8]);
});

test("mescla ids de cartucho sem duplicar e preserva prioridade", () => {
  const merged = mergeCartridgeItemIds([7, 8], [8, 9], [9, 10]);

  assert.deepEqual(merged, [7, 8, 9, 10]);
});
