import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import techPackRoutes from "./routes/techPackRoutes.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { PDFMonitorScheduler } from "./services/pdfMonitorScheduler.js";

// Load environment variables
dotenv.config();

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize PDF scheduler globally
let pdfScheduler;

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Logging middleware
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files for uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    scheduler: pdfScheduler?.getStatus() || "Not initialized",
  });
});

// API routes
app.use("/api/techpack", techPackRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `🌐 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`
  );

  // Setup PDF monitoring scheduler after env vars are loaded
  try {
    pdfScheduler = new PDFMonitorScheduler();
    pdfScheduler.setupMonitoringTasks();
    console.log("✅ PDF monitoring scheduler initialized");
  } catch (error) {
    console.error("❌ Failed to setup PDF monitoring scheduler:", error);
  }

  // Check and populate vector store if empty
  if (pdfScheduler) {
    await pdfScheduler.checkAndPopulateVectorStore();
  }
});

export default app;
