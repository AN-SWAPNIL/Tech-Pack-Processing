// Frontend types for the Tech Pack Processing application

// Garment type dropdown options
export const GARMENT_TYPE_OPTIONS = [
  "T-Shirt",
  "Shirt",
  "Polo Shirt",
  "Blouse",
  "Jeans",
  "Trousers",
  "Shorts",
  "Skirt",
  "Dress",
  "Jacket",
  "Coat",
  "Blazer",
  "Vest",
  "Sweater",
  "Cardigan",
  "Hoodie",
  "Sweatshirt",
  "Tank Top",
  "Custom",
] as const;

export interface TechPackSummary {
  // Existing core fields (keeping same names)
  materialPercentage: { material: string; percentage: number }[]; // fiberComposition
  fabricType: "knit" | "woven"; // constructionType
  garmentType: string; // garmentType (with dropdown support)
  gender: string; // genderCategory
  description: string; // productSummary

  // New optional fields
  gsm?: number; // Grams per square meter
  countryOfOrigin?: string; // Manufacturing country
  destinationMarket?: string; // Target market/country
  incoterm?: string; // International commercial terms
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
  // NBR specific fields
  source?: "nbr" | "customs" | "mixed";
  chapter?: string;
  pdfLink?: string;
  year?: string;
}

export interface ComplianceData {
  destination: string;
  office: string;
  port: string;
  udLcNumber?: string;
  btbLcNumber?: string;
  costUsd?: number;
  quantity?: number;
}

// Document generation types
export interface DocumentData {
  orderNumber?: string;
  orderDate?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  packingListNumber?: string;
  blNumber?: string;
  certificateNumber?: string;
  buyer?: string;
  buyerAddress?: string;
  seller?: string;
  sellerAddress?: string;
  productDescription?: string;
  hsCode?: string;
  quantity?: number;
  unitPrice?: number;
  totalValue?: number;
  currency?: string;
  [key: string]: any; // Allow additional fields
}

export interface GeneratedDocument {
  purchaseOrder: DocumentData;
  commercialInvoice: DocumentData;
  packingList: DocumentData;
  billOfLading: DocumentData;
  complianceCertificate: DocumentData;
}

export interface DocumentTemplate {
  type: string;
  filename: string;
  exists: boolean;
  displayName: string;
}

export interface DocumentGenerationRequest {
  techPackData: TechPackSummary;
  hsCodeData: HSCodeSuggestion;
  complianceData: ComplianceData;
  orderDetails?: Record<string, any>;
}

export interface DocumentGenerationResponse {
  purchaseOrder: DocumentData;
  commercialInvoice: DocumentData;
  packingList: DocumentData;
  billOfLading: DocumentData;
  complianceCertificate: DocumentData;
  pdfs?: {
    purchaseOrder: string;
    commercialInvoice: string;
    packingList: string;
    billOfLading: string;
    complianceCertificate: string;
  };
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
