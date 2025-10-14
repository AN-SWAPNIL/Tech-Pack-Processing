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
import { Separator } from "./ui/separator";
import {
  Lock,
  CheckCircle,
  Edit,
  FileText,
  AlertTriangle,
  Download,
  Unlock,
} from "lucide-react";
import type {
  TechPackSummary,
  HSCodeSuggestion,
  ComplianceData,
  DocumentGenerationResponse,
} from "../types";

interface ReviewStepProps {
  onBack: () => void;
  onEdit: (step: number) => void;
  onLock?: () => void;
  techPackData: TechPackSummary | null;
  hsCodeData: HSCodeSuggestion | null;
  complianceData: ComplianceData | null;
  generatedDocuments: DocumentGenerationResponse | null;
  initialLocked?: boolean;
}

export function ReviewStep({
  onBack,
  onEdit,
  onLock,
  techPackData,
  hsCodeData,
  complianceData,
  generatedDocuments,
  initialLocked = false,
}: ReviewStepProps) {
  const [isLocked, setIsLocked] = useState(initialLocked);

  // Update locked state when initialLocked prop changes
  useEffect(() => {
    setIsLocked(initialLocked);
  }, [initialLocked]);

  const handleLock = () => {
    setIsLocked(true);
    if (onLock) {
      onLock();
    }
  };

  const handleUnlock = () => {
    setIsLocked(false);
  };

  const downloadDocument = (docName: string, pdfBase64: string) => {
    const byteCharacters = atob(pdfBase64);
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
  };

  const downloadAllDocuments = () => {
    if (!generatedDocuments?.pdfs) return;

    const docNames = [
      { key: "purchaseOrder" as const, name: "Proforma Invoice" },
      { key: "commercialInvoice" as const, name: "Commercial Invoice" },
      { key: "packingList" as const, name: "Packing List" },
      { key: "billOfLading" as const, name: "Bill of Lading" },
      { key: "complianceCertificate" as const, name: "Compliance Certificate" },
    ];

    docNames.forEach((doc) => {
      const pdfBase64 = generatedDocuments.pdfs![doc.key];
      if (pdfBase64) {
        setTimeout(() => downloadDocument(doc.name, pdfBase64), 300);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Step 6: Review & Finalize</h2>
          <p className="text-muted-foreground">
            Review all your export documentation and download final documents
          </p>
        </div>

        {isLocked ? (
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            <Lock className="h-4 w-4 mr-1" />
            Locked
          </Badge>
        ) : (
          <Badge variant="outline">
            <Edit className="h-4 w-4 mr-1" />
            Editable
          </Badge>
        )}
      </div>

      {!techPackData &&
        !hsCodeData &&
        !complianceData &&
        !generatedDocuments && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
                <div>
                  <h3 className="text-orange-800">No Data Available</h3>
                  <p className="text-sm text-orange-600">
                    Please complete all previous steps before reviewing.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      <div className="grid gap-6">
        {/* Tech Pack Summary */}
        {techPackData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Tech Pack Summary
                </CardTitle>
                {!isLocked && (
                  <Button variant="ghost" size="sm" onClick={() => onEdit(2)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="mb-4">
                <label className="text-sm text-muted-foreground">
                  Description
                </label>
                <p className="text-sm">{techPackData.description || "N/A"}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">
                    Material
                  </label>
                  <p className="text-sm">
                    {techPackData.materialPercentage?.length > 0
                      ? techPackData.materialPercentage
                          .map((m) => `${m.percentage}% ${m.material}`)
                          .join(", ")
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Fabric Type
                  </label>
                  <p className="text-sm">{techPackData.fabricType || "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Garment Type
                  </label>
                  <p className="text-sm">{techPackData.garmentType || "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Gender
                  </label>
                  <p className="text-sm">{techPackData.gender || "N/A"}</p>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">GSM</label>
                  <p className="text-sm">{techPackData.gsm || "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Country of Origin
                  </label>
                  <p className="text-sm">
                    {techPackData.countryOfOrigin || "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* HS Code Classification */}
        {hsCodeData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>HS Code Classification</CardTitle>
                {!isLocked && (
                  <Button variant="ghost" size="sm" onClick={() => onEdit(3)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <h3 className="text-lg">HS {hsCodeData.code}</h3>
                </div>
                <div className="flex-1">
                  <p className="text-sm">{hsCodeData.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">
                      {(hsCodeData.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Compliance Configuration */}
        {complianceData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Compliance Configuration</CardTitle>
                {!isLocked && (
                  <Button variant="ghost" size="sm" onClick={() => onEdit(4)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">
                    Destination
                  </label>
                  <p className="text-sm">
                    {complianceData.destination || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Customs Office
                  </label>
                  <p className="text-sm">{complianceData.office || "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Export Port
                  </label>
                  <p className="text-sm">{complianceData.port || "N/A"}</p>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">
                    Cost (USD)
                  </label>
                  <p className="text-sm">
                    ${complianceData.costUsd?.toLocaleString() || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Quantity
                  </label>
                  <p className="text-sm">
                    {complianceData.quantity?.toLocaleString() || "N/A"} units
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generated Documents */}
        {generatedDocuments && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Generated Documents</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadAllDocuments}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { key: "purchaseOrder" as const, name: "Proforma Invoice" },
                  {
                    key: "commercialInvoice" as const,
                    name: "Commercial Invoice",
                  },
                  { key: "packingList" as const, name: "Packing List" },
                  { key: "billOfLading" as const, name: "Bill of Lading" },
                  {
                    key: "complianceCertificate" as const,
                    name: "Compliance Certificate",
                  },
                ].map((doc) => (
                  <div
                    key={doc.key}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {generatedDocuments.pdfs?.[doc.key]
                            ? "PDF Generated"
                            : "JSON Data"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const pdfBase64 = generatedDocuments.pdfs?.[doc.key];
                        if (pdfBase64) {
                          downloadDocument(doc.name, pdfBase64);
                        }
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!isLocked &&
          techPackData &&
          hsCodeData &&
          complianceData &&
          generatedDocuments && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <h3 className="text-orange-800">Ready to Lock</h3>
                    <p className="text-sm text-orange-600 mt-1">
                      Once locked, you won't be able to edit the configuration
                      or regenerate documents. Make sure all information is
                      correct before proceeding.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
      </div>

      <Separator />

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={isLocked}>
          Back
        </Button>

        {!isLocked ? (
          <Button
            onClick={handleLock}
            className="flex-1"
            disabled={
              !techPackData ||
              !hsCodeData ||
              !complianceData ||
              !generatedDocuments
            }
          >
            <Lock className="h-4 w-4 mr-2" />
            Lock Configuration
          </Button>
        ) : (
          <Button onClick={handleUnlock} variant="outline" className="flex-1">
            <Unlock className="h-4 w-4 mr-2" />
            Unlock to Edit
          </Button>
        )}
      </div>
    </div>
  );
}
