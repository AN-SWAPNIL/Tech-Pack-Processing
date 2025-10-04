// localStorage utility for tech pack data persistence
import type {
  TechPackSummary,
  HSCodeSuggestion,
  ComplianceData,
} from "../types";

const STORAGE_KEYS = {
  TECH_PACK_DATA: "techpack_data",
  TECH_PACK_FILE_INFO: "techpack_file_info",
  HS_CODE_DATA: "hscode_data",
  HS_CODE_SUGGESTIONS: "hscode_suggestions",
  COMPLIANCE_DATA: "compliance_data",
  COMPLETED_STEPS: "completed_steps",
  CURRENT_STEP: "current_step",
} as const;

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  dataUrl?: string; // Base64 encoded file for small files
}

export interface StoredData {
  techPackData: TechPackSummary | null;
  fileInfo: FileInfo | null;
  hsCodeData: HSCodeSuggestion | null;
  hsCodeSuggestions: HSCodeSuggestion[] | null;
  complianceData: ComplianceData | null;
  completedSteps: number[];
  currentStep: number;
}

class LocalStorageManager {
  // Clear data for subsequent steps when a previous step is updated
  clearSubsequentSteps(updatedStep: number): void {
    console.log(`🧹 Clearing data for steps after step ${updatedStep}`);

    switch (updatedStep) {
      case 1: // Upload updated - clear tech pack, HS code and compliance data (but keep file info)
        // Don't call clearAllData() - it would remove the file info we just saved
        // Instead, clear only the downstream data
        this.clearTechPackData();
        this.clearHSCodeData();
        this.clearHSCodeSuggestions();
        this.clearComplianceData();
        this.saveAppState([], 1); // Reset to step 1
        break;
      case 2: // Tech pack updated - clear HS code and compliance data only
        this.clearHSCodeData();
        this.clearHSCodeSuggestions();
        this.clearComplianceData();
        this.saveAppState([1], 2); // Keep step 1, reset to step 2
        break;
      case 3: // HS code updated - clear compliance data only
        this.clearComplianceData();
        this.saveAppState([1, 2], 3); // Keep steps 1 and 2, reset to step 3
        break;
      case 4: // Compliance updated - nothing to clear after this
        this.saveAppState([1, 2, 3], 4); // Keep steps 1, 2, and 3
        break;
    }
  }

  // Save tech pack data with cascading clear
  saveTechPackData(data: TechPackSummary): void {
    try {
      // Clear HS codes and compliance when tech pack data is updated
      this.clearSubsequentSteps(2); // Tech pack edit - only clear HS codes and compliance

      localStorage.setItem(STORAGE_KEYS.TECH_PACK_DATA, JSON.stringify(data));

      console.log("💾 Tech pack data saved to localStorage");
    } catch (error) {
      console.warn("⚠️ Failed to save tech pack data to localStorage:", error);
    }
  }

