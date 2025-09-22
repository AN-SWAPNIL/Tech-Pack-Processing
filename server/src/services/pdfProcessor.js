import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import getSupabaseClient from "../config/supabase.js";
import CustomGoogleGenerativeAIEmbeddings from "./customEmbeddings.js";

export class PDFProcessor {
  constructor() {
    this.supabase = getSupabaseClient();
    this.embeddings = new CustomGoogleGenerativeAIEmbeddings({
      modelName: "models/gemini-embedding-001",
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: 1536,
      title: "Tariff Document Processing",
    });
  }

  async processPDF(filePath, documentInfo) {
    console.log(
      `📄 Processing PDF: ${documentInfo.type} v${documentInfo.version}`
    );

    try {
      // 1. Load PDF with LangChain
      const loader = new PDFLoader(filePath, {
        splitPages: false,
        parsedItemSeparator: " ",
      });

      const docs = await loader.load();
      const fullText = docs.map((doc) => doc.pageContent).join("\n");

      console.log(`📖 Extracted ${fullText.length} characters from PDF`);

      // 2. Parse tabular tariff data with fallback
      let tariffRows;
      try {
        tariffRows = this.parseTariffTable(fullText);
        console.log(`📊 Found ${tariffRows.length} tariff entries`);
      } catch (parseError) {
        console.warn(`⚠️ Standard parsing failed: ${parseError.message}`);
        console.log(`🤖 Attempting AI-powered parsing as fallback...`);

        // Fallback to AI parsing if structure has changed
        tariffRows = await this.parseWithAI(fullText);
        console.log(`🤖 AI parsing found ${tariffRows.length} tariff entries`);
      }

      if (tariffRows.length === 0) {
        throw new Error("No valid tariff entries found in PDF");
      }

      // 3. Create chunks for vector search (group by HS code ranges)
      const chunks = this.createChunksFromTariffData(tariffRows);
      console.log(`📦 Created ${chunks.length} chunks for vector storage`);

      // 4. Generate embeddings and store (with transaction safety)
      await this.storeChunks(chunks, documentInfo);

      console.log(
        `✅ Successfully processed PDF: ${documentInfo.type} v${documentInfo.version}`
      );
    } catch (error) {
      console.error(
        `❌ Failed to process PDF: ${documentInfo.type} v${documentInfo.version}`,
        error
      );
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  parseTariffTable(text) {
    const lines = text.split("\n");
    const tariffRows = [];
    let failedRows = 0;
    let totalRows = 0;

    // Find the start of tariff data (after header)
    let startIndex = -1;
    let headerLine = "";
    for (let i = 0; i < lines.length; i++) {
      if (
        lines[i].includes("Hscode") ||
        lines[i].includes("HSCODE") ||
        lines[i].includes("TARRIFF_DESCRIPTION") ||
        lines[i].includes("DESCRIPTION")
      ) {
        startIndex = i + 1;
        headerLine = lines[i];
        break;
      }
    }

    if (startIndex === -1) {
      throw new Error("Could not find tariff table header");
    }

    console.log(`📋 Found header: ${headerLine}`);

    // Parse each tariff row
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.length < 10) continue; // Skip empty lines

      totalRows++;
      const row = this.parseTariffRow(line);
      if (row) {
        tariffRows.push(row);
      } else {
        failedRows++;
        if (failedRows <= 5) {
          // Log first 5 failures for debugging
          console.warn(
            `⚠️ Failed to parse row ${i}: ${line.substring(0, 100)}...`
          );
        }
      }
    }

    // Check if we have too many failures (structure might have changed)
    const failureRate = failedRows / totalRows;
    if (failureRate > 0.3) {
      // More than 30% failure rate
      console.error(
        `❌ High failure rate: ${failedRows}/${totalRows} rows failed (${(
          failureRate * 100
        ).toFixed(1)}%)`
      );
      throw new Error(
        `PDF structure may have changed. High parsing failure rate: ${(
          failureRate * 100
        ).toFixed(1)}%`
      );
    }

    if (failedRows > 0) {
      console.warn(
        `⚠️ ${failedRows}/${totalRows} rows failed to parse (${(
          failureRate * 100
        ).toFixed(1)}% failure rate)`
      );
    }

    console.log(`✅ Successfully parsed ${tariffRows.length} tariff rows`);
    return tariffRows;
  }

