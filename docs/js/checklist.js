import { fetchBindings, buildNodeMap } from './model.js';
await window.__i18nReady;

const BASE_URI = 'https://agriculture.ld.admin.ch/inspection/';
const content      = document.getElementById('content');
const metaDateEl   = document.getElementById('metaDate');
const printBtn     = document.getElementById('printBtn');
const copyLinkBtn  = document.getElementById('copyLinkBtn');
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

(async function init() {
  const bindings = await fetchBindings();
  nodeMap  = buildNodeMap(bindings);
  rebuildPage(window.__APP_LANG);
})();

function addDescendantsAndSelf(uri, set) {
  if (!uri || set.has(uri)) return;
  set.add(uri);
  const node = nodeMap.get(uri);
  (node?.subGroups ?? []).forEach(subUri => addDescendantsAndSelf(subUri, set));
}

// Petite fonction utilitaire à placer avant window.rebuildPage
function toggleAll(checked) {
  const checkboxes = document.getElementById('content').querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = checked);
}

window.rebuildPage = function(lang) {
  content.innerHTML = '';


// --- AJOUT DES BOUTONS ---
  const controls = document.createElement('div');
  controls.className = 'mb-4 d-print-none text-end'; // text-end pour aligner à droite
  controls.innerHTML = `
    <button type="button" class="btn btn-sm btn-outline-primary me-2" id="btnCheckAll">
      <i class="bi bi-check2-all"></i> Tout cocher
    </button>
    <button type="button" class="btn btn-sm btn-outline-secondary" id="btnUncheckAll">
      <i class="bi bi-square"></i> Tout décocher
    </button>
  `;
  content.appendChild(controls);

  // Écouteurs d'événements pour les boutons
  controls.querySelector('#btnCheckAll').addEventListener('click', () => toggleAll(true));
  controls.querySelector('#btnUncheckAll').addEventListener('click', () => toggleAll(false));
  // -------------------------

  metaDateEl.textContent = new Date().toLocaleDateString(lang, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const params    = new URLSearchParams(location.search);
  const slugParam = params.get('groups');

  if (!slugParam) {
    content.innerHTML = `<p class="text-danger">${t('noGroups')}</p>`;
    return;
  }

  // ... (le reste
  
  
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
    ul.className = 'checklist';
    node.inspectionPoints.forEach(ipUri => {
      const ip = nodeMap.get(ipUri);
      if (!ip) return;

      const li = document.createElement('li');
      const label = document.createElement('label');
      label.className = 'd-block';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'form-check-input';
      label.appendChild(cb);

      const ipCommentText = window.getLocalizedText(ip.comment, lang);
      const nameEl = document.createElement(ipCommentText ? 'strong' : 'span');
      nameEl.innerHTML = window.getLocalizedText(ip.label, lang);
      label.appendChild(nameEl);

      if (ipCommentText) {
        label.appendChild(document.createElement('br'));
        const span = document.createElement('span');
        span.className = 'text-muted';
        span.innerHTML = ipCommentText;
        label.appendChild(span);
      }

      li.appendChild(label);
      ul.appendChild(li);
    });
    content.appendChild(ul);
  }

  (node.subGroups ?? []).forEach((subUri, i) =>
    renderCollection(subUri, numbers.concat(i + 1), lang, displayableUris)
  );
}
