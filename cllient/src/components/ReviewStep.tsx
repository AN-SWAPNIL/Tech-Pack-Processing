import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Lock, CheckCircle, Edit, FileText, AlertTriangle } from 'lucide-react';

interface ReviewData {
  techPack: {
    filename: string;
    material: string;
    fabricType: string;
    garmentType: string;
    gender: string;
  };
  hsCode: {
    code: string;
    description: string;
    confidence: number;
  };
  compliance: {
    destination: string;
    office: string;
    port: string;
  };
  documents: string[];
}

interface ReviewStepProps {
  onBack: () => void;
  onEdit: (step: number) => void;
}

export function ReviewStep({ onBack, onEdit }: ReviewStepProps) {
  const [isLocked, setIsLocked] = useState(false);

  // Mock review data
  const reviewData: ReviewData = {
    techPack: {
      filename: 'Tech_Pack_Mens_Shirt_v2.pdf',
      material: '100% Cotton',
      fabricType: 'Woven',
      garmentType: 'Shirt',
      gender: 'Men\'s'
    },
    hsCode: {
      code: '62052000',
      description: 'Men\'s cotton shirts (woven)',
      confidence: 0.92
    },
    compliance: {
      destination: 'European Union',
      office: 'Chattogram Customs House',
      port: 'Chattogram Port'
    },
    documents: [
      'Proforma Invoice',
      'Commercial Invoice',
      'Packing List',
      'ASYCUDA Export',
      'EXP Registration'
    ]
  };

  const handleLock = () => {
    setIsLocked(true);
  };

  const handleUnlock = () => {
    setIsLocked(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Step 5: Review & Lock</h2>
          <p className="text-muted-foreground">Final review before locking the export documentation</p>
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

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Tech Pack Summary
              </CardTitle>
              {!isLocked && (
                <Button variant="ghost" size="sm" onClick={() => onEdit(1)}>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">File</label>
                <p className="text-sm">{reviewData.techPack.filename}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Material</label>
                <p className="text-sm">{reviewData.techPack.material}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Type</label>
                <p className="text-sm">{reviewData.techPack.fabricType} {reviewData.techPack.garmentType}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Gender</label>
                <p className="text-sm">{reviewData.techPack.gender}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>HS Code Classification</CardTitle>
              {!isLocked && (
                <Button variant="ghost" size="sm" onClick={() => onEdit(2)}>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <h3 className="text-lg">HS {reviewData.hsCode.code}</h3>
              </div>
              <div className="flex-1">
                <p className="text-sm">{reviewData.hsCode.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">
                    {(reviewData.hsCode.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Compliance Configuration</CardTitle>
              {!isLocked && (
                <Button variant="ghost" size="sm" onClick={() => onEdit(3)}>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Destination</label>
                <p className="text-sm">{reviewData.compliance.destination}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Customs Office</label>
                <p className="text-sm">{reviewData.compliance.office}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Export Port</label>
                <p className="text-sm">{reviewData.compliance.port}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated Documents</CardTitle>
              {!isLocked && (
                <Button variant="ghost" size="sm" onClick={() => onEdit(4)}>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-2">
              {reviewData.documents.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{doc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {!isLocked && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                <div>
                  <h3 className="text-orange-800">Ready to Lock</h3>
                  <p className="text-sm text-orange-600 mt-1">
                    Once locked, you won't be able to edit the configuration or regenerate documents. 
                    Make sure all information is correct before proceeding.
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
          <Button onClick={handleLock} className="flex-1">
            <Lock className="h-4 w-4 mr-2" />
            Lock Export Documentation
          </Button>
        ) : (
          <div className="flex gap-2 flex-1">
            <Button variant="outline" onClick={handleUnlock}>
              Unlock for Editing
            </Button>
            <Button className="flex-1">
              <CheckCircle className="h-4 w-4 mr-2" />
              Export Documentation Complete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}