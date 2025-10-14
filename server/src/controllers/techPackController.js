import { processFile } from "../services/fileProcessingService.js";
import { extractTechPackInfo } from "../services/aiService.js";
import { RAGAgent } from "../services/ragAgent.js";
import { DocumentGenerator } from "../services/documentGenerator.js";
import {
  techPackSchema,
  hsCodeSuggestionSchema,
  documentGenerationRequestSchema,
} from "../schemas/index.js";
import Joi from "joi";

// Lazy initialization of RAG Agent and Document Generator
let ragAgent = null;
let documentGenerator = null;

const getRagAgent = () => {
  if (!ragAgent) {
    ragAgent = new RAGAgent();
  }
  return ragAgent;
};

const getDocumentGenerator = () => {
  if (!documentGenerator) {
    documentGenerator = new DocumentGenerator();
  }
  return documentGenerator;
};

export const uploadTechPack = async (req, res) => {
  try {
    // File validation is handled by middleware
    // req.file is already validated by validateUpload middleware

    console.log(`📁 Processing file: ${req.file.originalname}`);

    // Step 1: Extract text from file
    const extractedText = await processFile(req.file);

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Unable to extract text from the uploaded file",
      });
    }

    console.log(`📝 Extracted ${extractedText.length} characters from file`);

    // Step 2: Use AI to extract tech pack information
    const aiResult = await extractTechPackInfo(extractedText);

    // Step 3: Handle AI response (success or failure)
    if (!aiResult.success) {
      return res.status(400).json({
        success: false,
        message: aiResult.error,
        error: aiResult.error,
        fileInfo: {
          originalName: req.file.originalname,
          size: req.file.size,
          type: req.file.mimetype,
        },
      });
    }

    // Step 4: Validate the extracted tech pack data structure
    const { error: techPackError } = techPackSchema.validate(aiResult.data);
    if (techPackError) {
      console.warn(
        "⚠️ Tech pack data validation failed:",
        techPackError.details
      );
      // Continue anyway but log the validation issues for debugging
    }

    // Step 5: Return the processed tech pack information (without HS codes)
    res.json({
      success: true,
      data: {
        techPackSummary: aiResult.data,
        fileInfo: {
          originalName: req.file.originalname,
          size: req.file.size,
          type: req.file.mimetype,
        },
      },
      message: "Tech pack processed successfully",
    });
  } catch (error) {
    console.error("❌ Error processing tech pack:", error);

    // Determine if this is a user-facing error (insufficient information) or server error
    const isUserError =
      error.message.includes("insufficient") ||
      error.message.includes("could not extract") ||
      error.message.includes("not contain sufficient");

    const statusCode = isUserError ? 400 : 500;
    const message = isUserError ? error.message : "Failed to process tech pack";

    res.status(statusCode).json({
      success: false,
      message: message,
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : isUserError
          ? error.message
          : "Internal server error",
    });
  }
};

