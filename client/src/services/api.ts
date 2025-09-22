import {
  TechPackSummary,
  TechPackUploadResponse,
  HSCodeSuggestion,
  HSCodeClassificationResponse,
  ComplianceData,
  ApiResponse,
} from "../types";

// API configuration
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

// API error class
class ApiError extends Error {
  constructor(message: string, public status: number, public details?: any[]) {
    super(message);
    this.name = "ApiError";
  }
}

// Generic API request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.message || "API request failed",
        response.status,
        data.details
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network or parsing errors
    throw new ApiError(
      error instanceof Error ? error.message : "Network error occurred",
      0
    );
  }
}

// File upload function
async function uploadFile(
  endpoint: string,
  file: File,
  additionalData?: Record<string, any>
): Promise<ApiResponse<any>> {
  const formData = new FormData();
  formData.append("techpack", file);

  if (additionalData) {
    Object.keys(additionalData).forEach((key) => {
      formData.append(key, JSON.stringify(additionalData[key]));
    });
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    const data: ApiResponse<any> = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.message || "File upload failed",
        response.status,
        data.details
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      error instanceof Error ? error.message : "Upload error occurred",
      0
    );
  }
}

// API service functions
export const api = {
  // Upload tech pack file and get summary
  uploadTechPack: async (
    file: File
  ): Promise<ApiResponse<TechPackUploadResponse>> => {
    return uploadFile("/techpack/upload", file);
  },

  // Get HS code suggestions
  getHSCodeSuggestions: async (
    techPackData: TechPackSummary
  ): Promise<ApiResponse<HSCodeClassificationResponse>> => {
    return apiRequest("/techpack/hscode", {
      method: "POST",
      body: JSON.stringify(techPackData),
    });
  },

  // Process complete tech pack with compliance data
  processTechPack: async (
    techPackData: TechPackSummary,
    hsCode: string,
    complianceData: ComplianceData
  ): Promise<ApiResponse<any>> => {
    return apiRequest("/techpack/process", {
      method: "POST",
      body: JSON.stringify({
        ...techPackData,
        hsCode,
        compliance: complianceData,
      }),
    });
  },

  // Health check
  healthCheck: async (): Promise<ApiResponse<{ status: string }>> => {
    return apiRequest("/health");
  },
};

// Export types and utilities
export { API_BASE_URL };
export { ApiError };
export default api;
