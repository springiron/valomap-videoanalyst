
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, PlayerPosition, MinimapBounds } from "../types";

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
  minimapLocation?: {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
  };
  detectedIcons: RawAgentDetection[];
  summary: string;
}

export const analyzeValorantScreenshot = async (base64Image: string, manualBounds?: MinimapBounds): Promise<AnalysisResult> => {
  const modelId = "gemini-2.5-flash";

  // If manual bounds are provided, we inject them into the prompt to force the AI to focus there.
  const boundsInstruction = manualBounds 
    ? `CRITICAL: The user has MANUALLY identified the minimap at these exact absolute coordinates (0-1000 scale): YMIN:${manualBounds.ymin}, XMIN:${manualBounds.xmin}, YMAX:${manualBounds.ymax}, XMAX:${manualBounds.xmax}. Use THESE coordinates as the reference for the minimap. Detect agents ONLY inside this box.`
    : `1. **Locate the Minimap**: Find the minimap UI element (usually top-left). Return its ABSOLUTE bounding box (0-1000 scale).`;

  const prompt = `
    Analyze this Valorant gameplay screenshot with high precision.

    GOAL: accurate extraction of player positions on the minimap.

    INSTRUCTIONS:
    ${boundsInstruction}
    
    2. **Detect ALL Agent Icons**: Find every agent/hero icon visible inside the minimap area. 
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
        // If manual bounds are used, the model might skip this or just echo it, so we make it optional in schema to be safe, 
        // though we likely won't use the AI's return value for this if manual is provided.
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
    required: ["mapName", "detectedIcons", "summary"]
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
      
      // Determine which bounds to use.
      // If manualBounds exists, we trust it 100%. If not, we fall back to AI detection.
      let mapBox: MinimapBounds;
      
      if (manualBounds) {
        mapBox = manualBounds;
      } else if (rawData.minimapLocation) {
        mapBox = rawData.minimapLocation;
      } else {
         // Fallback if AI fails to return location and no manual bounds
         // Default to top-left 20%
         mapBox = { xmin: 0, ymin: 0, xmax: 200, ymax: 200 };
      }

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
