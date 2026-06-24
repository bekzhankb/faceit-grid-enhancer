// MODULE 2 — Quick Dodge Calculator

const DodgeCalc = (() => {

    // Ban timetable (mock — mirrors real FACEIT penalty structure)
    // Source: community-verified penalty ladder
    const PENALTY_TABLE = [
        { dodges: 1, banMinutes: 30,   eloPenalty: 0,   label: '1-й додж за день'  },
        { dodges: 2, banMinutes: 120    ,  eloPenalty: 0,   label: '2-й додж за день'  },
        { dodges: 3, banMinutes: 360,  eloPenalty: 5,   label: '3-й додж за день'  },
        { dodges: 4, banMinutes: 720,  eloPenalty: 10,  label: '4-й додж за день'  },
        { dodges: 5, banMinutes: 1440, eloPenalty: 20,  label: '5-й додж (суточный бан)' },
    ];

    // Fetch today's dodge count from storage

    async function getTodayDodges() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['dodgeHistory'], (r) => {
                const history = r.dodgeHistory || [];
                const todayStart = new Date().setHours(0, 0, 0, 0);
                const todayDodges = history.filter((ts) => ts >= todayStart).length;
                resolve(todayDodges);
            });
        });
    }

    async function recordDodge() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['dodgeHistory'], (r) => {
                const history = r.dodgeHistory || [];
                history.push(Date.now());
                chrome.storage.local.set({ dodgeHistory: history }, resolve);
            });
        });
    }

    // Core calculation

    function calculate(todayDodges) {
        const nextCount = todayDodges + 1; // next dodge = what they're about to do
        const tier = PENALTY_TABLE[Math.min(nextCount - 1, PENALTY_TABLE.length - 1)];
        const banEndsAt = Date.now() + tier.banMinutes * 60 * 1000;
        return {
            label:      tier.label,
            banMinutes: tier.banMinutes,
            eloPenalty: tier.eloPenalty,
            banEndsAt,
        };
    }

    // Countdown timer helper

    function formatCountdown(ms) {
        if (ms <= 0) return '00:00:00';
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
    }

    // UI: inject "Dodge Calculator" button into the lobby

    function injectButton() {
        // Don't inject twice
        if (document.getElementById('fue-dodge-calc-btn')) return;

        // Only inject on match room / lobby pages
        const lobby =
            document.querySelector('[class*="MatchRoom"]') ||
            document.querySelector('[class*="match-room"]');
        if (!lobby) return;

        const btn = document.createElement('button');
        btn.id          = 'fue-dodge-calc-btn';
        btn.className   = 'fue-action-btn';
        btn.textContent = '⚡ Последствия додж';
        btn.addEventListener('click', openCalcPanel);

        // Insert into an existing actions bar if present, otherwise append to lobby header
        const actionsBar =
            lobby.querySelector('[class*="actions"]') ||
            lobby.querySelector('[class*="header"]') ||
            lobby;
        actionsBar.appendChild(btn);
    }

    // Panel with calculation result & live countdown

    let countdownInterval = null;

    async function openCalcPanel() {
        closeCalcPanel();

        const todayDodges = await getTodayDodges();
        const result      = calculate(todayDodges);

        const panel = document.createElement('div');
        panel.id        = 'fue-dodge-panel';
        panel.innerHTML = `
      <div class="fue-panel">
        <div class="fue-panel__header">
          <span>⚡ Dodge Calculator</span>
          <button class="fue-panel__close" id="fue-dodge-close">✕</button>
        </div>
        <div class="fue-panel__body">
          <div class="fue-calc-row">
            <span class="fue-calc-label">Статус</span>
            <span class="fue-calc-value">${result.label}</span>
          </div>
          <div class="fue-calc-row">
            <span class="fue-calc-label">Бан на поиск</span>
            <span class="fue-calc-value fue-calc-value--danger" id="fue-ban-time">
              ${result.banMinutes} мин
            </span>
          </div>
          <div class="fue-calc-row">
            <span class="fue-calc-label">Потеря Elo</span>
            <span class="fue-calc-value ${result.eloPenalty > 0 ? 'fue-calc-value--danger' : 'fue-calc-value--safe'}">
              ${result.eloPenalty > 0 ? `−${result.eloPenalty}` : '0'}
            </span>
          </div>
          <div class="fue-calc-row fue-calc-row--timer">
            <span class="fue-calc-label">Бан истечёт через</span>
            <span class="fue-calc-value fue-calc-value--timer" id="fue-countdown">
              ${formatCountdown(result.banMinutes * 60 * 1000)}
            </span>
          </div>
          <button class="fue-btn fue-btn--confirm" id="fue-dodge-confirm">
            Я всё равно доджую — записать
          </button>
        </div>
      </div>
    `;

        document.body.appendChild(panel);

        // Live countdown
        const endTime = result.banEndsAt;
        countdownInterval = setInterval(() => {
            const el = document.getElementById('fue-countdown');
            if (!el) { clearInterval(countdownInterval); return; }
            el.textContent = formatCountdown(endTime - Date.now());
        }, 1000);

        document.getElementById('fue-dodge-close').addEventListener('click', closeCalcPanel);

        document.getElementById('fue-dodge-confirm').addEventListener('click', async () => {
            await recordDodge();
            closeCalcPanel();
            showPenaltyToast(result);
        });
    }

    function closeCalcPanel() {
        clearInterval(countdownInterval);
        document.getElementById('fue-dodge-panel')?.remove();
    }

    function showPenaltyToast(result) {
        const toast = document.createElement('div');
        toast.className   = 'fue-toast fue-toast--danger';
        toast.textContent =
            `🚫 Додж записан. Бан: ${result.banMinutes} мин. Elo: ${result.eloPenalty > 0 ? '-' + result.eloPenalty : '0'}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('fue-toast--show'), 10);
        setTimeout(() => {
            toast.classList.remove('fue-toast--show');
            setTimeout(() => toast.remove(), 400);
        }, 5000);
    }

    // Public API
    return { injectButton, calculate, getTodayDodges };

})();