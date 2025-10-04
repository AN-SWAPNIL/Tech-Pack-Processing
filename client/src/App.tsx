import React, { useState, useEffect } from "react";
import { StepNavigation } from "./components/StepNavigation";
import { UploadStep } from "./components/UploadStep";
import { TechPackStep } from "./components/TechPackStep";
import { HSCodeStep } from "./components/HSCodeStep";
import { ComplianceStep } from "./components/ComplianceStep";
import { GenerateStep } from "./components/GenerateStep";
import { ReviewStep } from "./components/ReviewStep";
import { Button } from "./components/ui/button";
import { Trash2 } from "lucide-react";
import { localStorageManager } from "./utils/localStorage";
import type {
  TechPackSummary,
  HSCodeSuggestion,
  ComplianceData,
} from "./types";

export default function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [techPackData, setTechPackData] = useState<TechPackSummary | null>(
    null
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [hsCodeData, setHSCodeData] = useState<HSCodeSuggestion | null>(null);
  const [complianceData, setComplianceData] = useState<ComplianceData | null>(
    null
  );
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data from localStorage on component mount
  useEffect(() => {
    const storedData = localStorageManager.loadStoredData();

    // Restore file from localStorage if available
    if (storedData.fileInfo) {
      // Try to recreate file if we have the data
      if (storedData.fileInfo.dataUrl) {
        localStorageManager.createFileFromStoredInfo(storedData.fileInfo)
          .then(recreatedFile => {
            if (recreatedFile) {
              setUploadedFile(recreatedFile);
            }
          })
          .catch(error => {
            console.warn("Could not recreate file from stored data:", error);
          });
      }
      setCompletedSteps((prev) => (prev.includes(1) ? prev : [...prev, 1]));
    }

    if (storedData.techPackData) {
      setTechPackData(storedData.techPackData);
      setCompletedSteps((prev) => (prev.includes(2) ? prev : [...prev, 2]));
    }

    if (storedData.hsCodeData) {
      setHSCodeData(storedData.hsCodeData);
      setCompletedSteps((prev) => (prev.includes(3) ? prev : [...prev, 3]));
    }

    if (storedData.complianceData) {
      setComplianceData(storedData.complianceData);
      setCompletedSteps((prev) => (prev.includes(4) ? prev : [...prev, 4]));
    }

    // Set current step based on what data we have
    let targetStep = 1;
    if (storedData.complianceData) {
      targetStep = 4; // Go to generate step
    } else if (storedData.hsCodeData) {
      targetStep = 3; // Go to compliance step
    } else if (storedData.techPackData) {
      targetStep = 2; // Go to tech pack step
    }

    if (targetStep > 1) {
      setCurrentStep(targetStep);
    }

    setIsLoaded(true);
  }, []);

  // Save app state to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      localStorageManager.saveAppState(completedSteps, currentStep);
    }
  }, [completedSteps, currentStep, isLoaded]);

  const handleStepComplete = (step: number) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step]);
    }
  };

  const handleStepNavigation = (step: number) => {
    // Only allow navigation to completed steps or next step
    if (
      completedSteps.includes(step) ||
      step === Math.max(...completedSteps, 0) + 1
    ) {
      setCurrentStep(step);
    }
  };

  const handleUploadNext = async (file?: File) => {
    setUploadedFile(file || null);
    await localStorageManager.saveFileInfo(file!);
    handleStepComplete(1);
    setCurrentStep(2);
  };

  const handleTechPackNext = (techPackData: TechPackSummary) => {
    setTechPackData(techPackData);
    localStorageManager.saveTechPackData(techPackData);
    handleStepComplete(2);
    setCurrentStep(3);
  };

  const handleHSCodeNext = (selectedCode: HSCodeSuggestion) => {
    setHSCodeData(selectedCode);
    localStorageManager.saveHSCodeData(selectedCode);
    handleStepComplete(3);
    setCurrentStep(4);
  };

  const handleComplianceNext = (data: ComplianceData) => {
    setComplianceData(data);
    localStorageManager.saveComplianceData(data);
    handleStepComplete(4);
    setCurrentStep(5);
  };

  const handleGenerateNext = () => {
    handleStepComplete(5);
    setCurrentStep(6);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClearData = () => {
    localStorageManager.clearAllData();
    setTechPackData(null);
    setUploadedFile(null);
    setHSCodeData(null);
    setComplianceData(null);
    setCompletedSteps([]);
    setCurrentStep(1);
  };

  // Show loading state while data is being loaded from localStorage
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary rounded-lg">
              <div className="w-6 h-6 bg-primary-foreground rounded-sm"></div>
            </div>
            <div className="flex-1">
              <h1>Factory & Buying-House Export System</h1>
              <p className="text-muted-foreground">
                Trade compliance and documentation platform for Bangladesh
                exports
              </p>
            </div>

            {(techPackData ||
              hsCodeData ||
              complianceData ||
              completedSteps.length > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearData}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Session
              </Button>
            )}
          </div>
        </div>
      </header>

      <StepNavigation
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepNavigation}
      />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {currentStep === 1 && (
          <UploadStep
            onNext={handleUploadNext}
            initialData={techPackData}
            uploadedFile={uploadedFile}
            onClearData={handleClearData}
          />
        )}

        {currentStep === 2 && (
          <TechPackStep
            onNext={handleTechPackNext}
            onBack={handleBack}
            techPackData={techPackData}
            uploadedFile={uploadedFile}
          />
        )}

        {currentStep === 3 && (
          <HSCodeStep
            onNext={handleHSCodeNext}
            onBack={handleBack}
            techPackData={techPackData}
          />
        )}

        {currentStep === 4 && (
          <ComplianceStep onNext={handleComplianceNext} onBack={handleBack} />
        )}

        {currentStep === 5 && (
          <GenerateStep onNext={handleGenerateNext} onBack={handleBack} />
        )}

        {currentStep === 6 && (
          <ReviewStep
            onBack={handleBack}
            onEdit={(step) => setCurrentStep(step)}
          />
        )}
      </main>

      <footer className="border-t bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Bangladesh Customs Integration</span>
              <span>•</span>
              <span>BKMEA Certified</span>
              <span>•</span>
              <span>ASYCUDA Compatible</span>
            </div>
            <div>Export Documentation System v2.1</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
