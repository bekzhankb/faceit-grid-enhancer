// MODULE 4 — QoL Features & Smurf Detection
const QolFeatures = (() => {
    const BACKEND_URL = "http://localhost:8080/api/players";

    // Функция отправки ника на сервер для проверки на смурфинг
    async function checkPlayerSmurfStatus(nickname) {
        try {
            const response = await fetch(`${BACKEND_URL}/check-smurf?nickname=${nickname}`);
            if (!response.ok) return null;
            return await response.json(); // Ждем { isSmurf: true/false, reason: "..." }
        } catch (e) {
            console.error("[FACEIT Grid] Ошибка проверки смурфа для " + nickname, e);
            return null;
        }
    }

    return { checkPlayerSmurfStatus };
})();