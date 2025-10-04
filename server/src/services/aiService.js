import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

// Define a simple output format instruction
const formatInstructions = `
Respond with a JSON object in this exact format:
{
  "success": true or false,
  "error": "string (only if success is false)",
  "data": {
    "materialPercentage": [{"material": "string", "percentage": number}],
    "fabricType": "knit" or "woven",
    "garmentType": "string",
    "gender": "string",
    "description": "string",
    "gsm": number or null,
    "countryOfOrigin": "string" or null,
    "destinationMarket": "string" or null,
    "incoterm": "string" or null
  }
}

Response rules:
- Set success: true if you can extract garment/textile information
- Set success: false if document lacks sufficient garment information or is not about textiles
- If success: false, include an error message explaining why (e.g., "Document does not contain sufficient garment or textile information")
- If success: true, include all data fields with detailed information
- ALWAYS provide materialPercentage array when success is true, even if you need to infer from context
- If NO material information can be found or inferred from the content, set success to false

Field requirements:
- Gender: Always use possessive form ("Men's", "Women's", "Children's", "Unisex"). Infer from context if not explicitly stated (e.g., if all sizing mentions are for men's sizes, classify as "Men's")
- materialPercentage: Must ALWAYS be provided when success=true. If percentages not explicit, analyze content for material mentions and provide reasonable estimates that sum to 100%. If NO materials can be identified or inferred, set success=false
- Description: Keep concise and HS code-focused with these elements:
  * Primary fabric construction (e.g., "jersey knit", "twill weave", "denim")
  * Material composition (if not in materialPercentage)
  * Key garment characteristics for customs classification
  * Avoid excessive detail - focus on HS code classification factors
  * Example: "Men's denim jeans, cotton twill weave construction"
- gsm: Extract fabric weight in grams per square meter if mentioned, otherwise null
- countryOfOrigin: Extract manufacturing/production country if mentioned, otherwise null
- destinationMarket: Extract target market, export destination, or customer location if mentioned, otherwise null
- incoterm: Extract international commercial terms (FOB, CIF, EXW, etc.) if mentioned, otherwise null
`;

// Create the prompt template
const promptTemplate = PromptTemplate.fromTemplate(`
You are an expert textile analyst specializing in tech pack analysis for HS code classification. 
Your task is to extract key information from tech pack documents to determine appropriate HS codes.

Analyze the following tech pack content and extract the required information:

{format_instructions}

Tech Pack Content:
{techpack_content}

Important Guidelines:
1. Focus on identifying the primary garment type and construction
2. Extract material composition with accurate percentages (should sum to 100%)
3. Determine if the fabric is knit or woven based on construction details:
   - Knit: jersey, rib, interlock, fleece, terry, sweater knits, etc.
   - Woven: plain weave, twill, satin, denim, canvas, poplin, chambray, flannel, etc.
4. Identify the target demographic/gender for the garment (use possessive form: "Men's", "Women's", "Children's", "Unisex")
5. Create a concise, HS code-focused description that includes:
   - Primary fabric construction (e.g., "twill weave", "jersey knit", "denim")
   - Key characteristics relevant for customs classification
   - Garment type and basic construction
   - Keep it brief and professional for HS code purposes
6. Extract fabric weight (GSM) if mentioned in the document
7. Extract country of origin/manufacturing location if mentioned
8. Extract destination market, target market, or export destination if mentioned
9. Extract international commercial terms (Incoterms) like FOB, CIF, EXW, DDP, etc. if mentioned
10. For specialty fabrics (non-woven, lace, braided, felt), mention these details in the description while classifying fabricType as the nearest knit/woven equivalent
11. If information is unclear, make reasonable inferences based on industry standards and context clues
12. For HS code purposes, be precise about material percentages as they affect classification
13. Include technical details that would be important for customs classification and quality assessment
14. CRITICAL: Always extract material information from ANY textile content - analyze fabric descriptions, construction details, and technical specifications. If absolutely NO material information can be found, return success=false
15. Use contextual analysis to infer missing fields:
    - Gender: Look for sizing charts, fit descriptions, style names, target market indicators
    - Materials: Search for any fabric mentions, fiber content, blend descriptions, or construction details
    - FabricType: Analyze construction methods, weave/knit descriptions, fabric names
16. If explicit percentages unavailable, provide educated estimates based on typical industry standards for the garment type

Use your expertise in textile classification and HS code requirements to provide accurate, detailed information.

Response:
`);

