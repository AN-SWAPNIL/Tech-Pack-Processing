import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import {
  validateUpload,
  validateTechPack,
} from "../middleware/validationMiddleware.js";
import {
  uploadTechPack,
  processTechPack,
  classifyHSCode,
} from "../controllers/techPackController.js";

const router = express.Router();

// POST /api/techpack/upload - Upload and process tech pack
router.post(
  "/upload",
  upload.single("techpack"),
  validateUpload,
  uploadTechPack
);

// POST /api/techpack/hscode - Classify HS code from tech pack information
router.post("/hscode", validateTechPack, classifyHSCode);

// GET /api/techpack/process/:id - Get processing status (for future implementation)
router.get("/process/:id", processTechPack);

export default router;