// New endpoint for HS code classification
export const classifyHSCode = async (req, res) => {
  try {
    console.log("🔍 Starting HS code classification...");

    // Request body validation is handled by middleware
    // req.body is already validated by validateTechPack middleware
    const techPackInfo = req.body;

    // Generate HS code suggestions using RAG agent
    let hsCodeSuggestions = [];
    try {
      console.log("🤖 Using RAG agent for HS code classification...");
      hsCodeSuggestions = await getRagAgent().classifyHSCode(techPackInfo);
      console.log(
        `✅ Generated ${hsCodeSuggestions.length} HS code suggestions`
      );
    } catch (ragError) {
      console.warn(
        "⚠️ RAG agent failed, falling back to mock suggestions:",
        ragError.message
      );
      // Fallback to mock suggestions if RAG fails (e.g., no data in vector DB yet)
      hsCodeSuggestions = await generateMockHSCodeSuggestions(techPackInfo);
    }

    // Validate HS code suggestions format
    const suggestionValidation = Joi.array()
      .items(hsCodeSuggestionSchema)
      .validate(hsCodeSuggestions);
    if (suggestionValidation.error) {
      console.warn(
        "⚠️ HS code suggestions validation failed:",
        suggestionValidation.error.details
      );
    }

    // Return HS code suggestions
    res.json({
      success: true,
      data: {
        hsCodeSuggestions: hsCodeSuggestions,
        techPackInfo: techPackInfo,
      },
      message: "HS code classification completed successfully",
    });
  } catch (error) {
    console.error("❌ Error in HS code classification:", error);

    res.status(500).json({
      success: false,
      message: "Failed to classify HS code",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

export const processTechPack = async (req, res) => {
  try {
    const { id } = req.params;

    // This endpoint can be used for checking processing status in future
    // For now, return a simple response
    res.json({
      success: true,
      message: "Processing status endpoint - to be implemented",
      data: { id },
    });
  } catch (error) {
    console.error("❌ Error getting processing status:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get processing status",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Fallback function for mock HS code suggestions
async function generateMockHSCodeSuggestions(techPackInfo) {
  console.log("🔧 Generating mock HS code suggestions...");

  // Generate mock suggestions based on garment type and fabric type
  const suggestions = [];

  if (techPackInfo.fabricType === "knit") {
    if (
      techPackInfo.garmentType.toLowerCase().includes("shirt") ||
      techPackInfo.garmentType.toLowerCase().includes("t-shirt")
    ) {
      suggestions.push({
        code: "61091000",
        description:
          "T-shirts, singlets and other vests, knitted or crocheted, of cotton",
        confidence: 0.95,
        rationale: [
          "Knit construction",
          "Cotton material",
          "Shirt type garment",
        ],
        tariffInfo: {
          CD: 25.0,
          SD: 4.0,
          VAT: 15.0,
          AIT: 5.0,
          AT: 2.0,
          RD: 0.0,
          TTI: 1.0,
        },
      });
    }
  } else if (techPackInfo.fabricType === "woven") {
    if (techPackInfo.garmentType.toLowerCase().includes("shirt")) {
      suggestions.push({
        code: "62052000",
        description: "Men's or boys' shirts, woven, of cotton",
        confidence: 0.92,
        rationale: ["Woven construction", "Cotton material", "Men's shirt"],
        tariffInfo: {
          CD: 25.0,
          SD: 4.0,
          VAT: 15.0,
          AIT: 5.0,
          AT: 2.0,
          RD: 0.0,
          TTI: 1.0,
        },
      });
    }
  }

  // Add a generic fallback based on gender and fabric type
  if (suggestions.length === 0) {
    const isWomen =
      techPackInfo.gender.toLowerCase().includes("women") ||
      techPackInfo.gender.toLowerCase().includes("girls");

    suggestions.push({
      code: isWomen ? "62064000" : "62059080",
      description: isWomen
        ? "Women's or girls' blouses, shirts and shirt-blouses, woven, of other textile materials"
        : "Men's or boys' shirts, woven, of other textile materials",
      confidence: 0.7,
      rationale: [
        `${techPackInfo.fabricType} construction`,
        `${techPackInfo.gender} garment`,
        "General textile classification",
      ],
      tariffInfo: {
        CD: 25.0,
        SD: 4.0,
        VAT: 15.0,
        AIT: 5.0,
        AT: 2.0,
        RD: 0.0,
        TTI: 1.0,
      },
    });
  }

  return suggestions;
}

// Generate export documents
export const generateDocuments = async (req, res) => {
  try {
    console.log("📄 Starting document generation...");

    // Validate request body
    const { error } = documentGenerationRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        error: error.details[0].message,
      });
    }

    const { techPackData, hsCodeData, complianceData, orderDetails } = req.body;

    // Generate documents using AI
    const result = await getDocumentGenerator().generateDocuments({
      techPackData,
      hsCodeData,
      complianceData,
      orderDetails: orderDetails || {},
    });

    console.log("✅ Documents generated successfully");

    res.json({
      success: true,
      data: result.documents,
      message: "Export documents generated successfully",
    });
  } catch (error) {
    console.error("❌ Error generating documents:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate documents",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Generate PDF documents (returns actual PDF files, not JSON)
export const generateDocumentPDFs = async (req, res) => {
  try {
    console.log("📄 Starting PDF document generation...");

    // Validate request body
    const { error } = documentGenerationRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        error: error.details[0].message,
      });
    }

    const { techPackData, hsCodeData, complianceData, orderDetails } = req.body;

    // Generate PDF documents using AI
    const result = await getDocumentGenerator().generateDocumentPDFs({
      techPackData,
      hsCodeData,
      complianceData,
      orderDetails: orderDetails || {},
    });

    console.log("✅ PDF documents generated successfully");

    // Return PDF buffers encoded as base64 for easy transfer
    const pdfsBase64 = {
      purchaseOrder: result.pdfs.purchaseOrder.toString("base64"),
      commercialInvoice: result.pdfs.commercialInvoice.toString("base64"),
      packingList: result.pdfs.packingList.toString("base64"),
      billOfLading: result.pdfs.billOfLading.toString("base64"),
      complianceCertificate:
        result.pdfs.complianceCertificate.toString("base64"),
    };

    res.json({
      success: true,
      data: {
        pdfs: pdfsBase64,
        metadata: result.data,
      },
      message: "PDF documents generated successfully",
    });
  } catch (error) {
    console.error("❌ Error generating PDF documents:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate PDF documents",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Get available templates
export const getTemplates = async (req, res) => {
  try {
    const templates = await getDocumentGenerator().getAvailableTemplates();

    res.json({
      success: true,
      data: { templates },
      message: "Templates retrieved successfully",
    });
  } catch (error) {
    console.error("❌ Error getting templates:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve templates",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Replace template file
export const replaceTemplate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No template file provided",
      });
    }

    const { templateType } = req.body;

    if (!templateType) {
      return res.status(400).json({
        success: false,
        message: "Template type is required",
      });
    }

    // Validate template type
    const validTypes = ["pi", "ci", "pl", "bl", "compliance"];
    if (!validTypes.includes(templateType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid template type. Must be one of: ${validTypes.join(
          ", "
        )}`,
      });
    }

    console.log(`📤 Replacing template: ${templateType}`);

    // Replace the template
    const result = await getDocumentGenerator().replaceTemplate(
      templateType,
      req.file.buffer
    );

    console.log(`✅ Template ${templateType} replaced successfully`);

    res.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    console.error("❌ Error replacing template:", error);

    res.status(500).json({
      success: false,
      message: "Failed to replace template",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};
