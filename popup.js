const listEl = document.getElementById('list');
const statusEl = document.getElementById('status');
const lastAddedEl = document.getElementById('last-added');
const refreshBtn = document.getElementById('refresh');
const exportBtn = document.getElementById('export');
const clearBtn = document.getElementById('clear');

function renderList() {
  chrome.storage.local.get({ sites: [] }, (data) => {
    const sites = data.sites || [];
    
    if (sites.length === 0) {
      listEl.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Пока ничего не найдено.<br>Посетите сайты с формами рассылок!</p>';
      exportBtn.disabled = true;
      clearBtn.disabled = true;
      return;
    }

    exportBtn.disabled = false;
    clearBtn.disabled = false;

    const ul = document.createElement('ul');
    sites.forEach((site, index) => {
      const li = document.createElement('li');
      
      // Кнопка удаления
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '✕';
      deleteBtn.className = 'delete-btn';
      deleteBtn.title = 'Удалить';
      deleteBtn.style.cssText = 'float: right; padding: 2px 6px; font-size: 12px; background: #ff5252; margin: 0;';
      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        deleteSite(index);
      });
      
      const link = document.createElement('a');
      link.href = site.url;
      link.target = '_blank';
      link.textContent = site.title;
      
      const small = document.createElement('small');
      small.textContent = `${site.date} · ${site.hostname || new URL(site.url).hostname}`;
      
      li.appendChild(deleteBtn);
      li.appendChild(link);
      li.appendChild(small);
      ul.appendChild(li);
    });
    
    listEl.innerHTML = '';
    listEl.appendChild(ul);
    
    // Обновляем badge
    chrome.action.setBadgeText({ text: sites.length.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  });
}

function deleteSite(index) {
  chrome.storage.local.get({ sites: [] }, (data) => {
    const sites = data.sites || [];
    sites.splice(index, 1);
    chrome.storage.local.set({ sites }, () => {
      renderList();
      showNotification('Удалено', 1000);
    });
  });
}

function showNotification(message, duration = 2000) {
  statusEl.textContent = message;
  statusEl.style.display = 'block';
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, duration);
}

// Первоначальная отрисовка
renderList();

// Слушаем изменения в storage
chrome.storage.onChanged.addListener((changes) => {
  if (changes.sites) {
    const newSites = changes.sites.newValue || [];
    const oldSites = changes.sites.oldValue || [];
    
    // Показываем уведомление только при добавлении
    if (newSites.length > oldSites.length) {
      const lastAdded = newSites[0]; // Новые добавляются в начало
      lastAddedEl.innerHTML = `<strong>✓ Добавлен:</strong> ${lastAdded.title}`;
      lastAddedEl.style.display = 'block';
      setTimeout(() => {
        lastAddedEl.style.display = 'none';
      }, 4000);
    }
    
    renderList();
  }
});

// Обновить список
refreshBtn.addEventListener('click', () => {
  renderList();
  showNotification('Обновлено!', 1000);
});

// Экспорт в TXT
exportBtn.addEventListener('click', () => {
  chrome.storage.local.get({ sites: [] }, (data) => {
    const sites = data.sites || [];
    
    if (sites.length === 0) {
      alert('Список пуст, нечего экспортировать!');
      return;
    }
    
    // Формируем текст
    let text = '=== НАЙДЕННЫЕ САЙТЫ С РАССЫЛКАМИ ===\n\n';
    text += `Всего найдено: ${sites.length}\n`;
    text += `Дата экспорта: ${new Date().toLocaleString('ru-RU')}\n\n`;
    text += '─'.repeat(60) + '\n\n';
    
    sites.forEach((site, i) => {
      text += `${i + 1}. ${site.title}\n`;
      text += `   URL: ${site.url}\n`;
      text += `   Домен: ${site.hostname || new URL(site.url).hostname}\n`;
      text += `   Найден: ${site.date}\n\n`;
    });
    
    // Создаем blob и скачиваем
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `newsletter_sites_${new Date().toISOString().split('T')[0]}.txt`;
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download error:', chrome.runtime.lastError);
        alert('Ошибка при скачивании: ' + chrome.runtime.lastError.message);
      } else {
        showNotification('Файл скачивается...', 2000);
        // Очищаем URL после скачивания
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    });
  });
});

// Очистить список
clearBtn.addEventListener('click', () => {
  if (confirm('Вы уверены, что хотите удалить все найденные сайты из списка?')) {
    chrome.storage.local.set({ sites: [] }, () => {
      renderList();
      chrome.action.setBadgeText({ text: '' });
      showNotification('Список очищен', 1500);
    });
  }
});