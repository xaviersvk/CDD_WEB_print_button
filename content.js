(() => {
    const BTN_CLASS = "cdd-stoich-print-button";
    const STATE = {
        reactionPayloads: [],
        lastUrl: location.href,
        depletedIdentifiers: new Set()
    };

  function isElnEntryPage(url = location.href) {
    return /\/vaults\/\d+\/eln\/entries\/\d+/.test(url);
  }

  function injectPageScript() {
    if (document.getElementById("cdd-stoich-print-inject-script")) return;

    const script = document.createElement("script");
    script.id = "cdd-stoich-print-inject-script";
    script.src = chrome.runtime.getURL("inject.js");
    script.onload = () => script.remove();

    (document.head || document.documentElement).appendChild(script);
  }


  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


    function getReactionElements() {
        return Array.from(document.querySelectorAll('[data-autotest-id="reaction"]'));
    }
    

    function getReactionImageHtmlForIndex(reactionIndex) {
        const reactions = getReactionElements();
        const reaction = reactions[reactionIndex];
        if (!reaction) return "";

        let img = reaction.querySelector(".ChemistryImage img");

        if (!img) {
            const imageContainer = reaction.querySelector('[data-autotest-id="inline-container--image"]');
            if (imageContainer) {
                img = imageContainer.querySelector("img");
            }
        }

        if (!img) return "";

        return img.outerHTML;
    }

    function buildButton(reactionIndex) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = BTN_CLASS;
        btn.dataset.reactionIndex = String(reactionIndex);
        btn.title = "Print stoichiometry sheet";
        btn.setAttribute("aria-label", "Print stoichiometry sheet");

        btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path fill="currentColor" d="M6 9V4h12v5h1a2 2 0 0 1 2 2v5h-3v4H6v-4H3v-5a2 2 0 0 1 2-2h1zm2-3v3h8V6H8zm8 12v-4H8v4h8zm2-7H6a1 1 0 0 0-1 1v2h1v-2h12v2h1v-2a1 1 0 0 0-1-1z"/>
      </svg>
    `;

        btn.style.position = "absolute";
        btn.style.top = "6px";
        btn.style.right = "88px";
        btn.style.width = "32px";
        btn.style.height = "32px";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.padding = "0";
        btn.style.border = "1px solid #cfd4dc";
        btn.style.borderRadius = "6px";
        btn.style.background = "#ffffff";
        btn.style.color = "#6b7280";
        btn.style.cursor = "pointer";
        btn.style.zIndex = "20";
        btn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)";
        btn.style.transition = "background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease";



        btn.addEventListener("mouseenter", () => {
            btn.style.background = "#f9fafb";
            btn.style.borderColor = "#bfc6cf";
            btn.style.color = "#374151";
            btn.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)";
        });

        btn.addEventListener("mouseleave", () => {
            btn.style.background = "#ffffff";
            btn.style.borderColor = "#cfd4dc";
            btn.style.color = "#6b7280";
            btn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)";
        });

        btn.addEventListener("focus", () => {
            btn.style.outline = "2px solid #93c5fd";
            btn.style.outlineOffset = "1px";
        });

        btn.addEventListener("blur", () => {
            btn.style.outline = "none";
        });

        btn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            printStoichiometrySheet(reactionIndex);
        }, true);

        return btn;
    }

    function ensurePrintButtons() {
        if (!isElnEntryPage()) return;

        const reactions = getReactionElements();
        if (!reactions.length) return;

        reactions.forEach((reaction, index) => {
            if (reaction.querySelector(`.${BTN_CLASS}[data-reaction-index="${index}"]`)) {
                return;
            }

            const computed = window.getComputedStyle(reaction);
            if (computed.position === "static") {
                reaction.style.position = "relative";
            }

            reaction.appendChild(buildButton(index));
        });
    }

    function formatMass(value) {
        if (value == null || value === "") return "—";

        const num = Number(value);
        if (Number.isNaN(num)) return escapeHtml(value);

        if (num < 0.01) {
            return `${formatNumber(num * 1000, 2)} mg`;
        }

        return `${formatNumber(num, 3)} g`;
    }
    

    function formatNumber(value, digits = 2) {
        if (value == null || value === "") return "—";
        const num = Number(value);
        if (Number.isNaN(num)) return String(value);
        return num.toFixed(digits);
    }

    function formatMmol(value) {
        if (value == null || value === "") return "—";
        const num = Number(value);
        if (Number.isNaN(num)) return "—";
        return `${num * 1000 >= 100 ? (num * 1000).toFixed(1) : (num * 1000).toFixed(2)} mmol`;
    }

    function buildRowsHtml(rows) {
        return rows.map((row, index) => {
            const fw = row.formulaWeight ?? row.molecularWeight;
            const exactMass = row.exactMass;
            const mass = row.mass;
            const volume = row.volume;
            const equivalent = row.equivalent;
            const limiting = row.limitingReagent;
            const mole = row.mole;
            const effectiveMole = row.effectiveMole;

            return `
          <tr class="main-row">
            <td class="col-name compact-name">
              <div class="row-index">${index + 1}</div>
              <div class="name-main">${escapeHtml(row.name)}</div>
            </td>

            <td class="col-properties">
              ${fw != null ? `<div><strong>FW:</strong> ${formatNumber(fw, 2)} g/mol</div>` : ""}
              ${exactMass != null ? `<div class="muted">Exact mass: ${formatNumber(exactMass, 6)} Da</div>` : ""}
              ${row.density != null ? `<div class="muted">Density: ${formatNumber(row.density, 3)} g/cm³</div>` : ""}
              ${row.boilingPoint != null ? `<div class="muted">Boiling point: ${formatNumber(row.boilingPoint, 0)} °C</div>` : ""}
            </td>

            <td class="col-amounts">
              ${mass != null ? `<div><strong>Mass:</strong> ${formatMass(mass)}</div>` : ""}
              ${volume != null ? `<div><strong>Volume:</strong> ${formatNumber(Number(volume) * 1000, 3)} mL</div>` : ""}
            </td>

            <td class="col-calculation">
              ${limiting ? `<div><strong>Limiting reagent</strong></div>` : ""}
              ${equivalent != null ? `<div><strong>Equivalent:</strong> ${formatNumber(equivalent, 2)}</div>` : ""}
              ${mole != null ? `<div><strong>Mole:</strong> ${formatMmol(mole)}</div>` : ""}
              ${effectiveMole != null ? `<div class="muted">Effective mole: ${formatMmol(effectiveMole)}</div>` : ""}
              ${row.yield != null ? `<div class="muted">Yield: ${formatNumber(row.yield, 2)} %</div>` : ""}
            </td>
          </tr>

          <tr class="details-row">
            <td colspan="4" class="row-details">
              <div class="location-line"><strong>Location:</strong> ${escapeHtml(row.location || "Location not set")}</div>
              ${row.subtitle ? `<div class="name-sub"><strong>IUPAC:</strong>${escapeHtml(row.subtitle)}</div>` : ""}
            </td>
          </tr>
        `;
        }).join("");
    }

    function printStoichiometrySheet(reactionIndex) {
        const payload = STATE.reactionPayloads.find(
            p => Number(p.reactionIndex) === Number(reactionIndex)
        );

        const experimentId = payload?.identifier || "Unknown experiment";

        if (!payload?.rows?.length) {
            alert("No stoichiometry data available yet for this reaction.");
            return;
        }

        const imageHtml = getReactionImageHtmlForIndex(reactionIndex);
        const rowsHtml = buildRowsHtml(payload.rows);

        const html = `
      <html lang="es">
        <head>
         <title>${escapeHtml(experimentId)} - ${escapeHtml(payload.title || "Stoichiometry Sheet")}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm;
            }

            body {
              font-family: Arial, sans-serif;
              color: #111;
              margin: 0;
              padding: 0;
            }

            .page {
              width: 100%;
            }

            .header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 8px;
}