/**
 * Extract tech pack information using LangChain with Gemini AI
 * @param {string} extractedText - Text extracted from the tech pack file
 * @returns {Promise<Object>} - Parsed tech pack information
 */
export const extractTechPackInfo = async (extractedText) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    console.log("🤖 Starting LangChain AI analysis of tech pack...");

    // Initialize the model with correct model name for text processing
    const model = new ChatGoogleGenerativeAI({
      modelName: "gemini-2.5-flash", // Use pro model for better analysis
      temperature: 0.1,
      apiKey: process.env.GEMINI_API_KEY,
    });

    // Create output parser
    const outputParser = new StringOutputParser();

    // Create the chain
    const chain = promptTemplate.pipe(model).pipe(outputParser);

    console.log("📝 Sending prompt to Gemini via LangChain...");

    // Execute the chain
    const response = await chain.invoke({
      format_instructions: formatInstructions,
      techpack_content: extractedText.substring(0, 8000), // Limit content to avoid token limits
    });

    console.log("✅ Received response from Gemini");
    // console.log("🔍 Raw AI Response:", response);

    // Parse the JSON response
    let parsedResult;
    try {
      // Extract JSON from response if it's wrapped in text
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : response;
      console.log("🔍 Extracted JSON string:", jsonString);
      const aiResponse = JSON.parse(jsonString);

      // Check if AI indicates success
      if (!aiResponse.success) {
        console.log(
          "ℹ️ AI indicates insufficient information:",
          aiResponse.error
        );
        // Return the AI response as-is instead of throwing an error
        return {
          success: false,
          error:
            aiResponse.error || "AI could not extract sufficient information",
        };
      }

      // Validate that data exists
      if (!aiResponse.data) {
        throw new Error("AI response missing data field");
      }

      parsedResult = aiResponse.data;

      // Validate required fields in data
      if (
        !parsedResult.materialPercentage ||
        !parsedResult.fabricType ||
        !parsedResult.garmentType
      ) {
        throw new Error("Missing required fields in AI response data");
      }
    } catch (parseError) {
      console.warn("⚠️ Failed to parse JSON response, using fallback");
      console.log("Parse error details:", parseError.message);
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    }

    console.log("🎯 Successfully parsed tech pack information:", {
      garmentType: parsedResult.garmentType,
      fabricType: parsedResult.fabricType,
      materials: parsedResult.materialPercentage?.length || 0,
    });

    return {
      success: true,
      data: parsedResult,
    };
  } catch (error) {
    console.error("❌ Error in LangChain AI analysis:", error);

    // Fallback to a basic analysis if AI fails
    console.log("🔄 Falling back to basic text analysis...");
    return await fallbackAnalysis(extractedText);
  }
};

/**
 * Fallback analysis when AI fails
 * @param {string} text - Extracted text
 * @returns {Object} - Basic tech pack information
 */
