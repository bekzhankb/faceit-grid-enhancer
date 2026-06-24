// Personal Dodge List (Кастомный ЧС)

const DodgeList = (() => {

    // Storage helpers
    async function getList() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['dodgeList'], (r) => resolve(r.dodgeList || []));
        });
    }

    async function saveList(list) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ dodgeList: list }, resolve);
        });
    }

    async function addPlayer(player) {
        const list = await getList();
        // Проверяем и по ID (ник из URL), и по отображаемому имени
        if (list.some((p) => p.id === player.id || p.name.toLowerCase() === player.name.toLowerCase())) return;
        list.push({ ...player, addedAt: Date.now() });
        await saveList(list);
    }

    async function removePlayer(playerId, playerName) {
        const list = await getList();
        // Удаляем по совпадению любого из параметров для надежности
        const filtered = list.filter((p) => p.id !== playerId && p.name.toLowerCase() !== playerName.toLowerCase());
        await saveList(filtered);
    }

    // UI: inject "Add to Dodge List" button next to every player nickname
    async function injectButtons() {
        // Запрашиваем список ОДИН раз перед циклом, а не для каждой кнопки отдельно
        const currentList = await getList();

        const selectors = [
            '[class*="nickname"]',
            '[class*="PlayerCard"] a',
            '[class*="player-card"] a',
            '[data-testid*="player"] [class*="name"]',
        ];

        selectors.forEach((sel) => {
            document.querySelectorAll(sel).forEach((el) => {
                // Избегаем двойного инжекта
                if (el.dataset.fueDodgeInjected) return;
                el.dataset.fueDodgeInjected = '1';

                const playerId   = extractPlayerId(el); // Никнейм из URL
                const playerName = el.textContent.trim();

                // Если нет ни того, ни другого — скипаем
                if (!playerId && !playerName) return;

                const btn = document.createElement('button');
                btn.className  = 'fue-dodge-btn';
                btn.title      = 'Добавить в Dodge List';
                btn.textContent = '🚫';

                // Сверяем элемент с текущим ЧС
                const isDodged = currentList.some(
                    (p) => (playerId && p.id === playerId) || p.name.toLowerCase() === playerName.toLowerCase()
                );

                if (isDodged) {
                    btn.classList.add('fue-dodge-btn--active');
                    btn.title = 'В Dodge List (нажми для удаления)';
                }

                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const latestList = await getList();
                    const inList = latestList.some(
                        (p) => (playerId && p.id === playerId) || p.name.toLowerCase() === playerName.toLowerCase()
                    );

                    if (inList) {
                        await removePlayer(playerId, playerName);
                        btn.classList.remove('fue-dodge-btn--active');
                        btn.title = 'Добавить в Dodge List';
                        showToast(`❌ ${playerName} удален из Dodge List`);
                    } else {
                        await addPlayer({ id: playerId || playerName, name: playerName });
                        btn.classList.add('fue-dodge-btn--active');
                        btn.title = 'В Dodge List (нажми для удаления)';
                        showToast(`🚫 ${playerName} добавлен в Dodge List`);
                    }
                });

                // Вставляем кнопку сразу после элемента никнейма
                el.insertAdjacentElement('afterend', btn);
            });
        });
    }

    // Extract player FACEIT ID (или никнейм из ссылки) из контекста страницы
    function extractPlayerId(el) {
        const link = el.closest('a') || el.querySelector('a') || (el.tagName === 'A' ? el : null);
        if (link && link.href) {
            // Ищет паттерны типа /players/челик или /ru/players/челик
            const match = link.href.match(/\/(?:players|profile)\/([^/?#]+)/);
            if (match) return match[1];
        }
        return el.dataset.playerId || el.dataset.userId || null;
    }

    // Lobby check: scan all visible nicknames against dodge list
    async function checkLobby() {
        // Если алерт уже на экране, не тратим ресурсы на повторную проверку
        if (document.getElementById('fue-dodge-alert')) return;

        const list = await getList();
        if (!list.length) return;

        const visibleNames = new Set();
        const visibleIds   = new Set();

        const selectors = ['[class*="nickname"]', '[class*="PlayerCard"] a', '[data-testid*="player"] [class*="name"]'];

        document.querySelectorAll(selectors.join(', ')).forEach((el) => {
            const name = el.textContent.trim().toLowerCase();
            if (name) visibleNames.add(name);

            const id = extractPlayerId(el);
            if (id) visibleIds.add(id.toLowerCase());
        });

        // Ищем совпадения
        const matched = list.filter(
            (p) =>
                (p.id && visibleIds.has(p.id.toLowerCase())) ||
                visibleNames.has(p.name.toLowerCase())
        );

        if (matched.length === 0) return;

        showDodgeAlert(matched);
        flashLobby();
    }

    // Dodge alert overlay
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

        // Авто-скрытие через 15 секунд
        setTimeout(removeDodgeAlert, 15000);
    }

    function removeDodgeAlert() {
        document.getElementById('fue-dodge-alert')?.remove();
    }

    // Red flash on lobby container
    function flashLobby() {
        const lobby =
            document.querySelector('[class*="MatchRoom"]') ||
            document.querySelector('[class*="match-room"]') ||
            document.querySelector('main');

        if (!lobby) return;
        lobby.classList.add('fue-flash-red');
        setTimeout(() => lobby.classList.remove('fue-flash-red'), 3000);
    }

    // Generic toast notification
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

    return { injectButtons, checkLobby, getList, addPlayer, removePlayer };
})();