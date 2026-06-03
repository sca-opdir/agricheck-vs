const CSV_URL =
  "https://raw.githubusercontent.com/sca-opdir/agricheck-vs/main/data/points_de_contr%C3%B4le_2026-05-20_addedKeywords_embeddings_tsneviz.csv";

function getQuery(lang) {
  return `
PREFIX schema: <http://schema.org/>
PREFIX : <https://agriculture.ld.admin.ch/inspection/>

SELECT (GROUP_CONCAT(?parentName; separator=" / ") AS ?hierarchy)
       ?code_full
       ?code
       ?label
WHERE {
  VALUES ?lang { "${lang}" }

  ?point a :InspectionPoint ;
         schema:name ?label .

  FILTER(LANG(?label) = ?lang)

  OPTIONAL { ?point schema:identifier ?code }
  OPTIONAL { ?point :conjunctIdentifier ?code_full }

  ?point (:belongsToGroup|schema:isPartOf)+ ?parent .

  ?parent schema:name ?parentName .
  FILTER(LANG(?parentName) = ?lang)

  FILTER(?parent != ?point)
  FILTER(STR(?parentName) != "BFCen")
  FILTER(STR(?parentName) != "BFC")
}
GROUP BY ?point ?label ?code ?code_full
ORDER BY ?hierarchy
`;
}

(async function init() {
  try {
    await window.__i18nReady;
    await rebuildPage(window.__APP_LANG || "fr");
  } catch (error) {
    console.error("Erreur initialisation all-points :", error);
    hideLoaderSafe();
  }
})();


window.rebuildPage = async function(lang) {
  // 1. Charger les données
  await loadQueryTable(lang);
  await loadCsvTable();
  
  hideLoaderSafe();
};

async function loadQueryTable(lang) {
  const tbody = document.getElementById("resultsBodyQuery");
  if (!tbody) return;
 
  tbody.innerHTML = "";

  const url = "https://lindas.admin.ch/query";
  const sparqlQuery = getQuery(lang);

  try {
    const response = await fetch(`${url}?query=${encodeURIComponent(sparqlQuery)}`, {
      headers: {
        Accept: "application/sparql-results+json"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    data.results.bindings.forEach(row => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td class="small text-muted">${row.hierarchy?.value || ""}</td>
        <td><strong>${row.code_full?.value || ""}</strong></td>
        <td>${row.code?.value || ""}</td>
        <td>${row.label?.value || ""}</td>
      `;

      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error("Erreur SPARQL :", error);

    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-danger text-center">
          Erreur de chargement des points d'inspection.
        </td>
      </tr>
    `;
  }
}

async function loadCsvTable() {
  const tbody = document.getElementById("resultsBodyCSV");
  if (!tbody) return;
  console.log("Tentative de chargement du CSV..."); // <--- AJOUTEZ CECI
  tbody.innerHTML = "";

  if (typeof Papa === "undefined") {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-danger text-center">
          PapaParse n'est pas chargé.
        </td>
      </tr>
    `;
    return;
  }

  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    delimiter: ";",
    skipEmptyLines: true,

    complete: function(results) {
      console.log("CSV chargé avec succès, lignes :", results.data.length);
      results.data.forEach(row => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td class="small text-muted">${row.hierarchy || row.Hierarchy || ""}</td>
          <td>${row.code || row.Code || row.code_full || ""}</td>
          <td>${row.label || row.Label || row.point || ""}</td>
          <td><span class="badge bg-info">${row.Tags || row.tags || "-"}</span></td>
        `;

        tbody.appendChild(tr);
      });
    },

    error: function(error) {
      console.error("Erreur CSV :", error);

      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-danger text-center">
            Erreur de chargement du fichier CSV.
          </td>
        </tr>
      `;
    }
  });
}

function hideLoaderSafe() {
  if (typeof window.hideLoader === "function") {
    window.hideLoader();
  }
}


function applyFilters() {
  const activeTable = document.querySelector('.tab-pane.active table');
  if (!activeTable) return;

  const rows = activeTable.querySelector('tbody').rows;
  const filters = activeTable.querySelectorAll('.column-filter');

  for (const row of rows) {
    let isVisible = true;
    filters.forEach((input) => {
      const colIndex = parseInt(input.getAttribute('data-col'));
      const filterValue = input.value.toLowerCase();
      
      // Sécurité : vérifie que la cellule existe avant d'accéder à innerText
      const cell = row.cells[colIndex];
      const cellText = cell ? cell.innerText.toLowerCase() : "";
      
      if (filterValue && !cellText.includes(filterValue)) {
        isVisible = false;
      }
    });
    row.style.display = isVisible ? '' : 'none';
  }
}

document.addEventListener('input', function(e) {
  if (e.target.classList.contains('column-filter')) {
    applyFilters();
  }
});
