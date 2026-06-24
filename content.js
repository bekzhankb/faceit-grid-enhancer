// FACEIT Grid Enhancer — content.js (Smart Dispatcher)


console.log("[FACEIT Grid Enhancer] Главный контент-скрипт запущен.");

function initEnhancer() {
    // Проверяем, что мы находимся в комнате матча
    const isVetoPage = location.pathname.includes('/room/') || location.pathname.includes('/match/');
    if (!isVetoPage) return;

    // Запрашиваем состояние тумблеров из памяти расширения (синхронизировано с popup.js)
    chrome.storage.local.get({
        'mod_mapVeto': true,
        'mod_smurfDetector': true,
        'mod_dodgeList': true,
        'mod_qol': true
    }, (settings) => {

        // 1. Модуль: AI Deep Map Veto
        if (settings.mod_mapVeto && typeof MapVeto !== 'undefined') {
            if (typeof MapVeto.injectPanel === 'function') {
                MapVeto.injectPanel();
            } else if (typeof MapVeto.init === 'function') {
                MapVeto.init();
            }
        }

        // 2. Модуль: Smurf Detector
        if (settings.mod_smurfDetector && typeof SmurfDetector !== 'undefined') {
            if (typeof SmurfDetector.checkPlayers === 'function') {
                SmurfDetector.checkPlayers();
            } else if (typeof SmurfDetector.init === 'function') {
                SmurfDetector.init();
            }
        }

        // 3. Модуль: Personal Dodge List (Наш ЧС)
        if (settings.mod_dodgeList && typeof DodgeList !== 'undefined') {
            DodgeList.injectButtons();
            DodgeList.checkLobby();
        }

        // 4. Модуль: General QoL Фичи
        if (settings.mod_qol && typeof QolFeatures !== 'undefined') {
            if (typeof QolFeatures.init === 'function') {
                QolFeatures.init();
            }
        }
    });
}

// Запускаем проверку каждые 2 секунды, так как FACEIT — это SPA (динамически обновляет DOM)
setInterval(initEnhancer, 2000);