  // Save file info only (called from UploadStep after file validation)
  saveFileInfo(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log("📥 saveFileInfo called with:", {
          name: file.name,
          size: file.size,
          type: file.type,
          sizeInMB: (file.size / 1024 / 1024).toFixed(2),
        });

        // Clear all data when a new file is uploaded
        this.clearSubsequentSteps(1); // New upload - clear everything

        const fileInfo: FileInfo = {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        };

        // For small files (< 1MB), store base64 data for complete restoration
        if (file.size < 1024 * 1024) {
          console.log("📖 File is < 1MB, reading as base64...");
          const reader = new FileReader();

          reader.onload = () => {
            console.log("✅ FileReader onload triggered");
            fileInfo.dataUrl = reader.result as string;
            console.log("📊 DataUrl length:", fileInfo.dataUrl?.length || 0);

            localStorage.setItem(
              STORAGE_KEYS.TECH_PACK_FILE_INFO,
              JSON.stringify(fileInfo)
            );
            console.log(
              "💾 File info saved to localStorage (with base64 data)"
            );

            // Verify it was saved
            const saved = localStorage.getItem(
              STORAGE_KEYS.TECH_PACK_FILE_INFO
            );
            const parsed = saved ? JSON.parse(saved) : null;
            console.log("✔️ Verification - dataUrl exists:", !!parsed?.dataUrl);

            resolve();
          };

          reader.onerror = (error) => {
            console.error("❌ FileReader error:", error);
            console.warn("⚠️ Failed to read file data");
            // Still save file info without dataUrl
            localStorage.setItem(
              STORAGE_KEYS.TECH_PACK_FILE_INFO,
              JSON.stringify(fileInfo)
            );
            console.log("💾 File info saved to localStorage (without base64)");
            resolve();
          };

          console.log("🚀 Starting FileReader.readAsDataURL()...");
          reader.readAsDataURL(file);
        } else {
          console.log("⚠️ File is >= 1MB, saving without base64");
          localStorage.setItem(
            STORAGE_KEYS.TECH_PACK_FILE_INFO,
            JSON.stringify(fileInfo)
          );
          console.log(
            "💾 File info saved to localStorage (too large for base64)"
          );
          resolve();
        }
      } catch (error) {
        console.error("❌ Exception in saveFileInfo:", error);
        console.warn("⚠️ Failed to save file info to localStorage:", error);
        reject(error);
      }
    });
  }

  // Save HS code data with cascading clear
  saveHSCodeData(data: HSCodeSuggestion): void {
    try {
      // Clear subsequent steps when step 2 data is updated
      this.clearSubsequentSteps(3);

      localStorage.setItem(STORAGE_KEYS.HS_CODE_DATA, JSON.stringify(data));
      console.log("💾 HS code data saved to localStorage");
    } catch (error) {
      console.warn("⚠️ Failed to save HS code data to localStorage:", error);
    }
  }

  // Save HS code suggestions list with cascading clear
  saveHSCodeSuggestions(suggestions: HSCodeSuggestion[]): void {
    try {
      // Clear subsequent steps when HS code suggestions are updated
      this.clearSubsequentSteps(3);

      localStorage.setItem(
        STORAGE_KEYS.HS_CODE_SUGGESTIONS,
        JSON.stringify(suggestions)
      );
      console.log("💾 HS code suggestions saved to localStorage");
    } catch (error) {
      console.warn(
        "⚠️ Failed to save HS code suggestions to localStorage:",
        error
      );
    }
  }

  // Save compliance data with step update
  saveComplianceData(data: ComplianceData): void {
    try {
      // Update step when compliance data is saved
      this.clearSubsequentSteps(4);

      localStorage.setItem(STORAGE_KEYS.COMPLIANCE_DATA, JSON.stringify(data));
      console.log("💾 Compliance data saved to localStorage");
    } catch (error) {
      console.warn("⚠️ Failed to save compliance data to localStorage:", error);
    }
  }

  // Save app state
  saveAppState(completedSteps: number[], currentStep: number): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.COMPLETED_STEPS,
        JSON.stringify(completedSteps)
      );
      localStorage.setItem(STORAGE_KEYS.CURRENT_STEP, currentStep.toString());
      console.log("💾 App state saved to localStorage");
    } catch (error) {
      console.warn("⚠️ Failed to save app state to localStorage:", error);
    }
  }

  // Load all stored data
  loadStoredData(): StoredData {
    try {
      const techPackData = this.getItem<TechPackSummary>(
        STORAGE_KEYS.TECH_PACK_DATA
      );
      const fileInfo = this.getItem<FileInfo>(STORAGE_KEYS.TECH_PACK_FILE_INFO);
      const hsCodeData = this.getItem<HSCodeSuggestion>(
        STORAGE_KEYS.HS_CODE_DATA
      );
      const hsCodeSuggestions = this.getItem<HSCodeSuggestion[]>(
        STORAGE_KEYS.HS_CODE_SUGGESTIONS
      );
      const complianceData = this.getItem<ComplianceData>(
        STORAGE_KEYS.COMPLIANCE_DATA
      );
      const completedSteps =
        this.getItem<number[]>(STORAGE_KEYS.COMPLETED_STEPS) || [];
      const currentStep = parseInt(
        localStorage.getItem(STORAGE_KEYS.CURRENT_STEP) || "1",
        10
      );

      const hasData =
        techPackData ||
        fileInfo ||
        hsCodeData ||
        complianceData ||
        completedSteps.length > 0;

      if (hasData) {
        console.log("📂 Loaded stored data from localStorage:", {
          hasTechPack: !!techPackData,
          hasFile: !!fileInfo,
          hasHSCode: !!hsCodeData,
          hasCompliance: !!complianceData,
          completedSteps,
          currentStep,
        });
      }

      return {
        techPackData,
        fileInfo,
        hsCodeData,
        hsCodeSuggestions,
        complianceData,
        completedSteps,
        currentStep,
      };
    } catch (error) {
      console.warn("⚠️ Failed to load stored data from localStorage:", error);
      return {
        techPackData: null,
        fileInfo: null,
        hsCodeData: null,
        hsCodeSuggestions: null,
        complianceData: null,
        completedSteps: [],
        currentStep: 1,
      };
    }
  }

  // Create File object from stored file info (for small files with dataUrl)
  async createFileFromStoredInfo(fileInfo: FileInfo): Promise<File | null> {
    if (!fileInfo.dataUrl) {
      return null; // Can't recreate file without data
    }

    try {
      // Convert base64 data URL back to File
      const response = await fetch(fileInfo.dataUrl);
      const blob = await response.blob();
      return new File([blob], fileInfo.name, {
        type: fileInfo.type,
        lastModified: fileInfo.lastModified,
      });
    } catch (error) {
      console.warn("⚠️ Failed to recreate file from stored data:", error);
      return null;
    }
  }

  // Clear all stored data
  clearAllData(): void {
    try {
      Object.values(STORAGE_KEYS).forEach((key) => {
        localStorage.removeItem(key);
      });
      console.log("🗑️ Cleared all tech pack data from localStorage");
    } catch (error) {
      console.warn("⚠️ Failed to clear localStorage:", error);
    }
  }

  // Generic helper to get and parse JSON from localStorage
  private getItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.warn(`⚠️ Failed to parse localStorage item "${key}":`, error);
      return null;
    }
  }

  // Check if we have tech pack data
  hasTechPackData(): boolean {
    return !!localStorage.getItem(STORAGE_KEYS.TECH_PACK_DATA);
  }

  // Clear HS code related data (when starting fresh generation)
  clearHSCodeData(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.HS_CODE_DATA);
      // localStorage.removeItem(STORAGE_KEYS.HS_CODE_SUGGESTIONS);
      console.log("🧹 HS code data cleared from localStorage");
    } catch (error) {
      console.warn("⚠️ Failed to clear HS code data from localStorage:", error);
    }
  }

  // Clear tech pack data only
  clearTechPackData(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.TECH_PACK_DATA);
      console.log("🧹 Tech pack data cleared from localStorage");
    } catch (error) {
      console.warn(
        "⚠️ Failed to clear tech pack data from localStorage:",
        error
      );
    }
  }

  // Clear HS code suggestions only
  clearHSCodeSuggestions(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.HS_CODE_SUGGESTIONS);
      console.log("🧹 HS code suggestions cleared from localStorage");
    } catch (error) {
      console.warn(
        "⚠️ Failed to clear HS code suggestions from localStorage:",
        error
      );
    }
  }

  // Clear compliance data only
  clearComplianceData(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.COMPLIANCE_DATA);
      console.log("🧹 Compliance data cleared from localStorage");
    } catch (error) {
      console.warn(
        "⚠️ Failed to clear compliance data from localStorage:",
        error
      );
    }
  }

  // Get storage usage info
  getStorageInfo(): { used: number; available: number; percentage: number } {
    try {
      let used = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length;
        }
      }

      // Estimate available space (most browsers limit to ~5-10MB)
      const estimated = 5 * 1024 * 1024; // 5MB estimate
      const available = Math.max(0, estimated - used);
      const percentage = (used / estimated) * 100;

      return { used, available, percentage };
    } catch (error) {
      return { used: 0, available: 0, percentage: 0 };
    }
  }
}

export const localStorageManager = new LocalStorageManager();
