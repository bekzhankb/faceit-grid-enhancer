// ============================================================
// FACEIT Grid Enhancer — content.js (Smart Orchestrator)
// ============================================================
console.log("[FACEIT Grid Enhancer] Инициализация контент-скрипта...");

// Главная функция инициализации с проверкой настроек
function initEnhancer() {
    const isVetoPage = location.pathname.includes('/room/') || location.pathname.includes('/match/');
    if (!isVetoPage) return;

    // Запрашиваем состояние всех тумблеров из памяти браузера
    chrome.storage.local.get({
        'toggle-mapVeto': true,
        'toggle-smurfDetector': true,
        'toggle-dodgeCalc': true,
        'toggle-dodgeList': true,
        'toggle-qol': true
    }, (settings) => {

        console.log("[FACEIT Grid Enhancer] Текущие настройки модулей:", settings);

        // 1. Модуль AI Deep Map Veto
        if (settings['toggle-mapVeto'] && typeof MapVeto !== 'undefined') {
            MapVeto.injectPanel();
        }

        // 2. Локальный Черный Список (Dodge List)
        if (settings['toggle-dodgeList'] && typeof DodgeList !== 'undefined') {
            // Сюда можно будет повесить автоматический алерт, если задодженный игрок попался в лобби
            console.log("[FACEIT Grid Enhancer] Модуль Dodge List активен.");
        }

        // 3. Смурф-детектор и QoL
        if (settings['toggle-smurfDetector'] && typeof QolFeatures !== 'undefined') {
            console.log("[FACEIT Grid Enhancer] Модуль детекта смурфов активен.");
        }
    });
}

// Отслеживание SPA-переходов FACEIT (смена комнат без перезагрузки страницы)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(initEnhancer, 1500); // Даем 1.5 секунды на прогрузку DOM-дерева страницы
    }
}).observe(document, { subtree: true, childList: true });

// Первичный запуск при старте страницы
window.addEventListener('load', () => {
    setTimeout(initEnhancer, 2000);
});

// content.js — Главный диспетчер расширения

console.log("[FACEIT Grid] Content script успешно загружен на страницу!");

// Функция инициализации
function initEnhancer() {
    // Проверяем, включен ли модуль DodgeList в настройках, и запускаем его
    if (typeof DodgeList !== 'undefined') {
        // Запускаем инжект кнопок 🚫
        DodgeList.injectButtons();

        // Проверяем лобби на наличие токсиков
        DodgeList.checkLobby();
    } else {
        console.error("[FACEIT Grid] Модуль DodgeList не найден в контексте страницы!");
    }
}

// Запускаем проверку каждые 2 секунды, так как FACEIT постоянно обновляет DOM без перезагрузки страниц
setInterval(initEnhancer, 2000);