  parseTariffRow(line) {
    try {
      // Parse: "01012100 Pure-bred breeding animals of horses.. 5 0 0 5 0 0.0 10.00"
      const parts = line.split(/\s+/);

      // Validate minimum required parts (HS code + description + at least some rates)
      if (parts.length < 3) {
        return null;
      }

      const hsCode = parts[0];
      if (!/^\d{8}$/.test(hsCode)) {
        return null;
      }

      // Extract description (everything between HS code and first number)
      const descriptionStart = line.indexOf(hsCode) + hsCode.length + 1;
      const firstNumberIndex = line.search(/\s+\d+\s/);

      if (firstNumberIndex === -1) {
        return null;
      }

      const description = line
        .substring(descriptionStart, firstNumberIndex)
        .trim();

      // Extract tariff rates - handle variable number of rates
      const rateParts = parts.slice(-7); // Get last 7 parts (expected rates)
      const rates = rateParts.map((rate) => parseFloat(rate) || 0);

      // Validate that we have meaningful tariff data
      const hasValidRates = rates.some((rate) => rate >= 0);
      if (!hasValidRates) {
        return null;
      }

      return {
        hsCode,
        description,
        cd: rates[0] || 0,
        sd: rates[1] || 0,
        vat: rates[2] || 0,
        ait: rates[3] || 0,
        rd: rates[4] || 0,
        at: rates[5] || 0,
        tti: rates[6] || 0,
      };
    } catch (error) {
      return null;
    }
  }

  async parseWithAI(fullText) {
    const llm = new ChatGoogleGenerativeAI({
      modelName: "gemini-1.5-pro",
      temperature: 0.1,
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    });

    const promptTemplate = PromptTemplate.fromTemplate(`
You are an expert at parsing Bangladesh Customs tariff data. The PDF structure may have changed.

Extract all tariff entries from this text and return them in JSON format.

Text to parse:
{text}

Return JSON format:
{{
  "success": true,
  "tariffRows": [
    {{
      "hsCode": "string (8 digits)",
      "description": "string",
      "cd": number,
      "sd": number,
      "vat": number,
      "ait": number,
      "rd": number,
      "at": number,
      "tti": number
    }}
  ]
}}

Rules:
1. Extract all valid HS codes (8-digit numbers)
2. Extract descriptions (text between HS code and tariff rates)
3. Extract all tariff rates (CD, SD, VAT, AIT, RD, AT, TTI)
4. If a rate is missing or unclear, use 0
5. Only include rows with valid 8-digit HS codes

Response:
`);

    try {
      const chain = promptTemplate.pipe(llm);
      const result = await chain.invoke({
        text: fullText.substring(0, 50000), // Limit text size
      });

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : result;
      const aiResponse = JSON.parse(jsonString);

      if (!aiResponse.success || !aiResponse.tariffRows) {
        throw new Error("AI parsing failed to extract tariff data");
      }

      // Validate and clean the AI response
      const validRows = aiResponse.tariffRows.filter((row) => {
        return (
          row.hsCode &&
          /^\d{8}$/.test(row.hsCode) &&
          row.description &&
          typeof row.cd === "number"
        );
      });

      console.log(`🤖 AI extracted ${validRows.length} valid tariff rows`);
      return validRows;
    } catch (error) {
      console.error("❌ AI parsing failed:", error);
      throw new Error(`AI fallback parsing failed: ${error.message}`);
    }
  }

