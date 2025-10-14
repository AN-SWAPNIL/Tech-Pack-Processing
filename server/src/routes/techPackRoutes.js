import express from "express";
import multer from "multer";
import upload from "../middleware/uploadMiddleware.js";
import {
  validateUpload,
  validateTechPack,
} from "../middleware/validationMiddleware.js";
import {
  uploadTechPack,
  processTechPack,
  classifyHSCode,
  generateDocuments,
  generateDocumentPDFs,
  getTemplates,
  replaceTemplate,
} from "../controllers/techPackController.js";

const router = express.Router();

// Configure multer for template uploads (memory storage for direct buffer access)
const templateUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed for templates"));
    }
  },
});

// POST /api/techpack/upload - Upload and process tech pack
router.post(
  "/upload",
  upload.single("techpack"),
  validateUpload,
  uploadTechPack
);

// POST /api/techpack/hscode - Classify HS code from tech pack information
router.post("/hscode", validateTechPack, classifyHSCode);

// POST /api/techpack/generate-documents - Generate export documents (JSON data)
router.post("/generate-documents", generateDocuments);

// POST /api/techpack/generate-pdfs - Generate export documents (actual PDF files)
router.post("/generate-pdfs", generateDocumentPDFs);

// GET /api/techpack/templates - Get available document templates
router.get("/templates", getTemplates);

// POST /api/techpack/templates/replace - Replace a document template
router.post(
  "/templates/replace",
  templateUpload.single("template"),
  replaceTemplate
);

// GET /api/techpack/process/:id - Get processing status (for future implementation)
router.get("/process/:id", processTechPack);

export default router;