.header-left {
  flex: 1;
  min-width: 0;
}

.header-right {
  flex: 0 0 auto;
  text-align: right;
  padding-left: 16px;
}

.title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 2px;
  line-height: 1.2;
  word-break: break-word;
}

.experiment-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6b7280;
  margin-bottom: 2px;
}

.experiment-id {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

            .meta {
              font-size: 11px;
              color: #666;
              margin-bottom: 14px;
            }

            .scheme {
              border: 1px solid #d1d5db;
              border-radius: 8px;
              padding: 10px 12px;
              margin-bottom: 14px;
              page-break-inside: avoid;
            }

            .scheme img {
              width: 100%;
              height: auto;
              display: block;
            }

           table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

thead {
  display: table-header-group;
}

.main-row {
  border-top: 1px solid #d1d5db;
}

.details-row {
  border-top: none;
}

th, td {
  padding: 10px 8px;
  font-size: 12px;
  text-align: left;
  vertical-align: top;
}

th {
  font-size: 12px;
  font-weight: 700;
  border-bottom: 1px solid #9ca3af;
}

.col-name { width: 24%; }
.col-properties { width: 26%; }
.col-amounts { width: 20%; }
.col-calculation { width: 30%; }

.compact-name .row-index {
  float: left;
  width: 18px;
  color: #444;
}

.compact-name .name-main {
  font-weight: 700;
  color: #1d4ed8;
  margin-left: 22px;
  line-height: 1.2;
  word-break: break-word;
}

.row-details {
  padding-top: 0;
  padding-left: 30px;
  padding-bottom: 8px;
}

.location-line {
  margin-top: 0;
  margin-bottom: 1px;
  font-size: 11px;
  color: #1f2937;
  line-height: 1.15;
  word-break: break-word;
}

.name-sub {
  margin-top: 0;
  margin-bottom: 0;
  font-size: 10px;
  color: #6b7280;
  line-height: 1.1;
  word-break: break-word;
}

.muted {
  color: #6b7280;
  margin-top: 1px;
  line-height: 1.2;
}

            .print-footer {
              margin-top: 24px;
              padding-top: 8px;
              border-top: 1px solid #d1d5db;
              font-size: 9px;
              color: #9ca3af;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="page">
           <div class="header">
  <div class="header-left">
    <div class="title">${escapeHtml(payload.title || "Stoichiometry Sheet")}</div>
  </div>
  <div class="header-right">
    <div class="experiment-label">Experiment ID</div>
    <div class="experiment-id">${escapeHtml(experimentId)}</div>
  </div>
</div>

<div class="meta">
  <div><strong>Source:</strong> ${escapeHtml(location.href)}</div>
  <div><strong>Printed:</strong> ${escapeHtml(new Date().toLocaleString())}</div>
  <div><strong>Reaction index:</strong> ${reactionIndex + 1}</div>
</div>

            ${imageHtml ? `<div class="scheme">${imageHtml}</div>` : ""}

            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Properties</th>
                  <th>Amounts</th>
                  <th>Calculation</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="print-footer">
              Custom print layout generated by CDD Stoichiometry Print Button. Written by Matus Drexler
            </div>
          </div>
        </body>
      </html>
    `;

        window.postMessage(
            {
                source: "CDD_STOICH_PLUGIN",
                type: "CDD_STOICH_PRINT_REQUEST",
                payload: {
                    html
                }
            },
            "*"
        );
    }
    function ensureDepletedStyle() {
        if (document.getElementById("cdd-depleted-style")) return;

        const style = document.createElement("style");
        style.id = "cdd-depleted-style";
        style.textContent = `
    .cdd-depleted-sample {
      opacity: 0.45 !important;
    }

    .cdd-depleted-sample,
    .cdd-depleted-sample * {
      text-decoration: line-through !important;
    }
  `;

        document.documentElement.appendChild(style);
    }

    function markDepletedSamplesInSelector() {
        ensureDepletedStyle();

        const depleted = STATE.depletedIdentifiers;
        if (!depleted || !depleted.size) return;

        document.querySelectorAll('input[type="radio"][value]').forEach((input) => {
            const value = String(input.value || "").trim();

            const wrapper =
                input.closest('[data-autotest-id="radio-button"]')?.parentElement ||
                input.closest('[data-component="Box"]') ||
                input.parentElement;

            if (!wrapper) return;

            wrapper.classList.toggle("cdd-depleted-sample", depleted.has(value));
        });
    }

    function handleMessage(event) {
        if (event.source !== window) return;
        if (!event.data || event.data.source !== "CDD_STOICH_PRINT_PLUGIN") return;

        if (event.data.type === "CDD_STOICH_PRINT_DATA") {
            const incomingPayload = event.data.payload || {};

            STATE.reactionPayloads = Array.isArray(incomingPayload.reactionPayloads)
                ? incomingPayload.reactionPayloads
                : [];

            const incomingDepleted = Array.isArray(incomingPayload.depletedIdentifiers)
                ? incomingPayload.depletedIdentifiers
                : [];

            if (incomingDepleted.length > 0) {
                STATE.depletedIdentifiers = new Set(incomingDepleted);
            }

            console.log("[CDD depleted] active state:", [...STATE.depletedIdentifiers]);
            console.log("[CDD reactions] payload count:", STATE.reactionPayloads.length);

            ensurePrintButtons();
            markDepletedSamplesInSelector();
        }
    }

    function watchDom() {
        const observer = new MutationObserver(() => {
            ensurePrintButtons();
            markDepletedSamplesInSelector();
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    function watchUrlChanges() {
        setInterval(() => {
            if (location.href !== STATE.lastUrl) {
                STATE.lastUrl = location.href;
                //STATE.depletedIdentifiers = new Set();

                setTimeout(() => {
                    ensurePrintButtons();
                }, 500);
            }
        }, 500);
    }

  function init() {
    if (!/collaborativedrug\.com/.test(location.hostname)) return;

    injectPageScript();
    window.addEventListener("message", handleMessage);
    watchDom();
    watchUrlChanges();

    if (isElnEntryPage()) {
      ensurePrintButtons();
    }
  }

  init();
})();