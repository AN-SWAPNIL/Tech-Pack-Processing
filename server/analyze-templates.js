import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templates = {
  purchaseOrder: "template_purchase_order.pdf",
  commercialInvoice: "template_commercial_invoice.pdf",
  packingList: "template_packing_list.pdf",
  billOfLading: "template_bill_of_lading.pdf",
  complianceCertificate: "template_compliance_certificate.pdf",
};

async function analyzeTemplates() {
  console.log("📄 ANALYZING TEMPLATE PDFs...\n");

  for (const [type, filename] of Object.entries(templates)) {
    const templatePath = path.join(__dirname, "docs", filename);

    console.log(`\n${"=".repeat(80)}`);
    console.log(`📋 ${type.toUpperCase()} - ${filename}`);
    console.log("=".repeat(80));

    try {
      const loader = new PDFLoader(templatePath, {
        splitPages: false,
        parsedItemSeparator: " ",
      });

      const docs = await loader.load();
      const text = docs.map((doc) => doc.pageContent).join("\n");

      console.log(`\n📝 Extracted Text (first 1500 chars):`);
      console.log("-".repeat(80));
      console.log(text.substring(0, 1500));
      console.log("-".repeat(80));

      // Analyze for table structures
      const lines = text.split("\n");
      console.log(`\n📊 Document Analysis:`);
      console.log(`   Total Lines: ${lines.length}`);
      console.log(`   Total Characters: ${text.length}`);

      // Look for table-like patterns
      const tableIndicators = [
        "Item",
        "Description",
        "Quantity",
        "Price",
        "Amount",
        "Total",
        "No.",
        "HS Code",
        "Package",
        "Weight",
        "Dimensions",
      ];

      const foundIndicators = tableIndicators.filter((indicator) =>
        text.toLowerCase().includes(indicator.toLowerCase())
      );

      if (foundIndicators.length > 0) {
        console.log(`   📊 Potential Table Columns Found:`);
        foundIndicators.forEach((col) => console.log(`      - ${col}`));
      }

      // Look for common fields
      const fieldPatterns = [
        /Invoice\s*No\.?:?\s*([^\n]+)/i,
        /Date:?\s*([^\n]+)/i,
        /Buyer:?\s*([^\n]+)/i,
        /Seller:?\s*([^\n]+)/i,
        /Total:?\s*([^\n]+)/i,
      ];

      console.log(`\n🔍 Detected Fields:`);
      fieldPatterns.forEach((pattern) => {
        const match = text.match(pattern);
        if (match) {
          console.log(`   - ${match[0]}`);
        }
      });
    } catch (error) {
      console.error(`❌ Error analyzing ${type}:`, error.message);
    }
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("✅ Template analysis complete!");
  console.log("=".repeat(80));
}

analyzeTemplates().catch(console.error);