  createChunksFromTariffData(tariffRows) {
    const chunks = [];
    const chunkSize = 50; // Group 50 HS codes per chunk

    for (let i = 0; i < tariffRows.length; i += chunkSize) {
      const chunkRows = tariffRows.slice(i, i + chunkSize);
      const content = this.formatChunkContent(chunkRows);

      chunks.push({
        content,
        metadata: {
          startHsCode: chunkRows[0].hsCode,
          endHsCode: chunkRows[chunkRows.length - 1].hsCode,
          rowCount: chunkRows.length,
          documentType: "tariff",
        },
      });
    }

    return chunks;
  }

  formatChunkContent(rows) {
    return rows
      .map(
        (row) =>
          `HS Code: ${row.hsCode}\nDescription: ${row.description}\nTariff Rates: CD=${row.cd}%, SD=${row.sd}%, VAT=${row.vat}%, AIT=${row.ait}%, RD=${row.rd}%, AT=${row.at}%, TTI=${row.tti}%`
      )
      .join("\n\n");
  }

  async storeChunks(chunks, documentInfo) {
    console.log(
      `🔄 Starting database transaction for ${chunks.length} chunks...`
    );

    try {
      // Start transaction - store new data first without deleting old data
      const batchSize = 10;
      const allDocuments = [];

      // Process all chunks and prepare documents
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);

        // Generate embeddings for batch
        const contents = batch.map((chunk) => chunk.content);
        const embeddings = await this.embeddings.embedDocuments(contents);

        // Prepare data for insertion
        const documents = batch.map((chunk, index) => ({
          content: chunk.content,
          metadata: {
            ...chunk.metadata,
            version: documentInfo.version,
            documentType: documentInfo.type,
          },
          embedding: embeddings[index],
        }));

        allDocuments.push(...documents);
        console.log(
          `📊 Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            chunks.length / batchSize
          )}`
        );
      }

      // Insert all new documents
      console.log(`💾 Inserting ${allDocuments.length} documents...`);
      const { error: insertError } = await this.supabase
        .from("documents")
        .insert(allDocuments);

      if (insertError) {
        console.error("❌ Error inserting new documents:", insertError);
        throw new Error(`Failed to insert documents: ${insertError.message}`);
      }

      // Only after successful insertion, update document version
      console.log(`📝 Updating document version tracking...`);
      const { error: versionError } = await this.supabase
        .from("document_versions")
        .upsert({
          document_type: documentInfo.type,
          version: documentInfo.version,
          file_url: documentInfo.url,
          file_hash: documentInfo.hash,
          processed_at: new Date().toISOString(),
          is_active: true,
        });

      if (versionError) {
        console.error("❌ Error updating document version:", versionError);
        // Rollback: delete the documents we just inserted
        await this.supabase
          .from("documents")
          .delete()
          .eq("metadata->version", documentInfo.version)
          .eq("metadata->documentType", documentInfo.type);
        throw new Error(
          `Failed to update document version: ${versionError.message}`
        );
      }

      // Only after successful version update, clean up old documents
      console.log(`🧹 Cleaning up old documents...`);
      const { error: deleteError } = await this.supabase
        .from("documents")
        .delete()
        .eq("metadata->>documentType", "tariff")
        .neq("metadata->>version", documentInfo.version);

      if (deleteError) {
        console.warn(
          "⚠️ Warning: Could not clean up old documents:",
          deleteError
        );
        // Don't throw error here as the main operation was successful
      }

      console.log(
        `✅ Successfully stored ${allDocuments.length} documents for version ${documentInfo.version}`
      );
    } catch (error) {
      console.error("❌ Transaction failed, rolling back all changes:", error);

      // Cleanup: remove any documents that might have been inserted
      try {
        await this.supabase
          .from("documents")
          .delete()
          .eq("metadata->>version", documentInfo.version)
          .eq("metadata->>documentType", documentInfo.type);
        console.log(
          "🧹 Rollback completed - removed any partially inserted documents"
        );
      } catch (rollbackError) {
        console.error("❌ Rollback failed:", rollbackError);
      }

      throw error; // Re-throw the original error
    }
  }
}
