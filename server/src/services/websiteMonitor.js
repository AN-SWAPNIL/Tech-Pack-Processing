import getSupabaseClient from "../config/supabase.js";
import axios from "axios";
import fs from "fs/promises";
import * as fsSync from "fs";
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

        // Check if this document version already exists in metadata
        const { data: existing } = await this.supabase
          .from("documents")
          .select("*")
          .eq("metadata->>documentType", link.type)
          .eq("metadata->>version", link.version)
          .limit(1)
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

      // Simple stream to file
      const writer = fsSync.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          console.log(`✅ Download completed: ${filePath}`);
          resolve();
        });
        writer.on("error", reject);
      });
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
        `📝 Document processing completed: ${documentInfo.type} v${documentInfo.version}`
      );
      console.log("✅ Document metadata is now stored in documents table");
    } catch (error) {
      console.error("❌ Error in document processing:", error);
      throw error;
    }
  }

  // Comprehensive method for PDFMonitorScheduler with retry mechanism
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

      // 2. Process each document with retry mechanism
      let processedCount = 0;
      const failedDocuments = [];

      for (const docInfo of currentDocuments) {
        const success = await this.processDocumentWithRetry(docInfo, 3);
        if (success) {
          processedCount++;
        } else {
          failedDocuments.push(docInfo);
        }
      }

      // 3. Report results
      console.log(
        `✅ Document processing completed: ${processedCount}/${currentDocuments.length} successful`
      );

      if (failedDocuments.length > 0) {
        console.warn(
          `⚠️ ${failedDocuments.length} documents failed after all retries:`,
          failedDocuments.map((d) => `${d.type} v${d.version}`).join(", ")
        );
      }

      return processedCount;
    } catch (error) {
      console.error("❌ Error in processAllNewDocuments:", error);
      throw error;
    }
  }

  // Process document with retry mechanism
  async processDocumentWithRetry(docInfo, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔄 Processing: ${docInfo.type} v${docInfo.version} (attempt ${attempt}/${maxRetries})`
        );
        await this.processDocument(docInfo);
        console.log(
          `✅ Successfully processed: ${docInfo.type} v${docInfo.version}`
        );
        return true;
      } catch (error) {
        console.error(
          `❌ Failed to process ${docInfo.type} v${docInfo.version} (attempt ${attempt}/${maxRetries}):`,
          error.message
        );

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
          console.log(`⏳ Retrying in ${delay / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.error(
            `❌ Final failure for ${docInfo.type} v${docInfo.version} after ${maxRetries} attempts`
          );
          return false;
        }
      }
    }
    return false;
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

  // NBR specific monitoring methods
  async checkNBRUpdates() {
    try {
      console.log(`🔍 Checking for NBR tariff updates...`);

      // Step 1: Check if year is updated
      const yearCheck = await this.linkExtractor.checkNBRYearUpdate();

      if (!yearCheck.success) {
        console.log(`⚠️ NBR year check failed: ${yearCheck.error}`);
        return { success: false, error: yearCheck.error };
      }

      console.log(`📅 Current NBR year: ${yearCheck.currentYear}`);

      // Step 2: Check if we need to update
      const needsUpdate = await this.shouldUpdateNBRChapters(
        yearCheck.currentYear
      );

      if (!needsUpdate) {
        console.log(
          `✅ NBR chapters are up to date for year: ${yearCheck.currentYear}`
        );
        return { success: true, updated: false, year: yearCheck.currentYear };
      }

      // Step 3: Extract chapter links for current year
      const chaptersData = await this.linkExtractor.extractNBRChapterLinks(
        yearCheck.currentYear
      );

      if (!chaptersData.success) {
        console.log(`⚠️ NBR chapters extraction failed: ${chaptersData.error}`);
        return { success: false, error: chaptersData.error };
      }

      console.log(
        `📋 Found ${chaptersData.chapters.length} NBR chapters to process`
      );

      // Step 4: Process the chapters
      const result = await this.processNBRChapters(chaptersData);

      return result;
    } catch (error) {
      console.error("❌ Error checking NBR updates:", error);
      return { success: false, error: error.message };
    }
  }

  async shouldUpdateNBRChapters(currentYear) {
    try {
      // Check if we have any chapters for this year (use version field consistently)
      const { data: existingChapters } = await this.supabase
        .from("chapter_documents")
        .select("id")
        .eq("metadata->>version", currentYear)
        .limit(1);

      // If no chapters exist for this year, we need to update
      return !existingChapters || existingChapters.length === 0;
    } catch (error) {
      console.warn("⚠️ Error checking existing NBR chapters:", error);
      return true; // Default to update if check fails
    }
  }

  async processNBRChapters(chaptersData) {
    try {
      console.log(
        `📄 Processing ${chaptersData.chapters.length} NBR chapters...`
      );

      let processedCount = 0;
      let errorCount = 0;
      const errors = [];
      const failedChapters = [];

      // First pass: Process all chapters with individual retries
      for (const chapter of chaptersData.chapters) {
        const success = await this.processNBRChapterWithRetry(
          chapter,
          chaptersData.year,
          2
        );
        if (success) {
          processedCount++;
        } else {
          errorCount++;
          failedChapters.push(chapter);
          errors.push({
            chapter: chapter.chapter,
            error: "Failed after initial retries",
          });
        }
      }

      console.log(
        `📊 NBR Processing first pass complete: ${processedCount} success, ${errorCount} errors`
      );

      // Second pass: Final retry for failed chapters
      if (failedChapters.length > 0) {
        console.log(
          `🔄 Final retry pass for ${failedChapters.length} failed chapters...`
        );

        const finalFailures = [];

        for (const chapter of failedChapters) {
          console.log(`🔄 Final retry for ${chapter.chapter}...`);
          const success = await this.processNBRChapterWithRetry(
            chapter,
            chaptersData.year,
            1
          ); // Single final attempt
          if (success) {
            processedCount++;
            errorCount--;
            console.log(`✅ ${chapter.chapter} succeeded on final retry!`);
            // Remove from errors array
            const errorIndex = errors.findIndex(
              (e) => e.chapter === chapter.chapter
            );
            if (errorIndex > -1) {
              errors.splice(errorIndex, 1);
            }
          } else {
            finalFailures.push(chapter.chapter);
            console.log(`❌ ${chapter.chapter} failed final retry`);
          }
        }

        if (finalFailures.length > 0) {
          console.log(
            `⚠️ ${
              finalFailures.length
            } chapters permanently failed: ${finalFailures.join(", ")}`
          );
        }
      }

      console.log(
        `📊 NBR Processing complete: ${processedCount} success, ${errorCount} errors`
      );

      return {
        success: true,
        processed: processedCount,
        errors: errorCount,
        year: chaptersData.year,
        details: errors,
      };
    } catch (error) {
      console.error("❌ Error processing NBR chapters:", error);
      return { success: false, error: error.message };
    }
  }

  // Process single NBR chapter with retry mechanism
  async processNBRChapterWithRetry(chapter, year, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `📄 Processing ${chapter.chapter} from ${chapter.pdfLink} (attempt ${attempt}/${maxRetries})`
        );

        // Download and process the chapter PDF
        const tempPath = path.join(
          process.cwd(),
          "temp",
          `nbr_${chapter.chapter}_${Date.now()}.pdf`
        );

        await this.downloadDocument(chapter.pdfLink, tempPath);

        // Process with PDFProcessor for NBR chapters
        const chapterInfo = {
          type: "nbr_chapter",
          chapter: chapter.chapter,
          pdfLink: chapter.pdfLink,
          year: year,
          section: chapter.section,
        };

        await this.pdfProcessor.processNBRChapterPDF(tempPath, chapterInfo);

        // Cleanup temp file
        await fs.unlink(tempPath);

        console.log(`✅ Successfully processed ${chapter.chapter}`);
        return true;
      } catch (error) {
        console.error(
          `❌ Error processing ${chapter.chapter} (attempt ${attempt}/${maxRetries}):`,
          error
        );

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s
          console.log(`⏳ Retrying ${chapter.chapter} in ${delay / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.error(
            `❌ Final failure for ${chapter.chapter} after ${maxRetries} attempts`
          );
          return false;
        }
      }
    }
    return false;
  }
}
