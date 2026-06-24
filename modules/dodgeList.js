// Personal Dodge List (Кастомный ЧС)

const DodgeList = (() => {

    // Безопасный оберточный метод для работы с локальным хранилищем Chrome
    async function getList() {
        return new Promise((resolve) => {
            try {
                if (!chrome.runtime?.id) {
                    resolve([]);
                    return;
                }
                // Используем STRICTLY local, проверяем ключ 'dodgeList'
                chrome.storage.local.get(['dodgeList'], (r) => {
                    if (chrome.runtime.lastError) {
                        resolve([]);
                    } else {
                        resolve(r.dodgeList || []);
                    }
                });
            } catch (e) {
                resolve([]);
            }
        });
    }

    async function saveList(list) {
        return new Promise((resolve) => {
            try {
                if (!chrome.runtime?.id) {
                    resolve();
                    return;
                }
                chrome.storage.local.set({ dodgeList: list }, () => {
                    if (!chrome.runtime.lastError) {
                        // Важно: уведомляем попап и другие модули, что список изменился
                        chrome.runtime.sendMessage({ action: 'dodgeListUpdated', list }).catch(() => {});
                    }
                    resolve();
                });
            } catch (e) {
                resolve();
            }
        });
    }

    async function addPlayer(player) {
        const list = await getList();
        if (list.some((p) => p.id === player.id || p.name.toLowerCase() === player.name.toLowerCase())) return;
        list.push({ ...player, addedAt: Date.now() });
        await saveList(list);
    }

    async function removePlayer(playerId, playerName) {
        const list = await getList();
        const filtered = list.filter((p) => p.id !== playerId && p.name.toLowerCase() !== playerName.toLowerCase());
        await saveList(filtered);
    }

    // UI: inject "Add to Dodge List" button next to every player nickname
    async function injectButtons() {
        if (!chrome.runtime?.id) return;

        const currentList = await getList();

        const selectors = [
            '[class*="Nickname__Name"]',
            '[class*="PlayerCard"] a',
            '[class*="player-card"] a',
            '[data-testid*="player"] [class*="name"]',
            '[class*="nickname"]'
        ];

        const selectorString = selectors.join(', ');

        document.querySelectorAll(selectorString).forEach((el) => {
            if (el.dataset.fueDodgeInjected) return;
            el.dataset.fueDodgeInjected = '1';

            const playerName = el.textContent.trim();
            if (!playerName) return;

            const playerId = extractPlayerId(el) || playerName;

            const btn = document.createElement('button');
            btn.className  = 'fue-dodge-btn';
            btn.title      = 'Добавить в Dodge List';
            btn.textContent = '🚫';

            const isDodged = currentList.some(
                (p) => p.id === playerId || p.name.toLowerCase() === playerName.toLowerCase()
            );

            if (isDodged) {
                btn.classList.add('fue-dodge-btn--active');
                btn.title = 'В Dodge List (нажми для удаления)';
            }

            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (!chrome.runtime?.id) {
                    showToast("⚠️ Расширение было обновлено. Пожалуйста, перезагрузите страницу (F5).");
                    return;
                }

                const latestList = await getList();
                const inList = latestList.some(
                    (p) => p.id === playerId || p.name.toLowerCase() === playerName.toLowerCase()
                );

                if (inList) {
                    await removePlayer(playerId, playerName);
                    btn.classList.remove('fue-dodge-btn--active');
                    btn.title = 'Добавить в Dodge List';
                    showToast(`❌ ${playerName} удален из Dodge List`);
                } else {
                    await addPlayer({ id: playerId, name: playerName });
                    btn.classList.add('fue-dodge-btn--active');
                    btn.title = 'В Dodge List (нажми для удаления)';
                    showToast(`🚫 ${playerName} добавлен в Dodge List`);
                }
            });

            el.insertAdjacentElement('afterend', btn);
        });
    }

    function extractPlayerId(el) {
        const link = el.closest('a') || el.querySelector('a') || (el.tagName === 'A' ? el : null);
        if (link && link.href) {
            const match = link.href.match(/\/(?:players|profile)\/([^/?#]+)/);
            if (match) return match[1];
        }
        return el.dataset.playerId || el.dataset.userId || null;
    }

    async function checkLobby() {
        if (!chrome.runtime?.id) return;
        if (document.getElementById('fue-dodge-alert')) return;

        const list = await getList();
        if (!list.length) return;

        const visibleNames = new Set();
        const visibleIds   = new Set();

        const selectors = [
            '[class*="Nickname__Name"]',
            '[class*="PlayerCard"] a',
            '[data-testid*="player"] [class*="name"]'
        ];

        document.querySelectorAll(selectors.join(', ')).forEach((el) => {
            const name = el.textContent.trim().toLowerCase();
            if (name) visibleNames.add(name);

            const id = extractPlayerId(el);
            if (id) visibleIds.add(id.toLowerCase());
        });

        const matched = list.filter(
            (p) =>
                (p.id && visibleIds.has(p.id.toLowerCase())) ||
                visibleNames.has(p.name.toLowerCase())
        );

        if (matched.length === 0) return;

        showDodgeAlert(matched);
        flashLobby();
    }

    function showDodgeAlert(players) {
        removeDodgeAlert();

        const names = players.map((p) => p.name).join(', ');
        const overlay = document.createElement('div');
        overlay.id        = 'fue-dodge-alert';
        overlay.innerHTML = `
          <div class="fue-dodge-alert__inner">
            <span class="fue-dodge-alert__icon">⚠️</span>
            <div class="fue-dodge-alert__text">
              <strong>ТОКСИК В ЛОББИ!</strong>
              <span>${names} — в твоем Dodge List</span>
            </div>
            <button class="fue-dodge-alert__close" title="Закрыть">✕</button>
          </div>
        `;

        overlay.querySelector('.fue-dodge-alert__close').addEventListener('click', removeDodgeAlert);
        document.body.appendChild(overlay);

        setTimeout(removeDodgeAlert, 15000);
    }

    function removeDodgeAlert() {
        document.getElementById('fue-dodge-alert')?.remove();
    }

    function flashLobby() {
        const lobby =
            document.querySelector('[class*="Overview__Grid"]') ||
            document.querySelector('[class*="MatchRoom"]') ||
            document.querySelector('main');

        if (!lobby) return;
        lobby.classList.add('fue-flash-red');
        setTimeout(() => lobby.classList.remove('fue-flash-red'), 3000);
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className   = 'fue-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('fue-toast--show'), 10);
        setTimeout(() => {
            toast.classList.remove('fue-toast--show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // Слушаем внешние изменения (если игрока удалили прямо из Попапа меню)
    if (chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.action === 'dodgeListUpdated') {
                // Принудительно обновляем классы активных кнопок на странице без перезагрузки
                const updatedList = message.list || [];
                const buttons = document.querySelectorAll('.fue-dodge-btn');
                buttons.forEach(btn => {
                    const el = btn.previousElementSibling;
                    if (!el) return;
                    const playerName = el.textContent.trim();
                    const playerId = extractPlayerId(el) || playerName;

                    const isDodged = updatedList.some(
                        (p) => p.id === playerId || p.name.toLowerCase() === playerName.toLowerCase()
                    );

                    if (isDodged) {
                        btn.classList.add('fue-dodge-btn--active');
                        btn.title = 'В Dodge List (нажми для удаления)';
                    } else {
                        btn.classList.remove('fue-dodge-btn--active');
                        btn.title = 'Добавить в Dodge List';
                    }
                });
            }
        });
    }

    return { injectButtons, checkLobby, getList, addPlayer, removePlayer };
})();