// Personal Dodge List (Кастомный ЧС)

const DodgeList = (() => {

    async function getList() {
        return new Promise((resolve) => {
            try {
                if (!chrome.runtime?.id) return resolve([]);
                chrome.storage.local.get(['dodgeList'], (r) => {
                    resolve(chrome.runtime.lastError ? [] : (r.dodgeList || []));
                });
            } catch (e) { resolve([]); }
        });
    }

    async function saveList(list) {
        return new Promise((resolve) => {
            try {
                if (!chrome.runtime?.id) return resolve();
                chrome.storage.local.set({ dodgeList: list }, () => resolve());
            } catch (e) { resolve(); }
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

    // Обновление состояния кнопок на странице на основе актуального списка
    function updateButtonStates(updatedList) {
        document.querySelectorAll('.fue-dodge-btn').forEach(btn => {
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

    async function injectButtons() {
        if (!chrome.runtime?.id) return;
        const currentList = await getList();

        const selectors = [
            '[class*="Nickname__Name"]',
            '[class*="PlayerCard"] a',
            '[data-testid*="player"] [class*="name"]',
            '[class*="nickname"]'
        ];

        document.querySelectorAll(selectors.join(', ')).forEach((el) => {
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
            if (isDodged) btn.classList.add('fue-dodge-btn--active');

            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const latestList = await getList();
                const inList = latestList.some(
                    (p) => p.id === playerId || p.name.toLowerCase() === playerName.toLowerCase()
                );

                if (inList) {
                    await removePlayer(playerId, playerName);
                    showToast(`❌ ${playerName} удален из Dodge List`);
                } else {
                    await addPlayer({ id: playerId, name: playerName });
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
        const list = await getList();
        if (!list.length) {
            removeDodgeAlert();
            return;
        }

        const visibleNames = new Set();
        document.querySelectorAll('[class*="Nickname__Name"], [data-testid*="player"] [class*="name"]').forEach((el) => {
            const name = el.textContent.trim().toLowerCase();
            if (name) visibleNames.add(name);
        });

        const matched = list.filter((p) => visibleNames.has(p.name.toLowerCase()));
        if (matched.length === 0) {
            removeDodgeAlert();
            return;
        }

        if (!document.getElementById('fue-dodge-alert')) {
            showDodgeAlert(matched);
        }
    }

    function showDodgeAlert(players) {
        removeDodgeAlert();
        const names = players.map((p) => p.name).join(', ');
        const overlay = document.createElement('div');
        overlay.id = 'fue-dodge-alert';
        overlay.innerHTML = `
          <div class="fue-dodge-alert__inner">
            <span class="fue-dodge-alert__icon">⚠️</span>
            <div class="fue-dodge-alert__text"><strong>ТОКСИК В ЛОББИ!</strong> <span>${names}</span></div>
            <button class="fue-dodge-alert__close">✕</button>
          </div>
        `;
        overlay.querySelector('.fue-dodge-alert__close').addEventListener('click', removeDodgeAlert);
        document.body.appendChild(overlay);
    }

    function removeDodgeAlert() { document.getElementById('fue-dodge-alert')?.remove(); }

    function showToast(message) {
        // Защита: удаляем старый тост, если он завис
        document.querySelector('.fue-toast')?.remove();

        const toast = document.createElement('div');
        toast.className = 'fue-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('fue-toast--show'), 50);
        setTimeout(() => {
            toast.classList.remove('fue-toast--show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // РЕАКТИВНОСТЬ: Слушаем изменения в хранилище напрямую!
    if (chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes.dodgeList) {
                const newList = changes.dodgeList.newValue || [];
                updateButtonStates(newList);
                checkLobby();
            }
        });
    }

    return { injectButtons, checkLobby, updateButtonStates };
})();