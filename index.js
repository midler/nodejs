const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const csv = require("csv-parser");

// Замените 'YOUR_TOKEN' на токен вашего бота
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let data = [];

// Загрузка данных из CSV-файла
fs.createReadStream("data.csv")
    .pipe(csv())
    .on("data", (row) => {
        if (!/mcc:/i.test(row.MCC)) {
            data.push(row);
        }
    })
    .on("end", () => {
        console.log("CSV файл загружен.");
    })
    .on("error", (error) => {
        console.error("Ошибка при чтении CSV:", error);
    });

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Привет! Отправь мне MCC-коды через пробел или запятую, и я найду совпадения.");
});

// Функция для экранирования специальных символов для HTML
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Функция для отправки сообщения с учетом длины
function sendMessageInChunks(chatId, message) {
    const maxLength = 4096; // Максимальная длина сообщения в Telegram
    const chunks = [];

    // Разбиваем сообщение на части, если оно слишком длинное
    while (message.length > maxLength) {
        chunks.push(message.slice(0, maxLength));
        message = message.slice(maxLength);
    }
    chunks.push(message);

    // Отправляем каждую часть
    chunks.forEach((chunk) => {
        bot.sendMessage(chatId, chunk, { parse_mode: "HTML" });
    });
}

// Обработка текстовых сообщений
bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const input = msg.text.trim();

    // Удаляем "MCC:" и "MCC" (в любом регистре) из входного текста
    const cleanedInput = input.replace(/mcc:\s*/i, "").replace(/mcc\s*/i, "");

    // Регулярное выражение для проверки на целые числа, разделенные пробелами или запятыми
    const regex = /^(\d+([,\s]*\d*)*)+$/;

    if (regex.test(cleanedInput)) {
        // Разделяем по запятым или пробелам
        const mccCodes = cleanedInput.split(/[\s,]+/).map((num) => num.trim());

        // Поиск совпадений
        const matches = data.filter((row) => mccCodes.includes(row.MCC));

        if (matches.length > 0) {
            matches.forEach((row) => {
                // Экранируем описание и заключаем его в <blockquote>
                const description = `<blockquote>${escapeHtml(row.Описание).replace(/\n/g, "<br>")}</blockquote>`;

                const response =
                    `<b>${escapeHtml(row.MCC)}</b>: <i>${escapeHtml(row.Название)}</i>\n` +
                    `${description}`; // Используем HTML разметку

                // Отправляем каждое совпадение как отдельное сообщение
                sendMessageInChunks(chatId, response);
            });
        } else {
            bot.sendMessage(chatId, "Совпадений не найдено.");
        }
    } else {
        bot.sendMessage(
            chatId,
            "Пожалуйста, введите только целые числа, разделенные пробелами или запятыми (например, 3000, 3001 или 3000 3001).",
        );
    }
});

// Обработка ошибок
bot.on("polling_error", (error) => {
    console.error(error); // Логируем ошибки
});
