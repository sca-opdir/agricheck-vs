import { fetchBindings, buildNodeMap } from './model.js';
await window.__i18nReady;

const BASE_URI = 'https://agriculture.ld.admin.ch/inspection/';
const content      = document.getElementById('content');
const metaDateEl   = document.getElementById('metaDate');
const printBtn     = document.getElementById('printBtn');
const copyLinkBtn  = document.getElementById('copyLinkBtn');
const btnCheckAll = document.getElementById('btnCheckAll');
const btnUncheckAll = document.getElementById('btnUncheckAll');

let nodeMap;

printBtn.addEventListener('click', () => window.print());
copyLinkBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(location.href).then(() => {
    copyLinkBtn.classList.replace('btn-outline-secondary', 'btn-success');
    copyLinkBtn.innerHTML = `<i class="bi bi-clipboard-check"></i> ${t('copied')}`;
    setTimeout(() => {
      copyLinkBtn.classList.replace('btn-success', 'btn-outline-secondary');
      copyLinkBtn.innerHTML = `<i class="bi bi-clipboard"></i> ${t('copyLink')}`;
    }, 2000);
  });
});

// Logique pour tout cocher
btnCheckAll.addEventListener('click', () => {
  document.querySelectorAll('.checklist input[type="checkbox"]').forEach(cb => {
    cb.checked = true;
  });
});

// Logique pour tout décocher
btnUncheckAll.addEventListener('click', () => {
  document.querySelectorAll('.checklist input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });
});

(async function init() {
  const bindings = await fetchBindings();
  nodeMap  = buildNodeMap(bindings);
  rebuildPage(window.__APP_LANG);

// AJOUTE CETTE LIGNE ICI :
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
  content.innerHTML = '';
  metaDateEl.textContent = new Date().toLocaleDateString(lang, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const params    = new URLSearchParams(location.search);
  const slugParam = params.get('groups');

  if (!slugParam) {
    content.innerHTML = `<p class="text-danger">${t('noGroups')}</p>`;
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
  if (!displayableUris.has(uri)) {
    return;
  }
  const node = nodeMap.get(uri);
  if (!node) return;
  const hLevel  = Math.min(numbers.length, 6);
  const heading = document.createElement('h' + hLevel);
  const numSpan = document.createElement('span');
  numSpan.className = 'section-number';
  numSpan.textContent = numbers.join('.');
  heading.appendChild(numSpan);
  heading.innerHTML += window.getLocalizedText(node.label, lang);
  content.appendChild(heading);

  const commentText = window.getLocalizedText(node.comment, lang);
  if (commentText) {
    const p = document.createElement('p');
    p.innerHTML = commentText;
    content.appendChild(p);
  }

if (node.inspectionPoints?.length) {
    const ul = document.createElement('ul');
    ul.className = 'checklist list-unstyled'; // list-unstyled pour un look plus propre
    node.inspectionPoints.forEach(ipUri => {
        const ip = nodeMap.get(ipUri);
        if (!ip) return;

        const li = document.createElement('li');
        li.className = 'mb-3 p-2 border-bottom'; // On espace un peu les points
        
        const ipId = ipUri.split('/').pop(); // On récupère l'ID pour SPARQL

        // Template du point de contrôle
        li.innerHTML = `
            <div class="form-check">
                <input type="checkbox" class="form-check-input" id="check-${ipId}">
                <label class="form-check-label fw-bold" for="check-${ipId}">
                    ${window.getLocalizedText(ip.label, lang)}
                </label>
            </div>
            ${ip.comment ? `<div class="text-muted small ms-4">${window.getLocalizedText(ip.comment, lang)}</div>` : ''}
            
            <div class="ms-4 mt-2 d-print-none">
                <button class="btn btn-sm btn-link p-0 text-decoration-none btn-details" data-id="${ipId}">
                    <i class="bi bi-plus-circle"></i> Détails techniques
                </button>
                <div id="details-${ipId}" class="sparql-details mt-2" style="display:none;">
                    <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                </div>
            </div>
        `;

        ul.appendChild(li);
    });
    content.appendChild(ul);
}

// ... (fin de la fonction renderCollection)

  
  (node.subGroups ?? []).forEach((subUri, i) =>
    renderCollection(subUri, numbers.concat(i + 1), lang, displayableUris)
  );
}

// ajouté pour mettre tous les détails long-format

async function fetchPointDetails(pointId) {
    // On construit l'URI complète à partir de l'ID
    const pointUri = `https://agriculture.ld.admin.ch/inspection/${pointId}`;
    
    const sparqlQuery = `
        PREFIX : <https://agriculture.ld.admin.ch/inspection/>
        SELECT ?propriete ?valeur
        WHERE {
            <${pointUri}> ?propriete ?valeur .
        }
        ORDER BY ?propriete
    `;

    const url = `https://agriculture.ld.admin.ch/query?query=${encodeURIComponent(sparqlQuery)}`;

    try {
        const response = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
        const data = await response.json();
        return data.results.bindings;
    } catch (error) {
        console.error("Erreur SPARQL:", error);
        return [];
    }
}



// AJOUTER CECI À LA FIN DE TON FICHIER pour gérer le clic sur "Détails"
document.addEventListener('click', async (e) => {
    if (e.target.closest('.btn-details')) {
        const btn = e.target.closest('.btn-details');
        const ipId = btn.dataset.id;
        const detailsDiv = document.getElementById(`details-${ipId}`);

        // Toggle l'affichage
        if (detailsDiv.style.display === 'block') {
            detailsDiv.style.display = 'none';
            btn.innerHTML = '<i class="bi bi-plus-circle"></i> Détails techniques';
            return;
        }

        detailsDiv.style.display = 'block';
        btn.innerHTML = '<i class="bi bi-dash-circle"></i> Masquer les détails';

        // Charger les données si pas encore fait
        if (detailsDiv.innerHTML.includes('spinner-border')) {
            const bindings = await fetchPointDetails(ipId);
            if (bindings.length === 0) {
                detailsDiv.innerHTML = '<span class="text-warning">Aucune donnée trouvée.</span>';
                return;
            }

            let table = '<table class="table table-sm table-bordered small bg-light"><tbody>';
            bindings.forEach(b => {
                const prop = b.propriete.value.split('/').pop().split('#').pop();
                const val = b.valeur.value;
                // On n'affiche que les valeurs un peu lisibles
                if (!val.startsWith('http') || val.includes('inspection')) {
                    table += `<tr><td class="fw-bold">${prop}</td><td>${val}</td></tr>`;
                }
            });
            table += '</tbody></table>';
            detailsDiv.innerHTML = table;
        }
    }
});
