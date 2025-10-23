import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config();

/**
 * DocumentGenerator - AI-powered document generation using Gemini Vision + Puppeteer
 *
 * Architecture:
 * 1. Template PDF → Base64 encoding
 * 2. Send PDF + data to Gemini Vision API
 * 3. AI generates HTML matching template layout exactly
 * 4. Puppeteer converts HTML to PDF
 *
 * Key Features:
 * - NO extra fields added by AI
 * - Exact template layout preservation
 * - Visual layout understanding via Gemini Vision
 * - High-quality PDF output via Puppeteer
 */
export class DocumentGenerator {
  constructor() {
    this.llm = new ChatGoogleGenerativeAI({
      modelName: "gemini-2.5-pro", // Using Pro for better vision capabilities
      temperature: 0.1, // Low temperature for consistent output
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    });

    this.templatesDir = path.join(__dirname, "../../docs");

    // Define template file paths
    this.templates = {
      pi: "template_purchase_order.pdf",
      ci: "template_commercial_invoice.pdf",
      pl: "template_packing_list.pdf",
      bl: "template_bill_of_lading.pdf",
      compliance: "template_compliance_certificate.pdf",
    };

    // Puppeteer browser instance (long-lived for better performance)
    this.browser = null;
  }

  /**
   * Initialize Puppeteer browser (lazy loading)
   */
  async initializeBrowser() {
    if (!this.browser) {
      console.log("🚀 Launching Puppeteer browser...");
      this.browser = await puppeteer.launch({
        headless: "new", // Modern headless mode
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage", // Overcome limited resource problems
          "--disable-gpu",
        ],
      });
      console.log("✅ Puppeteer browser launched");
    }
    return this.browser;
  }

  /**
   * Cleanup browser instance
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log("🔒 Puppeteer browser closed");
    }
  }

  /**
   * Encode PDF file to base64 string
   * @param {string} filePath - Path to PDF file
   * @returns {Promise<string>} Base64 encoded PDF
   */
  async encodePdfToBase64(filePath) {
    try {
      const pdfBuffer = await fs.readFile(filePath);
      return pdfBuffer.toString("base64");
    } catch (error) {
      console.error(`❌ Error encoding PDF to base64: ${error.message}`);
      throw new Error(`Failed to read template PDF: ${filePath}`);
    }
  }

  /**
   * Generate HTML from PDF template using Gemini Vision
   * @param {string} templatePdfPath - Path to template PDF
   * @param {Object} techPackData - Data to fill in template
   * @param {string} documentType - Type of document being generated
   * @returns {Promise<string>} HTML matching template layout
   */
  async generateHtmlFromPdfTemplate(
    templatePdfPath,
    techPackData,
    documentType
  ) {
    try {
      console.log(`🔍 Analyzing template: ${path.basename(templatePdfPath)}`);

      // Step 1: Encode PDF to base64
      const base64Pdf = await this.encodePdfToBase64(templatePdfPath);
      console.log(
        `✅ PDF encoded to base64 (${Math.round(base64Pdf.length / 1024)}KB)`
      );

      // Step 2: Build prompt with strict instructions
      const promptText = this.buildVisionPrompt(techPackData, documentType);

      // Step 3: Create multimodal message (text + PDF as image)
      const message = new HumanMessage({
        content: [
          {
            type: "text",
            text: promptText,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:application/pdf;base64,${base64Pdf}`,
            },
          },
        ],
      });

      console.log(`🤖 Sending request to Gemini Vision API...`);

      // Step 4: Invoke Gemini Vision
      const response = await this.llm.invoke([message]);

      console.log(`✅ Received HTML response from AI`);

      // Step 5: Extract HTML from response
      let html = response.content;

      // Remove markdown code blocks if present
      html = html
        .replace(/```html\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      // Debug: Save HTML to temp file for inspection
      try {
        const tempHtmlPath = path.join(
          __dirname,
          "../../temp",
          `${documentType}-${Date.now()}.html`
        );
        await fs.writeFile(tempHtmlPath, html, "utf-8");
        console.log(`💾 Saved HTML for debugging: ${tempHtmlPath}`);
      } catch (err) {
        console.warn(`⚠️ Could not save debug HTML: ${err.message}`);
      }

      return html;
    } catch (error) {
      console.error(`❌ Error generating HTML from template: ${error.message}`);
      throw new Error(`Failed to generate HTML: ${error.message}`);
    }
  }

  /**
   * Build prompt for Gemini Vision API
   * @param {Object} techPackData - Data to fill in template
   * @param {string} documentType - Type of document
   * @returns {string} Prompt text
   */
  buildVisionPrompt(techPackData, documentType) {
    // Debug: Log the actual data being sent to AI
    console.log(`📊 Data being sent to AI for ${documentType}:`);
    console.log(JSON.stringify(techPackData, null, 2));
    console.log(`📊 Data keys:`, Object.keys(techPackData));
    console.log(
      `📊 Data values count:`,
      Object.values(techPackData).filter((v) => v && v !== "unknown").length
    );

    return `You are a document generation assistant. Analyze the attached PDF template and generate HTML that EXACTLY matches its layout, structure, and visual appearance.

CRITICAL RULES (MUST FOLLOW STRICTLY):
1. DO NOT add ANY fields, sections, tables, or data that are NOT visible in the template PDF
2. ONLY fill in the fields that actually exist in the template
3. Match the exact visual layout, positioning, and spacing
4. Use inline CSS to replicate fonts, colors, borders, and styling
5. Return ONLY the complete HTML code (no markdown code blocks, no explanations)
6. If a data field is not in the template, DO NOT include it in the output
7. Keep the layout simple and clean - these are simple key-value documents

Document Type: ${documentType}

Data to Fill In:
${JSON.stringify(techPackData, null, 2)}

IMPORTANT: The template is a simple document with key-value pairs. Do NOT create complex tables or add extra sections. Just replicate what you see in the PDF exactly with the provided data filled in.

Generate the HTML now:`;
  }

  /**
   * Convert HTML to PDF using Puppeteer
   * @param {string} html - HTML content to convert
   * @returns {Promise<Buffer>} PDF buffer
   */
  async convertHtmlToPdf(html) {
    let page = null;

    try {
      console.log(`📄 Converting HTML to PDF with Puppeteer...`);

      // Initialize browser if needed
      const browser = await this.initializeBrowser();

      // Create new page
      page = await browser.newPage();

      // Set content
      await page.setContent(html, {
        waitUntil: "networkidle0", // Wait for all resources to load
      });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true, // Include background colors/images
        margin: {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm",
        },
      });

      console.log(
        `✅ PDF generated (${Math.round(pdfBuffer.length / 1024)}KB)`
      );

      return pdfBuffer;
    } catch (error) {
      console.error(`❌ Error converting HTML to PDF: ${error.message}`);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    } finally {
      // Clean up page
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Main method: Generate document using Vision AI + Puppeteer
   * @param {string} documentType - Type of document to generate
   * @param {Object} techPackData - Data to fill in template
   * @returns {Promise<{pdfBuffer: Buffer, base64: string}>} Generated PDF
   */
  async generateDocumentWithVision(documentType, techPackData) {
    try {
      console.log(`\n🎯 Starting document generation: ${documentType}`);
      console.log(`📦 Tech Pack ID: ${techPackData.id}`);

      // Step 1: Get template path
      const templateKey = this.getTemplateKey(documentType);
      const templatePath = path.join(
        this.templatesDir,
        this.templates[templateKey]
      );

      // Verify template exists
      try {
        await fs.access(templatePath);
      } catch (error) {
        throw new Error(`Template not found: ${this.templates[templateKey]}`);
      }

      // Step 2: Generate HTML from template using Gemini Vision
      const html = await this.generateHtmlFromPdfTemplate(
        templatePath,
        techPackData,
        documentType
      );

      // Step 3: Convert HTML to PDF using Puppeteer
      const pdfBuffer = await this.convertHtmlToPdf(html);

      // Step 4: Convert to base64 for API response
      const buffer = Buffer.isBuffer(pdfBuffer)
        ? pdfBuffer
        : Buffer.from(pdfBuffer);

      const base64 = buffer.toString("base64");

      console.log(`✅ Document generation complete: ${documentType}\n`);

      return {
        pdfBuffer: buffer,
        base64,
        documentType,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`❌ Document generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get template key from document type
   * @param {string} documentType - Document type (purchase-order, commercial-invoice, etc.)
   * @returns {string} Template key (pi, ci, pl, bl, compliance)
   */
  getTemplateKey(documentType) {
    const typeMap = {
      "purchase-order": "pi",
      "commercial-invoice": "ci",
      "packing-list": "pl",
      "bill-of-lading": "bl",
      "compliance-certificate": "compliance",
    };

    const key = typeMap[documentType];
    if (!key) {
      throw new Error(`Unknown document type: ${documentType}`);
    }

    return key;
  }

  /**
   * Generate all documents for a tech pack (sequential generation)
   * @param {Object} techPackData - Complete tech pack data
   * @returns {Promise<Object>} All generated documents
   */
  async generateAllDocuments(techPackData) {
    console.log(
      `\n🚀 Starting generation of ALL documents for Tech Pack ${techPackData.id}`
    );

    const results = {
      techPackId: techPackData.id,
      documents: {},
      errors: {},
    };

    const documentTypes = [
      "purchase-order",
      "commercial-invoice",
      "packing-list",
      "bill-of-lading",
      "compliance-certificate",
    ];

    // Generate each document sequentially
    for (const docType of documentTypes) {
      try {
        const result = await this.generateDocumentWithVision(
          docType,
          techPackData
        );
        results.documents[docType] = {
          base64: result.base64,
          generatedAt: result.generatedAt,
          size: result.pdfBuffer.length,
        };
      } catch (error) {
        console.error(`❌ Failed to generate ${docType}: ${error.message}`);
        results.errors[docType] = error.message;
      }
    }

    console.log(
      `\n✅ Bulk generation complete. Success: ${
        Object.keys(results.documents).length
      }/5\n`
    );

    return results;
  }
}

// Export singleton instance
export const documentGenerator = new DocumentGenerator();

// Graceful shutdown - close browser on process exit
process.on("SIGINT", async () => {
  console.log("\n🛑 Received SIGINT, closing Puppeteer browser...");
  await documentGenerator.closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received SIGTERM, closing Puppeteer browser...");
  await documentGenerator.closeBrowser();
  process.exit(0);
});
