import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import {
  CheckCircle,
  AlertCircle,
  MapPin,
  FileText,
  Building,
} from "lucide-react";
import type { ComplianceData } from "../types";

interface ComplianceStepProps {
  onNext: (data: ComplianceData) => void;
  onBack: () => void;
}

export function ComplianceStep({ onNext, onBack }: ComplianceStepProps) {
  const [destination, setDestination] = useState<string>("");
  const [office, setOffice] = useState<string>("");
  const [port, setPort] = useState<string>("");
  const [udLcNumber, setUdLcNumber] = useState<string>("");
  const [btbLcNumber, setBtbLcNumber] = useState<string>("");
  const [isBondedUser] = useState(true); // Mock bonded user status

  const destinations = [
    { value: "EU", label: "European Union", dutyRate: "12%" },
    { value: "US", label: "United States", dutyRate: "16.5%" },
    { value: "UK", label: "United Kingdom", dutyRate: "12%" },
  ];

  const offices = [
    "Chattogram Customs House",
    "DEPZ Customs Office",
    "Benapole Land Port",
    "Dhaka ICD",
    "Mongla Port",
  ];

  const ports = [
    "Chattogram Port",
    "Mongla Port",
    "Benapole Land Port",
    "Dhaka Airport",
    "Sylhet Airport",
  ];

  const getDocumentChecklist = (dest: string) => {
    const baseDocuments = [
      "Commercial Invoice",
      "Packing List",
      "Bill of Lading/Airway Bill",
      "Certificate of Origin",
    ];

    const destinationSpecific = {
      EU: ["EUR.1 Movement Certificate", "REACH Compliance Certificate"],
      US: ["Textile Declaration", "CBP Form 3461"],
      UK: ["UK Conformity Assessment", "UKCA Marking"],
    };

    return [
      ...baseDocuments,
      ...(destinationSpecific[dest as keyof typeof destinationSpecific] || []),
    ];
  };

  const selectedDestination = destinations.find((d) => d.value === destination);
  const documentChecklist = destination
    ? getDocumentChecklist(destination)
    : [];

  const isFormValid = destination && office && port;

  const handleNext = () => {
    if (isFormValid) {
      onNext({
        destination,
        office,
        port,
        udLcNumber: udLcNumber || undefined,
        btbLcNumber: btbLcNumber || undefined,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2>Step 4: Compliance Check</h2>
        <p className="text-muted-foreground">
          Configure destination and compliance requirements
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Destination Selection
            </CardTitle>
            <CardDescription>
              Select your export destination for duty calculations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="destination">Destination Market</Label>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((dest) => (
                    <SelectItem key={dest.value} value={dest.value}>
                      <div className="flex items-center justify-between w-full">
                        <span>{dest.label}</span>
                        <Badge variant="secondary" className="ml-2">
                          {dest.dutyRate}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDestination && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Duty Context</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Standard duty rate for textiles:{" "}
                  {selectedDestination.dutyRate}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              ASYCUDA Configuration
            </CardTitle>
            <CardDescription>
              Select customs office and port for processing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="office">Customs Office</Label>
              <Select value={office} onValueChange={setOffice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((off) => (
                    <SelectItem key={off} value={off}>
                      {off}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="port">Export Port</Label>
              <Select value={port} onValueChange={setPort}>
                <SelectTrigger>
                  <SelectValue placeholder="Select port" />
                </SelectTrigger>
                <SelectContent>
                  {ports.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {isBondedUser && (
        <Card>
          <CardHeader>
            <CardTitle>UD/BTB LC Information</CardTitle>
            <CardDescription>
              <Badge variant="secondary" className="mr-2">
                BKMEA +1
              </Badge>
              Auto-pull for bonded users
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ud-lc">UD LC Number</Label>
              <Input
                id="ud-lc"
                value={udLcNumber}
                onChange={(e) => setUdLcNumber(e.target.value)}
                placeholder="Enter UD LC number"
              />
            </div>
            <div>
              <Label htmlFor="btb-lc">BTB LC Number</Label>
              <Input
                id="btb-lc"
                value={btbLcNumber}
                onChange={(e) => setBtbLcNumber(e.target.value)}
                placeholder="Enter BTB LC number"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {documentChecklist.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Checklist
            </CardTitle>
            <CardDescription>
              Required documents for {selectedDestination?.label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-2">
              {documentChecklist.map((doc, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"
                >
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{doc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext} disabled={!isFormValid} className="flex-1">
          Continue to Document Generation
        </Button>
      </div>
    </div>
  );
}
