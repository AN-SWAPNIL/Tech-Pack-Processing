import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { CheckCircle, Info } from 'lucide-react';

interface HSCodeSuggestion {
  code: string;
  description: string;
  confidence: number;
  rationale: string[];
}

interface TariffInfo {
  CD: number;
  SD: number;
  VAT: number;
  AIT: number;
  AT: number;
  RD: number;
  TTI: number;
}

interface HSCodeStepProps {
  onNext: (selectedCode: HSCodeSuggestion) => void;
  onBack: () => void;
}

export function HSCodeStep({ onNext, onBack }: HSCodeStepProps) {
  const [selectedCode, setSelectedCode] = useState<HSCodeSuggestion | null>(null);

  const suggestions: HSCodeSuggestion[] = [
    {
      code: '62052000',
      description: 'Men\'s cotton shirts (woven)',
      confidence: 0.92,
      rationale: ['woven', 'men\'s', '100% cotton']
    },
    {
      code: '62053000',
      description: 'Men\'s shirts of man-made fibres',
      confidence: 0.41,
      rationale: ['woven', 'men\'s', 'synthetic fibers']
    },
    {
      code: '62052010',
      description: 'Men\'s cotton shirts, knitted',
      confidence: 0.23,
      rationale: ['men\'s', '100% cotton', 'knit construction']
    }
  ];

  const tariffInfo: TariffInfo = {
    CD: 25.0,
    SD: 4.0,
    VAT: 15.0,
    AIT: 5.0,
    AT: 2.0,
    RD: 0.0,
    TTI: 1.0
  };

  const handleSelect = (suggestion: HSCodeSuggestion) => {
    setSelectedCode(suggestion);
  };

  const handleNext = () => {
    if (selectedCode) {
      onNext(selectedCode);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2>Step 2: HS Code Suggestions</h2>
        <p className="text-muted-foreground">Select the most appropriate HS code for your product</p>
      </div>

      <div className="space-y-4">
        {suggestions.map((suggestion) => (
          <Card 
            key={suggestion.code}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedCode?.code === suggestion.code ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleSelect(suggestion)}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg">HS {suggestion.code}</h3>
                    {selectedCode?.code === suggestion.code && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                  <p className="text-muted-foreground mb-3">{suggestion.description}</p>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm">Confidence</span>
                    <Progress value={suggestion.confidence * 100} className="w-24" />
                    <span className="text-sm">{(suggestion.confidence * 100).toFixed(0)}%</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {suggestion.rationale.map((reason, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedCode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              NBR Tariff Information
            </CardTitle>
            <CardDescription>Bangladesh Customs tariff breakdown for HS {selectedCode.code}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">CD</div>
                <div>{tariffInfo.CD}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">SD</div>
                <div>{tariffInfo.SD}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">VAT</div>
                <div>{tariffInfo.VAT}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">AIT</div>
                <div>{tariffInfo.AIT}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">AT</div>
                <div>{tariffInfo.AT}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">RD</div>
                <div>{tariffInfo.RD}%</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">TTI</div>
                <div>{tariffInfo.TTI}%</div>
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