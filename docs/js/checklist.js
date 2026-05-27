import { fetchBindings, buildNodeMap } from './model.js';

const BASE_URI = 'https://agriculture.ld.admin.ch/inspection/';
const content      = document.getElementById('content');
const metaDateEl   = document.getElementById('metaDate');
const printBtn     = document.getElementById('printBtn');
const copyLinkBtn  = document.getElementById('copyLinkBtn');
const btnCheckAll  = document.getElementById('btnCheckAll');
const btnUncheckAll = document.getElementById('btnUncheckAll');

let nodeMap;
let similarityMatrix = null; // Stockera les données du JSON matriciel

// Raccourci sécurisé pour la traduction
function safeT(key) {
  if (typeof window.t === 'function') return window.t(key);
  if (typeof globalThis.t === 'function') return globalThis.t(key);
  return key; 
}

// Fonction sécurisée pour le texte localisé (évite le crash si layout.js n'a pas fini)
function safeGetLocalizedText(obj, lang, fallbackToFirst = true) {
  if (typeof window.getLocalizedText === 'function') {
    return window.getLocalizedText(obj, lang, fallbackToFirst);
  }
  if (obj && typeof obj === 'object') {
    return obj[lang] || Object.values(obj)[0] || '';
  }
  return obj || '';
}

// Écouteurs d'événements pour les boutons de contrôle de la page
if (printBtn) printBtn.addEventListener('click', () => window.print());

if (copyLinkBtn) {
  copyLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(location.href).then(() => {
      copyLinkBtn.classList.replace('btn-outline-secondary', 'btn-success');
      copyLinkBtn.innerHTML = `<i class="bi bi-clipboard-check"></i> ${safeT('copied')}`;
      setTimeout(() => {
        copyLinkBtn.classList.replace('btn-success', 'btn-outline-secondary');
        copyLinkBtn.innerHTML = `<i class="bi bi-clipboard"></i> ${safeT('copyLink')}`;
      }, 2000);
    });
  });
}

if (btnCheckAll) {
  btnCheckAll.addEventListener('click', () => {
    document.querySelectorAll('.checklist input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
    });
  });
}

