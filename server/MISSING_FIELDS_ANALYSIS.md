# Missing Fields Analysis & Implementation Plan

## Current State Analysis

Based on the generated PDF documents, many critical fields are missing from the frontend data collection flow.

---

## 📋 Missing Fields by Document

### 1. **Purchase Order (PO)**

**Currently Available:**

- Product: ✅ (from techPackData.garmentType + description)
- HS Code: ✅ (from hsCodeData.code)
- Qty: ⚠️ (from complianceData.quantity - but needs dedicated field)
- FOB USD/pc: ❌ Missing

**Missing Fields:**

- `PO No`: Order/PO Number (e.g., "PO30719")
- `Order ID`: Internal Order ID (e.g., "O0016")
- `FOB USD/pc`: FOB price per unit (e.g., 6.93)
- `Ex-Factory Date`: Manufacturing completion date (e.g., "2026-01-23")
- `Port of Loading`: Departure port (e.g., "Mongla")
- `Destination`: Destination port/city (e.g., "Los Angeles")
- `Incoterm`: Trade terms (e.g., "DAP", "FOB")
- `Buyer`: Company name (e.g., "Private Co. 4 (USA)")

---

### 2. **Commercial Invoice**

**Currently Available:**

- Product: ✅ (from techPackData)
- HS Code: ✅ (from hsCodeData.code)
- Order Qty: ⚠️ (from complianceData.quantity)
- Total FOB: ⚠️ (Can calculate from quantity × FOB price)

**Missing Fields:**

- `PO No`: Same as Purchase Order PO number
- `Order ID`: Same as Purchase Order order ID
- `Style Code`: Product style/SKU (e.g., "ST-8202")
- `FOB USD/pc`: Unit price
- `Ex-Factory Date`: Same as PO
- `Payment Terms`: Payment conditions (e.g., "LC at sight")
- `Dest Port`: Destination port
- `Incoterm`: Trade terms
- `Buyer`: Buyer company details
- `Contact`: Buyer contact (e.g., "Taylor Brown - contact4@buyer4.com")
- `Segment`: Business segment (e.g., "Private Label")
- `Factory`: Factory details (e.g., "Factory 1 Ltd., Narayanganj")
- `Compliance`: Certifications (e.g., "OEKO-TEX.RCS")
- `DPP`: Digital Product Passport status (e.g., "Ready")

---

### 3. **Packing List**

**Currently Available:**

- PO No: ⚠️ (needs dedicated field)
- Order ID: ⚠️ (needs dedicated field)
- Total Quantity: ⚠️ (from complianceData.quantity)

**Missing Fields:**

- `Buyer`: Buyer company name
- `Total Cartons`: Number of cartons/boxes
- `Gross Weight (MT)`: Total gross weight in metric tons
- `Net Weight (MT)`: Total net weight in metric tons
- `Ex-Factory Date`: Manufacturing completion date
- `Destination Port`: Final destination

---

### 4. **Bill of Lading (B/L)**

**Currently Available:**

- Order ID: ⚠️ (needs dedicated field)

**Missing Fields:**

- `PO`: PO number
- `Port of Loading`: Departure port
- `Destination`: Destination port/city
- `B/L_No`: Bill of Lading number (e.g., "BL838726")
- `Carrier`: Shipping carrier (e.g., "Hapag-Lloyd")
- `Container No`: Container number (e.g., "CONT14062")
- `ETD`: Estimated Time of Departure (e.g., "2026-01-26")
- `ETA`: Estimated Time of Arrival (e.g., "2026-02-17")
- `Incoterm`: Trade terms (e.g., "FOB")

---

### 5. **Compliance Certificate**

**Currently Available:**

- Factory: ⚠️ (needs dedicated field)

**Missing Fields:**

- `Factory`: Full factory name and location
- `Certification`: List of certifications with status
  - OEKO-TEX: Status (Valid/Expired)
  - RCS: Status (Valid/Expired)
  - GOTS: Status (if applicable)
  - etc.

---

## 🎯 Mock Data Structure

