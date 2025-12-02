import { GoogleGenAI, Type } from "@google/genai";
import { Token } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateComponentCode = async (
  prompt: string, 
  tokens: Token[], 
  currentCode: string | null
): Promise<string> => {
  const tokenContext = tokens.map(t => `--${t.name}: ${t.value}`).join('\n');
  
  const systemInstruction = `
    You are an expert Senior React Engineer and Design System Architect.
    Your goal is to generate or modify React components using Tailwind CSS.
    
    Adhere to these rules:
    1. Use TypeScript.
    2. Use Tailwind CSS for styling.
    3. Ensure the component is accessible (ARIA attributes).
    4. If provided, use the following Design Tokens as CSS variables or Tailwind arbitrary values where possible, but prioritize standard Tailwind utility classes if they match closely.
    
    Tokens available:
    ${tokenContext}

    Return ONLY the code for the React component. Do not include imports if they are standard React. 
    Assume 'react' and 'lucide-react' are available.
    Do not wrap in markdown code blocks like \`\`\`tsx. Just return raw string.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: currentCode 
        ? `Refine this component based on request: ${prompt}\n\nCurrent Code:\n${currentCode}`
        : `Create a React component based on this description: ${prompt}`,
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 0 } // Fast response for UI
      }
    });

    return response.text?.replace(/^```tsx\s*/, '').replace(/```$/, '') || '';
  } catch (error) {
    console.error("Gemini generation error:", error);
    throw new Error("Failed to generate component.");
  }
};

export const generateDocumentation = async (code: string): Promise<string> => {
   try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a simple markdown documentation snippet for Docusaurus for this component. Include props table and usage example.\n\nCode:\n${code}`,
    });
    return response.text || '';
  } catch (error) {
    console.error("Gemini doc generation error:", error);
    return "Documentation generation failed.";
  }
}