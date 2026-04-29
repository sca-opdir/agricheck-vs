window.getLocalizedText = (textObj, lang, fallbackWrapper = true) => {
  const fallbackOrder = [lang, 'de', 'fr', 'it'];
  for (const l of fallbackOrder) {
    if (textObj[l]) {
      if (l === lang || !fallbackWrapper) {
        return textObj[l];
      } else {
        return `<strong>${l.toUpperCase()}:</strong> <em>${textObj[l]}</em>`;
      }
    }
  }
  const anyLang = Object.keys(textObj)[0];
  return anyLang ? `<strong>${anyLang.toUpperCase()}:</strong> <em>${textObj[anyLang]}</em>` : '';
};

window.__i18nReady = (async () => {
  const urlParams  = new URLSearchParams(location.search);
  const urlLang    = urlParams.get('lang');
  const storedLang = localStorage.getItem('akcLang');
  const lang       = (urlLang || storedLang || 'de').toLowerCase();

  window.__APP_LANG = lang;
  document.documentElement.lang = lang;
  localStorage.setItem('akcLang', lang);

  const yamlText = await fetch('i18n/translations.yml').then(r => r.text());
  const translationsAll = jsyaml.load(yamlText);

  return { lang, translationsAll };
})();

document.addEventListener('DOMContentLoaded', async () => {
  const [headerHTML, footerHTML] = await Promise.all([
    fetch('partials/header.html').then(r => r.text()),
    fetch('partials/footer.html').then(r => r.text())
  ]);
  document.body.insertAdjacentHTML('afterbegin', headerHTML);
  document.body.insertAdjacentHTML('beforeend',  footerHTML);

  const nav = document.querySelector('.navbar');
  if (nav) {
    document.documentElement.style.setProperty('--akc-navbar-h', nav.offsetHeight + 'px');
  }

  const { lang: initialLang, translationsAll } = await window.__i18nReady;

  const resolvePath = (obj, path) => path.split('.').reduce((acc, part) => acc && acc[part], obj);

  window.t = key => {
    const langData = translationsAll[window.__APP_LANG] || translationsAll['de'];
    let val = resolvePath(langData, key);

    if (val === undefined && window.__APP_LANG !== 'de') {
      val = resolvePath(translationsAll['de'], key);
    }

    if (val === undefined) return key;

    if (typeof val === 'string') {
      return val.includes('\n') ? marked.parse(val) : marked.parseInline(val);
    }
    return val;
  };

  function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      el.innerHTML = t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
    });
  }
  applyTranslations(document);

  function patchLinks(currentLang) {
    document.querySelectorAll('a[href$=".html"]').forEach(a => {
      const raw = a.getAttribute('href');
      if (/^(https?:)?\/\//.test(raw) || raw.startsWith('/')) return;
      const u = new URL(raw, location.href);
      u.searchParams.set('lang', currentLang);
      a.setAttribute('href', u.pathname + u.search);
    });
  }
  patchLinks(initialLang);

  const curLabel = document.getElementById('currentLangLabel');
  if (curLabel) curLabel.textContent = initialLang.toUpperCase();

  document.querySelectorAll('.lang-option').forEach(a => {
    const code = a.dataset.lang;
    if (code === initialLang) a.classList.add('active');

    a.addEventListener('click', e => {
      e.preventDefault();
      const newLang = a.dataset.lang;
      if (newLang === window.__APP_LANG) return;

      window.__APP_LANG = newLang;
      localStorage.setItem('akcLang', newLang);
      document.documentElement.lang = newLang;

      const url = new URL(location.href);
      url.searchParams.set('lang', newLang);
      history.pushState({}, '', url.toString());

      applyTranslations(document);

      const curLabel = document.getElementById('currentLangLabel');
      if (curLabel) curLabel.textContent = newLang.toUpperCase();
      
      document.querySelectorAll('.lang-option').forEach(el => el.classList.remove('active'));
      a.classList.add('active');

      patchLinks(newLang);

      // 5. App-spezifische Rebuilds anstossen (z.B. den Tree)
      if (typeof window.rebuildPage === 'function') {
        window.rebuildPage(newLang);
      }
    });
  });
});