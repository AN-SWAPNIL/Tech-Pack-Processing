import getSupabaseClient from "../config/supabase.js";
import * as cron from "node-cron";
import fs from "fs/promises";
import path from "path";
import { WebsiteMonitor } from "./websiteMonitor.js";

export class PDFMonitorScheduler {
  constructor() {
    this.supabase = getSupabaseClient();
    this.websiteMonitor = new WebsiteMonitor();
    this.isRunning = false;
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  setupMonitoringTasks() {
    console.log("🕐 Setting up PDF monitoring scheduler...");

    // Daily PDF version check (6 AM Bangladesh timezone)
    // Bangladesh is UTC+6, so 6 AM BDT = 12 AM UTC
    cron.schedule(
      "0 0 * * *",
      async () => {
        console.log("🔍 Daily PDF version check started...");
        await this.checkForPDFUpdatesWithRetry();
      },
      {
        timezone: "Asia/Dhaka",
      }
    );

    // Health check every 6 hours
    cron.schedule("0 */6 * * *", async () => {
      console.log("❤️ Running health check...");
      await this.performHealthCheck();
    });

    // Cleanup old temp files every day at 2 AM BDT
    cron.schedule(
      "0 20 * * *",
      async () => {
        console.log("🧹 Running cleanup task...");
        await this.cleanupTempFiles();
      },
      {
        timezone: "Asia/Dhaka",
      }
    );

    console.log("✅ PDF monitoring scheduler setup completed");
    console.log("📅 Schedule:");
    console.log("  - PDF checks: Daily at 6:00 AM BDT");
    console.log("  - Health checks: Every 6 hours");
    console.log("  - Cleanup: Daily at 2:00 AM BDT");
  }

  async checkForPDFUpdatesWithRetry() {
    if (this.isRunning) {
      console.log("⚠️ PDF update check already running, skipping...");
      return;
    }

    this.isRunning = true;
    let lastError = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(
          `🔄 PDF update check attempt ${attempt}/${this.retryAttempts}`
        );
        await this.checkForPDFUpdates();
        console.log("✅ PDF update check completed successfully");
        this.isRunning = false;
        return;
      } catch (error) {
        lastError = error;
        console.error(
          `❌ PDF update check attempt ${attempt} failed:`,
          error.message
        );

        if (attempt < this.retryAttempts) {
          console.log(`⏳ Waiting ${this.retryDelay / 1000}s before retry...`);
          await this.sleep(this.retryDelay);
        }
      }
    }

