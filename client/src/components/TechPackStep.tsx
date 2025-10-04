import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import {
  ShirtIcon,
  Ruler,
  Globe,
  Package,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { localStorageManager } from "../utils/localStorage";
import type { TechPackSummary } from "../types";
import { GARMENT_TYPE_OPTIONS } from "../types";

interface TechPackStepProps {
  onNext: (techPackData: TechPackSummary) => void;
  onBack: () => void;
  techPackData: TechPackSummary | null;
}

export function TechPackStep({
  onNext,
  onBack,
  techPackData,
}: TechPackStepProps) {
  const [description, setDescription] = useState("");
  const [garmentType, setGarmentType] = useState("");
  const [customGarmentType, setCustomGarmentType] = useState("");
  const [fabricType, setFabricType] = useState<"knit" | "woven">("knit");
  const [gender, setGender] = useState("");
  const [materialPercentage, setMaterialPercentage] = useState<
    Array<{ material: string; percentage: number }>
  >([]);
  const [gsm, setGsm] = useState<number | undefined>(undefined);
  const [countryOfOrigin, setCountryOfOrigin] = useState("");
  const [destinationMarket, setDestinationMarket] = useState("");
  const [incoterm, setIncoterm] = useState("");

  const genderOptions = ["Men", "Women", "Unisex", "Infant", "Kids"];

  const countryOptions = [
    { value: "BD", label: "Bangladesh" },
    { value: "CN", label: "China" },
    { value: "IN", label: "India" },
    { value: "VN", label: "Vietnam" },
    { value: "TH", label: "Thailand" },
    { value: "MM", label: "Myanmar" },
    { value: "KH", label: "Cambodia" },
    { value: "ID", label: "Indonesia" },
  ];

  const destinationOptions = [
    { value: "US", label: "United States" },
    { value: "EU", label: "European Union" },
    { value: "UK", label: "United Kingdom" },
    { value: "CA", label: "Canada" },
    { value: "AU", label: "Australia" },
    { value: "JP", label: "Japan" },
  ];

  const incotermOptions = [
    { value: "FOB", label: "FOB (Free on Board)" },
    { value: "CIF", label: "CIF (Cost, Insurance & Freight)" },
    { value: "EXW", label: "EXW (Ex Works)" },
    { value: "FCA", label: "FCA (Free Carrier)" },
    { value: "CPT", label: "CPT (Carriage Paid To)" },
    { value: "CIP", label: "CIP (Carriage and Insurance Paid To)" },
    { value: "DAP", label: "DAP (Delivered at Place)" },
    { value: "DDP", label: "DDP (Delivered Duty Paid)" },
  ];

  // Load data on mount
  useEffect(() => {
    if (techPackData) {
      setDescription(techPackData.description || "");
      setFabricType(techPackData.fabricType || "knit");
      setGender(techPackData.gender || "");
      setMaterialPercentage(techPackData.materialPercentage || []);
      setGsm(techPackData.gsm);
      setCountryOfOrigin(techPackData.countryOfOrigin || "");
      setDestinationMarket(techPackData.destinationMarket || "");
      setIncoterm(techPackData.incoterm || "");

      // Check if garment type is a predefined option or custom
      const isPredefinedType = GARMENT_TYPE_OPTIONS.includes(
        techPackData.garmentType as any
      );
      if (isPredefinedType) {
        setGarmentType(techPackData.garmentType);
        setCustomGarmentType("");
      } else {
        setGarmentType("Custom");
        setCustomGarmentType(techPackData.garmentType || "");
      }
    }
  }, [techPackData]);

  const handleMaterialChange = (
    index: number,
    field: "material" | "percentage",
    value: string | number
  ) => {
    const newMaterials = [...materialPercentage];
    newMaterials[index] = { ...newMaterials[index], [field]: value };
    setMaterialPercentage(newMaterials);
  };

  const addMaterial = () => {
    setMaterialPercentage([
      ...materialPercentage,
      { material: "", percentage: 0 },
    ]);
  };

  const removeMaterial = (index: number) => {
    setMaterialPercentage(materialPercentage.filter((_, i) => i !== index));
  };

  const totalPercentage = materialPercentage.reduce(
    (sum, item) => sum + item.percentage,
    0
  );
  const isValidPercentage = Math.abs(totalPercentage - 100) <= 0.1;

  const isFormValid =
    garmentType &&
    (garmentType !== "Custom" || customGarmentType.trim()) &&
    fabricType &&
    gender &&
    description.trim() &&
    materialPercentage.length > 0 &&
    isValidPercentage;

  const handleNext = () => {
    if (isFormValid) {
      const finalData: TechPackSummary = {
        description,
        garmentType: garmentType === "Custom" ? customGarmentType : garmentType,
        fabricType,
        gender,
        materialPercentage,
        gsm: gsm || undefined,
        countryOfOrigin: countryOfOrigin || undefined,
        destinationMarket: destinationMarket || undefined,
        incoterm: incoterm || undefined,
      };

      // Save to localStorage (without file since we're in TechPackStep)
      // This will NOT clear HS code suggestions if they exist
      localStorageManager.saveTechPackData(finalData);

      onNext(finalData);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2>Step 2: Tech Pack Details</h2>
        <p className="text-muted-foreground">
          Review and edit product details for accurate HS code classification
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Basic Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShirtIcon className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>
              Core product details and construction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Garment Type */}
            <div>
              <Label htmlFor="garmentType">Garment Type *</Label>
              <Select value={garmentType} onValueChange={setGarmentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select garment type" />
                </SelectTrigger>
                <SelectContent>
                  {GARMENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Garment Type - shown only when Custom is selected */}
            {garmentType === "Custom" && (
              <div>
                <Label htmlFor="customGarmentType">Custom Garment Type *</Label>
                <Input
                  id="customGarmentType"
                  placeholder="Enter custom garment type"
                  value={customGarmentType}
                  onChange={(e) => setCustomGarmentType(e.target.value)}
                />
              </div>
            )}

            {/* Construction Type */}
            <div>
              <Label htmlFor="fabricType">Construction Type *</Label>
              <Select
                value={fabricType}
                onValueChange={(value: "knit" | "woven") =>
                  setFabricType(value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select construction type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="knit">Knit</SelectItem>
                  <SelectItem value="woven">Woven</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Gender Category */}
            <div>
              <Label htmlFor="gender">Gender/Age Category *</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender category" />
                </SelectTrigger>
                <SelectContent>
                  {genderOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* GSM */}
            <div>
              <Label htmlFor="gsm">GSM (Grams per Square Meter)</Label>
              <Input
                id="gsm"
                type="number"
                placeholder="e.g., 180"
                value={gsm || ""}
                onChange={(e) =>
                  setGsm(parseFloat(e.target.value) || undefined)
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Fabric weight affects HS classification
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Fabric Composition Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Fabric Composition
            </CardTitle>
            <CardDescription>
              Material breakdown (must total 100%)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>
                Fiber Composition *
                <Badge
                  variant={isValidPercentage ? "secondary" : "destructive"}
                  className="ml-2"
                >
                  Total: {totalPercentage.toFixed(1)}%
                </Badge>
              </Label>

              {materialPercentage.map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      placeholder="Material (e.g., Cotton)"
                      value={item.material}
                      onChange={(e) =>
                        handleMaterialChange(index, "material", e.target.value)
                      }
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      placeholder="%"
                      value={item.percentage || ""}
                      onChange={(e) =>
                        handleMaterialChange(
                          index,
                          "percentage",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeMaterial(index)}
                    disabled={materialPercentage.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={addMaterial}
                className="w-full"
              >
                Add Material
              </Button>

              {!isValidPercentage && materialPercentage.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>Material percentages must sum to 100%</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Summary
          </CardTitle>
          <CardDescription>
            Detailed product description for classification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="description">Product Description *</Label>
            <Textarea
              id="description"
              placeholder="Example: Men's 100% cotton jersey T-shirt, 180 GSM, crew neck, short sleeves"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Trade Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Trade Information
          </CardTitle>
          <CardDescription>
            Origin, destination, and shipping terms
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          {/* Country of Origin */}
          <div>
            <Label htmlFor="countryOfOrigin">Country of Origin</Label>
            <Select value={countryOfOrigin} onValueChange={setCountryOfOrigin}>
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countryOptions.map((country) => (
                  <SelectItem key={country.value} value={country.value}>
                    {country.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destination Market */}
          <div>
            <Label htmlFor="destinationMarket">Destination Market</Label>
            <Select
              value={destinationMarket}
              onValueChange={setDestinationMarket}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                {destinationOptions.map((dest) => (
                  <SelectItem key={dest.value} value={dest.value}>
                    {dest.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Incoterm */}
          <div>
            <Label htmlFor="incoterm">Incoterm</Label>
            <Select value={incoterm} onValueChange={setIncoterm}>
              <SelectTrigger>
                <SelectValue placeholder="Select incoterm" />
              </SelectTrigger>
              <SelectContent>
                {incotermOptions.map((term) => (
                  <SelectItem key={term.value} value={term.value}>
                    {term.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext} disabled={!isFormValid} className="flex-1">
          Continue to HS Code Suggestions
        </Button>
      </div>
    </div>
  );
}
