import type { GoogleGenAIOptions } from "@google/genai";

/**
 * Configuration du client Gemini.
 *
 * Obligatoire :
 *   GEMINI_API_KEY   — clé API Google AI Studio (https://aistudio.google.com/apikey)
 *
 * Optionnel :
 *   GEMINI_BASE_URL  — pour router les appels vers un proxy compatible Gemini.
 *                      Laisser vide pour utiliser directement l'API Google.
 */
export function geminiOptions(): GoogleGenAIOptions {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY must be set to use the AI features. " +
        "Create a key at https://aistudio.google.com/apikey and add it to your .env file.",
    );
  }

  const baseUrl = process.env.GEMINI_BASE_URL;

  return {
    apiKey,
    ...(baseUrl ? { httpOptions: { apiVersion: "", baseUrl } } : {}),
  };
}

/** Indique si les fonctionnalités IA sont configurées, sans lever d'erreur. */
export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
