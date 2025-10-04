import React from "react";
import { CheckCircle, Circle } from "lucide-react";
import { cn } from "./ui/utils";

interface Step {
  id: number;
  title: string;
  description: string;
}

interface StepNavigationProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
}

export function StepNavigation({
  currentStep,
  completedSteps,
  onStepClick,
}: StepNavigationProps) {
  const steps: Step[] = [
    { id: 1, title: "Upload", description: "Tech Pack Analysis" },
    { id: 2, title: "Tech Pack", description: "Product Details" },
    { id: 3, title: "HS Codes", description: "Classification" },
    { id: 4, title: "Compliance", description: "Requirements" },
    { id: 5, title: "Generate", description: "Documents" },
    { id: 6, title: "Review", description: "Lock & Finalize" },
  ];

  return (
    <div className="w-full bg-card border-b">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => onStepClick(step.id)}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-colors",
                  "hover:bg-muted/50",
                  currentStep === step.id && "bg-primary/10",
                  completedSteps.includes(step.id) &&
                    currentStep !== step.id &&
                    "bg-green-50"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                    currentStep === step.id &&
                      "border-primary bg-primary text-primary-foreground",
                    completedSteps.includes(step.id) &&
                      currentStep !== step.id &&
                      "border-green-500 bg-green-500 text-white",
                    currentStep < step.id &&
                      !completedSteps.includes(step.id) &&
                      "border-muted bg-background text-muted-foreground"
                  )}
                >
                  {completedSteps.includes(step.id) &&
                  currentStep !== step.id ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <span className="text-sm">{step.id}</span>
                  )}
                </div>

                <div className="text-left">
                  <div
                    className={cn(
                      "text-sm transition-colors",
                      currentStep === step.id && "text-primary",
                      completedSteps.includes(step.id) &&
                        currentStep !== step.id &&
                        "text-green-700",
                      currentStep < step.id &&
                        !completedSteps.includes(step.id) &&
                        "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {step.description}
                  </div>
                </div>
              </button>

              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-12 h-0.5 mx-2 transition-colors",
                    completedSteps.includes(step.id)
                      ? "bg-green-500"
                      : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
