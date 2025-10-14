import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import PDFKit from "pdfkit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DocumentGenerator {
  constructor() {
    this.llm = new ChatGoogleGenerativeAI({
      modelName: "gemini-2.5-flash",
      temperature: 0.3,
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    });

    this.templatesDir = path.join(__dirname, "../../docs");

    // Define template file paths
    this.templates = {
      pi: "template_purchase_order.pdf",
      ci: "template_commercial_invoice.pdf",
      pl: "template_packing_list.pdf",
      bl: "template_bill_of_lading.pdf",
      compliance: "template_compliance_certificate.pdf",
    };
  }

  /**
   * Generate all export documents based on tech pack, HS code, and compliance data
   */
  async generateDocuments(documentRequest) {
    try {
      const {
        techPackData,
        hsCodeData,
        complianceData,
        orderDetails = {},
      } = documentRequest;

      console.log("📄 Starting document generation...");

      // Extract template content for context
      const templateContext = await this.extractTemplateContext();

      // Generate document data using AI
      const documentsData = await this.generateDocumentData(
        techPackData,
        hsCodeData,
        complianceData,
        orderDetails,
        templateContext
      );

      console.log("✅ Document generation completed");

      return {
        success: true,
        documents: documentsData,
      };
    } catch (error) {
      console.error("❌ Document generation error:", error);
      throw error;
    }
  }

  /**
   * Generate all export documents as PDF files (instead of JSON)
   */
  async generateDocumentPDFs(documentRequest) {
    try {
      const {
        techPackData,
        hsCodeData,
        complianceData,
        orderDetails = {},
      } = documentRequest;

      console.log("📄 Starting PDF document generation...");

      // Extract template content for context
      const templateContext = await this.extractTemplateContext();

      // Generate document data using AI
      const documentsData = await this.generateDocumentData(
        techPackData,
        hsCodeData,
        complianceData,
        orderDetails,
        templateContext
      );

      // Generate actual PDF files from the data
      const pdfFiles = await this.generatePDFFiles(documentsData);

      console.log("✅ PDF document generation completed");

      return {
        success: true,
        pdfs: pdfFiles,
        data: documentsData,
      };
    } catch (error) {
      console.error("❌ PDF document generation error:", error);
      throw error;
    }
  }

  /**
   * Extract text content from PDF templates for AI context (using LangChain PDFLoader)
   */
  async extractTemplateContext() {
    try {
      console.log("📖 Reading template documents with PDFLoader...");

      const templates = {};

      for (const [type, filename] of Object.entries(this.templates)) {
        const templatePath = path.join(this.templatesDir, filename);

        try {
          // Check if file exists
          await fs.access(templatePath);

          // Use LangChain PDFLoader to extract text
          const loader = new PDFLoader(templatePath, {
            splitPages: false,
            parsedItemSeparator: " ",
          });

          const docs = await loader.load();
          const text = docs.map((doc) => doc.pageContent).join("\n");

          if (text && text.trim().length > 50) {
            templates[type] = {
              filename,
              textContent: text.substring(0, 2000), // First 2000 chars for context
              hasTemplate: true,
            };
            console.log(`✅ Loaded template: ${type} (${text.length} chars)`);
          }
        } catch (fileError) {
          console.warn(
            `⚠️ Could not load template ${type}: ${fileError.message}`
          );
          templates[type] = {
            filename,
            textContent: "",
            hasTemplate: false,
          };
        }
      }

      return {
        availableTemplates: Object.keys(this.templates),
        templatePath: this.templatesDir,
        templates,
      };
    } catch (error) {
      console.warn("⚠️ Could not extract template context:", error);
      return {
        availableTemplates: Object.keys(this.templates),
        templatePath: this.templatesDir,
        templates: {},
      };
    }
  }

  /**
   * Use AI to generate structured document data
   */
  async generateDocumentData(
    techPackData,
    hsCodeData,
    complianceData,
    orderDetails,
    templateContext
  ) {
    console.log("🤖 Generating document data with AI...");

    const prompt = PromptTemplate.fromTemplate(`
You are an expert in international trade documentation for garment exports from Bangladesh.

Based on the provided information, generate comprehensive data for export documents.

Tech Pack Information:
- Garment Type: {garmentType}
- Fabric Type: {fabricType}
- Materials: {materials}
- Gender: {gender}
- Description: {description}
- GSM: {gsm}
- Country of Origin: {countryOfOrigin}

HS Code Information:
- HS Code: {hsCode}
- Description: {hsCodeDescription}

Compliance Information:
- Destination: {destination}
- Customs Office: {office}
- Export Port: {port}
- Cost (USD): {costUsd}
- Quantity: {quantity}
- UD LC Number: {udLcNumber}
- BTB LC Number: {btbLcNumber}

Order Details (if provided):
{orderDetails}

Template Context (use these as examples for formatting and structure):
{templateContext}

Generate the following document data in JSON format:

1. **Purchase Order (Proforma Invoice)** - Initial order details
2. **Commercial Invoice** - Final invoice with pricing
3. **Packing List** - Detailed packing information
4. **Bill of Lading** - Shipping document
5. **Compliance Certificate** - Factory compliance documentation

IMPORTANT: Use the template examples above to understand the expected format and structure of each document type.

Response format (JSON only):
{{
  "purchaseOrder": {{
    "orderNumber": "PO-YYYY-XXXXX",
    "orderDate": "YYYY-MM-DD",
    "buyer": "Company Name",
    "buyerAddress": "Full Address",
    "seller": "Factory Name",
    "sellerAddress": "Bangladesh Factory Address",
    "productDescription": "Detailed product description",
    "hsCode": "HS Code",
    "quantity": number,
    "unitPrice": number,
    "totalValue": number,
    "currency": "USD",
    "deliveryTerms": "FOB/CIF/etc",
    "paymentTerms": "LC/TT/etc",
    "deliveryDate": "YYYY-MM-DD"
  }},
  "commercialInvoice": {{
    "invoiceNumber": "INV-YYYY-XXXXX",
    "invoiceDate": "YYYY-MM-DD",
    "buyer": "Company Name",
    "buyerAddress": "Full Address",
    "seller": "Factory Name",
    "sellerAddress": "Bangladesh Factory Address",
    "productDescription": "Detailed product description",
    "hsCode": "HS Code",
    "quantity": number,
    "unitPrice": number,
    "totalValue": number,
    "currency": "USD",
    "incoterm": "FOB/CIF/etc",
    "portOfLoading": "Port name",
    "portOfDischarge": "Destination port",
    "countryOfOrigin": "Bangladesh",
    "destinationCountry": "Country name",
    "lcNumber": "LC reference if applicable"
  }},
  "packingList": {{
    "packingListNumber": "PL-YYYY-XXXXX",
    "date": "YYYY-MM-DD",
    "buyer": "Company Name",
    "seller": "Factory Name",
    "invoiceNumber": "Reference to commercial invoice",
    "totalCartons": number,
    "cartonDetails": [
      {{
        "cartonNumber": "1 of X",
        "quantity": number,
        "grossWeight": "weight in kg",
        "netWeight": "weight in kg",
        "dimensions": "L x W x H cm"
      }}
    ],
    "totalQuantity": number,
    "totalGrossWeight": "kg",
    "totalNetWeight": "kg",
    "totalVolume": "cbm"
  }},
  "billOfLading": {{
    "blNumber": "BL-YYYY-XXXXX",
    "bookingNumber": "BK-XXXXX",
    "shipper": "Factory Name",
    "shipperAddress": "Bangladesh Address",
    "consignee": "Buyer Name",
    "consigneeAddress": "Destination Address",
    "notifyParty": "Usually same as consignee",
    "portOfLoading": "Bangladesh port",
    "portOfDischarge": "Destination port",
    "vessel": "Ship name",
    "voyageNumber": "Voyage reference",
    "containerNumber": "Container ID",
    "sealNumber": "Seal number",
    "descriptionOfGoods": "Product description with HS code",
    "numberOfPackages": number,
    "grossWeight": "kg",
    "measurement": "cbm",
    "freightTerms": "Prepaid/Collect",
    "dateOfShipment": "YYYY-MM-DD"
  }},
  "complianceCertificate": {{
    "certificateNumber": "CERT-YYYY-XXXXX",
    "issueDate": "YYYY-MM-DD",
    "manufacturer": "Factory Name",
    "manufacturerAddress": "Bangladesh Address",
    "buyer": "Company Name",
    "productDescription": "Detailed product description",
    "hsCode": "HS Code",
    "quantity": number,
    "certifications": [
      "OEKO-TEX Standard 100",
      "GOTS Certified",
      "ISO 9001:2015",
      "WRAP Certified"
    ],
    "complianceStandards": [
      "EU REACH Regulation",
      "US CPSIA",
      "Bangladesh Labor Law 2006"
    ],
    "testingLaboratory": "Accredited lab name",
    "validUntil": "YYYY-MM-DD"
  }}
}}

IMPORTANT:
- Generate realistic dates (current date + reasonable lead times)
- Use the provided HS code and product details
- Calculate weights/dimensions based on garment type and quantity
- Include all mandatory fields for each document
- Follow international trade documentation standards
- Use Bangladesh customs office: {office}
- Export from: {port}
- Follow the structure and format shown in the template examples above

Response:
`);

    try {
      const chain = prompt.pipe(this.llm);

      // Format template context for the prompt
      let templateContextString = "No templates available";
      if (templateContext && templateContext.templates) {
        const templateSummaries = [];
        for (const [type, template] of Object.entries(
          templateContext.templates
        )) {
          if (template.hasTemplate && template.textContent) {
            templateSummaries.push(
              `\n${this.getDisplayName(
                type
              )}:\n${template.textContent.substring(0, 500)}...\n`
            );
          }
        }
        if (templateSummaries.length > 0) {
          templateContextString = templateSummaries.join("\n---\n");
        }
      }

      const response = await chain.invoke({
        garmentType: techPackData.garmentType || "Not specified",
        fabricType: techPackData.fabricType || "Not specified",
        materials:
          techPackData.materialPercentage
            ?.map((m) => `${m.percentage}% ${m.material}`)
            .join(", ") || "Not specified",
        gender: techPackData.gender || "Not specified",
        description: techPackData.description || "Not specified",
        gsm: techPackData.gsm || "Not specified",
        countryOfOrigin: techPackData.countryOfOrigin || "Bangladesh",
        hsCode: hsCodeData.code || "Not specified",
        hsCodeDescription: hsCodeData.description || "Not specified",
        destination: complianceData.destination || "Not specified",
        office: complianceData.office || "Not specified",
        port: complianceData.port || "Not specified",
        costUsd: complianceData.costUsd || 0,
        quantity: complianceData.quantity || 0,
        udLcNumber: complianceData.udLcNumber || "N/A",
        btbLcNumber: complianceData.btbLcNumber || "N/A",
        orderDetails: JSON.stringify(orderDetails, null, 2),
        templateContext: templateContextString,
      });

      // Parse AI response
      let responseString;
      if (typeof response === "string") {
        responseString = response;
      } else if (response && typeof response.content === "string") {
        responseString = response.content;
      } else {
        responseString = response.toString();
      }

      console.log("📊 AI response received, parsing JSON...");

      // Extract JSON from response
      const jsonMatch = responseString.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseString;
      const documentsData = JSON.parse(jsonString);

      console.log("✅ Document data generated successfully");

      return documentsData;
    } catch (error) {
      console.error("❌ AI document generation error:", error);
      throw new Error(`Failed to generate document data: ${error.message}`);
    }
  }

  /**
   * Generate actual PDF files from document data
   */
  async generatePDFFiles(documentsData) {
    console.log("📄 Generating PDF files from document data...");

    const pdfFiles = {};

    try {
      // Generate each document type as PDF
      pdfFiles.purchaseOrder = await this.createPurchaseOrderPDF(
        documentsData.purchaseOrder
      );
      pdfFiles.commercialInvoice = await this.createCommercialInvoicePDF(
        documentsData.commercialInvoice
      );
      pdfFiles.packingList = await this.createPackingListPDF(
        documentsData.packingList
      );
      pdfFiles.billOfLading = await this.createBillOfLadingPDF(
        documentsData.billOfLading
      );
      pdfFiles.complianceCertificate =
        await this.createComplianceCertificatePDF(
          documentsData.complianceCertificate
        );

      console.log("✅ All PDF files generated successfully");

      return pdfFiles;
    } catch (error) {
      console.error("❌ PDF generation error:", error);
      throw new Error(`Failed to generate PDF files: ${error.message}`);
    }
  }

  /**
   * Create a professional PDF document using PDFKit
   */
  async createPurchaseOrderPDF(data) {
    return new Promise((resolve, reject) => {
      try {
        const chunks = [];
        const doc = new PDFKit({ size: "A4", margin: 50 });

        // Collect PDF data
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve(pdfBuffer);
        });
        doc.on("error", reject);

        // Header
        doc
          .fontSize(20)
          .font("Helvetica-Bold")
          .text("PROFORMA INVOICE", { align: "center" });
        doc.moveDown();

        // Order details
        doc.fontSize(10).font("Helvetica");
        doc.text(`Order Number: ${data.orderNumber || "N/A"}`, 50, 100);
        doc.text(`Order Date: ${data.orderDate || "N/A"}`, 400, 100);
        doc.moveDown();

        // Buyer & Seller info
        doc.fontSize(12).font("Helvetica-Bold").text("Buyer:", 50, 140);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(data.buyer || "N/A", 50, 160);
        doc.text(data.buyerAddress || "N/A", 50, 175, { width: 200 });

        doc.fontSize(12).font("Helvetica-Bold").text("Seller:", 350, 140);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(data.seller || "N/A", 350, 160);
        doc.text(data.sellerAddress || "N/A", 350, 175, { width: 200 });

        doc.moveDown(3);

        // Product details table
        const tableTop = 250;
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("Product Details", 50, tableTop);

        doc
          .fontSize(10)
          .font("Helvetica")
          .text("Description:", 50, tableTop + 25);
        doc.text(data.productDescription || "N/A", 150, tableTop + 25, {
          width: 400,
        });

        doc.text("HS Code:", 50, tableTop + 60);
        doc.text(data.hsCode || "N/A", 150, tableTop + 60);

        doc.text("Quantity:", 50, tableTop + 80);
        doc.text(`${data.quantity || 0} units`, 150, tableTop + 80);

        doc.text("Unit Price:", 50, tableTop + 100);
        doc.text(
          `${data.currency || "USD"} ${data.unitPrice || 0}`,
          150,
          tableTop + 100
        );

        doc.text("Total Value:", 50, tableTop + 120);
        doc
          .font("Helvetica-Bold")
          .text(
            `${data.currency || "USD"} ${data.totalValue || 0}`,
            150,
            tableTop + 120
          );

        // Terms
        doc.moveDown(3);
        doc.fontSize(10).font("Helvetica");
        doc.text(`Delivery Terms: ${data.deliveryTerms || "N/A"}`, 50);
        doc.text(`Payment Terms: ${data.paymentTerms || "N/A"}`, 50);
        doc.text(`Delivery Date: ${data.deliveryDate || "N/A"}`, 50);

        // Footer
        doc
          .fontSize(8)
          .text(
            "This is a system-generated document.",
            50,
            doc.page.height - 50,
            { align: "center" }
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create Commercial Invoice PDF
   */
  async createCommercialInvoicePDF(data) {
    return new Promise((resolve, reject) => {
      try {
        const chunks = [];
        const doc = new PDFKit({ size: "A4", margin: 50 });

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // Header
        doc
          .fontSize(20)
          .font("Helvetica-Bold")
          .text("COMMERCIAL INVOICE", { align: "center" });
        doc.moveDown();

        // Invoice details
        doc.fontSize(10).font("Helvetica");
        doc.text(`Invoice Number: ${data.invoiceNumber || "N/A"}`, 50, 100);
        doc.text(`Invoice Date: ${data.invoiceDate || "N/A"}`, 400, 100);
        doc.moveDown();

        // Parties
        doc.fontSize(12).font("Helvetica-Bold").text("Exporter:", 50, 140);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(data.seller || "N/A", 50, 160);
        doc.text(data.sellerAddress || "N/A", 50, 175, { width: 200 });

        doc.fontSize(12).font("Helvetica-Bold").text("Consignee:", 350, 140);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(data.buyer || "N/A", 350, 160);
        doc.text(data.buyerAddress || "N/A", 350, 175, { width: 200 });

        // Shipping details
        const shippingTop = 250;
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("Shipping Details", 50, shippingTop);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(
            `Port of Loading: ${data.portOfLoading || "N/A"}`,
            50,
            shippingTop + 25
          );
        doc.text(
          `Port of Discharge: ${data.portOfDischarge || "N/A"}`,
          50,
          shippingTop + 45
        );
        doc.text(
          `Country of Origin: ${data.countryOfOrigin || "N/A"}`,
          50,
          shippingTop + 65
        );
        doc.text(
          `Destination: ${data.destinationCountry || "N/A"}`,
          50,
          shippingTop + 85
        );
        doc.text(`Incoterm: ${data.incoterm || "N/A"}`, 50, shippingTop + 105);

        // Product & pricing
        const productTop = 380;
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("Product Information", 50, productTop);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(
            `Description: ${data.productDescription || "N/A"}`,
            50,
            productTop + 25,
            { width: 500 }
          );
        doc.text(`HS Code: ${data.hsCode || "N/A"}`, 50, productTop + 60);
        doc.text(`Quantity: ${data.quantity || 0} units`, 50, productTop + 80);
        doc.text(
          `Unit Price: ${data.currency || "USD"} ${data.unitPrice || 0}`,
          50,
          productTop + 100
        );
        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .text(
            `Total Value: ${data.currency || "USD"} ${data.totalValue || 0}`,
            50,
            productTop + 120
          );

        // LC Number if available
        if (data.lcNumber) {
          doc
            .fontSize(10)
            .font("Helvetica")
            .text(`LC Number: ${data.lcNumber}`, 50, productTop + 150);
        }

        doc
          .fontSize(8)
          .text(
            "This is a system-generated document.",
            50,
            doc.page.height - 50,
            { align: "center" }
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create Packing List PDF
   */
  async createPackingListPDF(data) {
    return new Promise((resolve, reject) => {
      try {
        const chunks = [];
        const doc = new PDFKit({ size: "A4", margin: 50 });

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc
          .fontSize(20)
          .font("Helvetica-Bold")
          .text("PACKING LIST", { align: "center" });
        doc.moveDown();

        doc.fontSize(10).font("Helvetica");
        doc.text(
          `Packing List Number: ${data.packingListNumber || "N/A"}`,
          50,
          100
        );
        doc.text(`Date: ${data.date || "N/A"}`, 400, 100);
        doc.text(`Invoice Ref: ${data.invoiceNumber || "N/A"}`, 50, 120);
        doc.moveDown(2);

        // Parties
        doc.fontSize(12).font("Helvetica-Bold").text("Shipper:", 50, 160);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(data.seller || "N/A", 50, 180);

        doc.fontSize(12).font("Helvetica-Bold").text("Consignee:", 350, 160);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(data.buyer || "N/A", 350, 180);

        // Carton details
        const cartonTop = 230;
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("Carton Details", 50, cartonTop);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(`Total Cartons: ${data.totalCartons || 0}`, 50, cartonTop + 25);

        if (data.cartonDetails && data.cartonDetails.length > 0) {
          let y = cartonTop + 50;
          data.cartonDetails.forEach((carton, index) => {
            doc.text(`Carton ${carton.cartonNumber || index + 1}:`, 50, y);
            doc.text(`  Quantity: ${carton.quantity || 0}`, 70, y + 15);
            doc.text(
              `  Gross Weight: ${carton.grossWeight || "N/A"}`,
              70,
              y + 30
            );
            doc.text(`  Net Weight: ${carton.netWeight || "N/A"}`, 70, y + 45);
            doc.text(`  Dimensions: ${carton.dimensions || "N/A"}`, 70, y + 60);
            y += 90;
          });
        }

        // Totals
        const totalsY = doc.y + 30;
        doc.fontSize(12).font("Helvetica-Bold").text("Totals:", 50, totalsY);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(
            `Total Quantity: ${data.totalQuantity || 0} units`,
            50,
            totalsY + 25
          );
        doc.text(
          `Total Gross Weight: ${data.totalGrossWeight || "N/A"}`,
          50,
          totalsY + 45
        );
        doc.text(
          `Total Net Weight: ${data.totalNetWeight || "N/A"}`,
          50,
          totalsY + 65
        );
        doc.text(
          `Total Volume: ${data.totalVolume || "N/A"}`,
          50,
          totalsY + 85
        );

        doc
          .fontSize(8)
          .text(
            "This is a system-generated document.",
            50,
            doc.page.height - 50,
            { align: "center" }
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create Bill of Lading PDF
   */
  async createBillOfLadingPDF(data) {
    return new Promise((resolve, reject) => {
      try {
        const chunks = [];
        const doc = new PDFKit({ size: "A4", margin: 50 });

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc
          .fontSize(20)
          .font("Helvetica-Bold")
          .text("BILL OF LADING", { align: "center" });
        doc.moveDown();

        doc.fontSize(10).font("Helvetica");
        doc.text(`B/L Number: ${data.blNumber || "N/A"}`, 50, 100);
        doc.text(`Booking Number: ${data.bookingNumber || "N/A"}`, 400, 100);
        doc.moveDown(2);

        // Parties
        doc.fontSize(12).font("Helvetica-Bold").text("Shipper:", 50, 140);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(data.shipper || "N/A", 50, 160);
        doc.text(data.shipperAddress || "N/A", 50, 175, { width: 200 });

        doc.fontSize(12).font("Helvetica-Bold").text("Consignee:", 350, 140);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(data.consignee || "N/A", 350, 160);
        doc.text(data.consigneeAddress || "N/A", 350, 175, { width: 200 });

        doc.fontSize(12).font("Helvetica-Bold").text("Notify Party:", 50, 230);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(data.notifyParty || "Same as Consignee", 50, 250);

        // Shipping details
        const shipTop = 290;
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("Shipping Details", 50, shipTop);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(
            `Port of Loading: ${data.portOfLoading || "N/A"}`,
            50,
            shipTop + 25
          );
        doc.text(
          `Port of Discharge: ${data.portOfDischarge || "N/A"}`,
          50,
          shipTop + 45
        );
        doc.text(`Vessel: ${data.vessel || "N/A"}`, 50, shipTop + 65);
        doc.text(
          `Voyage Number: ${data.voyageNumber || "N/A"}`,
          50,
          shipTop + 85
        );
        doc.text(
          `Date of Shipment: ${data.dateOfShipment || "N/A"}`,
          50,
          shipTop + 105
        );

        // Container details
        const containerTop = 420;
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("Container Details", 50, containerTop);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(
            `Container Number: ${data.containerNumber || "N/A"}`,
            50,
            containerTop + 25
          );
        doc.text(
          `Seal Number: ${data.sealNumber || "N/A"}`,
          50,
          containerTop + 45
        );
        doc.text(
          `Number of Packages: ${data.numberOfPackages || 0}`,
          50,
          containerTop + 65
        );
        doc.text(
          `Gross Weight: ${data.grossWeight || "N/A"}`,
          50,
          containerTop + 85
        );
        doc.text(
          `Measurement: ${data.measurement || "N/A"}`,
          50,
          containerTop + 105
        );

        // Goods description
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("Description of Goods:", 50, containerTop + 140);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(data.descriptionOfGoods || "N/A", 50, containerTop + 160, {
            width: 500,
          });

        // Freight
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(
            `Freight Terms: ${data.freightTerms || "N/A"}`,
            50,
            containerTop + 200
          );

        doc
          .fontSize(8)
          .text(
            "This is a system-generated document.",
            50,
            doc.page.height - 50,
            { align: "center" }
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create Compliance Certificate PDF
   */
  async createComplianceCertificatePDF(data) {
    return new Promise((resolve, reject) => {
      try {
        const chunks = [];
        const doc = new PDFKit({ size: "A4", margin: 50 });

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc
          .fontSize(20)
          .font("Helvetica-Bold")
          .text("COMPLIANCE CERTIFICATE", { align: "center" });
        doc.moveDown();

        doc.fontSize(10).font("Helvetica");
        doc.text(
          `Certificate Number: ${data.certificateNumber || "N/A"}`,
          50,
          100
        );
        doc.text(`Issue Date: ${data.issueDate || "N/A"}`, 400, 100);
        doc.text(`Valid Until: ${data.validUntil || "N/A"}`, 400, 120);
        doc.moveDown(2);

        // Manufacturer
        doc.fontSize(12).font("Helvetica-Bold").text("Manufacturer:", 50, 160);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(data.manufacturer || "N/A", 50, 180);
        doc.text(data.manufacturerAddress || "N/A", 50, 195, { width: 500 });

        // Buyer
        doc.fontSize(12).font("Helvetica-Bold").text("Buyer:", 50, 230);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(data.buyer || "N/A", 50, 250);

        // Product
        const prodTop = 280;
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("Product Information", 50, prodTop);
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(
            `Description: ${data.productDescription || "N/A"}`,
            50,
            prodTop + 25,
            { width: 500 }
          );
        doc.text(`HS Code: ${data.hsCode || "N/A"}`, 50, prodTop + 60);
        doc.text(`Quantity: ${data.quantity || 0} units`, 50, prodTop + 80);

        // Certifications
        const certTop = prodTop + 120;
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("Certifications:", 50, certTop);
        if (data.certifications && data.certifications.length > 0) {
          let y = certTop + 25;
          data.certifications.forEach((cert) => {
            doc.fontSize(10).font("Helvetica").text(`• ${cert}`, 50, y);
            y += 20;
          });
        } else {
          doc
            .fontSize(10)
            .font("Helvetica")
            .text("No certifications listed", 50, certTop + 25);
        }

        // Compliance Standards
        const stdTop = certTop + 120;
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("Compliance Standards:", 50, stdTop);
        if (data.complianceStandards && data.complianceStandards.length > 0) {
          let y = stdTop + 25;
          data.complianceStandards.forEach((std) => {
            doc.fontSize(10).font("Helvetica").text(`• ${std}`, 50, y);
            y += 20;
          });
        }

        // Testing lab
        if (data.testingLaboratory) {
          doc
            .fontSize(10)
            .font("Helvetica")
            .text(
              `Testing Laboratory: ${data.testingLaboratory}`,
              50,
              stdTop + 150
            );
        }

        doc
          .fontSize(8)
          .text(
            "This is a system-generated document.",
            50,
            doc.page.height - 50,
            { align: "center" }
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check if template file exists
   */
  async checkTemplateExists(templateType) {
    const templateFile = this.templates[templateType];
    if (!templateFile) {
      return false;
    }

    const templatePath = path.join(this.templatesDir, templateFile);
    try {
      await fs.access(templatePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Replace a template file (for user uploads)
   */
  async replaceTemplate(templateType, fileBuffer) {
    const templateFile = this.templates[templateType];
    if (!templateFile) {
      throw new Error(`Invalid template type: ${templateType}`);
    }

    const templatePath = path.join(this.templatesDir, templateFile);

    try {
      // Validate it's a PDF
      const pdfDoc = await PDFDocument.load(fileBuffer);
      console.log(`📄 Validated PDF with ${pdfDoc.getPageCount()} pages`);

      // Save the new template
      await fs.writeFile(templatePath, fileBuffer);
      console.log(`✅ Template ${templateType} replaced successfully`);

      return {
        success: true,
        message: `Template ${templateType} updated successfully`,
        templatePath: templateFile,
      };
    } catch (error) {
      console.error(`❌ Error replacing template ${templateType}:`, error);
      throw new Error(`Failed to replace template: ${error.message}`);
    }
  }

  /**
   * Get list of available templates
   */
  async getAvailableTemplates() {
    const templates = [];

    for (const [type, filename] of Object.entries(this.templates)) {
      const exists = await this.checkTemplateExists(type);
      templates.push({
        type,
        filename,
        exists,
        displayName: this.getDisplayName(type),
      });
    }

    return templates;
  }

  /**
   * Get display name for template type
   */
  getDisplayName(type) {
    const names = {
      pi: "Proforma Invoice (Purchase Order)",
      ci: "Commercial Invoice",
      pl: "Packing List",
      bl: "Bill of Lading",
      compliance: "Compliance Certificate",
    };
    return names[type] || type;
  }
}
