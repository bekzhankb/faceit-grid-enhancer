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
        if (list.some((p) => p.id === player.id)) return; // already in list
        list.push({ ...player, addedAt: Date.now() });
        await saveList(list);
    }

    async function removePlayer(playerId) {
        const list = await getList();
        await saveList(list.filter((p) => p.id !== playerId));
    }

    // UI: inject "Add to Dodge List" button next to every player nickname

    function injectButtons() {
        // FACEIT renders player cards as <a> tags with class containing "nickname"
        // We look for the most common selectors across match room / hub / profile pages
        const selectors = [
            '[class*="nickname"]',
            '[class*="PlayerCard"] a',
            '[class*="player-card"] a',
            '[data-testid*="player"] [class*="name"]',
        ];

        selectors.forEach((sel) => {
            document.querySelectorAll(sel).forEach((el) => {
                // Avoid double-injecting
                if (el.dataset.fueDodgeInjected) return;
                el.dataset.fueDodgeInjected = '1';

                const playerId   = extractPlayerId(el);
                const playerName = el.textContent.trim();
                if (!playerId && !playerName) return;

                const btn = document.createElement('button');
                btn.className  = 'fue-dodge-btn';
                btn.title      = 'Добавить в Dodge List';
                btn.textContent = '🚫';

                // Check if already in list and update visual state
                getList().then((list) => {
                    if (list.some((p) => p.id === playerId || p.name === playerName)) {
                        btn.classList.add('fue-dodge-btn--active');
                        btn.title = 'В Dodge List (нажми для удаления)';
                    }
                });

                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const list = await getList();
                    const inList = list.some((p) => p.id === playerId || p.name === playerName);

                    if (inList) {
                        await removePlayer(playerId);
                        btn.classList.remove('fue-dodge-btn--active');
                        btn.title = 'Добавить в Dodge List';
                        showToast(`❌ ${playerName} удалён из Dodge List`);
                    } else {
                        await addPlayer({ id: playerId, name: playerName });
                        btn.classList.add('fue-dodge-btn--active');
                        btn.title = 'В Dodge List (нажми для удаления)';
                        showToast(`🚫 ${playerName} добавлен в Dodge List`);
                    }
                });

                // Insert button right after the nickname element
                el.insertAdjacentElement('afterend', btn);
            });
        });
    }

    // Extract player FACEIT ID from page context

    function extractPlayerId(el) {
        // Try href: /players/{id} or /profile/{id}
        const link = el.closest('a') || el.querySelector('a');
        if (link) {
            const match = link.href.match(/\/(?:players|profile)\/([^/?#]+)/);
            if (match) return match[1];
        }
        // Try data attributes
        return el.dataset.playerId || el.dataset.userId || null;
    }

    // Lobby check: scan all visible nicknames against dodge list

    async function checkLobby() {
        const list = await getList();
        if (!list.length) return;

        // Gather all player names visible on the current match/lobby page
        const visibleNames = new Set();
        const visibleIds   = new Set();

        document.querySelectorAll('[class*="nickname"], [class*="PlayerCard"] a').forEach((el) => {
            visibleNames.add(el.textContent.trim().toLowerCase());
            const id = extractPlayerId(el);
            if (id) visibleIds.add(id.toLowerCase());
        });

        const matched = list.filter(
            (p) =>
                visibleIds.has((p.id || '').toLowerCase()) ||
                visibleNames.has((p.name || '').toLowerCase())
        );

        if (matched.length === 0) return;

        showDodgeAlert(matched);
        flashLobby();
    }

    // Dodge alert overlay

    function showDodgeAlert(players) {
        removeDodgeAlert(); // clear previous

        const names = players.map((p) => p.name).join(', ');
        const overlay = document.createElement('div');
        overlay.id        = 'fue-dodge-alert';
        overlay.innerHTML = `
      <div class="fue-dodge-alert__inner">
        <span class="fue-dodge-alert__icon">⚠️</span>
        <div class="fue-dodge-alert__text">
          <strong>ТОКСИК В ЛОББИ!</strong>
          <span>${names} — в твоём Dodge List</span>
        </div>
        <button class="fue-dodge-alert__close" title="Закрыть">✕</button>
      </div>
    `;

        overlay.querySelector('.fue-dodge-alert__close').addEventListener('click', removeDodgeAlert);
        document.body.appendChild(overlay);

        // Auto-dismiss after 15 s
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

    // Public API
    return { injectButtons, checkLobby, getList, addPlayer, removePlayer };

})();