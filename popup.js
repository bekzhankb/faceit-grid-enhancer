// popup.js — Главная логика управления интерфейсом расширения

document.addEventListener('DOMContentLoaded', () => {


    // 1. УПРАВЛЕНИЕ СВИТЧАМИ (ТУМБЛЕРЫ МОДУЛЕЙ)

    const modules = ['mapVeto', 'smurfDetector', 'dodgeCalc', 'dodgeList', 'qol'];

    // Загружаем сохраненные настройки тумблеров из хранилища
    modules.forEach(mod => {
        const checkbox = document.getElementById(`toggle-${mod}`);
        if (!checkbox) return;

        // По умолчанию все модули включены (true), если нет сохраненного значения
        chrome.storage.local.get([`mod_${mod}`], (result) => {
            checkbox.checked = result[`mod_${mod}`] !== false;
        });

        // Слушаем переключение тумблера и сохраняем его состояние
        checkbox.addEventListener('change', () => {
            chrome.storage.local.set({ [`mod_${mod}`]: checkbox.checked }, () => {
                console.log(`[FACEIT Grid] Модуль ${mod} теперь: ${checkbox.checked ? 'ВКЛ' : 'ВЫКЛ'}`);

                // Дополнительно скрываем/показываем панели в самом попапе
                if (mod === 'dodgeCalc') togglePanel('panel-dodgeCalc', checkbox.checked);
                if (mod === 'dodgeList') togglePanel('panel-dodgeList', checkbox.checked);
            });
        });
    });

    // Вспомогательная функция для скрытия панелей, если модуль выключен
    function togglePanel(id, isVisible) {
        const panel = document.getElementById(id);
        if (panel) panel.style.display = isVisible ? 'block' : 'none';
    }



    // 2. ЛОКАЛЬНЫЙ ЧЕРНЫЙ СПИСОК (DODGE LIST)

    const blacklistTotal   = document.getElementById('blacklist-total');
    const listContainer    = document.getElementById('dodge-list-container');
    const listEmptyMessage = document.getElementById('dodge-list-empty');
    const btnClearDodge    = document.getElementById('btn-clear-dodgelist');

    // Функция отрисовки ЧС игроков
    function renderDodgeList() {
        chrome.storage.local.get(['dodgeList'], (result) => {
            const list = result.dodgeList || [];

            // Обновляем цифру счетчика в скобках
            if (blacklistTotal) blacklistTotal.textContent = list.length;

            // Управляем отображением сообщения "Список пуст"
            if (list.length === 0) {
                if (listEmptyMessage) listEmptyMessage.style.display = 'block';
                // Чистим старые элементы игроков, если они были
                listContainer.querySelectorAll('.blacklist-item').forEach(item => item.remove());
                return;
            }

            if (listEmptyMessage) listEmptyMessage.style.display = 'none';

            // Очищаем старые элементы перед перерисовкой
            listContainer.querySelectorAll('.blacklist-item').forEach(item => item.remove());

            // Генерируем карточку для каждого задодженного игрока
            list.forEach((player) => {
                const item = document.createElement('div');
                item.className = 'blacklist-item';
                item.innerHTML = `
                    <span class="blacklist-username">${player.name}</span>
                    <button class="blacklist-remove" data-id="${player.id}" data-name="${player.name}" title="Удалить">✕</button>
                `;

                // Удаление по нажатию на крестик
                item.querySelector('.blacklist-remove').addEventListener('click', async (e) => {
                    const id = e.target.dataset.id;
                    const name = e.target.dataset.name;
                    await removePlayerFromPopup(id, name);
                });

                listContainer.appendChild(item);
            });
        });
    }

    // Удаление игрока из памяти расширения
    async function removePlayerFromPopup(playerId, playerName) {
        chrome.storage.local.get(['dodgeList'], (result) => {
            const list = result.dodgeList || [];
            const filtered = list.filter((p) => p.id !== playerId && p.name.toLowerCase() !== playerName.toLowerCase());

            chrome.storage.local.set({ dodgeList: filtered }, () => {
                // Маякуем открытой странице FACEIT, чтобы убрала красный цвет с кнопки 🚫 игрока
                chrome.runtime.sendMessage({ action: 'dodgeListUpdated', list: filtered }).catch(() => {});
                renderDodgeList();
            });
        });
    }

    // Кнопка: Очистить весь ЧС
    if (btnClearDodge) {
        btnClearDodge.addEventListener('click', () => {
            if (confirm('Вы уверены, что хотите полностью очистить ваш Dodge List?')) {
                chrome.storage.local.set({ dodgeList: [] }, () => {
                    chrome.runtime.sendMessage({ action: 'dodgeListUpdated', list: [] }).catch(() => {});
                    renderDodgeList();
                });
            }
        });
    }



    // 3. ТРЕКЕР МАТЧЕЙ (DODGE CALCULATOR)

    const matchPoolGrid    = document.getElementById('match-pool-dots');
    const dodgeCountLabel  = document.getElementById('dodge-count-30');
    const btnLogPlayed     = document.getElementById('btn-log-played');
    const btnLogDodged     = document.getElementById('btn-log-dodged');

    // Функция отрисовки 30 точек (матчей) в стиле Repeek
    function renderMatchTracker() {
        if (!matchPoolGrid) return;

        chrome.storage.local.get(['matchHistory'], (result) => {
            const history = result.matchHistory || []; // Массив из 'played', 'dodged' или пустых ячеек

            // Считаем количество доджей за последние 30 игр
            const dodges = history.filter(status => status === 'dodged').length;
            if (dodgeCountLabel) dodgeCountLabel.textContent = dodges;

            // Очищаем сетку
            matchPoolGrid.innerHTML = '';

            // Генерируем ровно 30 точек
            for (let i = 0; i < 30; i++) {
                const dot = document.createElement('div');
                dot.className = 'grid-dot';

                if (history[i] === 'played') dot.classList.add('grid-dot--played');
                if (history[i] === 'dodged') dot.classList.add('grid-dot--dodged');

                matchPoolGrid.appendChild(dot);
            }
        });
    }

    // Функция добавления нового исхода матча (сдвигаем старые, если больше 30)
    function logMatchStatus(status) {
        chrome.storage.local.get(['matchHistory'], (result) => {
            let history = result.matchHistory || [];
            history.push(status);

            if (history.length > 30) {
                history.shift(); // Оставляем только последние 30 матчей
            }

            chrome.storage.local.set({ matchHistory: history }, () => {
                renderMatchTracker();
            });
        });
    }

    if (btnLogPlayed) btnLogPlayed.addEventListener('click', () => logMatchStatus('played'));
    if (btnLogDodged) btnLogDodged.addEventListener('click', () => logMatchStatus('dodged'));


    // 4. СИНХРОНИЗАЦИЯ И СТАРТ

    // Если игрок нажал на кнопку ЧС прямо на FACEIT — попап тут же обновит список внутри себя
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'dodgeListUpdated') {
            renderDodgeList();
        }
    });

    // Запускаем отрисовку при открытии меню
    renderDodgeList();
    renderMatchTracker();

    // Синхронизируем видимость панелей при старте
    chrome.storage.local.get(['mod_dodgeCalc', 'mod_dodgeList'], (res) => {
        if (res.mod_dodgeCalc === false) togglePanel('panel-dodgeCalc', false);
        if (res.mod_dodgeList === false) togglePanel('panel-dodgeList', false);
    });
});