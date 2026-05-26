document.getElementById('submitSearchBtn').addEventListener('click', performSparqlSearch);
document.getElementById('keywordInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSparqlSearch();
});

// Adapter dynamiquement le placeholder de l'input selon la langue au chargement
window.addEventListener('DOMContentLoaded', () => {
    const currentLang = localStorage.getItem('lang') || 'de'; // Récupère la langue active
    const input = document.getElementById('keywordInput');
    if (currentLang === 'fr') input.placeholder = "Mot-clé en français...";
    else if (currentLang === 'it') input.placeholder = "Parola chiave in italiano...";
    else input.placeholder = "Stichwort auf Deutsch...";
});

async function performSparqlSearch() {
    const keyword = document.getElementById('keywordInput').value.trim();
    const statusEl = document.getElementById('searchStatus');
    const errorEl = document.getElementById('errorMessage');
    const resultsCard = document.getElementById('resultsCard');
    const tableBody = document.getElementById('resultsTableBody');
    const matchCountEl = document.getElementById('matchCount');

    if (!keyword) return;

    statusEl.classList.remove('d-none');
    errorEl.classList.add('d-none');
    resultsCard.classList.add('d-none');
    tableBody.innerHTML = '';

    // 1. RECUPERATION DE LA LANGUE ACTIVE DU HEADER
    const currentLang = localStorage.getItem('lang') || 'de'; 

    // 2. REQUETE SPARQL DYNAMISÉE AVEC LA LANGUE
    const query = `PREFIX schema: <http://schema.org/>
PREFIX : <https://agriculture.ld.admin.ch/inspection/>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT (GROUP_CONCAT(?parentName; separator=" / ") AS ?hierarchy) ?code_full ?code ?label ?description ?point
WHERE {
  # On applique la langue du header partout
  VALUES ?lang { "${currentLang}" }

  ?point a :InspectionPoint .
  
  # On cherche le nom dans la langue active
  ?point schema:name ?label .
  FILTER(LANG(?label) = ?lang)
  
  # On cherche la description dans la langue active (si elle existe)
  OPTIONAL {
    ?point schema:description ?description .
    FILTER(LANG(?description) = ?lang)
  }
  
  # Le filtre REGEX s'applique maintenant sur les textes de la langue choisie !
  FILTER(
    REGEX(?label, "${keyword}", "i") || 
    (BOUND(?description) && REGEX(?description, "${keyword}", "i"))
  )

  # Récupération des codes
  OPTIONAL { ?point schema:identifier ?code }
  OPTIONAL { ?point :conjunctIdentifier ?code_full }

  # Remontée de la hiérarchie traduite dans la bonne langue
  ?point (:belongsToGroup|schema:isPartOf)+ ?parent .
  ?parent schema:name ?parentName .
  FILTER(LANG(?parentName) = ?lang)
  
  FILTER(?parent != ?point)
  FILTER(STR(?parentName) != "BFCen" && STR(?parentName) != "BFC")
}
GROUP BY ?point ?label ?code ?code_full ?description
ORDER BY ?hierarchy
LIMIT 100`;

    const url = "https://lindas.admin.ch/query?query=" + encodeURIComponent(query);

    try {
        const response = await fetch(url, {
            headers: { "Accept": "application/sparql-results+json" }
        });

        if (!response.ok) throw new Error(`Erreur LINDAS: ${response.status}`);

        const data = await response.json();
        const bindings = data.results.bindings;

        if (bindings.length === 0) {
            errorEl.innerText = currentLang === 'fr' ? "Aucun résultat trouvé." : (currentLang === 'it' ? "Nessun risultato trovato." : "Keine Ergebnisse gefunden.");
            errorEl.classList.remove('d-none');
            statusEl.classList.add('d-none');
            return;
        }

        bindings.forEach(row => {
            const tr = document.createElement('tr');
            
            const hierarchy = row.hierarchy ? row.hierarchy.value : '-';
            const codeFull = row.code_full ? row.code_full.value : '-';
            const codeShort = row.code ? row.code.value : '-';
            const label = row.label ? row.label.value : '';
            const description = row.description ? row.description.value : '-';
            const pointUri = row.point ? row.point.value : '#';

            tr.innerHTML = `
                <td><small class="text-muted">${hierarchy}</small></td>
                <td><code>${codeFull}</code></td>
                <td><code>${codeShort}</code></td>
                <td class="fw-semibold">${label}</td>
                <td><small>${description}</small></td>
                <td class="text-center">
                    <a href="${pointUri}" target="_blank" class="btn btn-sm btn-outline-info">
                        <i class="bi bi-box-arrow-up-right"></i>
                    </a>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        matchCountEl.innerText = bindings.length;
        resultsCard.classList.remove('d-none');

    } catch (err) {
        console.error(err);
        errorEl.innerText = "Erreur : " + err.message;
        errorEl.classList.remove('d-none');
    } finally {
        statusEl.classList.add('d-none');
    }
}
