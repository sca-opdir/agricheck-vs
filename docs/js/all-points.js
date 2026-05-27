// Fonction pour générer la requête SPARQL avec la langue active
function getQuery(lang) {
  return `
PREFIX schema: <http://schema.org/>
PREFIX : <https://agriculture.ld.admin.ch/inspection/>
SELECT (GROUP_CONCAT(?parentName; separator=" / ") AS ?hierarchy) ?code_full ?code ?label
WHERE {
  VALUES ?lang { "${lang}" }
  ?point a :InspectionPoint ; schema:name ?label .
  FILTER(LANG(?label) = ?lang)
  OPTIONAL { ?point schema:identifier ?code }
  OPTIONAL { ?point :conjunctIdentifier ?code_full }
  ?point (:belongsToGroup|schema:isPartOf)+ ?parent .
  ?parent schema:name ?parentName .
  FILTER(LANG(?parentName) = ?lang)
  FILTER(?parent != ?point && STR(?parentName) != "BFCen" && STR(?parentName) != "BFC")
}
GROUP BY ?point ?label ?code ?code_full
ORDER BY ?hierarchy`;
}

// Initialisation globale synchronisée avec le framework i18n de layout.js
(async function init() {
  try {
    // 1. On attend que le dictionnaire i18n soit prêt
    await window.__i18nReady;

    // 2. On lance la construction initiale de la page
    rebuildPage(window.__APP_LANG || 'fr');

  } catch (error) {
    console.error("Erreur lors de l'initialisation de la page all-points :", error);
    if (typeof window.hideLoader === 'function') {
      window.hideLoader();
    }
  }
})();

// Fonction appelée au démarrage ET à chaque changement de langue à chaud
window.rebuildPage = async function(lang) {
  const tbody = document.getElementById('resultsBody');
  if (!tbody) return;
  
  // On vide le tableau et on affiche le loader
  tbody.innerHTML = '';
  
  const url = "https://lindas.admin.ch/query";
  const sparqlQuery = getQuery(lang);

  try {
    const response = await fetch(`${url}?query=${encodeURIComponent(sparqlQuery)}`, {
      headers: { "Accept": "application/sparql-results+json" }
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    // Remplissage du tableau
    data.results.bindings.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="small text-muted">${row.hierarchy.value}</td>
        <td><strong>${row.code_full?.value || ''}</strong></td>
        <td>${row.code?.value || ''}</td>
        <td>${row.label.value}</td>
      `;
      tbody.appendChild(tr);
    });

    // Si des filtres étaient déjà saisis, on les réapplique sur les nouvelles lignes
    applyFilters();

  } catch (error) {
    console.error("Erreur lors de la récupération SPARQL :", error);
    tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center">Erreur de chargement des points d'inspection.</td></tr>`;
  } finally {
    // Une fois fini, on masque le loader
    if (typeof window.hideLoader === 'function') {
      window.hideLoader();
    }
  }
};

// Logique de filtrage isolée pour pouvoir la réappeler facilement
function applyFilters() {
  const table = document.getElementById('resultsTable');
  if (!table) return;
  
  const rows = table.querySelector('tbody').rows;
  const filterValues = Array.from(document.querySelectorAll('.column-filter')).map(i => i.value.toLowerCase());

  for (const row of rows) {
    let isVisible = true;
    
    filterValues.forEach((val, index) => {
      if (val && !row.cells[index].innerText.toLowerCase().includes(val)) {
        isVisible = false;
      }
    });

    row.style.display = isVisible ? '' : 'none';
  }
}

// Écouteur sur les champs de filtrage de colonnes
document.querySelectorAll('.column-filter').forEach(input => {
  input.addEventListener('keyup', applyFilters);
});
