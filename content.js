console.log('Newsletter Finder: Loaded on ' + window.location.href);

// Debounce для оптимизации
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function findAndSaveNewsletter() {
  console.log('Newsletter Finder: Scanning for newsletter/subscribe blocks...');

  function searchInElement(root) {
    // Ищем все возможные блоки с подпиской
    const candidates = root.querySelectorAll(
      'form, input[type="email"], input[placeholder*="email" i], input[placeholder*="почт" i], ' +
      'div[class*="subscribe" i], div[class*="newsletter" i], div[class*="signup" i], ' +
      'div[class*="email-capture" i], div[class*="substack" i], section, aside, [class*="popup" i], [class*="modal" i], [class*="overlay" i]'
    );

    for (const el of candidates) {
      // Собираем контекст из элемента и родителей
      let contextElement = el;
      let text = '';
      for (let i = 0; i < 5 && contextElement; i++) {
        text += (contextElement.textContent || '').toLowerCase() + ' ';
        text += (contextElement.className || '').toLowerCase() + ' ';
        text += (contextElement.id || '').toLowerCase() + ' ';
        contextElement = contextElement.parentElement;
      }

      // Email input
      const emailInput = el.tagName === 'INPUT' && el.type === 'email' ? el :
        el.querySelector('input[type="email"], input[placeholder*="email" i], input[placeholder*="почт" i], input[name*="email" i]');

      // Ключевые слова
      const keywords = [
        'subscribe', 'подпис', 'рассыл', 'newsletter', 'subscrib', 'substack', 
        'terms of use', 'privacy policy', 'information collection', 
        'by subscribing you agree', 'get updates', 'join', 'sign up',
        'email', 'почт', 'новост'
      ];
      const hasKeyword = keywords.some(kw => text.includes(kw));

      // Substack и другие платформы
      const isSubstackLike = text.includes('substack') || 
                             (text.includes('privacy') && text.includes('terms')) ||
                             el.closest('[data-substack]') !== null ||
                             document.querySelector('link[href*="substack.com"]') !== null ||
                             text.includes('information collection notice');

      // Кнопка Subscribe
      let hasSubscribeButton = false;
      const buttons = el.querySelectorAll('button, [role="button"], input[type="submit"], a');
      for (const btn of buttons) {
        const btnText = (btn.textContent || btn.value || '').toLowerCase();
        if (btnText.includes('subscribe') || btnText.includes('подпис') || btnText.includes('sign up')) {
          hasSubscribeButton = true;
          break;
        }
      }

      if (emailInput && (hasKeyword || isSubstackLike || hasSubscribeButton)) {
        console.log('✓ FOUND SUBSCRIPTION BLOCK!', {
          element: el.tagName + (el.className ? '.' + el.className.split(' ')[0] : ''),
          hasEmailInput: !!emailInput,
          hasKeyword: hasKeyword,
          isSubstackLike: isSubstackLike,
          hasSubscribeButton: hasSubscribeButton
        });
        return true;
      }
    }
    return false;
  }

  let found = searchInElement(document);

  // Shadow DOM (для web components)
  if (!found) {
    const elementsWithShadow = document.querySelectorAll('*');
    for (const el of elementsWithShadow) {
      if (el.shadowRoot) {
        found = searchInElement(el.shadowRoot);
        if (found) break;
      }
    }
  }

  // Сохранение найденного сайта
  if (found) {
    const entry = {
      url: window.location.href,
      title: document.title.trim() || 'Без названия',
      date: new Date().toLocaleString('ru-RU'),
      hostname: window.location.hostname
    };

    chrome.storage.local.get({ sites: [] }, (data) => {
      let sites = data.sites || [];
      
      // Проверка на дубликат
      if (!sites.some(s => s.url === entry.url)) {
        sites.unshift(entry); // Добавляем в начало (новые сверху)
        
        // Ограничиваем до 100 записей
        if (sites.length > 100) {
          sites = sites.slice(0, 100);
        }
        
        chrome.storage.local.set({ sites }, () => {
          chrome.action.setBadgeText({ text: sites.length.toString() });
          chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
          console.log('✓ Saved newsletter page:', entry.title);
        });
      } else {
        console.log('Already saved:', entry.url);
      }
    });
  } else {
    console.log('No newsletter/subscribe block found');
  }
}

// Debounced версия для событий
const debouncedFind = debounce(findAndSaveNewsletter, 1000);

// Запуск при загрузке
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findAndSaveNewsletter);
} else {
  findAndSaveNewsletter();
}

window.addEventListener('load', findAndSaveNewsletter);

// MutationObserver для динамически загружаемого контента
const observer = new MutationObserver(debouncedFind);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

// Scroll для lazy-load попапов (но не слишком часто)
let scrollTimeout;
window.addEventListener('scroll', () => {
  if (!scrollTimeout) {
    scrollTimeout = setTimeout(() => {
      debouncedFind();
      scrollTimeout = null;
    }, 2000);
  }
}, { passive: true });