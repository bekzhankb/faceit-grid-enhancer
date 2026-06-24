document.addEventListener('DOMContentLoaded', () => {

    // 1. УПРАВЛЕНИЕ ТУМБЛЕРAМИ МОДУЛЕЙ
    const modules = ['mapVeto', 'smurfDetector', 'dodgeList', 'qol'];

    modules.forEach(mod => {
        const checkbox = document.getElementById(`toggle-${mod}`);
        if (!checkbox) return;

        // По умолчанию всё включено
        chrome.storage.local.get([`mod_${mod}`], (result) => {
            checkbox.checked = result[`mod_${mod}`] !== false;
        });

        checkbox.addEventListener('change', () => {
            chrome.storage.local.set({ [`mod_${mod}`]: checkbox.checked }, () => {
                if (mod === 'dodgeList') {
                    const panel = document.getElementById('panel-dodgeList');
                    if (panel) panel.style.display = checkbox.checked ? 'block' : 'none';
                }
            });
        });
    });

    // 2. ЛОКАЛЬНЫЙ ЧЕРНЫЙ СПИСОК (DODGE LIST)
    const blacklistTotal   = document.getElementById('blacklist-total');
    const listContainer    = document.getElementById('dodge-list-container');
    const listEmptyMessage = document.getElementById('dodge-list-empty');
    const btnClearDodge    = document.getElementById('btn-clear-dodgelist');

    function renderDodgeList() {
        chrome.storage.local.get(['dodgeList'], (result) => {
            const list = result.dodgeList || [];
            if (blacklistTotal) blacklistTotal.textContent = list.length;

            listContainer.querySelectorAll('.blacklist-item').forEach(item => item.remove());

            if (list.length === 0) {
                if (listEmptyMessage) listEmptyMessage.style.display = 'block';
                return;
            }

            if (listEmptyMessage) listEmptyMessage.style.display = 'none';

            list.forEach((player) => {
                const item = document.createElement('div');
                item.className = 'blacklist-item';
                item.innerHTML = `
                    <span class="blacklist-username">${player.name}</span>
                    <button class="blacklist-remove" data-id="${player.id}" data-name="${player.name}">✕</button>
                `;
                item.querySelector('.blacklist-remove').addEventListener('click', async (e) => {
                    await removePlayerFromPopup(e.target.dataset.id, e.target.dataset.name);
                });
                listContainer.appendChild(item);
            });
        });
    }

    async function removePlayerFromPopup(playerId, playerName) {
        chrome.storage.local.get(['dodgeList'], (result) => {
            const list = result.dodgeList || [];
            const filtered = list.filter((p) => p.id !== playerId && p.name.toLowerCase() !== playerName.toLowerCase());
            chrome.storage.local.set({ dodgeList: filtered }, () => {
                chrome.runtime.sendMessage({ action: 'dodgeListUpdated', list: filtered }).catch(() => {});
                renderDodgeList();
            });
        });
    }

    if (btnClearDodge) {
        btnClearDodge.addEventListener('click', () => {
            if (confirm('Очистить весь Dodge List?')) {
                chrome.storage.local.set({ dodgeList: [] }, () => {
                    chrome.runtime.sendMessage({ action: 'dodgeListUpdated', list: [] }).catch(() => {});
                    renderDodgeList();
                });
            }
        });
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'dodgeListUpdated') renderDodgeList();
    });

    renderDodgeList();
    chrome.storage.local.get(['mod_dodgeList'], (res) => {
        const panel = document.getElementById('panel-dodgeList');
        if (panel && res.mod_dodgeList === false) panel.style.display = 'none';
    });
});