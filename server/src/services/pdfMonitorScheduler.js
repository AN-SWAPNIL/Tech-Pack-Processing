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

      // Let WebsiteMonitor handle all document processing
      const processedCount = await this.websiteMonitor.processAllNewDocuments();

      if (processedCount === 0) {
        console.log("✅ No new documents found");
      } else {
        console.log(
          `✅ Successfully processed ${processedCount} new documents`
        );
      }
    } catch (error) {
      console.error("❌ Error in PDF monitoring:", error);
      throw error;
    }
  }

  async performHealthCheck() {
    try {
      console.log("❤️ Performing system health check...");

      // Check database connectivity
      const { data: dbTest, error: dbError } = await this.supabase
        .from("document_versions")
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

      // Check for recent updates
      const { data: recentVersions, error: versionError } = await this.supabase
        .from("document_versions")
        .select("*")
        .eq("is_active", true)
        .order("processed_at", { ascending: false })
        .limit(5);

      if (versionError) {
        throw new Error(`Version check failed: ${versionError.message}`);
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

  // Function to check if vector store is empty and populate if needed
  async checkAndPopulateVectorStore() {
    try {
      console.log("🔍 Checking vector store status...");

      // Simple check: count documents in the table
      const { count, error } = await this.supabase
        .from("documents")
        .select("id", { count: "exact" });

      if (error) {
        console.warn("⚠️ Vector store check failed:", error.message);
        return;
      }

      if (count === 0) {
        console.log(
          "📊 Vector store is empty. Triggering automatic document processing..."
        );

        // Trigger document processing
        await this.checkForPDFUpdatesWithRetry();

        console.log("✅ Vector store initialization completed");
      } else {
        console.log(`📊 Vector store has ${count} documents available`);
      }
    } catch (error) {
      console.error("❌ Vector store check failed:", error.message);
      // Don't fail server startup if vector store check fails
    }
  }
}
