import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, PlayerPosition } from "../types";

const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Internal types for the raw API response matching the schema below
interface RawAgentDetection {
  team: string;
  agentGuess?: string;
  boundingBox: {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
  };
}

interface RawAnalysisResponse {
  mapName: string;
  minimapLocation: {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
  };
  detectedIcons: RawAgentDetection[];
  summary: string;
}

export const analyzeValorantScreenshot = async (base64Image: string): Promise<AnalysisResult> => {
  const modelId = "gemini-2.5-flash";

  // Improved prompt strategy:
  // 1. Ask for absolute coordinates (0-1000) for everything.
  // 2. Do not ask the model to calculate relative percentages (it is bad at math).
  // 3. Use "thinking" to ensure it carefully distinguishes the minimap from the scoreboard.
  const prompt = `
    Analyze this Valorant gameplay screenshot with high precision.

    GOAL: accurate extraction of the minimap and player positions on it.

    INSTRUCTIONS:
    1. **Locate the Minimap**: Find the minimap UI element (usually top-left, sometimes top-right). Return its ABSOLUTE bounding box (0-1000 scale).
    2. **Detect ALL Agent Icons**: Find every agent/hero icon visible anywhere in the image (minimap, scoreboard, etc.). 
       - Return the ABSOLUTE bounding box (0-1000 scale) for each.
       - Identify the team (Red/Enemy or Blue/Cyan/Ally).
       - Guess the agent name if possible.
    3. **Context**: Identify the map name and provide a tactical summary.

    OUTPUT: JSON format only.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      mapName: { type: Type.STRING },
      minimapLocation: {
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
      detectedIcons: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            team: { type: Type.STRING },
            agentGuess: { type: Type.STRING },
            boundingBox: {
              type: Type.OBJECT,
              properties: {
                ymin: { type: Type.INTEGER },
                xmin: { type: Type.INTEGER },
                ymax: { type: Type.INTEGER },
                xmax: { type: Type.INTEGER },
              },
              required: ["ymin", "xmin", "ymax", "xmax"]
            }
          },
          required: ["team", "boundingBox"]
        }
      },
      summary: { type: Type.STRING }
    },
    required: ["mapName", "minimapLocation", "detectedIcons", "summary"]
  };

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
        responseSchema: responseSchema,
        // Enable thinking to improve spatial reasoning and object differentiation
        thinkingConfig: { thinkingBudget: 2048 }, 
        maxOutputTokens: 8192
      }
    });

    if (response.text) {
      const rawData = JSON.parse(response.text) as RawAnalysisResponse;
      
      // --- Post-Processing Logic ---
      // We calculate relative positions in code to avoid model hallucination/math errors.
      
      const mapBox = rawData.minimapLocation;
      const mapWidth = mapBox.xmax - mapBox.xmin;
      const mapHeight = mapBox.ymax - mapBox.ymin;

      // Filter icons to only those INSIDE the minimap
      const players: PlayerPosition[] = rawData.detectedIcons
        .map((icon): PlayerPosition | null => {
          const iconCenterY = (icon.boundingBox.ymin + icon.boundingBox.ymax) / 2;
          const iconCenterX = (icon.boundingBox.xmin + icon.boundingBox.xmax) / 2;

          // Define a strict boundary check
          // Icons must be largely within the minimap box to count
          const isInside = 
            iconCenterX >= mapBox.xmin && 
            iconCenterX <= mapBox.xmax &&
            iconCenterY >= mapBox.ymin &&
            iconCenterY <= mapBox.ymax;

          if (!isInside) return null;

          // Calculate relative percentage (0-100) for the UI
          let relX = ((iconCenterX - mapBox.xmin) / mapWidth) * 100;
          let relY = ((iconCenterY - mapBox.ymin) / mapHeight) * 100;
          
          // Clamp values
          relX = Math.max(0, Math.min(100, relX));
          relY = Math.max(0, Math.min(100, relY));

          return {
            team: icon.team,
            agentGuess: icon.agentGuess,
            x: relX,
            y: relY
          };
        })
        .filter((p): p is PlayerPosition => p !== null);

      return {
        mapName: rawData.mapName,
        minimapBounds: mapBox, 
        players: players,
        summary: rawData.summary
      };

    } else {
      throw new Error("No text response from Gemini");
    }
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
