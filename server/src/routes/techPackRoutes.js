import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import {
  uploadTechPack,
  processTechPack,
} from "../controllers/techPackController.js";

const router = express.Router();

// POST /api/techpack/upload - Upload and process tech pack
router.post("/upload", upload.single("techpack"), uploadTechPack);

// GET /api/techpack/process/:id - Get processing status (for future implementation)
router.get("/process/:id", processTechPack);

export default router;
