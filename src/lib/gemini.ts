import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    category: {
      type: Type.STRING,
      description: "The classification of the issue (e.g., 'Electricity outage', 'Water shortage', 'Billing problem', etc.)",
    },
    urgency: {
      type: Type.STRING,
      description: "The urgency level of the issue: 'Low', 'Medium', 'High', or 'Emergency'",
    },
    missingDetails: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list of missing details the user should provide to make the complaint complete, such as exact location, when it started, etc.",
    },
    generatedMessage: {
      type: Type.STRING,
      description: "A formal, polite complaint message that the user can send to the utility provider or local office. Include placeholders like [area], [time] if details are missing.",
    },
    followUpMessage: {
      type: Type.STRING,
      description: "A suggested polite follow-up message if the issue is not resolved after some time.",
    },
  },
  required: ["category", "urgency", "missingDetails", "generatedMessage", "followUpMessage"],
};

export interface AIAnalysisResult {
  category: string;
  urgency: 'Low' | 'Medium' | 'High' | 'Emergency';
  missingDetails: string[];
  generatedMessage: string;
  followUpMessage: string;
}

export async function analyzeComplaint(
  description: string,
  area: string,
  utilityType: string,
  timeStarted: string,
  language: string = "English"
): Promise<AIAnalysisResult> {
  const prompt = `
You are a helpful civic assistant in Ethiopia helping a user format a utility complaint.
Analyze the following details provided by the user. If information is missing, note it.
Generate a clear, formal complaint message and a follow-up message in ${language}.

IMPORTANT Context: 
- Ethiopian utility systems (electricity, water, telecom/internet)
- Places like 'Mexico', 'Piassa', 'Bole', 'Kazanchis', 'Saris', 'Megenagna', 'Gondar', 'Jimma', 'Dire Dawa' are common locations/neighborhoods in Ethiopia. Do NOT assume 'Mexico' refers to the country. Treat it as a valid Ethiopian location.

Target Language: ${language}
Area: ${area || "Not provided"}
Utility Type: ${utilityType || "Not specified, deduce from description"}
Time Started: ${timeStarted || "Not provided"}
User Description: ${description}

Provide the output in JSON matching the requested schema.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.2, // Low temp for consistent classification
    },
  });

  const jsonStr = response.text?.trim() || "{}";
  return JSON.parse(jsonStr) as AIAnalysisResult;
}