if (btnUncheckAll) {
  btnUncheckAll.addEventListener('click', () => {
    document.querySelectorAll('.checklist input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
  });
}

// Initialisation globale
(async function init() {
  try {
    // 1. On attend que layout.js signale qu'il est prêt
    await window.__i18nReady;

    // 2. On lance le téléchargement des structures principales
    const bindings = await fetchBindings();
    nodeMap = buildNodeMap(bindings);

    // 3. On charge la matrice de similarité
    try {
      const res = await fetch('https://raw.githubusercontent.com/sca-opdir/agricheck-vs/main/data/points_de_contr%C3%B4le_2026-05-20_addedKeywords_embeddings_matrixsim.json');
      if (!res.ok) throw new Error(`Statut HTTP: ${res.status}`);
      similarityMatrix = await res.json();
    } catch (jsonError) {
      console.error("⚠️ Impossible de charger la matrice sémantique :", jsonError);
      similarityMatrix = "ERROR"; 
    }

    // 4. On génère la page avec la bonne langue
    rebuildPage(window.__APP_LANG || 'fr');

  } catch (error) {
    console.error("❌ Erreur critique lors de l'initialisation d'Agricheck:", error);
    if (content) {
      content.innerHTML = `<p class="alert alert-danger">Une erreur critique est survenue lors du chargement des données principales.</p>`;
    }
  }

  if (typeof window.hideLoader === 'function') {
    window.hideLoader();
  }
})();

function addDescendantsAndSelf(uri, set) {
  if (!uri || set.has(uri)) return;
  set.add(uri);
  const node = nodeMap.get(uri);
  (node?.subGroups ?? []).forEach(subUri => addDescendantsAndSelf(subUri, set));
}

window.rebuildPage = function(lang) {
  if (!content) return;
  content.innerHTML = '';
  
  if (metaDateEl) {
    metaDateEl.textContent = new Date().toLocaleDateString(lang, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  const params    = new URLSearchParams(location.search);
  const slugParam = params.get('groups');

  if (!slugParam) {
    content.innerHTML = `<p class="text-danger">${safeT('noGroups')}</p>`;
    return;
  }
  
  const groupUris = slugParam.split(',')
    .map(decodeURIComponent)
    .map(slug => BASE_URI + slug);
    
  const displayableUris = new Set();
  groupUris.forEach(uri => {
    addDescendantsAndSelf(uri, displayableUris);
    let current = nodeMap.get(uri);
    while (current) {
      const parentUri = current.superGroup || current.parentGroup;
      if (parentUri) {
        displayableUris.add(parentUri);
        current = nodeMap.get(parentUri);
      } else {
        break;
      }
    }
  });
  
  const rootNodes = [...displayableUris].filter(uri => {
    const node = nodeMap.get(uri);
    const parentUri = node?.superGroup || node?.parentGroup;
    return !parentUri || !displayableUris.has(parentUri);
  });
  
  rootNodes.forEach((uri, idx) => renderCollection(uri, [idx + 1], lang, displayableUris));
};

function renderCollection(uri, numbers, lang, displayableUris) {
  if (!displayableUris.has(uri)) return;
  
  const node = nodeMap.get(uri);
  if (!node) return;

  const collectionId = node.conjunctIdentifier || node.identifier;
  const idBadge = collectionId ? ` (${collectionId})` : '';

  const hLevel  = Math.min(numbers.length, 6);
  const heading = document.createElement('h' + hLevel);
  const numSpan = document.createElement('span');
  numSpan.className = 'section-number';
  numSpan.textContent = numbers.join('.');
  
  heading.appendChild(numSpan);
  // CORRECTION ICI : Utilisation du wrapper sécurisé safeGetLocalizedText
  heading.innerHTML += safeGetLocalizedText(node.label, lang) + idBadge;
  content.appendChild(heading);

  const collectionUrlDiv = document.createElement('div');
  collectionUrlDiv.className = 'collection-url mb-2 mt-n1';
  collectionUrlDiv.innerHTML = `
      <a href="${uri}" target="_blank" class="text-decoration-none small" style="color: #6c757d; font-size: 0.8em;">
          <i class="bi bi-link-45deg"></i> ${uri}
      </a>
  `;
  content.appendChild(collectionUrlDiv);
  
  const commentText = safeGetLocalizedText(node.comment, lang);
  if (commentText) {
    const p = document.createElement('p');
    p.innerHTML = commentText;
    content.appendChild(p);
  }

  if (node.inspectionPoints?.length) {
    const ul = document.createElement('ul');
    ul.className = 'checklist list-unstyled';
    
    node.inspectionPoints.forEach(ipUri => {
        const ip = nodeMap.get(ipUri);
        if (!ip) return;

        const li = document.createElement('li');
        li.className = 'mb-3 p-2 border-bottom';
        
        const ipId = ipUri.split('/').pop();
        const ipIdValue = ip.conjunctIdentifier || ip.identifier;
        const ipIdString = ipIdValue ? ` (${ipIdValue})` : '';

        li.innerHTML = `
            <div class="form-check">
                <input type="checkbox" class="form-check-input" id="check-${ipId}">
                <label class="form-check-label fw-bold" for="check-${ipId}">
                    ${safeGetLocalizedText(ip.label, lang)}${ipIdString}
                </label>
            </div>
            
            <div class="ms-4 my-1">
                <a href="${ipUri}" target="_blank" class="text-decoration-none" style="color: #2b75a0; font-size: 12px;">
                    <i class="bi bi-box-arrow-up-right"></i> ${ipUri}
                </a>
            </div>

            ${ip.comment ? `<div class="text-muted small ms-4">${safeGetLocalizedText(ip.comment, lang)}</div>` : ''}
            
            <div class="ms-4 mt-2 d-print-none d-flex gap-3">
                <div>
                    <button class="btn btn-sm btn-link p-0 text-decoration-none btn-details" data-id="${ipId}">
                        <i class="bi bi-plus-circle"></i> ${safeT('techDetails')}
                    </button>
                </div>
                <div>
                    <button class="btn btn-sm btn-link p-0 text-decoration-none text-danger btn-outcomes" data-id="${ipId}">
                        <i class="bi bi-exclamation-triangle"></i> ${safeT('possibleOutcomes')}
                    </button>
                </div>
                <div>
                    <button class="btn btn-sm btn-link p-0 text-decoration-none text-success btn-similar" data-id="${ipId}">
                        <i class="bi bi-diagram-2"></i> ${safeT('similarPoints')}
                    </button>
                </div>
            </div>

            <div id="details-${ipId}" class="sparql-details mt-2 ms-4" style="display:none;">
                <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
            </div>
            <div id="outcomes-${ipId}" class="sparql-outcomes mt-2 ms-4" style="display:none;">
                <div class="spinner-border spinner-border-sm text-danger" role="status"></div>
            </div>
            <div id="similar-${ipId}" class="matrix-similar mt-2 ms-4" style="display:none;">
                <div class="spinner-border spinner-border-sm text-success" role="status"></div>
            </div>
        `;

        ul.appendChild(li);
    });
    content.appendChild(ul);
  }

  (node.subGroups ?? []).forEach((subUri, i) =>
    renderCollection(subUri, numbers.concat(i + 1), lang, displayableUris)
  );
}

// Extraction des métadonnées SPARQL d'un point
async function fetchPointDetails(pointId) {
    const pointUri = `${BASE_URI}${pointId}`;
    const sparqlQuery = `
        PREFIX : <https://agriculture.ld.admin.ch/inspection/>
        SELECT ?propriete ?valeur
        WHERE { <${pointUri}> ?propriete ?valeur . }
        ORDER BY ?propriete
    `;
    const url = `https://agriculture.ld.admin.ch/query?query=${encodeURIComponent(sparqlQuery)}`;
    try {
        const response = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
        const data = await response.json();
        return data.results.bindings;
    } catch (error) {
        console.error("Erreur SPARQL Details:", error);
        return [];
    }
}

// Extraction des manquements potentiels
async function fetchPossibleOutcomes(pointId) {
    const pointUri = `${BASE_URI}${pointId}`;
    const sparqlQuery = `
        PREFIX : <https://agriculture.ld.admin.ch/inspection/>
        PREFIX schema: <http://schema.org/>
        SELECT ?outcome ?defect ?defectLabel
        WHERE {
            <${pointUri}> :possibleOutcome ?outcome .
            OPTIONAL { ?outcome :defect ?defect . }
            OPTIONAL { 
                ?defect schema:name ?defectLabel . 
                FILTER(LANG(?defectLabel) = "${window.__APP_LANG || 'fr'}")
            }
        }
    `;
    const url = `https://agriculture.ld.admin.ch/query?query=${encodeURIComponent(sparqlQuery)}`;
    try {
        const response = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
        const data = await response.json();
        return data.results.bindings;
    } catch (error) {
        console.error("Erreur SPARQL Outcomes:", error);
        return [];
    }
}

// ÉCOUTEURS D'ÉVÉNEMENTS GÉNÉRIQUES
document.addEventListener('click', async (e) => {
    const lang = window.__APP_LANG || 'fr';

    // A. CLIC : Détails Techniques
    if (e.target.closest('.btn-details')) {
        const btn = e.target.closest('.btn-details');
        const ipId = btn.dataset.id;
        const detailsDiv = document.getElementById(`details-${ipId}`);

        if (detailsDiv.style.display === 'block') {
            detailsDiv.style.display = 'none';
            btn.innerHTML = `<i class="bi bi-plus-circle"></i> ${safeT('techDetails')}`;
            return;
        }

        detailsDiv.style.display = 'block';
        btn.innerHTML = `<i class="bi bi-dash-circle"></i> ${safeT('hideDetails')}`;

        if (detailsDiv.innerHTML.includes('spinner-border')) {
            const bindings = await fetchPointDetails(ipId);
            if (bindings.length === 0) {
                detailsDiv.innerHTML = `<span class="text-warning">${safeT('noDetails')}</span>`;
                return;
            }

            let table = '<table class="table table-sm table-bordered small bg-light"><tbody>';
            bindings.forEach(b => {
                const prop = b.propriete.value.split('/').pop().split('#').pop();
                const val = b.valeur.value;
                if (!val.startsWith('http') || val.includes('inspection')) {
                    table += `<tr><td class="fw-bold">${prop}</td><td>${val}</td></tr>`;
                }
            });
            table += '</tbody></table>';
            detailsDiv.innerHTML = table;
        }
    }

    // B. CLIC : Manquements Possibles
    if (e.target.closest('.btn-outcomes')) {
        const btn = e.target.closest('.btn-outcomes');
        const ipId = btn.dataset.id;
        const outcomesDiv = document.getElementById(`outcomes-${ipId}`);

        if (outcomesDiv.style.display === 'block') {
            outcomesDiv.style.display = 'none';
            btn.innerHTML = `<i class="bi bi-exclamation-triangle"></i> ${safeT('possibleOutcomes')}`;
            return;
        }

        outcomesDiv.style.display = 'block';
        btn.innerHTML = `<i class="bi bi-dash-circle"></i> ${safeT('hideOutcomes')}`;

        if (outcomesDiv.innerHTML.includes('spinner-border')) {
            const bindings = await fetchPossibleOutcomes(ipId);
            if (bindings.length === 0) {
                outcomesDiv.innerHTML = `<span class="text-muted small">Aucun manquement renvoyé par le SPARQL.</span>`;
                return;
            }

            let html = '<div class="alert alert-warning py-2 px-3 small"><strong>Liens vers les manquements :</strong><ul class="mb-0 mt-1">';
            bindings.forEach(b => {
                const displayVal = b.defectLabel?.value || b.defect?.value || b.outcome?.value;
                html += `<li class="text-monospace">${displayVal}</li>`;
            });
            html += '</ul></div>';
            outcomesDiv.innerHTML = html;
        }
    }

    // C. CLIC : Points Similaires
    if (e.target.closest('.btn-similar')) {
        const btn = e.target.closest('.btn-similar');
        const ipId = btn.dataset.id;
        const similarDiv = document.getElementById(`similar-${ipId}`);

        if (similarDiv.style.display === 'block') {
            similarDiv.style.display = 'none';
            btn.innerHTML = `<i class="bi bi-diagram-2"></i> ${safeT('similarPoints')}`;
            return;
        }

        similarDiv.style.display = 'block';
        btn.innerHTML = `<i class="bi bi-dash-circle"></i> ${safeT('hideSimilar')}`;

        if (similarDiv.innerHTML.includes('spinner-border')) {
            if (similarityMatrix === "ERROR") {
                similarDiv.innerHTML = `<div class="alert alert-danger py-2 px-3 small">
                    <i class="bi bi-exclamation-octagon"></i> Échec du chargement des données de similarité.
                </div>`;
                return;
            }

            if (!similarityMatrix || !similarityMatrix[ipId] || !similarityMatrix[ipId].similars) {
                similarDiv.innerHTML = `<span class="text-muted small">${safeT('noSimilar')}</span>`;
                return;
            }

            const topSimilars = similarityMatrix[ipId].similars;
            
            let html = '<div class="alert alert-success py-2 px-3 small">';
            html += '<ol class="mb-0 ps-3">';

            topSimilars.forEach(item => {
                const targetUri = `${BASE_URI}${item.id}`;
                const targetNode = nodeMap.get(targetUri);
                
                let labelText = "Point inconnu (Base fédérale)";
                let idBadge = "";

                if (targetNode) {
                    labelText = safeGetLocalizedText(targetNode.label, lang);
                    const coreId = targetNode.conjunctIdentifier || targetNode.identifier;
                    if (coreId) idBadge = ` <span class="badge bg-secondary font-monospace" style="font-size:10px;">${coreId}</span>`;
                }

                const matchPercentage = Math.round(item.score * 100);

                html += `
                    <li class="mb-2">
                        <strong>${matchPercentage}%</strong> - 
                        <a href="${targetUri}" target="_blank" class="text-decoration-none fw-semibold" style="color: #1e4d2b;">
                            ${labelText}
                        </a>${idBadge}
                    </li>`;
            });

            html += '</ol></div>';
            similarDiv.innerHTML = html;
        }
    }
});
