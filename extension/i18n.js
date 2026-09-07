(() => {
  function t(key, substitutions, fallback = '') {
    const value = chrome.i18n.getMessage(key, substitutions);
    return value || fallback || key;
  }

  function localizeDocument(root = document) {
    document.documentElement.lang = chrome.i18n.getUILanguage().toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
    for (const element of root.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n, undefined, element.textContent);
    for (const element of root.querySelectorAll('[data-i18n-placeholder]')) element.placeholder = t(element.dataset.i18nPlaceholder, undefined, element.placeholder);
    for (const element of root.querySelectorAll('[data-i18n-aria-label]')) element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel, undefined, element.getAttribute('aria-label')));
  }

  globalThis.Add2CalendarI18n = { t, localizeDocument };
})();
