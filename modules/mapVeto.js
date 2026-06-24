// MODULE 3 — Deep Map Veto (Production Ready)
const MapVeto = (() => {

    // Адрес твоего будущего бэкенд-сервера (пока локально, потом заменим на бесплатный хостинг)
    const BACKEND_URL = "http://localhost:8080/api/veto";
    const ALL_MAPS = ['Mirage', 'Anubis', 'Dust2', 'Inferno', 'Nuke', 'Ancient', 'Vertigo'];

    function suggestVeto(ourWR, enemyWR) {
        const diff = ourWR - enemyWR;
        if (diff >= 0.12)  return { action: 'Оставить карту',   emoji: '✅', cls: 'fue-veto--keep' };
        if (diff <= -0.12) return { action: 'ПРИОРИТЕТ БАНА',  emoji: '🔴', cls: 'fue-veto--ban'  };
        return                   { action: 'Нейтральная',       emoji: '🟡', cls: 'fue-veto--neutral' };
    }

    // Запрос аналитики лобби с твоего сервера
    async function fetchLobbyAnalytics(team1Names, team2Names) {
        try {
            const response = await fetch(`${BACKEND_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team1: team1Names, team2: team2Names })
            });

            if (!response.ok) throw new Error('Ошибка сервера бэкенда');
            return await response.json(); // Получаем полностью просчитанный мап-пул
        } catch (error) {
            console.error('[FACEIT Grid] Ошибка при получении аналитики:', error);
            return null;
        }
    }

    function injectPanel() {
        if (document.getElementById('fue-mapveto-btn')) return;

        const isVetoPage = location.pathname.includes('/room/') || location.pathname.includes('/match/');
        if (!isVetoPage) return;

        const btn = document.createElement('button');
        btn.id          = 'fue-mapveto-btn';
        btn.className   = 'fue-action-btn';
        btn.textContent = '🗺️ AI Tactical Veto';
        btn.addEventListener('click', () => handleVetoClick());

        const anchor = document.querySelector('[class*="actions"]') || document.querySelector('main');
        if (anchor) anchor.appendChild(btn);
    }

    async function handleVetoClick() {
        // 1. Скрапим реальные ники игроков прямо с экрана FACEIT
        const playerElements = document.querySelectorAll('a[href*="/players/"]');
        const allNames = Array.from(playerElements).map(el => el.textContent.trim()).filter(name => name.length > 0);

        // Убираем дубликаты, если они есть
        const uniqueNames = [...new Set(allNames)];

        if (uniqueNames.length < 2) {
            alert('Не удалось собрать ники игроков. Убедись, что ты в комнате матча!');
            return;
        }

        // Делим на команды (первые 5 — наши, вторые 5 — враги)
        const team1 = uniqueNames.slice(0, 5);
        const team2 = uniqueNames.slice(5, 10);

        // Показываем лоадер
        const btn = document.getElementById('fue-mapveto-btn');
        btn.textContent = '⚡ Анализ кода катки...';

        // 2. Запрашиваем у твоего Spring Boot бэкенда крутую аналитику
        const reportData = await fetchLobbyAnalytics(team1, team2);
        btn.textContent = '🗺️ AI Tactical Veto';

        if (!reportData) {
            alert('Бэкенд-сервер недоступен. Запусти Spring Boot приложение!');
            return;
        }

        renderVetoPanel(reportData);
    }

    function renderVetoPanel(report) {
        document.getElementById('fue-veto-panel')?.remove();

        const rows = report.maps.map((entry) => {
            const suggestion = suggestVeto(entry.team1AvgWR, entry.team2AvgWR);
            return `
              <tr class="fue-veto-row ${suggestion.cls}">
                <td class="fue-veto-map"><b>${entry.mapName}</b></td>
                <td>${(entry.team1AvgWR * 100).toFixed(0)}%</td>
                <td>${(entry.team2AvgWR * 100).toFixed(0)}%</td>
                <td class="fue-veto-action">${suggestion.emoji} ${suggestion.action}</td>
                <td class="fue-veto-players">
                  ${entry.topPerformers.map(p => `
                    <span class="fue-player-badge">
                      ${p.nickname}: K/D ${p.kd} · WR ${(p.wr * 100).toFixed(0)}%
                    </span>
                  `).join('')}
                </td>
              </tr>`;
        }).join('');

        const panel = document.createElement('div');
        panel.id = 'fue-veto-panel';
        panel.innerHTML = `
          <div class="fue-panel fue-panel--wide">
            <div class="fue-panel__header">
              <span>🗺️ Deep Map Veto — AI Enterprise Captain</span>
              <button class="fue-panel__close" id="fue-veto-close">✕</button>
            </div>
            <div class="fue-panel__body">
              <table class="fue-veto-table">
                <thead>
                  <tr>
                    <th>Карта</th>
                    <th>Наш Team WR</th>
                    <th>Враг Team WR</th>
                    <th>Рекомендация</th>
                    <th>Ключевые игроки</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>`;

        document.body.appendChild(panel);
        document.getElementById('fue-veto-close').addEventListener('click', () => panel.remove());
    }

    return { injectPanel };
})();