```json
{
  "techPackData": {
    "description": "Unisex hoodie, American Fleece knit construction",
    "garmentType": "Hoodie",
    "fabricType": "knit",
    "gender": "Unisex",
    "materialPercentage": [
      { "material": "organic cotton", "percentage": 80 },
      { "material": "recycled polyester", "percentage": 20 }
    ],
    "gsm": 320,
    "countryOfOrigin": "Portugal"
  },

  "hsCodeData": {
    "code": "6102.20.00",
    "description": "Women's or girls' overcoats...",
    "confidence": 0.75,
    "tariffInfo": {
      "CD": 25,
      "SD": 30,
      "VAT": 15,
      "AIT": 5,
      "AT": 7.5,
      "TTI": 104.06
    }
  },

  "complianceData": {
    "destination": "US",
    "office": "DEPZ Customs Office",
    "port": "Benapole Land Port",
    "udLcNumber": "UD-2025-001",
    "btbLcNumber": "BTB-2025-001",
    "costUsd": 481816,
    "quantity": 44849
  },

  "orderDetails": {
    "poNumber": "PO30719",
    "orderId": "O0016",
    "styleCode": "ST-8202",
    "fobPricePerUnit": 6.93,
    "exFactoryDate": "2026-01-23",
    "portOfLoading": "Mongla",
    "destinationPort": "Los Angeles",
    "incoterm": "DAP",

    "buyer": {
      "companyName": "Private Co. 4 (USA)",
      "contactPerson": "Taylor Brown",
      "email": "contact4@buyer4.com",
      "segment": "Private Label"
    },

    "factory": {
      "name": "Factory 1 Ltd.",
      "location": "Narayanganj",
      "compliance": ["OEKO-TEX.RCS"],
      "dppStatus": "Ready"
    },

    "paymentTerms": "LC at sight",

    "shipping": {
      "totalCartons": 173,
      "grossWeightMT": 17.5,
      "netWeightMT": 16.1,
      "blNumber": "BL838726",
      "carrier": "Hapag-Lloyd",
      "containerNumber": "CONT14062",
      "etd": "2026-01-26",
      "eta": "2026-02-17"
    },

    "certifications": [
      { "name": "OEKO-TEX", "status": "Expired" },
      { "name": "RCS", "status": "Valid" }
    ]
  }
}
```

---

## 📝 Implementation Plan

### Phase 1: Add New Data Collection Step (Order Details)

**Decision: YES - Add a new step between "Compliance" and "Generate"**

**Why?**

- Current flow: Upload → HS Code → Compliance → Generate
- Order/shipping details are business-critical but don't fit in "Compliance"
- Separating concerns makes the UI cleaner and data validation easier

**New Flow:**

```
Upload Tech Pack → HS Code Selection → Compliance Data → Order Details → Generate Documents
```

---

### Phase 2: Update Type Definitions

**File:** `client/src/types/index.ts`

**Add new interfaces:**

```typescript
export interface BuyerInfo {
  companyName: string;
  contactPerson?: string;
  email?: string;
  segment?: string; // e.g., "Private Label", "Retail", "Wholesale"
}

export interface FactoryInfo {
  name: string;
  location: string;
  compliance?: string[]; // e.g., ["OEKO-TEX", "GOTS"]
  dppStatus?: string; // Digital Product Passport status
}

export interface ShippingDetails {
  totalCartons?: number;
  grossWeightMT?: number;
  netWeightMT?: number;
  blNumber?: string;
  carrier?: string;
  containerNumber?: string;
  etd?: string; // Estimated Time of Departure
  eta?: string; // Estimated Time of Arrival
}

export interface Certification {
  name: string;
  status: "Valid" | "Expired" | "Pending";
  expiryDate?: string;
}

export interface OrderDetails {
  // Order identification
  poNumber: string;
  orderId: string;
  styleCode?: string;

  // Pricing
  fobPricePerUnit: number;
  currency?: string; // default "USD"

  // Dates
  exFactoryDate: string;

  // Shipping
  portOfLoading: string;
  destinationPort: string;
  incoterm: string; // "FOB", "CIF", "DAP", etc.

  // Parties
  buyer: BuyerInfo;
  factory: FactoryInfo;

  // Payment
  paymentTerms?: string; // e.g., "LC at sight", "T/T 30 days"

  // Shipping details (optional - can be filled later)
  shipping?: ShippingDetails;

  // Certifications
  certifications?: Certification[];
}

// Update DocumentGenerationRequest
export interface DocumentGenerationRequest {
  techPackData: TechPackSummary;
  hsCodeData: HSCodeSuggestion;
  complianceData: ComplianceData;
  orderDetails: OrderDetails; // Make it required instead of optional
}
```

