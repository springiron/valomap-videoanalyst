import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeValorantScreenshot = async (base64Image: string): Promise<AnalysisResult> => {
  const modelId = "gemini-2.5-flash"; // Flash is fast and good enough for spatial reasoning on diagrams

  const prompt = `
    Analyze this Valorant gameplay screenshot.
    
    1. Locate the Minimap. It is usually in the top-left corner, but sometimes configured to be elsewhere. 
    2. Identify the map name if visible (e.g., Haven, Bind, Ascent), or guess based on geometry.
    3. Detect all player icons currently visible *inside the minimap area*.
    4. For each player, identify their team color (Red vs Green/Blue/Cyan/Yellow) or side (Attacker/Defender) if clear.
    5. Estimate the relative X and Y coordinates (0-100) of each player *within the minimap bounding box*. (0,0 is top-left of the minimap, 100,100 is bottom-right of the minimap).
    6. Provide the bounding box of the minimap itself relative to the full image (0-1000 scale).
    
    Return the result in JSON.
  `;

  try {
    const response = await genAI.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mapName: { type: Type.STRING, description: "Name of the map (e.g. Haven, Ascent)" },
            minimapBounds: {
              type: Type.OBJECT,
              description: "The bounding box of the minimap on the full image (0-1000 scale)",
              properties: {
                ymin: { type: Type.INTEGER },
                xmin: { type: Type.INTEGER },
                ymax: { type: Type.INTEGER },
                xmax: { type: Type.INTEGER },
              },
              required: ["ymin", "xmin", "ymax", "xmax"]
            },
            players: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  team: { type: Type.STRING, description: "Team color or name (e.g. Red, Blue)" },
                  agentGuess: { type: Type.STRING, description: "Best guess of agent name if icon is clear" },
                  x: { type: Type.NUMBER, description: "X position 0-100 relative to minimap width" },
                  y: { type: Type.NUMBER, description: "Y position 0-100 relative to minimap height" }
                },
                required: ["team", "x", "y"]
              }
            },
            summary: { type: Type.STRING, description: "A brief tactical summary of the positions (e.g. 'Attackers are pushing B long')" }
          },
          required: ["mapName", "minimapBounds", "players", "summary"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AnalysisResult;
    } else {
      throw new Error("No text response from Gemini");
    }
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
