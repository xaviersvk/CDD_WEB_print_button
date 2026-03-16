(() => {
    if (window.__CDD_STOICH_PRINT_HOOKED_V2__) return;
    window.__CDD_STOICH_PRINT_HOOKED_V2__ = true;
    const STOICH_STATE = {
        lastNonEmptyDepletedIdentifiers: [],
        lastNonEmptyRows: []
    };

  function post(type, payload) {
    window.postMessage(
      {
        source: "CDD_STOICH_PRINT_PLUGIN",
        type,
        payload
      },
      "*"
    );
  }

  function normalizeFeatures(featureMap) {
    if (!featureMap) return [];
    if (Array.isArray(featureMap)) return featureMap;
    if (typeof featureMap === "object") return Object.values(featureMap);
    return [];
  }

    function getReactionFeatures(payload) {
        const features = normalizeFeatures(payload?.eln_entry?.feature_map);

        return features.filter(
            (f) => f?.type === "reaction" && f?.data?.stoichiometryTable
        );
    }


    window.addEventListener("message", (event) => {
        if (event.source !== window) return;

        const data = event.data;
        if (!data || data.source !== "CDD_STOICH_PLUGIN") return;
        if (data.type !== "CDD_STOICH_PRINT_REQUEST") return;

        const html = data.payload?.html;

        // printHtmlViaIframe(html);
    });

  function getReactionTitle(payload) {
    return (
      payload?.eln_entry?.title ||
      payload?.eln_entry?.displayTitle ||
      "Stoichiometry Sheet"
    );
  }
    function resolveDisplayName(row) {
        const sample = row?.sample || {};
        const batch = row?.batch || {};

        const batchName =
            typeof batch?.name === "string" ? batch.name.trim() : "";

        const isBadBatchName =
            !batchName ||
            batchName.toLowerCase() === "unspecified batch";

        return (
            sample?.name ||
            sample?.sample_identifier ||
            row?.name ||
            row?.iupacName ||
            row?.moleculeName ||
            row?.batch?.synonyms ||
            (!isBadBatchName ? batchName : null) ||
            "Unnamed sample"
        );
    }

    function resolveRowData(row) {
        const sample = row?.sample || {};

        return {
            uid: row?.uid ?? null,
            role: row?.role ?? "",
            rowType: row?.rowType ?? "",
            name: resolveDisplayName(row),
            subtitle: row?.iupacName || row?.moleculeName || "",
            location: sample?.location?.value || "Location not set",

            formulaWeight: row?.formulaWeight ?? row?.molecularWeight ?? null,
            molecularWeight: row?.molecularWeight ?? null,
            exactMass: row?.exactMass ?? null,
            formula: row?.formula ?? null,
            density: row?.density ?? null,
            boilingPoint: row?.boilingPoint ?? null,

            mass: row?.mass ?? null,
            volume: row?.volume ?? null,
            mole: row?.mole ?? null,
            effectiveMole: row?.moleffective ?? null,
            equivalent: row?.equivalent ?? null,
            limitingReagent: !!row?.limitingReagent,
            yield: row?.yield ?? null
        };
    }

    function extractRows(stoichTable) {
        const rows = Array.isArray(stoichTable?.rows) ? stoichTable.rows : [];

        return rows
            .filter((row) => {
               // if (!row || !row.sample) return false;

                const role = String(row.role || "").toLowerCase();

                // Do reportu nechceme produkty
                return role !== "product";


            })
            .map(resolveRowData);
    }
    function extractDepletedIdentifiers(stoichTable) {
        const depletedIdentifiers = new Set();
        const samples = stoichTable?.samples || {};

        for (const arr of Object.values(samples)) {
            if (!Array.isArray(arr)) continue;

            for (const sample of arr) {
                if (sample?.depleted === true && sample?.sample_identifier) {
                    depletedIdentifiers.add(String(sample.sample_identifier));
                }
            }
        }

        return Array.from(depletedIdentifiers);
    }
    function processJsonPayload(data) {
        if (!data || typeof data !== "object") return;
        const experimentIdentifier = data?.eln_entry?.identifier || null;
        const reactionFeatures = getReactionFeatures(data);
        if (!reactionFeatures.length) return;

        const reactionPayloads = [];
        const allDepleted = new Set();

        reactionFeatures.forEach((feature, index) => {
            const stoichTable = feature?.data?.stoichiometryTable;
            if (!stoichTable) return;

            const rows = extractRows(stoichTable);
            const depletedIdentifiers = extractDepletedIdentifiers(stoichTable);

            if (rows.length > 0) {
                STOICH_STATE.lastNonEmptyRows[index] = rows;
            }

            if (depletedIdentifiers.length > 0) {
                STOICH_STATE.lastNonEmptyDepletedIdentifiers[index] = depletedIdentifiers;
            }

            const rowsToSend =
                rows.length > 0 ? rows : (STOICH_STATE.lastNonEmptyRows[index] || []);

            const depletedToSend =
                depletedIdentifiers.length > 0
                    ? depletedIdentifiers
                    : (STOICH_STATE.lastNonEmptyDepletedIdentifiers[index] || []);

            depletedToSend.forEach(id => allDepleted.add(id));

            if (!rowsToSend.length && !depletedToSend.length) return;

            reactionPayloads.push({
                reactionIndex: index,
                title: getReactionTitle(data),
                identifier: experimentIdentifier,
                rows: rowsToSend,
                depletedIdentifiers: depletedToSend
            });
        });

        if (!reactionPayloads.length && !allDepleted.size) return;

        post("CDD_STOICH_PRINT_DATA", {
            reactionPayloads,
            depletedIdentifiers: Array.from(allDepleted),
            identifier: experimentIdentifier
        });
    }

  function tryParseText(text) {
    if (!text || typeof text !== "string") return;
    try {
      processJsonPayload(JSON.parse(text));
    } catch (_) {
      // ignore
    }
  }

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);

    try {
      const clone = res.clone();
      const contentType = clone.headers.get("content-type") || "";

      if (
        contentType.includes("application/json") ||
        contentType.includes("text/json")
      ) {
        processJsonPayload(await clone.json());
      } else {
        tryParseText(await clone.text());
      }
    } catch (err) {
      console.debug("[CDD Stoich Print Plugin] fetch parse failed", err);
    }

    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__cdd_url = url;
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        if (
          this.responseType &&
          this.responseType !== "" &&
          this.responseType !== "text"
        ) {
          return;
        }
        tryParseText(this.responseText);
      } catch (err) {
        console.debug("[CDD Stoich Print Plugin] xhr parse failed", err);
      }
    });

    return origSend.apply(this, args);
  };

  console.debug("[CDD Stoich Print Plugin] hooks installed");
})();