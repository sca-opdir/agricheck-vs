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
  
  // 2. Traduire les interfaces
  await translatePage(lang);
  
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


// Remplacez votre fonction applyFilters par celle-ci :
function applyFilters() {
  // On cible uniquement la table qui est dans l'onglet actif (visible)
  const activeTable = document.querySelector('.tab-pane.active table');
  if (!activeTable) return;

  const rows = activeTable.querySelector('tbody').rows;
  // On récupère les inputs de la table active uniquement
  const filters = activeTable.querySelectorAll('.column-filter');

  for (const row of rows) {
    let isVisible = true;
    filters.forEach((input) => {
      const colIndex = input.getAttribute('data-col');
      const filterValue = input.value.toLowerCase();
      const cellText = row.cells[colIndex].innerText.toLowerCase();
      
      if (filterValue && !cellText.includes(filterValue)) {
        isVisible = false;
      }
    });
    row.style.display = isVisible ? '' : 'none';
  }
}

// Fonction pour traduire les éléments de la page all-points
async function translatePage(lang) {
  // On récupère le dictionnaire de traduction via l'objet global si disponible, 
  // ou on utilise une logique de remplacement simple
  const translations = window.translations ? window.translations[lang] : null;
  if (!translations || !translations.allPoints) return;

  const t = translations.allPoints;

  // Mise à jour des onglets
  document.getElementById('query-tab').textContent = lang === 'de' ? 'Sans tag / Up-to-date' : 'Sans tag / Up-to-date'; // Adaptez selon besoin
  document.getElementById('csv-tab').textContent = lang === 'de' ? 'Mit Tag / Frozen' : 'Avec tag / Frozen';

  // Mise à jour des en-têtes de colonnes (Query)
  const headersQuery = document.querySelectorAll('#resultsTableQuery th');
  if (headersQuery.length >= 4) {
    headersQuery[0].textContent = t.thHierarchy;
    headersQuery[1].textContent = t.thCodeFull;
    headersQuery[2].textContent = t.thCode;
    headersQuery[3].textContent = t.thLabel;
  }

  // Mise à jour des en-têtes de colonnes (CSV)
  const headersCSV = document.querySelectorAll('#resultsTableCSV th');
  if (headersCSV.length >= 4) {
    headersCSV[0].textContent = t.thHierarchy;
    headersCSV[1].textContent = t.thCode;
    headersCSV[2].textContent = t.thLabel;
    headersCSV[3].textContent = "Tags"; // Ou t.thTags si défini
  }
}

// Ajouter l'écouteur d'événements globalement
document.addEventListener('keyup', function(e) {
  if (e.target.classList.contains('column-filter')) {
    applyFilters();
  }
});
