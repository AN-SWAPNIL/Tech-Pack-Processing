import { processFile } from "../services/fileProcessingService.js";
import { extractTechPackInfo } from "../services/aiService.js";
import Joi from "joi";

// Validation schema
const uploadSchema = Joi.object({
  fieldname: Joi.string().required(),
  originalname: Joi.string().required(),
  mimetype: Joi.string().required(),
  filename: Joi.string().required(),
  path: Joi.string().required(),
  size: Joi.number().required(),
}).unknown(true); // Allow additional properties from multer

export const uploadTechPack = async (req, res) => {
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Validate file structure
    const { error } = uploadSchema.validate(req.file);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid file format",
        details: error.details,
      });
    }

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

    // Step 4: Return the processed information
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
