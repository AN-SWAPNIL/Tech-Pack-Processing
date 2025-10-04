import Joi from "joi";

// Validation schema for file upload (multer file object)
export const uploadSchema = Joi.object({
  fieldname: Joi.string().required(),
  originalname: Joi.string().required(),
  mimetype: Joi.string().required(),
  filename: Joi.string().required(),
  path: Joi.string().required(),
  size: Joi.number().required(),
}).unknown(true); // Allow additional properties from multer

// Validation schema for tech pack summary (matches frontend TechPackSummary interface)
export const techPackSchema = Joi.object({
  // Existing core fields (keeping same names)
  materialPercentage: Joi.array()
    .items(
      Joi.object({
        material: Joi.string().required(),
        percentage: Joi.number().required(),
      })
    )
    .required(),
  fabricType: Joi.string().valid("knit", "woven").required(),
  garmentType: Joi.string().required(),
  gender: Joi.string().required(),
  description: Joi.string().required(),

  // New optional fields
  gsm: Joi.number().optional().allow(null),
  countryOfOrigin: Joi.string().optional().allow(null, ""),
  destinationMarket: Joi.string().optional().allow(null, ""),
  incoterm: Joi.string().optional().allow(null, ""),
}).unknown(true); // Allow additional properties

// Validation schema for tariff information
export const tariffInfoSchema = Joi.object({
  CD: Joi.number().required(),
  SD: Joi.number().required(),
  VAT: Joi.number().required(),
  AIT: Joi.number().required(),
  AT: Joi.number().required(),
  RD: Joi.number().required(),
  TTI: Joi.number().required(),
});

// Validation schema for HS code suggestions response
export const hsCodeSuggestionSchema = Joi.object({
  code: Joi.string().required(),
  description: Joi.string().required(),
  confidence: Joi.number().min(0).max(1).required(),
  rationale: Joi.array().items(Joi.string()).required(),
  tariffInfo: tariffInfoSchema.optional(),
  // NBR specific fields
  source: Joi.string().valid("nbr", "customs", "mixed").optional(),
  chapter: Joi.string().optional(),
  pdfLink: Joi.string().uri().optional(),
  year: Joi.string().optional(),
}).required();

// Common response schemas
export const successResponseSchema = Joi.object({
  success: Joi.boolean().valid(true).required(),
  data: Joi.any().required(),
  message: Joi.string().required(),
});

export const errorResponseSchema = Joi.object({
  success: Joi.boolean().valid(false).required(),
  message: Joi.string().required(),
  error: Joi.string().optional(),
  details: Joi.array().optional(),
});
