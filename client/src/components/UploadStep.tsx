import React, { useState, ChangeEvent, DragEvent } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Upload, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import type { TechPackSummary } from "../types";

interface UploadStepProps {
  onNext: (summary: TechPackSummary) => void;
}

export function UploadStep({ onNext }: UploadStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<TechPackSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      processFile(uploadedFile);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      processFile(droppedFile);
    }
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null); // Clear any previous errors
    setSummary(null); // Clear any previous summary

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("techpack", file);

      // Send file to backend
      const response = await fetch(
        "http://localhost:3001/api/techpack/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Handle user-facing errors (400) differently from server errors (500)
        const errorMessage =
          data.message || data.error || "Failed to process file";
        throw new Error(errorMessage);
      }

      if (data.success && data.data.techPackSummary) {
        setSummary(data.data.techPackSummary);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Error processing file:", error);
      setError(
        error instanceof Error ? error.message : "Failed to process file"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNext = () => {
    if (summary) {
      onNext(summary);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2>Step 1: Upload Tech Pack</h2>
        <p className="text-muted-foreground">
          Drop your tech pack for instant parsing and analysis
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Tech Pack Upload
          </CardTitle>
          <CardDescription>
            Upload your tech pack file for automatic parsing and material
            analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xlsx,.xls"
              onChange={handleFileUpload}
            />

            {!file ? (
              <div className="space-y-4">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p>Drop your tech pack here or click to browse</p>
                  <p className="text-sm text-muted-foreground">
                    Supports PDF, DOC, DOCX, XLS, XLSX
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <FileText className="h-12 w-12 mx-auto text-primary" />
                <div>
                  <p className="text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isProcessing && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span>Processing tech pack...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Processing Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="mb-4">
              <label className="text-sm text-muted-foreground">
                Error Message
              </label>
              <p className="mt-1 text-sm">{error}</p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setError(null);
                if (file) {
                  processFile(file);
                }
              }}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Parse Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">
                  Material
                </label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {summary.materialPercentage.map((item, idx) => (
                    <Badge key={idx} variant="secondary">
                      {item.material} {item.percentage}%
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">
                  Fabric Type
                </label>
                <div className="mt-1">
                  <Badge variant="outline">{summary.fabricType}</Badge>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">
                  Garment Type
                </label>
                <div className="mt-1">
                  <Badge variant="outline">{summary.garmentType}</Badge>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Gender</label>
                <div className="mt-1">
                  <Badge variant="outline">{summary.gender}</Badge>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-sm text-muted-foreground">
                Description
              </label>
              <p className="mt-1 text-sm">{summary.description}</p>
            </div>

            <Button onClick={handleNext} className="w-full">
              Continue to HS Code Suggestions
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
