import fs from "fs/promises";
import path from "path";

/**
 * Process uploaded file and extract text content
 * @param {Object} file - Multer file object
 * @returns {Promise<string>} - Extracted text content
 */
export const processFile = async (file) => {
  const { path: filePath, mimetype, originalname } = file;

  try {
    console.log(`🔄 Processing file: ${originalname} (${mimetype})`);

    switch (mimetype) {
      case "application/pdf":
        return await extractFromPDF(filePath);

      case "application/msword":
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return await extractFromDocx(filePath);

      case "application/vnd.ms-excel":
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        return await extractFromExcel(filePath);

      default:
        throw new Error(`Unsupported file type: ${mimetype}`);
    }
  } catch (error) {
    console.error(`❌ Error processing file ${originalname}:`, error);
    throw new Error(`Failed to process file: ${error.message}`);
  } finally {
    // Clean up uploaded file
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ Cleaned up file: ${originalname}`);
    } catch (cleanupError) {
      console.warn(
        `⚠️ Warning: Could not clean up file ${originalname}:`,
        cleanupError
      );
    }
  }
};

/**
 * Extract text from PDF files using multiple methods for best quality
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text
 */
const extractFromPDF = async (filePath) => {
  try {
    // Try LangChain PDFLoader first
    try {
      const { PDFLoader } = await import(
        "@langchain/community/document_loaders/fs/pdf"
      );
      const loader = new PDFLoader(filePath, {
        splitPages: false, // Keep all pages as one document
        parsedItemSeparator: " ", // Use space to separate parsed items
      });

      const docs = await loader.load();
      const combinedText = docs.map((doc) => doc.pageContent).join("\n\n");

      if (combinedText && combinedText.trim().length > 0) {
        return combinedText;
      }
    } catch (langchainError) {
      console.warn("LangChain PDF extraction failed:", langchainError.message);
    }

    // Method 3: Fallback to pdf-parse
    console.log("📄 Fallback to pdf-parse");
    const { default: pdfParse } = await import("pdf-parse");
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);

    if (!data.text || data.text.trim().length === 0) {
      throw new Error("No text extracted from PDF");
    }

    console.log(`✅ pdf-parse successful: ${data.text.length} characters`);
    return cleanExtractedText(data.text);
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
};

/**
 * Clean extracted text to fix broken words and OCR issues
 * @param {string} text - Raw extracted text
 * @returns {string} - Cleaned text
 */
const cleanExtractedText = (text) => {
  if (!text) return "";

  return (
    text
      // Remove decorative elements
      .replace(/_{10,}/g, "\n")
      .replace(/-{10,}/g, "\n")
      .replace(/={10,}/g, "\n")

      // Remove headers and footers
      .replace(/_{3,}.*?Bangladesh.*?Customs.*?Tari?ff?.*?_{3,}/gi, "")
      .replace(/^.*Bangladesh.*Customs.*Tariff.*$/gm, "")
      .replace(/^\s*\d+\s*-\s*Bangladesh.*$/gm, "")
      .replace(/^[\s\-_]*\d+[\s\-_]*$/gm, "")

      // Fix broken words - be more careful about word boundaries
      .replace(/\b([a-z])\s+([a-z]{2,})\b/g, "$1$2") // Fix broken words like "w eight" -> "weight"
      .replace(/\b([a-z]{2,})\s+([a-z])\s+([a-z]{2,})\b/g, "$1$2$3") // Fix "indica ted" -> "indicated"
      .replace(/\b([a-z]{2,})\s+([a-z]{1,2})\s+([a-z]{2,})\b/g, "$1$2$3") // Fix "preparati ons" -> "preparations"

      // Fix specific OCR issues for HS codes
      .replace(/(\d{4})\s*\.\s*(\d{2})\s*\.\s*(\d{2})/g, "$1.$2.$3") // Fix HS codes
      .replace(/([A-Z])\s+([A-Z])\s*\.(\d)/g, "$1$2.$3") // Fix "H S . Code"

      // Fix common formatting (preserve proper spacing)
      .replace(/BDT\s+(\d+)/g, "BDT $1")
      .replace(/(\d+)\s*%/g, "$1%")

      // Normalize whitespace carefully
      .replace(/[ \t]+/g, " ") // Multiple spaces to single space
      .replace(/\n\s+/g, "\n") // Remove leading spaces after newlines
      .replace(/\s+\n/g, "\n") // Remove trailing spaces before newlines
      .replace(/\n{3,}/g, "\n\n") // Multiple newlines to double
      .trim()
  );
};

/**
 * Extract text from Word documents using LangChain
 * @param {string} filePath - Path to the Word document
 * @returns {Promise<string>} - Extracted text
 */
const extractFromDocx = async (filePath) => {
  try {
    // Try LangChain DocxLoader first
    try {
      const { DocxLoader } = await import(
        "@langchain/community/document_loaders/fs/docx"
      );
      const loader = new DocxLoader(filePath);
      const docs = await loader.load();
      const combinedText = docs.map((doc) => doc.pageContent).join("\n\n");

      if (combinedText && combinedText.trim().length > 0) {
        return combinedText;
      }
    } catch (langchainError) {
      console.warn("LangChain Docx extraction failed:", langchainError.message);
    }

    // Fallback to mammoth
    console.log("Fallback to mammoth");
    const { default: mammoth } = await import("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });

    if (!result.value || result.value.trim().length === 0) {
      throw new Error("No text extracted from Word document");
    }

    return result.value;
  } catch (error) {
    throw new Error(`Word document extraction failed: ${error.message}`);
  }
};

/**
 * Extract text from Excel files using LangChain
 * @param {string} filePath - Path to the Excel file
 * @returns {Promise<string>} - Extracted text
 */
const extractFromExcel = async (filePath) => {
  try {
    const { default: xlsx } = await import("xlsx");
    const workbook = xlsx.readFile(filePath);
    let extractedText = "";

    // Process each sheet
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const sheetData = xlsx.utils.sheet_to_csv(worksheet);
      extractedText += `Sheet: ${sheetName}\n${sheetData}\n\n`;
    });

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error("No text extracted from Excel file");
    }

    return extractedText;
  } catch (error) {
    throw new Error(`Excel extraction failed: ${error.message}`);
  }
};
