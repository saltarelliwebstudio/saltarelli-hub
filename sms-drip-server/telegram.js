/**
 * Telegram Bot API helper
 * Sends messages via the Telegram Bot API using axios.
 */

import axios from 'axios';

/**
 * Send a message to a Telegram chat.
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Target chat ID
 * @param {string} text - Message text
 * @param {string} [parseMode='Markdown'] - Parse mode (Markdown or HTML)
 */
export async function sendTelegram(botToken, chatId, text, parseMode = 'Markdown') {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const res = await axios.post(url, {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  });

  return res.data;
}
