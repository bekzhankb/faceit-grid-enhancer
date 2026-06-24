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
        document.querySelector('.fue-toast')?.remove();

        const toast = document.createElement('div');
        toast.className = 'fue-toast';

        // Инжектим железные стили прямо в элемент, чтобы никакой CSS их не сломал
        toast.style.cssText = `
            position: fixed !important;
            bottom: 24px !important;
            right: 24px !important;
            width: auto !important;
            max-width: 300px !important;
            min-width: 200px !important;
            background: #1e222e !important;
            border: 1px solid #2c3142 !important;
            border-left: 4px solid #ff5500 !important;
            color: #ffffff !important;
            padding: 12px 16px !important;
            border-radius: 6px !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            font-family: sans-serif !important;
            z-index: 999999 !important;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6) !important;
            transition: transform 0.2s ease, opacity 0.2s ease !important;
            transform: translateY(30px) !important;
            opacity: 0 !important;
            display: block !important;
        `;

        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transform = 'translateY(0) !important';
            toast.style.opacity = '1 !important';
        }, 50);

        setTimeout(() => {
            toast.style.transform = 'translateY(30px) !important';
            toast.style.opacity = '0 !important';
            setTimeout(() => toast.remove(), 200);
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