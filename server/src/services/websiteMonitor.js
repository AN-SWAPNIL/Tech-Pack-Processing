import getSupabaseClient from "../config/supabase.js";
import axios from "axios";
import fs from "fs/promises";
import crypto from "crypto";
import path from "path";
import { AILinkExtractor } from "./aiLinkExtractor.js";
import { PDFProcessor } from "./pdfProcessor.js";

export class WebsiteMonitor {
  constructor() {
    this.supabase = getSupabaseClient();
    this.linkExtractor = new AILinkExtractor();
    this.pdfProcessor = new PDFProcessor();
  }

  async checkForUpdates() {
    try {
      console.log(`🔍 Checking for document updates from customs website...`);

      const links = await this.linkExtractor.extractPDFLinks(
        process.env.CUSTOMS_TARIFF_URL
      );

      const newDocuments = await this.filterNewDocuments(links);

      console.log(`📋 Found ${newDocuments.length} new documents to process`);
      return newDocuments;
    } catch (error) {
      console.error("❌ Error checking for updates:", error);
      throw error;
    }
  }

  async filterNewDocuments(links) {
    const newDocuments = [];

    for (const link of links) {
      try {
        console.log(`🔍 Checking document: ${link.type} v${link.version}`);

        // Only process tariff documents
        if (link.type !== "tariff") {
          console.log(
            `⏭️ Skipping non-tariff document: ${link.type} v${link.version}`
          );
          continue;
        }

        console.log(
          `✅ Processing tariff document: ${link.type} v${link.version}`
        );

        // Check if this document version already exists
        const { data: existing } = await this.supabase
          .from("document_versions")
          .select("*")
          .eq("document_type", link.type)
          .eq("version", link.version)
          .single();

        if (!existing) {
          const fileHash = await this.generateFileHash(link.url);

          newDocuments.push({
            type: link.type,
            version: link.version,
            url: link.url,
            hash: fileHash,
            title: link.title,
            confidence: link.confidence,
          });

          console.log(
            `🆕 New document detected: ${link.type} v${link.version}`
          );
        } else {
          console.log(`✅ Document up to date: ${link.type} v${link.version}`);
        }
      } catch (error) {
        console.warn(
          `⚠️ Error checking document ${link.title}:`,
          error.message
        );
      }
    }

    return newDocuments;
  }