const fallbackAnalysis = async (text) => {
  const lowerText = text.toLowerCase();

  // Enhanced garment type detection
  let garmentType = "Shirt"; // default

  // Primary garment type indicators
  if (
    lowerText.includes("t-shirt") ||
    lowerText.includes("tee") ||
    lowerText.includes("t shirt")
  ) {
    garmentType = "T-Shirt";
  } else if (lowerText.includes("jeans") || lowerText.includes("denim")) {
    garmentType = "Jeans";
  } else if (lowerText.includes("dress") || lowerText.includes("frock")) {
    garmentType = "Dress";
  } else if (
    lowerText.includes("trouser") ||
    lowerText.includes("pant") ||
    lowerText.includes("slack")
  ) {
    garmentType = "Trousers";
  } else if (
    lowerText.includes("jacket") ||
    lowerText.includes("blazer") ||
    lowerText.includes("coat")
  ) {
    garmentType = "Jacket";
  } else if (lowerText.includes("skirt")) {
    garmentType = "Skirt";
  } else if (lowerText.includes("blouse")) {
    garmentType = "Blouse";
  } else if (
    lowerText.includes("sweater") ||
    lowerText.includes("pullover") ||
    lowerText.includes("jumper")
  ) {
    garmentType = "Sweater";
  } else if (lowerText.includes("cardigan")) {
    garmentType = "Cardigan";
  } else if (lowerText.includes("polo")) {
    garmentType = "Polo Shirt";
  } else if (lowerText.includes("hoodie") || lowerText.includes("hooded")) {
    garmentType = "Hoodie";
  } else if (lowerText.includes("shorts")) {
    garmentType = "Shorts";
  } else if (lowerText.includes("vest") || lowerText.includes("waistcoat")) {
    garmentType = "Vest";
  } else if (lowerText.includes("shirt")) {
    // Keep shirt as fallback for general shirt mentions
    garmentType = "Shirt";
  }

  // Enhanced fabric type detection
  let fabricType = "woven"; // default

  // Knit indicators (override default)
  if (
    lowerText.includes("knit") ||
    lowerText.includes("jersey") ||
    lowerText.includes("rib") ||
    lowerText.includes("interlock") ||
    lowerText.includes("fleece") ||
    lowerText.includes("terry") ||
    lowerText.includes("french terry") ||
    lowerText.includes("loop") ||
    lowerText.includes("pique") ||
    lowerText.includes("waffle") ||
    lowerText.includes("circular knit") ||
    lowerText.includes("flat knit") ||
    lowerText.includes("tricot")
  ) {
    fabricType = "knit";
  }

  // Woven indicators (confirm default or override knit if more specific)
  const wovenIndicators = [
    "woven",
    "weave",
    "twill",
    "plain weave",
    "satin",
    "denim",
    "canvas",
    "poplin",
    "chambray",
    "flannel",
    "oxford",
    "broadcloth",
    "gabardine",
    "serge",
    "drill",
    "duck",
    "sateen",
    "crepe",
    "taffeta",
    "chiffon",
    "organza",
    "voile",
    "lawn",
    "batiste",
  ];

  for (const indicator of wovenIndicators) {
    if (lowerText.includes(indicator)) {
      fabricType = "woven";
      break;
    }
  }

  // Contextual inference based on garment type
  if (fabricType === "woven") {
    // Keep woven as default
    if (
      garmentType === "T-Shirt" ||
      garmentType === "Hoodie" ||
      garmentType === "Sweater"
    ) {
      // These are typically knit unless explicitly stated as woven
      const hasWovenKeywords = wovenIndicators.some((keyword) =>
        lowerText.includes(keyword)
      );
      if (!hasWovenKeywords) {
        fabricType = "knit";
      }
    }
  }

  // Enhanced gender detection with contextual analysis
  let gender = "Unisex"; // default
  if (
    lowerText.includes("men") ||
    lowerText.includes("male") ||
    lowerText.includes("gentleman")
  ) {
    gender = "Men's";
  } else if (
    lowerText.includes("women") ||
    lowerText.includes("female") ||
    lowerText.includes("ladies") ||
    lowerText.includes("woman")
  ) {
    gender = "Women's";
  } else if (
    lowerText.includes("kids") ||
    lowerText.includes("children") ||
    lowerText.includes("baby") ||
    lowerText.includes("toddler") ||
    lowerText.includes("infant")
  ) {
    gender = "Children's";
  } else {
    // Contextual inference from sizing, fit, or style indicators
    if (
      lowerText.includes("xl") ||
      lowerText.includes("xxl") ||
      lowerText.includes("xxxl")
    ) {
      // Larger sizes often indicate men's clothing in many contexts
      if (
        lowerText.includes("regular fit") ||
        lowerText.includes("relaxed fit") ||
        lowerText.includes("straight fit")
      ) {
        gender = "Men's";
      }
    } else if (
      lowerText.includes("fitted") ||
      lowerText.includes("slim fit") ||
      lowerText.includes("tapered")
    ) {
      // Could indicate women's or men's, need more context
      if (lowerText.includes("xs") || lowerText.includes("petite")) {
        gender = "Women's";
      }
    }
    // Check for style-specific indicators
    if (lowerText.includes("maternity") || lowerText.includes("nursing")) {
      gender = "Women's";
    }
  }

  // Enhanced material detection with comprehensive analysis
  let materials = [];

  // Look for explicit percentage mentions
  const percentageMatches = text.match(
    /(\d+)%\s*([a-zA-Z]+)|([a-zA-Z]+)\s*(\d+)%/gi
  );
  if (percentageMatches) {
    for (const match of percentageMatches) {
      const numbers = match.match(/\d+/g);
      const letters = match.match(/[a-zA-Z]+/g);
      if (numbers && letters) {
        const percentage = parseInt(numbers[0]);
        const material =
          letters[0].charAt(0).toUpperCase() +
          letters[0].slice(1).toLowerCase();
        materials.push({ material, percentage });
      }
    }
  }

  // If no explicit percentages found, analyze material mentions
  if (materials.length === 0) {
    const materialKeywords = {
      cotton: ["cotton", "organic cotton", "combed cotton", "ring spun cotton"],
      polyester: ["polyester", "poly", "pet", "recycled polyester"],
      elastane: ["elastane", "spandex", "lycra"],
      nylon: ["nylon", "polyamide", "pa"],
      viscose: ["viscose", "rayon", "modal", "tencel"],
      wool: ["wool", "merino", "cashmere", "alpaca"],
      linen: ["linen", "flax"],
      silk: ["silk"],
      acrylic: ["acrylic"],
      bamboo: ["bamboo"],
    };

    let foundMaterials = [];
    for (const [material, keywords] of Object.entries(materialKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          foundMaterials.push(
            material.charAt(0).toUpperCase() + material.slice(1)
          );
          break;
        }
      }
    }

    // Remove duplicates
    foundMaterials = [...new Set(foundMaterials)];

    // Assign reasonable percentages based on common industry blends
    if (foundMaterials.length === 1) {
      materials = [{ material: foundMaterials[0], percentage: 100 }];
    } else if (foundMaterials.length === 2) {
      if (
        foundMaterials.includes("Cotton") &&
        foundMaterials.includes("Elastane")
      ) {
        materials = [
          { material: "Cotton", percentage: 95 },
          { material: "Elastane", percentage: 5 },
        ];
      } else if (
        foundMaterials.includes("Cotton") &&
        foundMaterials.includes("Polyester")
      ) {
        materials = [
          { material: "Cotton", percentage: 60 },
          { material: "Polyester", percentage: 40 },
        ];
      } else {
        materials = [
          { material: foundMaterials[0], percentage: 70 },
          { material: foundMaterials[1], percentage: 30 },
        ];
      }
    } else if (foundMaterials.length >= 3) {
      // For multiple materials, distribute more evenly
      const mainPercentage = 60;
      const remaining = 40;
      const secondaryPercentage = Math.floor(
        remaining / (foundMaterials.length - 1)
      );

      materials = foundMaterials.map((material, index) => ({
        material,
        percentage: index === 0 ? mainPercentage : secondaryPercentage,
      }));

      // Adjust last material to make total 100%
      const total = materials.reduce((sum, m) => sum + m.percentage, 0);
      if (total !== 100 && materials.length > 1) {
        materials[materials.length - 1].percentage += 100 - total;
      }
    }
  }

  // Default fallback if still no materials found
  if (materials.length === 0) {
    // Try to infer from garment type if possible
    if (garmentType === "Jeans") {
      materials = [
        { material: "Cotton", percentage: 98 },
        { material: "Elastane", percentage: 2 },
      ];
    } else if (fabricType === "knit") {
      materials = [{ material: "Cotton", percentage: 100 }];
    } else if (garmentType !== "Shirt") {
      // If we detected a specific garment type, we can infer basic materials
      materials = [{ material: "Cotton", percentage: 100 }];
    } else {
      // If no materials found and only generic garment detected, return error
      console.log(
        "⚠️ No material information could be extracted from the content"
      );
      return {
        success: false,
        error:
          "No material information could be found or inferred from the tech pack content",
      };
    }
  }

  // Ensure percentages sum to 100
  const totalPercentage = materials.reduce((sum, m) => sum + m.percentage, 0);
  if (totalPercentage !== 100 && materials.length > 0) {
    const adjustment = 100 - totalPercentage;
    materials[0].percentage += adjustment;
  }

  // Enhanced description with fabric construction details
  let constructionDetails = "";
  if (fabricType === "knit") {
    if (lowerText.includes("jersey")) {
      constructionDetails = "jersey knit construction";
    } else if (lowerText.includes("rib")) {
      constructionDetails = "rib knit construction";
    } else if (lowerText.includes("interlock")) {
      constructionDetails = "interlock knit construction";
    } else if (lowerText.includes("fleece")) {
      constructionDetails = "fleece knit construction";
    } else if (
      lowerText.includes("french terry") ||
      lowerText.includes("terry")
    ) {
      constructionDetails = "terry knit construction";
    } else if (lowerText.includes("pique")) {
      constructionDetails = "pique knit construction";
    } else if (lowerText.includes("waffle")) {
      constructionDetails = "waffle knit construction";
    } else {
      constructionDetails = "knit construction";
    }
  } else {
    if (lowerText.includes("denim")) {
      constructionDetails = "denim woven construction";
    } else if (lowerText.includes("twill")) {
      constructionDetails = "twill weave construction";
    } else if (lowerText.includes("canvas")) {
      constructionDetails = "canvas weave construction";
    } else if (lowerText.includes("poplin")) {
      constructionDetails = "poplin weave construction";
    } else if (lowerText.includes("chambray")) {
      constructionDetails = "chambray weave construction";
    } else if (lowerText.includes("flannel")) {
      constructionDetails = "flannel weave construction";
    } else if (lowerText.includes("oxford")) {
      constructionDetails = "oxford weave construction";
    } else if (lowerText.includes("broadcloth")) {
      constructionDetails = "broadcloth weave construction";
    } else if (lowerText.includes("gabardine")) {
      constructionDetails = "gabardine weave construction";
    } else if (lowerText.includes("satin")) {
      constructionDetails = "satin weave construction";
    } else if (lowerText.includes("plain weave")) {
      constructionDetails = "plain weave construction";
    } else {
      constructionDetails = "woven construction";
    }
  }

  // Add weight and characteristics
  let characteristics = [];
  if (lowerText.includes("lightweight") || lowerText.includes("light weight")) {
    characteristics.push("lightweight");
  } else if (
    lowerText.includes("heavyweight") ||
    lowerText.includes("heavy weight")
  ) {
    characteristics.push("heavyweight");
  } else if (lowerText.includes("medium weight")) {
    characteristics.push("medium weight");
  }

  if (lowerText.includes("stretch")) {
    characteristics.push("stretch");
  }
  if (
    lowerText.includes("moisture wicking") ||
    lowerText.includes("moisture-wicking")
  ) {
    characteristics.push("moisture-wicking");
  }
  if (lowerText.includes("brushed")) {
    characteristics.push("brushed finish");
  }
  if (lowerText.includes("pre-shrunk") || lowerText.includes("preshrunk")) {
    characteristics.push("pre-shrunk");
  }

  const characteristicsText =
    characteristics.length > 0 ? ` with ${characteristics.join(", ")}` : "";
  const materialsText = materials
    .map((m) => `${m.percentage}% ${m.material}`)
    .join(", ");

  return {
    success: true,
    data: {
      materialPercentage: materials,
      fabricType,
      garmentType,
      gender,
      description: `${gender} ${garmentType.toLowerCase()}, ${constructionDetails}${characteristicsText}`,
      gsm: null, // No GSM extraction in fallback
      countryOfOrigin: null, // No origin extraction in fallback
      destinationMarket: null, // No destination extraction in fallback
      incoterm: null, // No incoterm extraction in fallback
    },
  };
};

