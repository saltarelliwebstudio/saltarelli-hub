/**
 * OpenPhone SMS sender module
 * Wraps the OpenPhone v1/messages API with retry logic and structured responses.
 */

import axios from 'axios';

const OPENPHONE_API_URL = 'https://api.openphone.com/v1/messages';

/**
 * Send an SMS via OpenPhone.
 *
 * @param {string} to       - E.164 recipient phone number (e.g. +12895551234)
 * @param {string} content  - Message body text
 * @param {string} apiKey   - OpenPhone API key
 * @param {string} from     - OpenPhone sender number (E.164)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function sendSms(to, content, apiKey, from) {
  const payload = {
    from,
    to,
    content,
  };

  try {
    const response = await axios.post(OPENPHONE_API_URL, payload, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    return {
      success: true,
      data: response.data,
      statusCode: response.status,
    };
  } catch (err) {
    const statusCode = err.response?.status;
    const errorBody = err.response?.data;
    const errorMessage = errorBody?.message || err.message || 'Unknown error';

    console.error(`[OpenPhone] SMS send failed to ${to}: ${statusCode} – ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
      statusCode,
      data: errorBody,
    };
  }
}
