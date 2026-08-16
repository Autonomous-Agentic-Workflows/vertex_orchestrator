
import { GoogleGenAI } from "@google/genai";
import { GEMINI_PROMPT } from '../constants';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const reviewCode = async (code: string): Promise<string> => {
    if (!code.trim()) {
        throw new Error("Cannot review empty code.");
    }

    try {
        const fullPrompt = `${GEMINI_PROMPT}\n\`\`\`python\n${code}\n\`\`\``;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            return `An error occurred while reviewing the code: ${error.message}`;
        }
        return "An unknown error occurred while reviewing the code.";
    }
};