/**
 * Generate HS code suggestions based on tech pack information
 * @param {Object} techPackInfo - Processed tech pack information
 * @returns {Promise<Array>} - Array of HS code suggestions with descriptions
 */
export const generateHSCodeSuggestions = async (techPackInfo) => {
  try {
    console.log("🔍 Generating HS code suggestions...");

    const { materialPercentage, fabricType, garmentType, gender } =
      techPackInfo;

    // Basic HS code mapping based on garment type and material
    const hsCodeMap = {
      "T-Shirt": {
        knit: {
          cotton_majority: "6109.10.00",
          synthetic_majority: "6109.90.00",
        },
        woven: {
          cotton_majority: "6205.20.00",
          synthetic_majority: "6205.30.00",
        },
      },
      Shirt: {
        woven: {
          cotton_majority: "6205.20.00",
          synthetic_majority: "6205.30.00",
        },
      },
      Jeans: {
        woven: {
          cotton_majority: "6203.42.00",
        },
      },
      Dress: {
        knit: {
          cotton_majority: "6104.44.00",
          synthetic_majority: "6104.49.00",
        },
        woven: {
          cotton_majority: "6204.44.00",
          synthetic_majority: "6204.49.00",
        },
      },
    };

    // Determine if cotton or synthetic is majority
    const cottonPercentage = materialPercentage
      .filter((m) => m.material.toLowerCase().includes("cotton"))
      .reduce((sum, m) => sum + m.percentage, 0);

    const materialCategory =
      cottonPercentage > 50 ? "cotton_majority" : "synthetic_majority";

    // Get base HS code
    const baseCode =
      hsCodeMap[garmentType]?.[fabricType]?.[materialCategory] || "6205.20.00";

    return [
      {
        hsCode: baseCode,
        description: `${garmentType} - ${fabricType} - ${materialCategory.replace(
          "_",
          " "
        )}`,
        confidence: 0.85,
      },
    ];
  } catch (error) {
    console.error("❌ Error generating HS codes:", error);
    return [
      {
        hsCode: "6205.20.00",
        description: "Default classification - Men's shirts of cotton",
        confidence: 0.5,
      },
    ];
  }
};
