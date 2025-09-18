import React, { useState } from "react";
import { StepNavigation } from "./components/StepNavigation";
import { UploadStep } from "./components/UploadStep";
import { HSCodeStep } from "./components/HSCodeStep";
import { ComplianceStep } from "./components/ComplianceStep";
import { GenerateStep } from "./components/GenerateStep";
import { ReviewStep } from "./components/ReviewStep";

interface TechPackSummary {
  materialPercentage: { material: string; percentage: number }[];
  fabricType: "knit" | "woven";
  garmentType: string;
  gender: string;
}

interface HSCodeSuggestion {
  code: string;
  description: string;
  confidence: number;
  rationale: string[];
}

interface ComplianceData {
  destination: string;
  office: string;
  port: string;
  udLcNumber?: string;
  btbLcNumber?: string;
}

export default function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [techPackData, setTechPackData] = useState<TechPackSummary | null>(
    null
  );
  const [hsCodeData, setHSCodeData] = useState<HSCodeSuggestion | null>(null);
  const [complianceData, setComplianceData] = useState<ComplianceData | null>(
    null
  );

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

  const handleUploadNext = (summary: TechPackSummary) => {
    setTechPackData(summary);
    handleStepComplete(1);
    setCurrentStep(2);
  };

  const handleHSCodeNext = (selectedCode: HSCodeSuggestion) => {
    setHSCodeData(selectedCode);
    handleStepComplete(2);
    setCurrentStep(3);
  };

  const handleComplianceNext = (data: ComplianceData) => {
    setComplianceData(data);
    handleStepComplete(3);
    setCurrentStep(4);
  };

  const handleGenerateNext = () => {
    handleStepComplete(4);
    setCurrentStep(5);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary rounded-lg">
              <div className="w-6 h-6 bg-primary-foreground rounded-sm"></div>
            </div>
            <div>
              <h1>Factory & Buying-House Export System</h1>
              <p className="text-muted-foreground">
                Trade compliance and documentation platform for Bangladesh
                exports
              </p>
            </div>
          </div>
        </div>
      </header>

      <StepNavigation
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepNavigation}
      />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {currentStep === 1 && <UploadStep onNext={handleUploadNext} />}

        {currentStep === 2 && (
          <HSCodeStep onNext={handleHSCodeNext} onBack={handleBack} />
        )}

        {currentStep === 3 && (
          <ComplianceStep onNext={handleComplianceNext} onBack={handleBack} />
        )}

        {currentStep === 4 && (
          <GenerateStep onNext={handleGenerateNext} onBack={handleBack} />
        )}

        {currentStep === 5 && (
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