---

### Phase 3: Create New OrderDetailsStep Component

**File:** `client/src/components/OrderDetailsStep.tsx`

**Features:**

- Form with sections: Order Info, Pricing, Shipping Ports, Buyer Info, Factory Info, Payment
- Optional sections: Shipping Details, Certifications
- Auto-calculate Total FOB (quantity × fobPricePerUnit)
- Date pickers for exFactoryDate, ETD, ETA
- Dropdown for incoterm (FOB, CIF, DAP, EXW, etc.)
- Validation for required fields

---

### Phase 4: Update Existing Components

#### 4.1 Update `App.tsx`

- Add new step: `OrderDetailsStep`
- Update step navigation
- Pass orderDetails state between components

#### 4.2 Update `GenerateStep.tsx`

- Receive `orderDetails` prop
- Include in API request

#### 4.3 Update `ComplianceStep.tsx`

- Remove fields that moved to OrderDetailsStep (if any overlap)

---

### Phase 5: Backend Updates

**Decision: Minimal backend changes needed**

**Files to update:**

#### 5.1 `server/src/schemas/index.js`

```javascript
// Add orderDetailsSchema
export const orderDetailsSchema = Joi.object({
  poNumber: Joi.string().required(),
  orderId: Joi.string().required(),
  styleCode: Joi.string().optional(),
  fobPricePerUnit: Joi.number().positive().required(),
  currency: Joi.string().default("USD"),
  exFactoryDate: Joi.string().isoDate().required(),
  portOfLoading: Joi.string().required(),
  destinationPort: Joi.string().required(),
  incoterm: Joi.string().required(),
  buyer: Joi.object({
    companyName: Joi.string().required(),
    contactPerson: Joi.string().optional(),
    email: Joi.string().email().optional(),
    segment: Joi.string().optional(),
  }).required(),
  factory: Joi.object({
    name: Joi.string().required(),
    location: Joi.string().required(),
    compliance: Joi.array().items(Joi.string()).optional(),
    dppStatus: Joi.string().optional(),
  }).required(),
  paymentTerms: Joi.string().optional(),
  shipping: Joi.object({
    totalCartons: Joi.number().integer().optional(),
    grossWeightMT: Joi.number().optional(),
    netWeightMT: Joi.number().optional(),
    blNumber: Joi.string().optional(),
    carrier: Joi.string().optional(),
    containerNumber: Joi.string().optional(),
    etd: Joi.string().isoDate().optional(),
    eta: Joi.string().isoDate().optional(),
  }).optional(),
  certifications: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        status: Joi.string().valid("Valid", "Expired", "Pending").required(),
        expiryDate: Joi.string().isoDate().optional(),
      })
    )
    .optional(),
});

// Update documentGenerationRequestSchema
export const documentGenerationRequestSchema = Joi.object({
  techPackData: techPackSchema.required(),
  hsCodeData: hsCodeSuggestionSchema.required(),
  complianceData: complianceDataSchema.required(),
  orderDetails: orderDetailsSchema.required(), // Now required
});
```

#### 5.2 `server/src/services/documentGenerator.js`

- No changes needed! The AI prompt already receives all data
- The combined data object will automatically include orderDetails fields
- AI will use available fields to populate the templates

---

### Phase 6: AI Data Extraction (Optional Enhancement)

**Question: Can some fields be extracted by AI from the tech pack?**

**Answer: YES - Some fields can be inferred or extracted**

**From existing AI extraction (in `aiService.js`):**

- ✅ `garmentType` - Already extracted
- ✅ `fabricType` - Already extracted
- ✅ `materialPercentage` - Already extracted
- ✅ `gsm` - Already extracted
- ✅ `countryOfOrigin` - Already extracted

