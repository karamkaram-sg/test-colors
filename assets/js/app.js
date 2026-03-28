(() => {
  const { data: ui } = window.PortColorsConfig;
  const { initialState, sampleTerminalsByPort } = window.PortColorsData;
  const { escapeHtml, showToast, deepClone } = window.PortColorsUtils;
  const { normalizeHex, getVesselColor } = window.PortColorsColor;

  const LOCAL_STORAGE_KEY = "port-colors-editor-state-v1";

  const state = {
    portBaseColors: deepClone(initialState.portBaseColors),
    portOrder: Object.keys(initialState.portBaseColors),
  };
  let terminalsByPort = deepClone(sampleTerminalsByPort);

  const elements = {
    addPortForm: document.getElementById("addPortForm"),
    addPortBtn: document.getElementById("addPortBtn"),
    copyJsonBtn: document.getElementById("copyJsonBtn"),
    resetBtn: document.getElementById("resetBtn"),
    downloadJsonBtn: document.getElementById("downloadJsonBtn"),
    newPortCode: document.getElementById("newPortCode"),
    newPortName: document.getElementById("newPortName"),
    newPortColor: document.getElementById("newPortColor"),
    portsGrid: document.getElementById("portsGrid"),
    compareModal: document.getElementById("compareModal"),
    compareBody: document.getElementById("compareBody"),
    compareTitle: document.getElementById("compareTitle"),
    closeCompareBtn: document.getElementById("closeCompareBtn"),
    deleteConfirmModal: document.getElementById("deleteConfirmModal"),
    deleteConfirmMessage: document.getElementById("deleteConfirmMessage"),
    closeDeleteConfirmBtn: document.getElementById("closeDeleteConfirmBtn"),
    cancelDeleteBtn: document.getElementById("cancelDeleteBtn"),
    confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
    helpBox: document.getElementById("helpBox"),
  };

  let comparePortCode = null;
  let pendingDeletePortCode = null;

  function isCompareEnabled() {
    return ui.enableCompare && window.innerWidth >= 800;
  }

  function getOrderedPortCodes() {
    const allCodes = Object.keys(state.portBaseColors);
    const known = state.portOrder.filter((code) => allCodes.includes(code));
    const missing = allCodes.filter((code) => !known.includes(code));
    return [...known, ...missing];
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          portBaseColors: state.portBaseColors,
          terminalsByPort,
          portOrder: getOrderedPortCodes(),
        }),
      );
    } catch {
      showToast("Could not save settings locally");
    }
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);

      if (
        parsed &&
        parsed.portBaseColors &&
        typeof parsed.portBaseColors === "object"
      ) {
        state.portBaseColors = deepClone(parsed.portBaseColors);
      }

      if (
        parsed &&
        parsed.terminalsByPort &&
        typeof parsed.terminalsByPort === "object"
      ) {
        terminalsByPort = deepClone(parsed.terminalsByPort);
      }

      if (parsed && Array.isArray(parsed.portOrder)) {
        state.portOrder = parsed.portOrder.filter((code) =>
          Object.hasOwn(state.portBaseColors, code),
        );
      } else {
        state.portOrder = Object.keys(state.portBaseColors);
      }
    } catch {
      showToast("Saved settings are invalid and were ignored");
    }
  }

  function resetToDefaults() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    state.portBaseColors = deepClone(initialState.portBaseColors);
    state.portOrder = Object.keys(initialState.portBaseColors);
    terminalsByPort = deepClone(sampleTerminalsByPort);
    render();
    showToast("Reset to original configuration");
  }

  function getExportObject() {
    const orderedKeys = getOrderedPortCodes();
    const result = {};

    for (const key of orderedKeys) {
      const port = state.portBaseColors[key];
      result[key] = {
        name: port.name,
        color: normalizeHex(port.color),
      };
    }

    return {
      portBaseColors: result,
    };
  }

  function applyUiConfig() {
    elements.addPortForm?.classList.toggle("is-hidden", !ui.enableAddPort);
    elements.copyJsonBtn?.classList.toggle("is-hidden", !ui.showCopy);
    elements.resetBtn?.classList.toggle("is-hidden", !ui.showReset);
    elements.helpBox?.classList.toggle("is-hidden", !ui.showInfoSection);
    elements.downloadJsonBtn?.classList.toggle("is-hidden", !ui.showDownload);

    if (!isCompareEnabled() && comparePortCode) {
      closeCompareModal();
    }
  }

  function copyJson() {
    const data = getExportObject().portBaseColors;

    const text = Object.entries(data)
      .map(([code, value]) => `${code}: ${value.color} (${value.name})`)
      .join("\n");

    navigator.clipboard
      .writeText(text)
      .then(() => showToast("JSON copied to clipboard"))
      .catch(() => showToast("Copy failed"));
  }

  function downloadJson() {
    const json = JSON.stringify(getExportObject(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "portBaseColors.json";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    showToast("JSON file downloaded");
  }

  function addPort() {
    const code = elements.newPortCode.value.trim().toUpperCase();
    const name = elements.newPortName.value.trim();
    const hex = elements.newPortColor.value;

    if (!/^[A-Z0-9]{5}$/.test(code)) {
      showToast("Port code must be exactly 5 characters");
      return;
    }

    if (!name) {
      showToast("Port name is required");
      return;
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      showToast("Please select a valid color");
      return;
    }

    state.portBaseColors[code] = {
      name,
      color: normalizeHex(hex),
    };

    if (!state.portOrder.includes(code)) {
      state.portOrder.push(code);
    }

    if (!terminalsByPort[code]) {
      terminalsByPort[code] = [`${code}1001`, `${code}2001`, `${code}3001`];
    }

    elements.newPortCode.value = "";
    elements.newPortName.value = "";
    elements.newPortColor.value = "#3b82f6";

    saveToLocalStorage();
    render();
    showToast(`${code} added`);
  }

  function removePort(portCode) {
    if (!state.portBaseColors[portCode]) return;

    if (comparePortCode === portCode) {
      closeCompareModal();
    }

    delete state.portBaseColors[portCode];
    delete terminalsByPort[portCode];
    state.portOrder = state.portOrder.filter((code) => code !== portCode);

    saveToLocalStorage();
    render();
    showToast(`${portCode} removed`);
  }

  function openDeleteConfirmModal(portCode) {
    const port = state.portBaseColors[portCode];
    if (!port) return;

    pendingDeletePortCode = portCode;
    elements.deleteConfirmMessage.textContent = `Delete port ${portCode}${port.name ? ` (${port.name})` : ""}?`;
    elements.deleteConfirmModal.classList.remove("is-hidden");
    elements.deleteConfirmModal.setAttribute("aria-hidden", "false");
  }

  function closeDeleteConfirmModal() {
    pendingDeletePortCode = null;
    elements.deleteConfirmModal.classList.add("is-hidden");
    elements.deleteConfirmModal.setAttribute("aria-hidden", "true");
  }

  function confirmDeletePort() {
    if (!pendingDeletePortCode) return;

    const portCode = pendingDeletePortCode;
    closeDeleteConfirmModal();
    removePort(portCode);
  }

  function resetPort(portCode) {
    const original = initialState.portBaseColors[portCode];
    if (!original || !state.portBaseColors[portCode]) return;

    state.portBaseColors[portCode] = deepClone(original);

    if (sampleTerminalsByPort[portCode]) {
      terminalsByPort[portCode] = deepClone(sampleTerminalsByPort[portCode]);
    }

    saveToLocalStorage();
    render();
    showToast(`${portCode} reset to default`);
  }

  function updatePortColorFromHex(portCode, hex, rerender = true) {
    if (!state.portBaseColors[portCode]) return;

    state.portBaseColors[portCode].color = normalizeHex(hex);
    saveToLocalStorage();

    if (rerender) {
      render();
    }
  }

  function syncPortCard(portCode) {
    const card = document.querySelector(`[data-port-code="${portCode}"]`);

    if (!card) {
      return;
    }

    const baseColor = normalizeHex(state.portBaseColors[portCode]?.color);
    const swatch = card.querySelector(`[data-open-color-picker="${portCode}"]`);
    const input = card.querySelector(`[data-color-input="${portCode}"]`);

    if (swatch) {
      swatch.style.background = baseColor;
    }

    if (input) {
      input.value = baseColor;
    }

    updatePortCardPreview(card, portCode);
  }

  function renderCompareModalBody(portCode) {
    const port = state.portBaseColors[portCode];
    if (!port) return;

    const currentColor = normalizeHex(port.color);
    const terminals = terminalsByPort[portCode] || [];

    elements.compareTitle.textContent = `Compare ${portCode}`;
    elements.compareBody.innerHTML = `
      <div class="compare-grid" style="--compare-row-span: ${Math.max(terminals.length, 1)};">
        <div class="compare-grid-header">Port</div>
        <div class="compare-grid-header">Terminals</div>
        <div class="compare-port-color" style="grid-row: span ${Math.max(terminals.length, 1)};">
          <button
            type="button"
            class="compare-port-swatch"
            data-compare-open-color-picker="${escapeHtml(portCode)}"
            style="background: ${escapeHtml(currentColor)};"
            title="Click to edit ${escapeHtml(portCode)}"
            aria-label="Edit color for ${escapeHtml(portCode)}"
          >
            <span class="compare-port-code">${escapeHtml(portCode)}</span>
            <span class="compare-port-value">${escapeHtml(currentColor)}</span>
          </button>
          <input
            class="hidden-color-input"
            type="color"
            value="${escapeHtml(currentColor)}"
            data-compare-color-input="${escapeHtml(portCode)}"
          />
        </div>
        ${terminals
          .map((terminalCode) => {
            const outputColor = getVesselColor(terminalCode, state);

            return `
              <div
                class="compare-terminal-color"
                data-compare-terminal="${escapeHtml(terminalCode)}"
                style="background: ${escapeHtml(outputColor)};"
                title="${escapeHtml(outputColor)}"
              >
                <div class="compare-terminal-info">
                  <span class="compare-terminal-code">${escapeHtml(terminalCode)}</span>
                  <span class="compare-value">${escapeHtml(outputColor)}</span>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function patchCompareModal(portCode) {
    if (comparePortCode !== portCode) return;

    const port = state.portBaseColors[portCode];
    if (!port) return;

    const currentColor = normalizeHex(port.color);
    const terminals = terminalsByPort[portCode] || [];

    const swatch = elements.compareBody.querySelector(".compare-port-swatch");
    if (swatch) {
      swatch.style.background = currentColor;
      const valueEl = swatch.querySelector(".compare-port-value");
      if (valueEl) valueEl.textContent = currentColor;
    }

    const hiddenInput = elements.compareBody.querySelector(
      `[data-compare-color-input="${portCode}"]`,
    );
    if (hiddenInput) hiddenInput.value = currentColor;

    terminals.forEach((terminalCode) => {
      const outputColor = getVesselColor(terminalCode, state);
      const termDiv = elements.compareBody.querySelector(
        `[data-compare-terminal="${terminalCode}"]`,
      );
      if (!termDiv) return;
      termDiv.style.background = outputColor;
      termDiv.title = outputColor;
      const valueEl = termDiv.querySelector(".compare-value");
      if (valueEl) valueEl.textContent = outputColor;
    });
  }

  function syncPortColorViews(portCode) {
    syncPortCard(portCode);
    patchCompareModal(portCode);
  }

  function updatePortCardPreview(card, portCode) {
    const baseColor = normalizeHex(state.portBaseColors[portCode]?.color);
    const baseText = card.querySelector(`[data-port-base-text="${portCode}"]`);

    if (baseText) {
      baseText.textContent = baseColor;
    }

    const terminals = terminalsByPort[portCode] || [];

    terminals.forEach((terminalCode) => {
      const outputColor = getVesselColor(terminalCode, state);
      const output = card.querySelector(
        `[data-terminal-output="${terminalCode}"]`,
      );
      const preview = card.querySelector(
        `[data-terminal-preview="${terminalCode}"]`,
      );

      if (output) {
        output.textContent = `output: ${outputColor}`;
      }

      if (preview) {
        preview.style.background = outputColor;
      }
    });
  }

  function openCompareModal(portCode) {
    if (!isCompareEnabled()) {
      return;
    }

    const port = state.portBaseColors[portCode];
    if (!port) return;

    comparePortCode = portCode;
    renderCompareModalBody(portCode);
    elements.compareModal.classList.remove("is-hidden");
    elements.compareModal.setAttribute("aria-hidden", "false");
  }

  function closeCompareModal() {
    comparePortCode = null;
    elements.compareModal.classList.add("is-hidden");
    elements.compareModal.setAttribute("aria-hidden", "true");
    elements.compareBody.innerHTML = "";
  }

  function reorderPorts(draggedPortCode, targetPortCode) {
    if (
      !draggedPortCode ||
      !targetPortCode ||
      draggedPortCode === targetPortCode
    ) {
      return;
    }

    const currentOrder = getOrderedPortCodes();
    const fromIndex = currentOrder.indexOf(draggedPortCode);
    const toIndex = currentOrder.indexOf(targetPortCode);

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    currentOrder.splice(fromIndex, 1);
    currentOrder.splice(toIndex, 0, draggedPortCode);
    state.portOrder = currentOrder;

    saveToLocalStorage();
    render();
  }

  function render() {
    const entries = getOrderedPortCodes().map((code) => [
      code,
      state.portBaseColors[code],
    ]);

    if (!entries.length) {
      elements.portsGrid.innerHTML =
        '<div class="empty-state">No ports configured yet.</div>';
      return;
    }

    elements.portsGrid.innerHTML = entries
      .map(([portCode, data]) => {
        const baseColor = normalizeHex(data.color);
        const terminals = terminalsByPort[portCode] || [
          `${portCode}1001`,
          `${portCode}2001`,
          `${portCode}3001`,
        ];

        const terminalsHtml = terminals
          .map((terminalCode) => {
            const outputColor = getVesselColor(terminalCode, state);

            return `
            <div class="terminal-item">
              <div class="terminal-info-row">
                <div class="terminal-code">${escapeHtml(terminalCode)}</div>
                <div class="terminal-output" data-terminal-output="${escapeHtml(terminalCode)}">output: ${escapeHtml(outputColor)}</div>
              </div>
              <div class="terminal-color-col">
                <div class="terminal-preview" data-terminal-preview="${escapeHtml(terminalCode)}" style="background: ${outputColor};"></div>
              </div>
            </div>
          `;
          })
          .join("");

        return `
          <div class="port-card" draggable="true" data-port-code="${escapeHtml(portCode)}">
            <div class="port-top">
              <div class="port-header-row">
                <div class="port-color-col">
                  <div
                    class="swatch swatch-editable"
                    style="background: ${baseColor};"
                    data-open-color-picker="${escapeHtml(portCode)}"
                    title="Click to edit color"
                  ></div>
                  <input
                    class="hidden-color-input"
                    type="color"
                    value="${baseColor}"
                    data-color-input="${escapeHtml(portCode)}"
                  />
                </div>
                <div class="port-info-col">
                  <div class="port-code">${escapeHtml(portCode)}</div>
                  <div class="port-name">${escapeHtml(data.name || portCode)}</div>
                  <div class="swatch-text" data-port-base-text="${escapeHtml(portCode)}">${escapeHtml(baseColor)}</div>
                </div>
                <div class="port-actions-col">
                  <button
                    type="button"
                    class="compare-icon-button${isCompareEnabled() ? "" : " is-hidden"}"
                    data-compare-port="${escapeHtml(portCode)}"
                    aria-label="Compare colors for ${escapeHtml(portCode)}"
                    title="Compare colors"
                  >
                    ⛶
                  </button>
                  <button
                    type="button"
                    class="reset-port-button${ui.showPortResetBtn ? "" : " is-hidden"}"
                    data-reset-port="${escapeHtml(portCode)}"
                    aria-label="Reset ${escapeHtml(portCode)}"
                    title="Reset port to default"
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    class="remove-port-button${ui.enableRemovePort ? "" : " is-hidden"}"
                    data-remove-port="${escapeHtml(portCode)}"
                    aria-label="Remove ${escapeHtml(portCode)}"
                    title="Remove port"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            <div class="variants">
              <div class="terminal-list">${terminalsHtml}</div>
            </div>
          </div>
        `;
      })
      .join("");

    bindDynamicEvents();
  }

  function bindDynamicEvents() {
    let draggedPortCode = null;

    document
      .querySelectorAll(".port-card[draggable='true']")
      .forEach((card) => {
        card.addEventListener("dragstart", (event) => {
          draggedPortCode = event.currentTarget.getAttribute("data-port-code");
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", draggedPortCode || "");
          event.currentTarget.classList.add("port-card--dragging");
        });

        card.addEventListener("dragover", (event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          event.currentTarget.classList.add("port-card-drop-target");
        });

        card.addEventListener("dragleave", (event) => {
          event.currentTarget.classList.remove("port-card-drop-target");
        });

        card.addEventListener("drop", (event) => {
          event.preventDefault();
          const targetPortCode =
            event.currentTarget.getAttribute("data-port-code");
          event.currentTarget.classList.remove("port-card-drop-target");
          reorderPorts(draggedPortCode, targetPortCode);
        });

        card.addEventListener("dragend", (event) => {
          event.currentTarget.classList.remove("port-card--dragging");
          document
            .querySelectorAll(".port-card.port-card-drop-target")
            .forEach((el) => el.classList.remove("port-card-drop-target"));
          draggedPortCode = null;
        });
      });

    document.querySelectorAll("[data-open-color-picker]").forEach((swatch) => {
      swatch.addEventListener("click", (event) => {
        const portCode = event.currentTarget.getAttribute(
          "data-open-color-picker",
        );
        const input = document.querySelector(
          `[data-color-input="${portCode}"]`,
        );

        if (!input) {
          return;
        }

        if (typeof input.showPicker === "function") {
          input.showPicker();
          return;
        }

        input.click();
      });
    });

    document.querySelectorAll("[data-color-input]").forEach((input) => {
      input.addEventListener("input", (event) => {
        const portCode = event.target.getAttribute("data-color-input");
        updatePortColorFromHex(portCode, event.target.value, false);
        syncPortColorViews(portCode);
      });

      input.addEventListener("change", (event) => {
        const portCode = event.target.getAttribute("data-color-input");
        updatePortColorFromHex(portCode, event.target.value, false);
        syncPortColorViews(portCode);
      });
    });

    document.querySelectorAll("[data-compare-port]").forEach((button) => {
      button.addEventListener("click", (event) => {
        const portCode = event.currentTarget.getAttribute("data-compare-port");
        openCompareModal(portCode);
      });
    });

    document.querySelectorAll("[data-reset-port]").forEach((button) => {
      button.addEventListener("click", (event) => {
        const portCode = event.currentTarget.getAttribute("data-reset-port");
        resetPort(portCode);
      });
    });

    document.querySelectorAll("[data-remove-port]").forEach((button) => {
      button.addEventListener("click", (event) => {
        const portCode = event.currentTarget.getAttribute("data-remove-port");
        openDeleteConfirmModal(portCode);
      });
    });
  }

  function bindStaticEvents() {
    elements.addPortBtn?.addEventListener("click", addPort);
    elements.copyJsonBtn?.addEventListener("click", copyJson);
    elements.resetBtn?.addEventListener("click", resetToDefaults);
    elements.downloadJsonBtn?.addEventListener("click", downloadJson);
    elements.closeCompareBtn?.addEventListener("click", closeCompareModal);
    elements.closeDeleteConfirmBtn?.addEventListener(
      "click",
      closeDeleteConfirmModal,
    );
    elements.cancelDeleteBtn?.addEventListener(
      "click",
      closeDeleteConfirmModal,
    );
    elements.confirmDeleteBtn?.addEventListener("click", confirmDeletePort);

    elements.compareModal?.addEventListener("click", (event) => {
      if (event.target.hasAttribute("data-close-compare")) {
        closeCompareModal();
      }
    });

    elements.deleteConfirmModal?.addEventListener("click", (event) => {
      if (event.target.hasAttribute("data-close-delete-confirm")) {
        closeDeleteConfirmModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && comparePortCode) {
        closeCompareModal();
      }
    });

    elements.compareBody?.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-compare-open-color-picker]");

      if (!trigger) {
        return;
      }

      const portCode = trigger.getAttribute("data-compare-open-color-picker");
      const input = elements.compareBody.querySelector(
        `[data-compare-color-input="${portCode}"]`,
      );

      if (!input) {
        return;
      }

      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }

      input.click();
    });

    elements.compareBody?.addEventListener("input", (event) => {
      const input = event.target.closest("[data-compare-color-input]");

      if (!input) {
        return;
      }

      const portCode = input.getAttribute("data-compare-color-input");
      updatePortColorFromHex(portCode, input.value, false);
      syncPortColorViews(portCode);
    });

    elements.compareBody?.addEventListener("change", (event) => {
      const input = event.target.closest("[data-compare-color-input]");

      if (!input) {
        return;
      }

      const portCode = input.getAttribute("data-compare-color-input");
      updatePortColorFromHex(portCode, input.value, false);
      syncPortColorViews(portCode);
    });

    window.addEventListener("resize", () => {
      applyUiConfig();
      render();
    });

    elements.newPortCode?.addEventListener("input", (event) => {
      event.target.value = event.target.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 5);
    });
  }

  function start() {
    applyUiConfig();
    loadFromLocalStorage();
    bindStaticEvents();
    render();
  }

  start();
})();
