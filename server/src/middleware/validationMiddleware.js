import {
  uploadSchema,
  techPackSchema,
  hsCodeSuggestionSchema,
} from "../schemas/index.js";

// Validation middleware factory
export const validateRequest = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property]);

    if (error) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${property} data`,
        details: error.details,
      });
    }

    // Replace the request property with validated value
    req[property] = value;
    next();
  };
};

// File upload validation middleware
export const validateUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
  }

  const { error, value } = uploadSchema.validate(req.file);
  if (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid file format",
      details: error.details,
    });
  }

  req.file = value;
  next();
};

// Specific validation middlewares
export const validateTechPack = validateRequest(techPackSchema, "body");

// Response validation (for development/testing)
export const validateResponse = (schema) => {
  return (req, res, next) => {
    if (process.env.NODE_ENV === "development") {
      const originalJson = res.json;
      res.json = function (data) {
        const { error } = schema.validate(data);
        if (error) {
          console.warn("⚠️ Response validation failed:", error.details);
        }
        return originalJson.call(this, data);
      };
    }
    next();
  };
};