**Can be added to AI extraction:**

- ✅ `styleCode` - Often mentioned in tech packs (e.g., "Style: ST-8202")
- ✅ `buyer.companyName` - Usually in tech pack header
- ✅ `factory.name` - May be in tech pack
- ✅ `factory.location` - May be in tech pack
- ✅ `certifications` - If listed in tech pack (GOTS, OEKO-TEX, etc.)
- ⚠️ `exFactoryDate` - Rarely in tech pack (user input better)
- ❌ `poNumber` - Not in tech pack (comes from order)
- ❌ `orderId` - Not in tech pack (comes from order)
- ❌ `fobPricePerUnit` - Not in tech pack (pricing info)
- ❌ `shipping details` - Not in tech pack (comes later)

**Recommendation:**
Update AI extraction prompt to also extract:

```javascript
styleCode: string | null
buyer: { companyName: string | null }
factory: { name: string | null, location: string | null }
certifications: string[] | null
```

Then pre-populate OrderDetailsStep with these AI-extracted values (user can edit).

---

## 🎯 Implementation Priority

### **Priority 1: Critical for MVP** ✅

1. Add OrderDetails type definitions
2. Create OrderDetailsStep component (basic version)
3. Update App.tsx navigation
4. Update backend schema validation
5. Test end-to-end with mock data

**Fields for MVP:**

- poNumber, orderId
- fobPricePerUnit, exFactoryDate
- portOfLoading, destinationPort, incoterm
- buyer.companyName
- factory.name, factory.location

### **Priority 2: Enhanced UX** 🎨

1. Add optional shipping details section
2. Add certifications management
3. Improve validation and error messages
4. Add auto-calculation (total FOB, etc.)

### **Priority 3: AI Enhancement** 🤖

1. Update AI extraction to get styleCode, buyer, factory
2. Pre-populate OrderDetailsStep with AI data
3. Add confidence scores for extracted fields

---

## 📍 Where to Insert in Frontend?

### Step Order:

```
1. UploadStep (existing)
2. ReviewStep (existing - shows AI extracted data)
3. HSCodeStep (existing - AI suggests HS codes)
4. ComplianceStep (existing - customs/compliance info)
5. **OrderDetailsStep** ← NEW STEP HERE
6. GenerateStep (existing - generate PDFs)
```

### File Structure:

```
client/src/components/
├── UploadStep.tsx (existing)
├── ReviewStep.tsx (existing)
├── HSCodeStep.tsx (existing)
├── ComplianceStep.tsx (existing)
├── OrderDetailsStep.tsx ← NEW COMPONENT
└── GenerateStep.tsx (existing)

client/src/types/
└── index.ts ← UPDATE with new interfaces
```

---

## 🚀 Quick Start Implementation Steps

1. **Update types** (5 min)

   ```bash
   # Edit client/src/types/index.ts
   # Add OrderDetails, BuyerInfo, FactoryInfo, etc.
   ```

2. **Create OrderDetailsStep component** (30 min)

   ```bash
   # Create client/src/components/OrderDetailsStep.tsx
   # Copy structure from ComplianceStep.tsx as template
   ```

3. **Update App.tsx** (10 min)

   ```tsx
   // Add orderDetails state
   // Add OrderDetailsStep in stepper
   // Pass props between steps
   ```

4. **Update backend schema** (10 min)

   ```bash
   # Edit server/src/schemas/index.js
   # Add orderDetailsSchema validation
   ```

5. **Test with mock data** (15 min)
   ```bash
   # Use mock data from this document
   # Generate all 5 documents
   # Verify fields appear in PDFs
   ```

**Total Time: ~70 minutes for MVP**

---

## 📌 Summary

- **Add new step?** YES - OrderDetailsStep between Compliance and Generate
- **Where to insert?** After ComplianceStep, before GenerateStep
- **Backend updates?** Minimal - just schema validation
- **AI extraction?** Optional enhancement - can extract 4-5 additional fields
- **Priority?** Focus on MVP (Priority 1) first - core order/shipping fields