    console.error(
      "❌ PDF update check failed after all retry attempts:",
      lastError?.message
    );
    await this.logError("PDF Update Check Failed", lastError);
    this.isRunning = false;
  }

  async checkForPDFUpdates() {
    try {
      console.log("🔍 Starting PDF update check...");

      // Primary: Check NBR updates first
      console.log("🎯 Checking NBR tariff updates (primary source)...");
      const nbrResult = await this.websiteMonitor.checkNBRUpdates();

      if (nbrResult.success && nbrResult.processed > 0) {
        console.log(
          `✅ NBR update successful: ${nbrResult.processed} chapters processed`
        );
      } else if (!nbrResult.success) {
        console.warn(`⚠️ NBR update failed: ${nbrResult.error}`);
      } else {
        console.log(`✅ NBR tariffs are up to date`);
      }

      // Fallback: Check customs.gov.bd updates
      console.log("🔄 Checking customs.gov.bd updates (fallback source)...");

      // Let WebsiteMonitor handle all customs document processing
      const processedCount = await this.websiteMonitor.processAllNewDocuments();

      if (processedCount === 0) {
        console.log("✅ No new customs documents found");
      } else {
        console.log(
          `✅ Successfully processed ${processedCount} new customs documents`
        );
      }

      // Return combined status
      const totalNBRProcessed = nbrResult.success
        ? nbrResult.processed || 0
        : 0;
      const totalProcessed = totalNBRProcessed + processedCount;

      console.log(
        `📊 Total updates: ${totalProcessed} (NBR: ${totalNBRProcessed}, Customs: ${processedCount})`
      );
    } catch (error) {
      console.error("❌ Error in PDF monitoring:", error);
      throw error;
    }
  }

  async performHealthCheck() {
    try {
      console.log("❤️ Performing system health check...");

      // Check database connectivity using documents table
      const { data: dbTest, error: dbError } = await this.supabase
        .from("documents")
        .select("id")
        .limit(1);

      if (dbError) {
        throw new Error(`Database connectivity failed: ${dbError.message}`);
      }

      // Check document count
      const { data: documents, error: countError } = await this.supabase
        .from("documents")
        .select("id", { count: "exact" });

      if (countError) {
        throw new Error(`Document count check failed: ${countError.message}`);
      }

      const documentCount = documents?.length || 0;
      console.log(`📊 Database status: ${documentCount} documents stored`);

      // Check for recent documents using metadata
      const { data: recentDocs, error: recentError } = await this.supabase
        .from("documents")
        .select("metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentError) {
        throw new Error(
          `Recent documents check failed: ${recentError.message}`
        );
      }

      console.log(
        `📋 Active document versions: ${recentVersions?.length || 0}`
      );

      if (recentVersions && recentVersions.length > 0) {
        const lastUpdate = new Date(recentVersions[0].processed_at);
        const daysSinceUpdate = Math.floor(
          (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
        );
        console.log(`📅 Last update: ${daysSinceUpdate} days ago`);

        if (daysSinceUpdate > 7) {
          console.warn(`⚠️ Warning: No updates in ${daysSinceUpdate} days`);
        }
      }

      console.log("✅ Health check completed successfully");
    } catch (error) {
      console.error("❌ Health check failed:", error);
      await this.logError("Health Check Failed", error);
    }
  }

  async cleanupTempFiles() {
    try {
      const tempDir = process.env.TEMP_DIR || "./temp";

      // Check if temp directory exists
      try {
        await fs.access(tempDir);
      } catch {
        console.log("📁 Temp directory doesn't exist, skipping cleanup");
        return;
      }

      const files = await fs.readdir(tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      let cleanedCount = 0;

      for (const file of files) {
        try {
          const filePath = path.join(tempDir, file);
          const stats = await fs.stat(filePath);

          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filePath);
            cleanedCount++;
            console.log(`🗑️ Removed old temp file: ${file}`);
          }
        } catch (error) {
          console.warn(
            `⚠️ Warning: Could not process file ${file}:`,
            error.message
          );
        }
      }

      console.log(`✅ Cleanup completed: ${cleanedCount} files removed`);
    } catch (error) {
      console.error("❌ Cleanup failed:", error);
      await this.logError("Cleanup Failed", error);
    }
  }

  async logError(operation, error, context = {}) {
    try {
      const errorLog = {
        operation,
        error_message: error.message,
        error_stack: error.stack,
        context: JSON.stringify(context),
        timestamp: new Date().toISOString(),
      };

      console.error(`📝 Logging error for ${operation}:`, errorLog);

      // In a production environment, you might want to store this in a separate error logging table
      // For now, we'll just log to console and optionally send to external monitoring
    } catch (logError) {
      console.error("❌ Failed to log error:", logError);
    }
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Method to manually trigger PDF check (for testing)
  async manualCheck() {
    console.log("🔧 Manual PDF check triggered...");
    await this.checkForPDFUpdatesWithRetry();
  }

  // Method to get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      retryAttempts: this.retryAttempts,
      retryDelay: this.retryDelay,
      tempDir: process.env.TEMP_DIR || "./temp",
    };
  }

  // Method to stop all scheduled tasks
  stopScheduler() {
    console.log("🛑 Stopping PDF monitoring scheduler...");
    // Note: node-cron doesn't provide a direct way to stop all tasks
    // In a production environment, you might want to track task references
    console.log("⚠️ Note: Scheduled tasks will continue until process restart");
  }

  // Function to check if vector stores are empty and populate if needed
  async checkAndPopulateVectorStore() {
    try {
      console.log("🔍 Checking vector stores status...");

      // Check if customs documents/tariff rates need processing (single call for both tables)
      const needsCustomsUpdate =
        (await this.isTableOutdatedOrEmpty("documents")) ||
        (await this.isTableOutdatedOrEmpty("customs_tariff_rates"));

      // Check if NBR chapters need processing
      const needsNBRUpdate = await this.isTableOutdatedOrEmpty(
        "chapter_documents"
      );

      // Process customs documents once (populates both documents and customs_tariff_rates tables)
      if (needsCustomsUpdate) {
        console.log("🔄 Processing customs documents and tariff rates...");
        try {
          await this.websiteMonitor.processAllNewDocuments();
          console.log("✅ Customs processing completed");
        } catch (error) {
          console.error("❌ Error processing customs documents:", error);
        }
      } else {
        console.log("✅ Customs documents and tariff rates are up to date");
      }

      // Process NBR chapters separately
      if (needsNBRUpdate) {
        console.log("🔄 Processing NBR chapter documents...");
        try {
          await this.websiteMonitor.checkNBRUpdates();
          console.log("✅ NBR chapter processing completed");
        } catch (error) {
          console.error("❌ Error processing NBR chapters:", error);
        }
      } else {
        console.log("✅ NBR chapter documents are up to date");
      }

      console.log("✅ All vector store checks completed");
    } catch (error) {
      console.error("❌ Error checking vector stores:", error);
      throw error;
    }
  }

  // Check if any of the three main tables are empty
  async checkIfAnyTableEmpty() {
    try {
      const tables = ["documents", "chapter_documents", "customs_tariff_rates"];
      
      for (const tableName of tables) {
        const { count } = await this.supabase
          .from(tableName)
          .select("id", { count: "exact" });

        if (count === 0) {
          console.log(`📊 Table ${tableName} is empty`);
          return true;
        }
      }
      
      console.log(`📊 All tables have data`);
      return false;
    } catch (error) {
      console.error("❌ Error checking table status:", error);
      return true; // Default to needing initialization on error
    }
  }

  async checkAndProcessTable(tableName, processingFunction) {
    try {
      const needsUpdate = await this.isTableOutdatedOrEmpty(tableName);

      if (needsUpdate) {
        console.log(`🔄 Processing ${tableName} table...`);
        await processingFunction();
        console.log(`✅ ${tableName} table processing completed`);
      } else {
        console.log(`✅ ${tableName} table is up to date`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${tableName} table:`, error);
      // Don't throw - continue with other tables
    }
  }

  async isTableOutdatedOrEmpty(tableName) {
    try {
      // Check if table is empty
      const { count } = await this.supabase
        .from(tableName)
        .select("id", { count: "exact" });

      if (count === 0) {
        console.log(`📊 ${tableName} table is empty`);
        return true;
      }

      // For each table type, get the current year from their respective sources
      if (tableName === "documents" || tableName === "customs_tariff_rates") {
        // For customs: Check if newer documents are available on customs website
        const latestCustomsYear = await this.getLatestCustomsYear();
        if (latestCustomsYear) {
          const hasLatestYear = await this.hasDataForYear(
            tableName,
            latestCustomsYear,
            "customs"
          );
          if (!hasLatestYear) {
            console.log(
              `📊 ${tableName} missing latest customs year: ${latestCustomsYear}`
            );
            return true;
          }
        }
      } else if (tableName === "chapter_documents") {
        // For NBR: Check if newer NBR year is available
        const latestNBRYear = await this.getLatestNBRYear();
        if (latestNBRYear) {
          const hasLatestYear = await this.hasDataForYear(
            tableName,
            latestNBRYear,
            "nbr"
          );
          if (!hasLatestYear) {
            console.log(
              `📊 ${tableName} missing latest NBR year: ${latestNBRYear}`
            );
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error(`❌ Error checking ${tableName}:`, error);
      return true; // Default to update on error
    }
  }

  async getLatestCustomsYear() {
    try {
      // Get year from latest customs documents via AI extraction
      const links = await this.websiteMonitor.linkExtractor.extractPDFLinks(
        process.env.CUSTOMS_TARIFF_URL
      );
      const tariffDocs = links.filter((link) => link.type === "tariff");
      return tariffDocs.length > 0 ? tariffDocs[0].version : null;
    } catch (error) {
      console.warn("⚠️ Could not get latest customs year:", error.message);
      return null;
    }
  }

  async getLatestNBRYear() {
    try {
      // Get year from NBR website
      const yearCheck =
        await this.websiteMonitor.linkExtractor.checkNBRYearUpdate();
      return yearCheck.success ? yearCheck.currentYear : null;
    } catch (error) {
      console.warn("⚠️ Could not get latest NBR year:", error.message);
      return null;
    }
  }

  async hasDataForYear(tableName, year, source) {
    try {
      let query;
      if (tableName === "customs_tariff_rates") {
        query = this.supabase
          .from(tableName)
          .select("id")
          .eq("document_version", year);
      } else {
        // Use version field consistently for both documents and chapter_documents
        query = this.supabase
          .from(tableName)
          .select("id")
          .eq("metadata->>version", year);
      }

      const { data } = await query.limit(1);
      return data && data.length > 0;
    } catch (error) {
      console.error(`❌ Error checking year data for ${tableName}:`, error);
      return false;
    }
  }
}
