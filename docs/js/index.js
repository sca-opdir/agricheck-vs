import { fetchBindings, buildNodeMap } from './model.js';
await window.__i18nReady;

const treeEl        = $('#tree');
const searchInput   = $('#search');
const searchBtn     = $('#searchBtn');
const generateBtn   = $('#generate');

let nodeMap;
let selectedSet = new Set();
let searchActive = false;

(async function init() {
  const bindings = await fetchBindings();
  nodeMap = buildNodeMap(bindings);

  treeEl.one('ready.jstree', function () {
    const urlParams = new URLSearchParams(location.search);
    const searchTerms = urlParams.getAll('search');
    if (searchTerms.length > 0) {
      searchInput.val(searchTerms.join(' '));
      performSearch();
    }
  });

  rebuildPage(window.__APP_LANG);
})();

window.rebuildPage = function(lang) {
  if (treeEl.jstree(true)) {
    treeEl.jstree(true).destroy();
  }
  selectedSet.clear();
  generateBtn.prop('disabled', true);
  
  function buildNode(uri) {
    const n = nodeMap.get(uri);
    const labelText = window.getLocalizedText(n.label, lang);
    const descriptionText = window.getLocalizedText(n.comment, lang, false);

    const strongHaystack = [...Object.values(n.label)];
    const weakHaystack   = [...Object.values(n.comment)];

    (n.inspectionPoints ?? []).forEach(ipUri => {
        const ip = nodeMap.get(ipUri);
        if (ip) {
            strongHaystack.push(...Object.values(ip.label));
            weakHaystack.push(...Object.values(ip.comment));
        }
    });
    
    const nodeData = {
      id: uri,
      text: labelText,
      a_attr: {
        'data-search':        [...strongHaystack, ...weakHaystack].join(' ').toLowerCase(),
        'data-search-strong': strongHaystack.join(' ').toLowerCase(),
        'data-search-weak':   weakHaystack.join(' ').toLowerCase()
      },
      children: (n.subGroups ?? []).map(buildNode)
    };

    if (descriptionText) {
      nodeData.a_attr['data-bs-toggle'] = 'tooltip';
      nodeData.a_attr['data-bs-placement'] = 'right';
      nodeData.a_attr['title'] = descriptionText;
    }
    return nodeData;
  }

  const roots = [...nodeMap.values()]
    .filter(n => n.type === 'Collection' && !n.superGroup && !n.parentGroup)
    .map(n => buildNode(n.uri));

  treeEl
    .jstree({
      plugins: ['search', 'checkbox'],
      core: { data: roots, themes: { icons: false } },
      checkbox: { three_state: true, cascade: 'up+down+undetermined' },
      search: {
        show_only_matches: false,
        search_callback(q, node) {
          const hay = treeEl.jstree(true)
                            .get_node(node)
                            .a_attr['data-search'] || '';
          const tokens = q.toLowerCase()
                          .split(/[ ,/]+| OR /i)
                          .filter(Boolean);
          if (tokens.length === 0) return false;
          return tokens.some(token => hay.includes(token));
        }
      }
    })
    .on('changed.jstree', (_, data) => {
      selectedSet = new Set(data.selected);
      const empty = selectedSet.size === 0;
      generateBtn.prop('disabled', empty)
                 .toggleClass('btn-success', !empty)
                 .toggleClass('btn-primary', empty);
    })
    .on('select_node.jstree', (_, data) => {
      treeEl.jstree(true).open_node(data.node);
    });
  new bootstrap.Tooltip(treeEl[0], {
    selector: '[data-bs-toggle="tooltip"]',
    trigger: 'hover',
    html: true,
    customClass: 'wide-tooltip',
    delay: { show: 500, hide: 50 }
  });
  updateSearchBtn();
  searchInput.attr('placeholder', t('search.placeholder'));
};

function updateSearchBtn() {
  if (searchActive) {
    searchBtn
      .html(`<i class="bi bi-x-lg me-2"></i><span data-i18n="search.reset">${t('search.reset')}</span>`)
      .removeClass('btn-outline-primary')
      .addClass('btn-outline-secondary');
  } else {
    searchBtn
      .html(`<span data-i18n="search.button">${t('search.button')}</span>`)
      .removeClass('btn-outline-secondary')
      .addClass('btn-outline-primary');
  }
}

function resetSearch() {
  searchInput.val('');
  performSearch();
}

function performSearch() {
  const q      = searchInput.val().trim();
  const jsTree = treeEl.jstree(true);

  const url = new URL(location.href);
  url.searchParams.delete('search');
  if (q) {
    const tokens = q.toLowerCase().split(/[ ,/]+| OR /i).filter(Boolean);
    tokens.forEach(token => url.searchParams.append('search', token));
  }
  history.pushState({}, '', url.toString());

  treeEl.find('.jstree-search-weak').removeClass('jstree-search-weak');
  jsTree.clear_search();
  jsTree.close_all();

  if (!q) {
    searchActive = false;
    updateSearchBtn();
    return;
  }

  jsTree.search(q);

  setTimeout(() => {
    const tokens = q.toLowerCase().split(/[ ,/]+| OR /i).filter(Boolean);
    treeEl.find('a.jstree-search').each((_, a) => {
      const anchor = $(a);
      const id     = anchor.closest('li').attr('id');
      const node   = jsTree.get_node(id);

      node.parents.forEach(p => { if (p !== '#') jsTree.open_node(p); });
      jsTree.open_node(id);

      const strongHay = anchor.attr('data-search-strong') || '';
      const isStrongMatch = tokens.some(token => strongHay.includes(token));

      if (!isStrongMatch) {
          anchor.removeClass('jstree-search').addClass('jstree-search-weak');
      }
    });
  }, 0);

  searchActive = true;
  updateSearchBtn();
}


searchInput.on('keydown', e => { if (e.key === 'Enter') performSearch(); });
searchInput.on('input',   e => { if (!e.target.value.trim() && searchActive) resetSearch(); });
searchBtn  .on('click',  () => { searchActive ? resetSearch() : performSearch(); });

function compressSelection(set) {
  const compressed = new Set();
  for (const uri of set) {
    let skip = false;
    let cur  = uri;
    while (true) {
      const node   = nodeMap.get(cur);
      const parent = node?.superGroup || node?.parentGroup;
      if (!parent) break;
      if (set.has(parent)) { skip = true; break; }
      cur = parent;
    }
    if (!skip) compressed.add(uri);
  }
  return compressed;
}

generateBtn.on('click', () => {
  if (!selectedSet.size) return;

  const minimal = compressSelection(selectedSet);
  const qs = [...minimal].map(u => encodeURIComponent(u.split('/').pop())).join(',');

  const url = new URL('checklist.html', location.href);
  url.searchParams.set('groups', qs);
  url.searchParams.set('lang', window.__APP_LANG);
  location.href = url.pathname + url.search;
});

export function resetTree() {
  const jsTree = treeEl.jstree(true);
  jsTree.deselect_all();
  jsTree.close_all();
  selectedSet.clear();
  generateBtn.prop('disabled', true);
}