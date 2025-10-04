import React, { useState, useEffect, ChangeEvent, DragEvent } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { localStorageManager } from "../utils/localStorage";
import type { TechPackSummary, TechPackUploadResponse } from "../types";
import api, { ApiError } from "../services/api";

interface UploadStepProps {
  onNext: (file?: File) => Promise<void>;
  initialData?: TechPackSummary | null;
  uploadedFile?: File | null;
  onClearData?: () => void;
}

export function UploadStep({
  onNext,
  initialData,
  uploadedFile: uploadedFileProp,
  onClearData,
}: UploadStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromStorage, setIsFromStorage] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);

  // Load file info from localStorage on component mount or use prop
  useEffect(() => {
    // If uploadedFile is provided as prop, use it
    if (uploadedFileProp) {
      setFile(uploadedFileProp);
      setFileInfo({
        name: uploadedFileProp.name,
        size: uploadedFileProp.size,
        type: uploadedFileProp.type,
      });
      setIsUploaded(true);
      setIsFromStorage(true);
      return;
    }

    // Otherwise, try to load from localStorage
    const loadStoredFile = async () => {
      const storedData = localStorageManager.loadStoredData();

      // Load file if it exists (even if techPackData doesn't exist yet)
      if (storedData.fileInfo) {
        console.log("📂 Found file info in localStorage:", storedData.fileInfo);
        setIsFromStorage(true);
        setIsUploaded(true); // Mark as uploaded if we have file info from storage

        // Store file info for display
        setFileInfo({
          name: storedData.fileInfo.name,
          size: storedData.fileInfo.size,
          type: storedData.fileInfo.type,
        });

        // Try to recreate file if we have the data
        if (storedData.fileInfo.dataUrl) {
          try {
            const recreatedFile =
              await localStorageManager.createFileFromStoredInfo(
                storedData.fileInfo
              );
            if (recreatedFile) {
              setFile(recreatedFile);
              console.log("✅ File object recreated from localStorage");
            }
          } catch (error) {
            console.warn("Could not recreate file from stored data:", error);
          }
        } else {
          console.log("⚠️ No dataUrl found - file info only (no File object)");
        }
      }
    };

    loadStoredFile();
  }, [uploadedFileProp]);

  // Update state when initialData changes
  useEffect(() => {
    if (initialData) {
      setIsFromStorage(true);
      setIsUploaded(true); // Mark as uploaded if we have data from storage
    }
  }, [initialData]);

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
    // Just validate file - don't process with backend yet
    setIsProcessing(true);
    setError(null);
    setIsFromStorage(false);

    try {
      // Basic file validation
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      if (file.size > maxSize) {
        throw new Error("File size exceeds 10MB limit");
      }

      if (!allowedTypes.includes(file.type)) {
        throw new Error(
          "Invalid file type. Please upload PDF, DOC, DOCX, XLS, or XLSX files"
        );
      }

      // File is valid - save file info to localStorage
      setIsUploaded(true);
      setFileInfo({
        name: file.name,
        size: file.size,
        type: file.type,
      });

      console.log("✅ File validated successfully");
    } catch (error) {
      console.error("Error validating file:", error);
      setError(
        error instanceof Error ? error.message : "Failed to validate file"
      );
      setIsUploaded(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNext = async () => {
    // Pass file if we have it, or allow proceeding with just fileInfo
    if ((file || fileInfo) && isUploaded) {
      // Pass the file to next step if available
      // TechPackStep will process it and get the data
      await onNext(file || undefined);
    }
  }; // const handleReupload = () => {
  //   setFile(null);
  //   setSummary(null);
  //   setError(null);
  //   setIsFromStorage(false);
  // };

  // const handleClearData = () => {
  //   if (onClearData) {
  //     onClearData();
  //   }
  //   handleReupload();
  // };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Step 1: Upload Tech Pack</h2>
          <p className="text-muted-foreground">
            Upload your tech pack file for processing and analysis
          </p>
        </div>

        {isFromStorage && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Session restored
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Tech Pack Upload
          </CardTitle>
          <CardDescription>
            Upload your tech pack file for automatic parsing and analysis
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

            {!file && !fileInfo ? (
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
                  <p className="text-sm">{fileInfo?.name || file?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(
                      (fileInfo?.size || file?.size || 0) /
                      1024 /
                      1024
                    ).toFixed(1)}{" "}
                    MB
                  </p>
                </div>
                {isUploaded && (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">File processed successfully</span>
                  </div>
                )}
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

      {/* File Information Card - shown after successful upload */}
      {isUploaded && (file || fileInfo) && !isProcessing && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              File Uploaded Successfully
            </CardTitle>
            <CardDescription>
              Your tech pack has been processed and is ready for review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">File Name</p>
                <p className="text-sm font-medium">
                  {fileInfo?.name || file?.name}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">File Size</p>
                <p className="text-sm font-medium">
                  {((fileInfo?.size || file?.size || 0) / 1024).toFixed(1)} KB
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">File Type</p>
                <p className="text-sm font-medium">
                  {fileInfo?.type ||
                    file?.type ||
                    (fileInfo?.name || file?.name)
                      ?.split(".")
                      .pop()
                      ?.toUpperCase() ||
                    "Unknown"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="default" className="bg-green-600">
                  Processed
                </Badge>
              </div>
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

      {/* Show continue button when file is uploaded successfully, or skip button when no file */}
      {isUploaded ? (
        <div className="flex gap-3">
          <Button onClick={async () => await handleNext()} className="w-full">
            Continue to Tech Pack Details
          </Button>
        </div>
      ) : (
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={async () => await onNext()}
            className="w-full"
          >
            Skip Upload - Enter Details Manually
          </Button>
        </div>
      )}
    </div>
  );
}
