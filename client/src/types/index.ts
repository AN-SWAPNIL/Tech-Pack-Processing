// Frontend types for the Tech Pack Processing application

export interface TechPackSummary {
  materialPercentage: { material: string; percentage: number }[];
  fabricType: "knit" | "woven";
  garmentType: string;
  gender: string;
  description: string;
}

export interface TechPackUploadResponse {
  techPackSummary: TechPackSummary;
  fileInfo: {
    originalName: string;
    size: number;
    type: string;
  };
}

export interface TariffInfo {
  CD: number;
  SD: number;
  VAT: number;
  AIT: number;
  AT: number;
  RD: number;
  TTI: number;
}

export interface HSCodeSuggestion {
  code: string;
  description: string;
  confidence: number;
  rationale: string[];
  tariffInfo?: TariffInfo;
}

export interface ComplianceData {
  destination: string;
  office: string;
  port: string;
  udLcNumber?: string;
  btbLcNumber?: string;
}

// API Response types for frontend
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  error?: string;
  details?: any[];
}

export interface HSCodeClassificationResponse {
  hsCodeSuggestions: HSCodeSuggestion[];
  techPackInfo: TechPackSummary;
}
