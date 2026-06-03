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
      const allTags = new Set();
      
      results.data.forEach(row => {
        const tr = document.createElement("tr");
        const tagsRaw = row.Tags || row.tags || "";
        
        // Extraction des tags pour le dropdown
        tagsRaw.split(',').forEach(t => {
          const trimmed = t.trim();
          if (trimmed) allTags.add(trimmed);
        });

        tr.innerHTML = `
          <td class="small text-muted">${row.hierarchy || row.Hierarchy || ""}</td>
          <td>${row.code || row.Code || row.code_full || ""}</td>
          <td>${row.label || row.Label || row.point || ""}</td>
          <td class="tag-cell">${tagsRaw}</td> 
        `;
        tbody.appendChild(tr);
      });

      // Création dynamique du dropdown
      renderTagDropdown(Array.from(allTags).sort());
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

let filterTimer = null;

function applyFilters() {
  const activePane = document.querySelector('.tab-pane.active');
  const tbody = activePane.querySelector('tbody');
  const rows = Array.from(tbody.rows);
  
  // 1. Filtres textes classiques
  const textFilters = Array.from(activePane.querySelectorAll('.column-filter')).filter(i => i.value !== '');
  
  // 2. Filtres tags (checkboxes cochées)
  const checkedTags = Array.from(activePane.querySelectorAll('.tag-checkbox:checked')).map(c => c.value);

  rows.forEach(row => {
    // Filtre texte
    const textMatch = textFilters.every(f => {
      const cell = row.cells[Number(f.dataset.col)];
      return cell.textContent.toLowerCase().includes(f.value.toLowerCase());
    });

    // Filtre tags (on vérifie si la cellule contient TOUS les tags sélectionnés)
    const tagCellText = row.cells[3].textContent;
    const tagMatch = checkedTags.every(tag => tagCellText.includes(tag));

    row.style.display = (textMatch && tagMatch) ? '' : 'none';
  });
}

// Écouteur pour les checkboxes
document.addEventListener('change', function(e) {
  if (e.target.classList.contains('tag-checkbox')) {
    applyFilters();
  }
});

document.addEventListener('input', function(e) {
  if (!e.target.classList.contains('column-filter')) return;

  clearTimeout(filterTimer);

  filterTimer = setTimeout(() => {
    applyFilters();
  }, 250);
});
function renderTagDropdown(tags) {
  const filterCell = document.querySelector('th[data-col="3"]'); // Correspond à la colonne Tags
  if (!filterCell) return;

  filterCell.innerHTML = `
    <div class="dropdown">
      <button class="btn btn-sm btn-light border dropdown-toggle w-100" type="button" data-bs-toggle="dropdown" aria-expanded="false">
        Filtrer tags
      </button>
      <ul class="dropdown-menu p-2" style="max-height: 300px; overflow-y: auto;">
        ${tags.map(tag => `
          <li>
            <label class="dropdown-item">
              <input type="checkbox" class="tag-checkbox" value="${tag}"> ${tag}
            </label>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}
