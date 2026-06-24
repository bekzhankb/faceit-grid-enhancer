// FACEIT Grid Enhancer — background.js (Service Worker)


const MAX_TRACKED_MATCHES = 30;

// Установка дефолтных настроек при первой установке расширения
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get([
        'toggle-mapVeto',
        'toggle-smurfDetector',
        'toggle-dodgeCalc',
        'toggle-dodgeList',
        'toggle-qol'
    ], (result) => {
        const defaultSettings = {};

        // Если настройки еще не заданы — выставляем true
        if (result['toggle-mapVeto'] === undefined) defaultSettings['toggle-mapVeto'] = true;
        if (result['toggle-smurfDetector'] === undefined) defaultSettings['toggle-smurfDetector'] = true;
        if (result['toggle-dodgeCalc'] === undefined) defaultSettings['toggle-dodgeCalc'] = true;
        if (result['toggle-dodgeList'] === undefined) defaultSettings['toggle-dodgeList'] = true;
        if (result['toggle-qol'] === undefined) defaultSettings['toggle-qol'] = true;

        if (Object.keys(defaultSettings).length > 0) {
            chrome.storage.local.set(defaultSettings, () => {
                console.log("[FACEIT Grid Enhancer] Дефолтные настройки успешно применены.");
            });
        }
    });

    trimMatchHistory();
});

chrome.runtime.onStartup.addListener(trimMatchHistory);

function trimMatchHistory() {
    chrome.storage.local.get(['matchHistory'], (r) => {
        const history = r.matchHistory || [];
        if (history.length > MAX_TRACKED_MATCHES) {
            const trimmed = history.slice(-MAX_TRACKED_MATCHES);
            chrome.storage.local.set({ matchHistory: trimmed });
        }
    });
}

// Обработчик сообщений (Popup -> Background)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

    if (msg.type === 'GET_DODGE_LIST') {
        chrome.storage.local.get(['dodgeList'], (r) => sendResponse(r.dodgeList || []));
        return true;
    }

    if (msg.type === 'CLEAR_DODGE_LIST') {
        chrome.storage.local.set({ dodgeList: [] }, () => sendResponse({ ok: true }));
        return true;
    }

    if (msg.type === 'GET_MATCH_STATISTICS') {
        chrome.storage.local.get(['matchHistory'], (r) => {
            const history = r.matchHistory || [];
            const dodgeCount = history.filter(m => m.status === 'DODGED').length;
            sendResponse({
                history: history,
                dodgeCountInLast30Games: dodgeCount
            });
        });
        return true;
    }

    if (msg.type === 'LOG_MATCH_PLAYED') {
        updateMatchHistory({ status: 'PLAYED', date: new Date().toLocaleString() }, sendResponse);
        return true;
    }

    if (msg.type === 'LOG_MATCH_DODGED') {
        updateMatchHistory({ status: 'DODGED', date: new Date().toLocaleString() }, sendResponse);
        return true;
    }
});

function updateMatchHistory(newEntry, sendResponse) {
    chrome.storage.local.get(['matchHistory'], (r) => {
        const history = r.matchHistory || [];
        history.push(newEntry);

        if (history.length > MAX_TRACKED_MATCHES) {
            history.shift();
        }

        chrome.storage.local.set({ matchHistory: history }, () => {
            const dodgeCount = history.filter(m => m.status === 'DODGED').length;
            sendResponse({ ok: true, totalTracked: history.length, dodgeCount: dodgeCount });
        });
    });
}