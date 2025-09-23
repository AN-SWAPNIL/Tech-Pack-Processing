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
      case 1: // Tech pack updated - clear HS code and compliance data
        this.clearHSCodeData();
        this.clearHSCodeSuggestions();
        this.clearComplianceData();
        this.saveAppState([], 1); // Reset to step 1
        break;
      case 2: // HS code updated - clear compliance data only
        this.clearComplianceData();
        this.saveAppState([1], 2); // Keep step 1, reset to step 2
        break;
      case 3: // Compliance updated - nothing to clear after this
        this.saveAppState([1, 2], 3); // Keep steps 1 and 2
        break;
    }
  }

  // Save tech pack data and file info with cascading clear
  saveTechPackData(data: TechPackSummary, file: File): void {
    try {
      // Clear all subsequent steps when step 1 data is updated
      this.clearSubsequentSteps(1);

      localStorage.setItem(STORAGE_KEYS.TECH_PACK_DATA, JSON.stringify(data));

      const fileInfo: FileInfo = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      };

      // For small files (< 1MB), store base64 data for complete restoration
      if (file.size < 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = () => {
          fileInfo.dataUrl = reader.result as string;
          localStorage.setItem(
            STORAGE_KEYS.TECH_PACK_FILE_INFO,
            JSON.stringify(fileInfo)
          );
        };
        reader.readAsDataURL(file);
      } else {
        localStorage.setItem(
          STORAGE_KEYS.TECH_PACK_FILE_INFO,
          JSON.stringify(fileInfo)
        );
      }

      console.log("💾 Tech pack data saved to localStorage");
    } catch (error) {
      console.warn("⚠️ Failed to save tech pack data to localStorage:", error);
    }
  }

  // Save HS code data with cascading clear
  saveHSCodeData(data: HSCodeSuggestion): void {
    try {
      // Clear subsequent steps when step 2 data is updated
      this.clearSubsequentSteps(2);

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
      this.clearSubsequentSteps(2);

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
      this.clearSubsequentSteps(3);

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
      localStorage.removeItem(STORAGE_KEYS.HS_CODE_SUGGESTIONS);
      console.log("🧹 HS code data cleared from localStorage");
    } catch (error) {
      console.warn("⚠️ Failed to clear HS code data from localStorage:", error);
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
