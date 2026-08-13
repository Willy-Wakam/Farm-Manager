import { GoogleGenAI } from "@google/genai";
import { geminiOptions } from "./config";

export const ai = new GoogleGenAI(geminiOptions());
