// Shared types for the Tech Pack Processing application

export interface TechPackSummary {
  materialPercentage: { material: string; percentage: number }[];
  fabricType: "knit" | "woven";
  garmentType: string;
  gender: string;
  description: string;
}

export interface HSCodeSuggestion {
  code: string;
  description: string;
  confidence: number;
  rationale: string[];
}

export interface ComplianceData {
  destination: string;
  office: string;
  port: string;
  udLcNumber?: string;
  btbLcNumber?: string;
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
