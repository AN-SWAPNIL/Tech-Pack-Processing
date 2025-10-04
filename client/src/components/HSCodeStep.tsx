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
import {
  CheckCircle,
  Info,
  Loader2,
  ExternalLink,
  FileText,
} from "lucide-react";
import { localStorageManager } from "../utils/localStorage";
import type {
  HSCodeSuggestion,
  TechPackSummary,
  HSCodeClassificationResponse,
} from "../types";
import api, { ApiError } from "../services/api";

interface HSCodeStepProps {
  onNext: (selectedCode: HSCodeSuggestion) => void;
  onBack: () => void;
  techPackData: TechPackSummary | null;
}

export function HSCodeStep({ onNext, onBack, techPackData }: HSCodeStepProps) {
  const [selectedCode, setSelectedCode] = useState<HSCodeSuggestion | null>(
    null
  );
  const [suggestions, setSuggestions] = useState<HSCodeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromStorage, setIsFromStorage] = useState(false);

  // Load stored HS code data on mount
  useEffect(() => {
    const storedData = localStorageManager.loadStoredData();
    if (
      storedData.hsCodeSuggestions &&
      storedData.hsCodeSuggestions.length > 0
    ) {
      console.log(
        `🔄 Restoring ${storedData.hsCodeSuggestions.length} HS code suggestions from localStorage`
      );
      setSuggestions(storedData.hsCodeSuggestions);
      setIsFromStorage(true);

      // If there's also a selected code, restore it
      if (storedData.hsCodeData) {
        console.log(
          `🔄 Restoring selected HS code: ${storedData.hsCodeData.code}`
        );
        setSelectedCode(storedData.hsCodeData);
      } else {
        // Auto-select the first suggestion if nothing was previously selected
        console.log(`✅ Auto-selecting first HS code suggestion`);
        setSelectedCode(storedData.hsCodeSuggestions[0]);
        localStorageManager.saveHSCodeData(storedData.hsCodeSuggestions[0]);
      }
    } else {
      console.log(
        `🆕 No stored HS code suggestions found, will generate fresh ones`
      );
      setIsFromStorage(false);
      // Generate fresh suggestions immediately if we have techPackData
      if (techPackData) {
        console.log(`🚀 Generating fresh HS code suggestions...`);
        generateHSCodeSuggestions();
      }
    }
  }, []); // Remove techPackData dependency - only run once on mount

  const generateHSCodeSuggestions = async () => {
    if (!techPackData) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.getHSCodeSuggestions(techPackData);

      if (!response.success) {
        throw new Error(
          response.message || "Failed to generate HS code suggestions"
        );
      }

      const generatedSuggestions = response.data?.hsCodeSuggestions || [];
      setSuggestions(generatedSuggestions);

      // Save suggestions to localStorage and auto-select the first one
      if (generatedSuggestions.length > 0) {
        localStorageManager.saveHSCodeSuggestions(generatedSuggestions);

        // Auto-select the first suggestion
        console.log(
          `✅ Auto-selecting first HS code: ${generatedSuggestions[0].code}`
        );
        setSelectedCode(generatedSuggestions[0]);
        localStorageManager.saveHSCodeData(generatedSuggestions[0]);
      }
    } catch (err) {
      console.error("Error generating HS code suggestions:", err);

      if (err instanceof ApiError) {
        setError(`API Error (${err.status}): ${err.message}`);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to generate HS code suggestions"
        );
      }

      // Fallback to mock data if API fails
      setSuggestions([
        {
          code: "62052000",
          description: "Men's cotton shirts (woven)",
          confidence: 0.92,
          rationale: ["woven", "men's", "100% cotton"],
          tariffInfo: {
            CD: 25.0,
            SD: 4.0,
            VAT: 15.0,
            AIT: 5.0,
            AT: 2.0,
            RD: 0.0,
            TTI: 1.0,
          },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (suggestion: HSCodeSuggestion) => {
    setSelectedCode(suggestion);
    localStorageManager.saveHSCodeData(suggestion);
  };

  const handleNext = () => {
    if (selectedCode) {
      onNext(selectedCode);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Step 3: HS Code Suggestions</h2>
          <p className="text-muted-foreground">
            Select the most appropriate HS code for your product
          </p>
        </div>{" "}
        {isFromStorage && !isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            HS code restored
          </div>
        )}
      </div>

      {error && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-800">
              <Info className="w-4 h-4" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <p>Generating HS code suggestions...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.isArray(suggestions) && suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <Card
                key={suggestion.code}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedCode?.code === suggestion.code
                    ? "ring-2 ring-primary"
                    : ""
                }`}
                onClick={() => handleSelect(suggestion)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <h3 className="text-lg font-semibold">
                          HS {suggestion.code}
                        </h3>
                        {selectedCode?.code === suggestion.code && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        {/* Source Badge */}
                        <Badge
                          variant={
                            suggestion.source === "nbr"
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {suggestion.source === "nbr"
                            ? `NBR ${suggestion.year || "2025-2026"}`
                            : suggestion.source === "customs"
                            ? "Customs.gov.bd"
                            : "Mixed Sources"}
                        </Badge>

                        {/* NBR Chapter and PDF Link */}
                        {suggestion.source === "nbr" && suggestion.chapter && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            <span className="text-muted-foreground text-sm">
                              {suggestion.chapter}
                            </span>
                          </div>
                        )}

                        {suggestion.source === "nbr" && suggestion.pdfLink && (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={suggestion.pdfLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2"
                              onClick={(e: React.MouseEvent) =>
                                e.stopPropagation()
                              }
                            >
                              <ExternalLink className="h-4 w-4" />
                              View NBR PDF
                            </a>
                          </Button>
                        )}
                      </div>
                      <p className="text-muted-foreground mb-3">
                        {suggestion.description}
                      </p>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">Confidence</span>
                        <Progress
                          value={suggestion.confidence * 100}
                          className="w-24"
                        />
                        <span className="text-sm">
                          {(suggestion.confidence * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {suggestion.rationale.map((reason, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-xs"
                          >
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <p>
                    No HS code suggestions available. Please check your tech
                    pack data and try again.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selectedCode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              NBR Tariff Information
            </CardTitle>
            <CardDescription>
              Bangladesh Customs tariff breakdown for HS {selectedCode.code}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Source Information */}
            {/* {selectedCode.source && (
              <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                <div className="text-sm font-medium">Data Source</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge
                    variant={
                      selectedCode.source === "nbr" ? "default" : "secondary"
                    }
                  >
                    {selectedCode.source === "nbr"
                      ? `NBR ${selectedCode.year || "2025-2026"}`
                      : selectedCode.source === "customs"
                      ? "Customs.gov.bd"
                      : "Mixed Sources"}
                  </Badge>
                  {selectedCode.chapter && (
                    <span>• {selectedCode.chapter}</span>
                  )}
                  {selectedCode.pdfLink && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="ml-2"
                    >
                      <a
                        href={selectedCode.pdfLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Source PDF
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )} */}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">CD</div>
                <div>{selectedCode.tariffInfo?.CD || 0}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">SD</div>
                <div>{selectedCode.tariffInfo?.SD || 0}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">VAT</div>
                <div>{selectedCode.tariffInfo?.VAT || 0}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">AIT</div>
                <div>{selectedCode.tariffInfo?.AIT || 0}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">AT</div>
                <div>{selectedCode.tariffInfo?.AT || 0}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">RD</div>
                <div>{selectedCode.tariffInfo?.RD || 0}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">TTI</div>
                <div>{selectedCode.tariffInfo?.TTI || 0}%</div>
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
          disabled={!selectedCode}
          className="flex-1"
        >
          Continue to Compliance Check
        </Button>
      </div>
    </div>
  );
}
