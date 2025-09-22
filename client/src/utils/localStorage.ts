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
  // Save tech pack data and file info
  saveTechPackData(data: TechPackSummary, file: File): void {
    try {
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

  // Save HS code data
  saveHSCodeData(data: HSCodeSuggestion): void {
    try {
      localStorage.setItem(STORAGE_KEYS.HS_CODE_DATA, JSON.stringify(data));
      console.log("💾 HS code data saved to localStorage");
    } catch (error) {
      console.warn("⚠️ Failed to save HS code data to localStorage:", error);
    }
  }

  // Save HS code suggestions list
  saveHSCodeSuggestions(suggestions: HSCodeSuggestion[]): void {
    try {
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

  // Save compliance data
  saveComplianceData(data: ComplianceData): void {
    try {
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
