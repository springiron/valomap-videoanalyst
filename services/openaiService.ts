
import { AnalysisResult, PlayerPosition, MinimapBounds } from "../types";

// Internal types for the raw API response matching the OpenAI JSON output
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

export const analyzeWithOpenAI = async (base64Image: string, manualBounds?: MinimapBounds): Promise<AnalysisResult> => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("Missing OpenAI API Key (process.env.OPENAI_API_KEY)");
  }

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

    OUTPUT: Return a SINGLE JSON object with this structure (do not wrap in markdown):
    {
      "mapName": "string",
      "minimapLocation": { "ymin": int, "xmin": int, "ymax": int, "xmax": int },
      "detectedIcons": [
        {
          "team": "string",
          "agentGuess": "string",
          "boundingBox": { "ymin": int, "xmin": int, "ymax": int, "xmax": int }
        }
      ],
      "summary": "string"
    }
  `;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a highly accurate computer vision assistant for Valorant. You output strictly valid JSON."
          },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(`OpenAI API Error: ${errData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    const rawData = JSON.parse(content) as RawAnalysisResponse;

    // --- Post-Processing Logic (Identical to Gemini Service for consistency) ---
    
    let mapBox: MinimapBounds;
      
    if (manualBounds) {
      mapBox = manualBounds;
    } else if (rawData.minimapLocation) {
      mapBox = rawData.minimapLocation;
    } else {
        mapBox = { xmin: 0, ymin: 0, xmax: 200, ymax: 200 };
    }

    const mapWidth = mapBox.xmax - mapBox.xmin;
    const mapHeight = mapBox.ymax - mapBox.ymin;

    const players: PlayerPosition[] = rawData.detectedIcons
      .map((icon): PlayerPosition | null => {
        const iconCenterY = (icon.boundingBox.ymin + icon.boundingBox.ymax) / 2;
        const iconCenterX = (icon.boundingBox.xmin + icon.boundingBox.xmax) / 2;

        const isInside = 
          iconCenterX >= mapBox.xmin && 
          iconCenterX <= mapBox.xmax &&
          iconCenterY >= mapBox.ymin &&
          iconCenterY <= mapBox.ymax;

        if (!isInside) return null;

        let relX = ((iconCenterX - mapBox.xmin) / mapWidth) * 100;
        let relY = ((iconCenterY - mapBox.ymin) / mapHeight) * 100;
        
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

  } catch (error) {
    console.error("OpenAI Analysis Error:", error);
    throw error;
  }
};
