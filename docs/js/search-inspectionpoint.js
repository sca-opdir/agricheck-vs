// On attend que le i18n soit prêt si nécessaire, mais layout.js s'occupe déjà du cycle global
await window.__i18nReady;

// Références vers les éléments du DOM de ta page de recherche
const keywordInput     = document.getElementById('keywordInput');
const submitSearchBtn  = document.getElementById('submitSearchBtn');
const searchStatus     = document.getElementById('searchStatus');
const errorMessage     = document.getElementById('errorMessage');
const resultsCard      = document.getElementById('resultsCard');
const resultsTableBody = document.getElementById('resultsTableBody');
const matchCount       = document.getElementById('matchCount');

// Variable globale pour stocker les derniers résultats de recherche SPARQL (si l'utilisateur change de langue après avoir cherché)
let lastSearchBindings = [];

// Fonction de reconstruction globale appelée par layout.js lors d'un changement de langue
window.rebuildPage = function(lang) {
  // 1. Mettre à jour manuellement le placeholder de l'input (les attributs standards sont gérés par applyTranslations)
  if (keywordInput && typeof window.t === 'function') {
    keywordInput.placeholder = window.t('searchPage.placeholder') || "Saisissez un mot-clé...";
  }

  // 2. Si des résultats de recherche sont actuellement affichés, on les redessine instantanément dans la bonne langue
  if (lastSearchBindings.length > 0) {
    renderResults(lastSearchBindings, lang);
  }
};

// Écouteur sur le bouton de recherche
submitSearchBtn.addEventListener('click', () => {
  executeSearch();
});

// Écouteur sur la touche Entrée dans le champ de saisie
keywordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    executeSearch();
  }
});

// Fonction principale d'interrogation SPARQL (LINDAS)
async function executeSearch() {
  const queryText = keywordInput.value.trim();
  if (!queryText) return;

  // Réinitialisation de l'affichage
  searchStatus.classList.remove('d-none');
  errorMessage.classList.add('d-none');
  resultsCard.classList.add('d-none');
  resultsTableBody.innerHTML = '';
  lastSearchBindings = [];

  const currentLang = window.__APP_LANG || 'fr';

  // Ta requête SPARQL adaptée pour filtrer selon la langue active
  const sparqlQuery = `
    PREFIX : <https://agriculture.ld.admin.ch/inspection/>
    PREFIX schema: <http://schema.org/>
    
    SELECT ?point ?codeFull ?code ?label ?description ?hierarchy
    WHERE {
      ?point a :InspectionPoint ;
             schema:name ?label .
      FILTER(LANG(?label) = "${currentLang}")
      FILTER(CONTAINS(LCASE(?label), LCASE("${queryText}")))
      
      OPTIONAL { ?point :conjunctIdentifier ?codeFull . }
      OPTIONAL { ?point :identifier ?code . }
      OPTIONAL { 
        ?point schema:description ?description . 
        FILTER(LANG(?description) = "${currentLang}")
      }
      OPTIONAL { ?point :hierarchy ?hierarchy . }
    }
    LIMIT 100
  `;

  const url = `https://agriculture.ld.admin.ch/query?query=${encodeURIComponent(sparqlQuery)}`;

  try {
    const response = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
    if (!response.ok) throw new Error("Erreur lors de la requête fédérale.");
    
    const data = await response.json();
    lastSearchBindings = data.results.bindings;

    // Masquer le spinner
    searchStatus.classList.add('d-none');

    if (lastSearchBindings.length === 0) {
      errorMessage.textContent = "Aucun point de contrôle ne correspond à ce mot-clé.";
      errorMessage.classList.remove('d-none');
      return;
    }

    // Affichage des lignes du tableau
    renderResults(lastSearchBindings, currentLang);
    resultsCard.classList.remove('d-none');

  } catch (error) {
    console.error(error);
    searchStatus.classList.add('d-none');
    errorMessage.textContent = "Impossible de joindre le serveur LINDAS. Veuillez réessayer.";
    errorMessage.classList.remove('d-none');
  }
}

// Fonction isolée pour dessiner le tableau (appelée à la recherche ET au rebuildPage)
function renderResults(bindings, lang) {
  resultsTableBody.innerHTML = '';
  matchCount.textContent = bindings.length;

  bindings.forEach(b => {
    const pointUri = b.point?.value || '';
    const codeFull = b.codeFull?.value || '-';
    const code     = b.code?.value || '-';
    const label    = b.label?.value || 'Sans titre';
    const desc     = b.description?.value || '';
    const hier     = b.hierarchy?.value || '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="small text-muted">${hier}</td>
      <td class="fw-bold">${codeFull}</td>
      <td><span class="badge bg-light text-dark border">${code}</span></td>
      <td class="fw-semibold">${label}</td>
      <td class="small text-secondary">${desc}</td>
      <td class="text-center">
        <a href="checklist.html?groups=${encodeURIComponent(pointUri.split('/').pop())}" class="btn btn-sm btn-outline-primary" target="_blank">
          <i class="bi bi-eye"></i>
        </a>
      </td>
    `;
    resultsTableBody.appendChild(tr);
  });
}

// Appel initial unique pour configurer le placeholder au chargement initial de la page
if (keywordInput && typeof window.t === 'function') {
  keywordInput.placeholder = window.t('searchPage.placeholder') || "Saisissez un mot-clé...";
}