  async downloadDocument(url, filePath) {
    try {
      console.log(`⬇️ Downloading document from: ${url}`);

      const response = await axios({
        method: "GET",
        url: url,
        responseType: "stream",
        timeout: 60000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      // Ensure directory exists
      const dir = path.dirname(filePath);
      console.log(`📁 Creating directory: ${dir}`);
      await fs.mkdir(dir, { recursive: true });

      const writer = fs.createWriteStream ? await fs.open(filePath, "w") : null;

      if (writer) {
        const writeStream = writer.createWriteStream();
        response.data.pipe(writeStream);

        return new Promise((resolve, reject) => {
          writeStream.on("finish", async () => {
            await writer.close();
            console.log(`✅ Download completed: ${filePath}`);
            resolve();
          });
          writeStream.on("error", async (error) => {
            await writer.close();
            reject(error);
          });
        });
      } else {
        // Fallback for older Node.js versions
        const chunks = [];

        return new Promise((resolve, reject) => {
          response.data.on("data", (chunk) => chunks.push(chunk));
          response.data.on("end", async () => {
            try {
              const buffer = Buffer.concat(chunks);
              await fs.writeFile(filePath, buffer);
              console.log(`✅ Download completed: ${filePath}`);
              resolve();
            } catch (error) {
              reject(error);
            }
          });
          response.data.on("error", reject);
        });
      }
    } catch (error) {
      console.error(`❌ Download failed for ${url}:`, error);
      throw error;
    }
  }

  async generateFileHash(url) {
    try {
      console.log(`🔍 Generating hash for: ${url}`);

      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const hash = crypto
        .createHash("sha256")
        .update(response.data)
        .digest("hex");
      console.log(`✅ Generated hash: ${hash.substring(0, 16)}...`);

      return hash;
    } catch (error) {
      console.error(`❌ Hash generation failed for ${url}:`, error);
      throw error;
    }
  }

  async markDocumentAsProcessed(documentInfo) {
    try {
      console.log(
        `📝 Marking document as processed: ${documentInfo.type} v${documentInfo.version}`
      );

      const { error } = await this.supabase.from("document_versions").upsert(
        {
          document_type: documentInfo.type,
          version: documentInfo.version,
          file_url: documentInfo.url,
          file_hash: documentInfo.hash,
          processed_at: new Date().toISOString(),
          is_active: true,
        },
        {
          onConflict: "document_type,version",
          ignoreDuplicates: false, // Update existing record
        }
      );

      if (error) {
        // If it's a duplicate key error, log it but don't throw
        if (error.code === "23505" || error.message.includes("duplicate key")) {
          console.log(
            `ℹ️ Document already marked as processed: ${documentInfo.type} v${documentInfo.version}`
          );
          return; // Exit gracefully
        }
        throw error;
      }

      console.log(
        `✅ Document marked as processed: ${documentInfo.type} v${documentInfo.version}`
      );
    } catch (error) {
      console.error("❌ Error marking document as processed:", error);
      throw error;
    }
  }

  // Comprehensive method for PDFMonitorScheduler
  async processAllNewDocuments() {
    try {
      console.log("🔍 Starting comprehensive document processing...");

      // 1. Check for new documents
      const currentDocuments = await this.checkForUpdates();

      if (currentDocuments.length === 0) {
        console.log("✅ No new documents found");
        return 0;
      }

      console.log(`📋 Processing ${currentDocuments.length} new documents...`);

      // 2. Process each document
      let processedCount = 0;
      for (const docInfo of currentDocuments) {
        try {
          console.log(`🔄 Processing: ${docInfo.type} v${docInfo.version}`);
          await this.processDocument(docInfo);
          processedCount++;
          console.log(
            `✅ Successfully processed: ${docInfo.type} v${docInfo.version}`
          );
        } catch (error) {
          console.error(
            `❌ Failed to process ${docInfo.type} v${docInfo.version}:`,
            error.message
          );
          // Continue with next document even if one fails
        }
      }

      console.log(
        `✅ Document processing completed: ${processedCount}/${currentDocuments.length} successful`
      );
      return processedCount;
    } catch (error) {
      console.error("❌ Error in processAllNewDocuments:", error);
      throw error;
    }
  }

  // Process individual document: download, extract, store, mark as processed
  async processDocument(docInfo) {
    const tempDir = process.env.TEMP_DIR || path.join(process.cwd(), "temp");
    const tempPath = path.join(
      tempDir,
      `${docInfo.type}_${docInfo.version}_${Date.now()}.pdf`
    );

    try {
      // Ensure temp directory exists
      console.log(`📁 Creating temp directory: ${tempDir}`);
      await fs.mkdir(tempDir, { recursive: true });

      // Download the document
      console.log(`⬇️ Downloading: ${docInfo.type} v${docInfo.version}`);
      await this.downloadDocument(docInfo.url, tempPath);

      // Process with PDFProcessor
      console.log(`📄 Processing PDF: ${docInfo.type} v${docInfo.version}`);
      await this.pdfProcessor.processPDF(tempPath, docInfo);

      // Mark as processed
      await this.markDocumentAsProcessed(docInfo);

      console.log(
        `✅ Document processing completed: ${docInfo.type} v${docInfo.version}`
      );
    } catch (error) {
      console.error(`❌ Error processing document ${docInfo.type}:`, error);
      throw error;
    } finally {
      // Always cleanup temp file
      try {
        await fs.unlink(tempPath);
        console.log(`🗑️ Cleaned up temp file: ${tempPath}`);
      } catch (cleanupError) {
        console.warn(
          `⚠️ Warning: Could not clean up temp file ${tempPath}:`,
          cleanupError.message
        );
      }
    }
  }
}
