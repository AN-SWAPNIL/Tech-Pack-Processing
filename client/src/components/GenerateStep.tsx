import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  FileText,
  Download,
  Database,
  Building2,
  CheckCircle,
  Upload,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type {
  TechPackSummary,
  HSCodeSuggestion,
  ComplianceData,
  DocumentGenerationResponse,
} from "../types";
import { api } from "../services/api";
import { localStorageManager } from "../utils/localStorage";

interface DocumentType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: "pending" | "generating" | "ready";
  data?: any;
}

interface GenerateStepProps {
  onNext: (documents: DocumentGenerationResponse) => void;
  onBack: () => void;
  techPackData: TechPackSummary | null;
  hsCodeData: HSCodeSuggestion | null;
  complianceData: ComplianceData | null;
  initialDocuments?: DocumentGenerationResponse | null;
}

export function GenerateStep({
  onNext,
  onBack,
  techPackData,
  hsCodeData,
  complianceData,
  initialDocuments,
}: GenerateStepProps) {
  const [documents, setDocuments] = useState<DocumentType[]>([
    {
      id: "pi",
      name: "Proforma Invoice",
      description: "Commercial proforma invoice with pricing and terms",
      icon: <FileText className="h-5 w-5" />,
      status: initialDocuments ? "ready" : "pending",
      data: initialDocuments?.purchaseOrder,
    },
    {
      id: "ci",
      name: "Commercial Invoice",
      description: "Final commercial invoice for customs clearance",
      icon: <FileText className="h-5 w-5" />,
      status: initialDocuments ? "ready" : "pending",
      data: initialDocuments?.commercialInvoice,
    },
    {
      id: "pl",
      name: "Packing List",
      description: "Detailed packing list with dimensions and weights",
      icon: <FileText className="h-5 w-5" />,
      status: initialDocuments ? "ready" : "pending",
      data: initialDocuments?.packingList,
    },
    {
      id: "bl",
      name: "Bill of Lading",
      description: "Shipping document for carrier and customs",
      icon: <Database className="h-5 w-5" />,
      status: initialDocuments ? "ready" : "pending",
      data: initialDocuments?.billOfLading,
    },
    {
      id: "compliance",
      name: "Compliance Certificate",
      description: "Factory compliance and certifications documentation",
      icon: <Building2 className="h-5 w-5" />,
      status: initialDocuments ? "ready" : "pending",
      data: initialDocuments?.complianceCertificate,
    },
  ]);

  const [generationProgress, setGenerationProgress] = useState(
    initialDocuments ? 100 : 0
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedDocuments, setGeneratedDocuments] =
    useState<DocumentGenerationResponse | null>(initialDocuments || null);

  // Template replacement state
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [selectedTemplateType, setSelectedTemplateType] = useState<string>("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [isReplacingTemplate, setIsReplacingTemplate] = useState(false);
  const [templateReplaceSuccess, setTemplateReplaceSuccess] = useState(false);

  // Load generated documents from localStorage on mount
  useEffect(() => {
    if (initialDocuments && !generatedDocuments) {
      setGeneratedDocuments(initialDocuments);
      updateDocumentsStatus(initialDocuments);
    }
  }, [initialDocuments]);

  const updateDocumentsStatus = (docs: DocumentGenerationResponse) => {
    setDocuments((prev) =>
      prev.map((doc) => ({
        ...doc,
        status: "ready" as const,
        data:
          doc.id === "pi"
            ? docs.purchaseOrder
            : doc.id === "ci"
            ? docs.commercialInvoice
            : doc.id === "pl"
            ? docs.packingList
            : doc.id === "bl"
            ? docs.billOfLading
            : doc.id === "compliance"
            ? docs.complianceCertificate
            : doc.data,
      }))
    );
    setGenerationProgress(100);
  };

  const generateAllDocuments = async () => {
    if (!techPackData || !hsCodeData || !complianceData) {
      setError("Missing required data. Please complete previous steps first.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGenerationProgress(0);

    // Reset all document statuses to pending
    setDocuments((prev) =>
      prev.map((doc) => ({ ...doc, status: "pending" as const }))
    );

    try {
      console.log("📄 Generating PDF documents progressively with AI...");

      // Progress callback for each document
      const handleProgress = (documentType: string, percentage: number) => {
        setGenerationProgress(percentage);

        // Map documentType to document ID
        const docIdMap: Record<string, string> = {
          purchaseOrder: "pi",
          commercialInvoice: "ci",
          packingList: "pl",
          billOfLading: "bl",
          complianceCertificate: "compliance",
        };

        const docId = docIdMap[documentType];

        // Update document status
        setDocuments((prev) =>
          prev.map((doc) => {
            if (doc.id === docId) {
              return { ...doc, status: "generating" as const };
            }
            // Mark previous documents as ready
            const docIndex = prev.findIndex((d) => d.id === docId);
            const currentIndex = prev.findIndex((d) => d.id === doc.id);
            if (currentIndex < docIndex) {
              return { ...doc, status: "ready" as const };
            }
            return doc;
          })
        );

        console.log(`📄 Generating ${documentType}... ${percentage}%`);
      };

      // Call API to generate PDF documents progressively
      const result = await api.generateDocumentsProgressively(
        {
          techPackData,
          hsCodeData,
          complianceData,
          orderDetails: {},
        },
        handleProgress,
        // Update state immediately as each document completes
        (partialPdfs, partialMetadata) => {
          console.log("🔄 Document completed, updating state...");
          console.log("   - Partial PDFs keys:", Object.keys(partialPdfs));

          const documentData: DocumentGenerationResponse = {
            purchaseOrder: partialMetadata.purchaseOrder || null,
            commercialInvoice: partialMetadata.commercialInvoice || null,
            packingList: partialMetadata.packingList || null,
            billOfLading: partialMetadata.billOfLading || null,
            complianceCertificate:
              partialMetadata.complianceCertificate || null,
            pdfs: partialPdfs as any,
          };

          setGeneratedDocuments(documentData);
        }
      );

      // Mark all documents as ready
      setDocuments((prev) =>
        prev.map((doc) => ({ ...doc, status: "ready" as const }))
      );

      // Convert response to proper format
      const documentData: DocumentGenerationResponse = {
        purchaseOrder: result.metadata.purchaseOrder,
        commercialInvoice: result.metadata.commercialInvoice,
        packingList: result.metadata.packingList,
        billOfLading: result.metadata.billOfLading,
        complianceCertificate: result.metadata.complianceCertificate,
        pdfs: result.pdfs,
      };

      setGeneratedDocuments(documentData);
      updateDocumentsStatus(documentData);

      // Save to localStorage (both metadata and PDFs)
      localStorageManager.saveGeneratedDocuments(documentData);

      console.log("✅ PDF documents generated successfully");
    } catch (error) {
      console.error("❌ Error generating PDF documents:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to generate PDF documents"
      );
      setGenerationProgress(0);
      // Reset all document statuses to pending on error
      setDocuments((prev) =>
        prev.map((doc) => ({ ...doc, status: "pending" as const }))
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadDocument = (docName: string, docData: any) => {
    // Map document names to keys
    type PdfDocumentKey =
      | "purchaseOrder"
      | "commercialInvoice"
      | "packingList"
      | "billOfLading"
      | "complianceCertificate";

    const docKeyMap: Record<string, PdfDocumentKey> = {
      "Proforma Invoice": "purchaseOrder",
      "Commercial Invoice": "commercialInvoice",
      "Packing List": "packingList",
      "Bill of Lading": "billOfLading",
      "Compliance Certificate": "complianceCertificate",
    };

    const docKey = docKeyMap[docName];
    const pdfBase64 = docKey && generatedDocuments?.pdfs?.[docKey];

    if (pdfBase64) {
      try {
        // Check if it's an array (byte array) or a string (base64)
        let base64String: string;

        if (Array.isArray(pdfBase64)) {
          // If it's an array of bytes, convert to base64
          const uint8Array = new Uint8Array(pdfBase64);
          base64String = btoa(String.fromCharCode(...uint8Array));
        } else if (typeof pdfBase64 === "string") {
          // If it's already a string, use it directly
          base64String = pdfBase64;
        } else {
          throw new Error("Invalid PDF data format");
        }

        // Download as PDF
        const byteCharacters = atob(base64String);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const pdfBlob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(pdfBlob);

        const element = document.createElement("a");
        element.setAttribute("href", url);
        element.setAttribute(
          "download",
          `${docName.toLowerCase().replace(/\s+/g, "_")}.pdf`
        );
        element.style.display = "none";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);

        URL.revokeObjectURL(url);
        console.log(`✅ Downloaded ${docName} successfully`);
      } catch (error) {
        console.error(`❌ Error downloading ${docName}:`, error);
        alert(
          `Failed to download ${docName}. Please try regenerating the documents.`
        );
      }
    } else {
      // Fallback: Download as JSON
      const dataStr = JSON.stringify(docData, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);

      const element = document.createElement("a");
      element.setAttribute("href", url);
      element.setAttribute(
        "download",
        `${docName.toLowerCase().replace(/\s+/g, "_")}.json`
      );
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      URL.revokeObjectURL(url);
    }
  };

  const handleNext = () => {
    if (generatedDocuments) {
      onNext(generatedDocuments);
    }
  };

  const handleTemplateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "application/pdf") {
        setTemplateFile(file);
        setTemplateReplaceSuccess(false);
      } else {
        setError("Please select a PDF file");
      }
    }
  };

  const handleReplaceTemplate = async () => {
    if (!templateFile || !selectedTemplateType) {
      setError("Please select a template type and file");
      return;
    }

    setIsReplacingTemplate(true);
    setError(null);

    try {
      const response = await api.replaceTemplate(
        selectedTemplateType,
        templateFile
      );

      if (response.success) {
        setTemplateReplaceSuccess(true);
        setTemplateFile(null);
        setTimeout(() => {
          setIsTemplateDialogOpen(false);
          setTemplateReplaceSuccess(false);
        }, 2000);
        console.log("✅ Template replaced successfully");
      } else {
        throw new Error(response.message || "Failed to replace template");
      }
    } catch (error) {
      console.error("❌ Error replacing template:", error);
      setError(
        error instanceof Error ? error.message : "Failed to replace template"
      );
    } finally {
      setIsReplacingTemplate(false);
    }
  };

  const templateTypeOptions = [
    { value: "pi", label: "Proforma Invoice" },
    { value: "ci", label: "Commercial Invoice" },
    { value: "pl", label: "Packing List" },
    { value: "bl", label: "Bill of Lading" },
    { value: "compliance", label: "Compliance Certificate" },
  ];

  const allDocumentsReady = documents.every((doc) => doc.status === "ready");
  const canGenerate = techPackData && hsCodeData && complianceData;

  return (
    <div className="space-y-6">
      <div>
        <h2>Step 5: Generate Documents</h2>
        <p className="text-muted-foreground">
          Create export documentation and compliance files using AI
        </p>
      </div>

      {!canGenerate && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-orange-500" />
              <div>
                <h3 className="text-orange-800">Missing Required Data</h3>
                <p className="text-sm text-orange-600">
                  Please complete Upload, Tech Pack, HS Code, and Compliance
                  steps before generating documents.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <div>
                <h3 className="text-red-800">Generation Error</h3>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 mb-6">
        <Button
          onClick={generateAllDocuments}
          disabled={isGenerating || !canGenerate}
          className="flex-1"
        >
          {isGenerating ? "Generating..." : "Generate All Documents"}
        </Button>

        <Dialog
          open={isTemplateDialogOpen}
          onOpenChange={setIsTemplateDialogOpen}
        >
          <DialogTrigger asChild>
            <Button variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Replace Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Replace Document Template</DialogTitle>
              <DialogDescription>
                Upload a new PDF template to use as an example for AI document
                generation
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="templateType">Template Type</Label>
                <select
                  id="templateType"
                  name="templateType"
                  aria-label="Select template type"
                  value={selectedTemplateType}
                  onChange={(e) => setSelectedTemplateType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select a template type...</option>
                  {templateTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateFile">PDF Template File</Label>
                <Input
                  id="templateFile"
                  type="file"
                  accept="application/pdf"
                  onChange={handleTemplateFileChange}
                />
                {templateFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {templateFile.name}
                  </p>
                )}
              </div>

              {templateReplaceSuccess && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-md">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">
                    Template replaced successfully!
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleReplaceTemplate}
                  disabled={
                    !templateFile ||
                    !selectedTemplateType ||
                    isReplacingTemplate
                  }
                  className="flex-1"
                >
                  {isReplacingTemplate ? "Uploading..." : "Replace Template"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsTemplateDialogOpen(false);
                    setTemplateFile(null);
                    setSelectedTemplateType("");
                    setTemplateReplaceSuccess(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isGenerating && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Generating documents with AI...</span>
                <span>{Math.round(generationProgress)}%</span>
              </div>
              <Progress value={generationProgress} />
              <p className="text-xs text-muted-foreground mt-2">
                AI is analyzing your data and generating export documents based
                on international trade standards...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {documents.map((doc) => (
          <Card key={doc.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">{doc.icon}</div>
                  <div>
                    <h3 className="font-medium">{doc.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {doc.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {doc.status === "pending" && (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                  {doc.status === "generating" && (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <Badge variant="secondary">Generating</Badge>
                    </div>
                  )}
                  {doc.status === "ready" && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700"
                      >
                        Ready
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadDocument(doc.name, doc.data)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {allDocumentsReady && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <div>
                <h3 className="text-green-800">All Documents Generated</h3>
                <p className="text-sm text-green-600">
                  Your export documentation package is ready for review and
                  submission
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!allDocumentsReady}
          className="flex-1"
        >
          Continue to Review
        </Button>
      </div>
    </div>
  );
}
