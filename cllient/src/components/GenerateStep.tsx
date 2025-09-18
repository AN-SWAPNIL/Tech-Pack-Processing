import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { FileText, Download, Database, Building2, CheckCircle } from 'lucide-react';

interface DocumentType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'generating' | 'ready';
}

interface GenerateStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function GenerateStep({ onNext, onBack }: GenerateStepProps) {
  const [documents, setDocuments] = useState<DocumentType[]>([
    {
      id: 'pi',
      name: 'Proforma Invoice',
      description: 'Commercial proforma invoice with pricing and terms',
      icon: <FileText className="h-5 w-5" />,
      status: 'pending'
    },
    {
      id: 'ci',
      name: 'Commercial Invoice',
      description: 'Final commercial invoice for customs clearance',
      icon: <FileText className="h-5 w-5" />,
      status: 'pending'
    },
    {
      id: 'pl',
      name: 'Packing List',
      description: 'Detailed packing list with dimensions and weights',
      icon: <FileText className="h-5 w-5" />,
      status: 'pending'
    },
    {
      id: 'asycuda',
      name: 'ASYCUDA Export',
      description: 'JSON export for ASYCUDA customs broker system',
      icon: <Database className="h-5 w-5" />,
      status: 'pending'
    },
    {
      id: 'exp',
      name: 'EXP Registration',
      description: 'Bank export registration documentation',
      icon: <Building2 className="h-5 w-5" />,
      status: 'pending'
    }
  ]);

  const [generationProgress, setGenerationProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateDocument = async (docId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === docId ? { ...doc, status: 'generating' } : doc
    ));

    // Simulate document generation
    await new Promise(resolve => setTimeout(resolve, 2000));

    setDocuments(prev => prev.map(doc => 
      doc.id === docId ? { ...doc, status: 'ready' } : doc
    ));
  };

  const generateAllDocuments = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);

    for (let i = 0; i < documents.length; i++) {
      await generateDocument(documents[i].id);
      setGenerationProgress(((i + 1) / documents.length) * 100);
    }

    setIsGenerating(false);
  };

  const downloadDocument = (docName: string) => {
    // Mock download functionality
    const element = document.createElement('a');
    element.setAttribute('download', `${docName.toLowerCase().replace(' ', '_')}.pdf`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const allDocumentsReady = documents.every(doc => doc.status === 'ready');

  return (
    <div className="space-y-6">
      <div>
        <h2>Step 4: Generate Documents</h2>
        <p className="text-muted-foreground">Create export documentation and compliance files</p>
      </div>

      <div className="flex gap-3 mb-6">
        <Button 
          onClick={generateAllDocuments} 
          disabled={isGenerating}
          className="flex-1"
        >
          {isGenerating ? 'Generating...' : 'Generate All Documents'}
        </Button>
      </div>

      {isGenerating && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Generating documents...</span>
                <span>{Math.round(generationProgress)}%</span>
              </div>
              <Progress value={generationProgress} />
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
                  <div className="p-2 bg-muted rounded-lg">
                    {doc.icon}
                  </div>
                  <div>
                    <h3 className="font-medium">{doc.name}</h3>
                    <p className="text-sm text-muted-foreground">{doc.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {doc.status === 'pending' && (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                  {doc.status === 'generating' && (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <Badge variant="secondary">Generating</Badge>
                    </div>
                  )}
                  {doc.status === 'ready' && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        Ready
                      </Badge>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => downloadDocument(doc.name)}
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
                  Your export documentation package is ready for review and submission
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
          onClick={onNext} 
          disabled={!allDocumentsReady}
          className="flex-1"
        >
          Continue to Review
        </Button>
      </div>
    </div>
  );
}