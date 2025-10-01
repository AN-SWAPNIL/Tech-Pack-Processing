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
      // 1. Load PDF with appropriate separator for customs documents
      const fullText = await this.extractTextFromPDF(filePath, "customs");

      console.log(`📖 Extracted ${fullText.length} characters from PDF`);

      // Debug: Print first 2000 characters to see the structure
      console.log(`🔍 PDF Content Preview (first 2000 chars):`);
      console.log("=".repeat(80));
      console.log(fullText.substring(0, 2000));
      console.log("=".repeat(80));

      // Debug: Look for header patterns in the text
      const lines = fullText.split("\n").slice(0, 50); // First 50 lines
      console.log(`🔍 First 50 lines of PDF:`);
      lines.forEach((line, index) => {
        if (line.trim()) {
          console.log(`Line ${index + 1}: ${line.trim()}`);
        }
      });

      // 2. Parse tabular tariff data
      const tariffRows = this.parseTariffTable(fullText);
      console.log(`📊 Found ${tariffRows.length} tariff entries`);

      if (tariffRows.length === 0) {
        throw new Error("No valid tariff entries found in PDF");
      }

      // 3. Create chunks for vector search (group by HS code ranges)
      const chunks = this.createChunksFromTariffData(tariffRows);
      console.log(`📦 Created ${chunks.length} chunks for vector storage`);

      // 4. Store individual tariff rows in customs_tariff_rates table
      try {
        await this.storeTariffRates(tariffRows, documentInfo);
      } catch (tariffError) {
        console.error(
          "❌ Warning: Failed to store tariff rates:",
          tariffError.message
        );
        console.log(
          "⚠️ Continuing with vector storage despite tariff rates failure..."
        );
        // Don't throw error here - continue with vector storage
      }

      // 5. Generate embeddings and store chunks (with transaction safety)
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

    // Find the start of tariff data (after header) - improved detection for various formats
    let startIndex = -1;
    let headerLine = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toUpperCase();
      // Handle both spaced and concatenated headers
      if (
        ((line.includes("HSCODE") || line.includes("HS CODE")) &&
          (line.includes("DESCRIPTION") || line.includes("TARIFF")) &&
          (line.includes("CD") || line.includes("DUTY"))) ||
        // Handle concatenated format like "HscodeTARRIFF_DESCRIPTIONCDSDVATAITRDATTTI"
        (line.includes("HSCODE") &&
          line.includes("TARIFF_DESCRIPTION") &&
          line.includes("CD")) ||
        (line.includes("HSCODE") &&
          line.includes("DESCRIPTION") &&
          line.includes("CDSD"))
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

      // Validate and cap numeric values to prevent overflow
      const validateRate = (rate) => {
        const num = parseFloat(rate) || 0;
        return Math.min(Math.max(num, 0), 99999.999); // Cap at 99999.999 for DECIMAL(8,3)
      };

      return {
        hsCode,
        description,
        cd: validateRate(rates[0]),
        sd: validateRate(rates[1]),
        vat: validateRate(rates[2]),
        ait: validateRate(rates[3]),
        rd: validateRate(rates[4]),
        at: validateRate(rates[5]),
        tti: validateRate(rates[6]),
      };
    } catch (error) {
      return null;
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

  async storeTariffRates(tariffRows, documentInfo) {
    console.log(
      `💰 Storing ${tariffRows.length} tariff rates in customs_tariff_rates table...`
    );

    try {
      // Prepare tariff data for insertion
      const tariffData = tariffRows.map((row) => ({
        hs_code: row.hsCode,
        tariff_description: row.description,
        cd: row.cd || 0,
        sd: row.sd || 0,
        vat: row.vat || 0,
        ait: row.ait || 0,
        rd: row.rd || 0,
        at: row.at || 0,
        tti: row.tti || 0,
        document_version: documentInfo.version, // Add version tracking
        updated_at: new Date().toISOString(),
      }));

      // First, delete old tariff rates for this version to avoid conflicts
      console.log(
        `🧹 Cleaning up old tariff rates for version ${documentInfo.version}...`
      );
      const { error: deleteError } = await this.supabase
        .from("customs_tariff_rates")
        .delete()
        .eq("document_version", documentInfo.version);

      if (deleteError) {
        console.warn(
          "⚠️ Warning: Could not clean up old tariff rates:",
          deleteError
        );
      }

      // Insert new tariff rates in batches
      const batchSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < tariffData.length; i += batchSize) {
        const batch = tariffData.slice(i, i + batchSize);

        const { error: insertError } = await this.supabase
          .from("customs_tariff_rates")
          .insert(batch);

        if (insertError) {
          console.error(
            `❌ Error inserting tariff batch ${Math.floor(i / batchSize) + 1}:`,
            insertError
          );
          throw new Error(
            `Failed to insert tariff rates: ${insertError.message}`
          );
        }

        insertedCount += batch.length;
        console.log(
          `📊 Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            tariffData.length / batchSize
          )} (${insertedCount}/${tariffData.length} rates)`
        );
      }

      console.log(
        `✅ Successfully stored ${insertedCount} tariff rates for version ${documentInfo.version}`
      );
    } catch (error) {
      console.error("❌ Failed to store tariff rates:", error);
      throw new Error(`Tariff rates storage failed: ${error.message}`);
    }
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

        // Prepare data for insertion with file info in metadata
        const documents = batch.map((chunk, index) => ({
          content: chunk.content,
          metadata: {
            ...chunk.metadata,
            version: documentInfo.version,
            documentType: documentInfo.type,
            fileUrl: documentInfo.url,
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

      // Clean up old documents of the same type
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

  // NBR chapter-specific PDF processing
  async processNBRChapterPDF(filePath, chapterInfo) {
    console.log(
      `📄 Processing NBR Chapter PDF: ${chapterInfo.chapter} (${chapterInfo.year})`
    );

    try {
      // 1. Load PDF with appropriate separator for NBR chapters (no extra spaces)
      const fullText = await this.extractTextFromPDF(filePath, "nbr");

      console.log(
        `📖 Extracted ${fullText.length} characters from NBR chapter PDF`
      );

      // 2. Clean and prepare text for processing
      const cleanedText = this.cleanExtractedText(fullText);
      // const cleanedText = fullText; // Skip cleaning for now

      // 3. Check if content needs chunking (Google Gemini limit: ~36KB)
      const maxChunkSize = 30000; // Leave buffer for safety
      const needsChunking = cleanedText.length > maxChunkSize;

      if (needsChunking) {
        console.log(
          `📄 Large chapter detected (${cleanedText.length} chars), splitting into chunks...`
        );
        return await this.processLargeNBRChapter(cleanedText, chapterInfo);
      }

      // 4. Process as single document for smaller chapters
      const chapterDocument = {
        content: cleanedText,
        metadata: {
          chapter: chapterInfo.chapter,
          fileUrl: chapterInfo.pdfLink, // Standardized from pdfLink
          version: chapterInfo.year, // Standardized from year
          section: chapterInfo.section,
          documentType: "nbr_chapter",
        },
      };

      // 5. Generate embedding and store in chapter_documents table
      console.log(`🔗 Generating embedding for ${chapterInfo.chapter}...`);

      try {
        // Generate embedding for the entire chapter
        const embedding = await this.embeddings.embedQuery(
          chapterDocument.content
        );

        // Store in chapter_documents table
        const { error } = await this.supabase.from("chapter_documents").insert({
          content: chapterDocument.content,
          metadata: chapterDocument.metadata,
          embedding: embedding,
        });

        if (error) {
          console.error(
            `❌ Error storing chapter ${chapterInfo.chapter}:`,
            error
          );
          throw error;
        }

        // Clean up old versions of this chapter
        console.log(`🧹 Cleaning up old versions of ${chapterInfo.chapter}...`);
        const { error: cleanupError } = await this.supabase
          .from("chapter_documents")
          .delete()
          .eq("metadata->>chapter", chapterInfo.chapter)
          .neq("metadata->>version", chapterInfo.year);

        if (cleanupError) {
          console.warn(
            `⚠️ Warning: Could not clean up old versions of ${chapterInfo.chapter}:`,
            cleanupError
          );
        }

        console.log(
          `✅ Successfully stored chapter ${chapterInfo.chapter} (${chapterInfo.year})`
        );

        return {
          success: true,
          chapter: chapterInfo.chapter,
          chunksProcessed: 1, // Single document per chapter
          year: chapterInfo.year,
        };
      } catch (embeddingError) {
        console.error(
          `❌ Error generating embedding for chapter ${chapterInfo.chapter}:`,
          embeddingError
        );
        throw embeddingError;
      }
    } catch (error) {
      console.error(
        `❌ Error processing NBR chapter ${chapterInfo.chapter}:`,
        error
      );

      // Cleanup: remove any documents that might have been inserted for this chapter
      try {
        await this.supabase
          .from("chapter_documents")
          .delete()
          .eq("metadata->chapter", chapterInfo.chapter)
          .eq("metadata->year", chapterInfo.year);
        console.log(
          `🧹 Cleanup completed - removed any partially inserted data for ${chapterInfo.chapter}`
        );
      } catch (rollbackError) {
        console.error("❌ Cleanup failed:", rollbackError);
      }

      throw error;
    }
  }

  // Helper method to clean extracted text - simplified to only remove unnecessary elements
  cleanExtractedText(text) {
    if (!text) return "";

    return (
      text
        // Remove decorative underscores and lines (keep the content clean)
        .replace(/_{10,}/g, "\n")
        .replace(/-{10,}/g, "\n")
        .replace(/={10,}/g, "\n")

        // Remove repetitive headers and footers
        .replace(/^.*Bangladesh\s+Customs\s+Tariff\s*-\s*\d+.*$/gm, "")
        .replace(/^\s*\d+\s*-\s*Bangladesh.*Customs.*Tariff.*$/gm, "")
        .replace(/^[\s\-_]*\d+[\s\-_]*$/gm, "")

        // Clean up excessive whitespace (but preserve structure)
        .replace(/\n{4,}/g, "\n\n\n") // Limit excessive newlines
        .replace(/[ \t]{3,}/g, "  ") // Limit excessive spaces (preserve some for table alignment)
        .trim()
    );
  }

  // Method to handle large NBR chapters with chunking
  async processLargeNBRChapter(cleanedText, chapterInfo) {
    const maxChunkSize = 30000;
    const chunks = this.smartChunkText(cleanedText, maxChunkSize);

    console.log(`📊 Split into ${chunks.length} chunks for processing`);

    let processedChunks = 0;
    const errors = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkMetadata = {
        chapter: chapterInfo.chapter,
        fileUrl: chapterInfo.pdfLink, // Standardized from pdfLink
        version: chapterInfo.year, // Standardized from year
        section: chapterInfo.section,
        documentType: "nbr_chapter",
        chunkIndex: i + 1,
        totalChunks: chunks.length,
      };

      try {
        console.log(
          `🔗 Generating embedding for ${chapterInfo.chapter} chunk ${i + 1}/${
            chunks.length
          }...`
        );

        const embedding = await this.embeddings.embedQuery(chunk);

        const { error } = await this.supabase.from("chapter_documents").insert({
          content: chunk,
          metadata: chunkMetadata,
          embedding: embedding,
        });

        if (error) {
          console.error(`❌ Error storing chunk ${i + 1}:`, error);
          errors.push(error);
        } else {
          processedChunks++;
          console.log(`✅ Stored chunk ${i + 1}/${chunks.length}`);
        }
      } catch (error) {
        console.error(`❌ Error processing chunk ${i + 1}:`, error);
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      console.error(
        `❌ ${errors.length} chunks failed to process for ${chapterInfo.chapter}`
      );
      // If more than half failed, consider it a failure and cleanup
      if (errors.length > chunks.length / 2) {
        console.log(
          `🧹 Cleaning up failed chunks for ${chapterInfo.chapter}...`
        );
        try {
          await this.supabase
            .from("chapter_documents")
            .delete()
            .eq("metadata->>chapter", chapterInfo.chapter)
            .eq("metadata->>version", chapterInfo.year);
          console.log(
            `🧹 Cleanup completed - removed partial data for ${chapterInfo.chapter}`
          );
        } catch (cleanupError) {
          console.error(
            `❌ Error during cleanup for ${chapterInfo.chapter}:`,
            cleanupError
          );
        }
        throw new Error(
          `Too many chunks failed for ${chapterInfo.chapter}: ${errors.length}/${chunks.length}`
        );
      }
    }

    console.log(
      `✅ Successfully processed ${processedChunks}/${chunks.length} chunks for ${chapterInfo.chapter}`
    );

    // Clean up old versions of this chapter (only if processing was successful)
    if (errors.length === 0 || errors.length < chunks.length / 2) {
      console.log(`🧹 Cleaning up old versions of ${chapterInfo.chapter}...`);
      try {
        const { error: cleanupError } = await this.supabase
          .from("chapter_documents")
          .delete()
          .eq("metadata->>chapter", chapterInfo.chapter)
          .neq("metadata->>version", chapterInfo.year);

        if (cleanupError) {
          console.warn(
            `⚠️ Warning: Could not clean up old versions of ${chapterInfo.chapter}:`,
            cleanupError
          );
        } else {
          console.log(`✅ Cleaned up old versions of ${chapterInfo.chapter}`);
        }
      } catch (cleanupError) {
        console.warn(
          `⚠️ Warning: Cleanup failed for ${chapterInfo.chapter}:`,
          cleanupError
        );
      }
    }

    return {
      success: true,
      chapter: chapterInfo.chapter,
      chunksProcessed: processedChunks,
      totalChunks: chunks.length,
      errors: errors.length,
    };
  }

  // Smart text chunking that preserves tariff structure
  smartChunkText(text, maxSize) {
    const chunks = [];
    let currentChunk = "";

    // Split by tariff sections first (look for section headers)
    const sections = text.split(/(?=\n\s*(?:Section|SECTION)\s+[IVXLCDM]+)/i);

    for (const section of sections) {
      if (!section.trim()) continue;

      // If adding this section would exceed limit
      if (currentChunk.length + section.length + 2 > maxSize) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }

        // If single section is too large, split by chapters
        if (section.length > maxSize) {
          const chapters = section.split(/(?=\n\s*Chapter\s+\d+)/i);

          for (const chapter of chapters) {
            if (!chapter.trim()) continue;

            if (currentChunk.length + chapter.length + 2 > maxSize) {
              if (currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = "";
              }

              // If single chapter is too large, split by headings
              if (chapter.length > maxSize) {
                const headings = chapter.split(/(?=\n\s*\d{2}\.\d{2})/);

                for (const heading of headings) {
                  if (!heading.trim()) continue;

                  if (currentChunk.length + heading.length + 2 > maxSize) {
                    if (currentChunk.length > 0) {
                      chunks.push(currentChunk.trim());
                      currentChunk = "";
                    }

                    // If single heading is still too large, split by paragraphs
                    if (heading.length > maxSize) {
                      const paragraphs = heading.split("\n\n");

                      for (const paragraph of paragraphs) {
                        if (
                          currentChunk.length + paragraph.length + 2 >
                          maxSize
                        ) {
                          if (currentChunk.length > 0) {
                            chunks.push(currentChunk.trim());
                            currentChunk = "";
                          }

                          // Force split if still too large
                          if (paragraph.length > maxSize) {
                            const words = paragraph.split(" ");
                            for (const word of words) {
                              if (
                                currentChunk.length + word.length + 1 >
                                maxSize
                              ) {
                                if (currentChunk.length > 0) {
                                  chunks.push(currentChunk.trim());
                                  currentChunk = "";
                                }
                              }
                              currentChunk += (currentChunk ? " " : "") + word;
                            }
                          } else {
                            currentChunk = paragraph;
                          }
                        } else {
                          currentChunk +=
                            (currentChunk ? "\n\n" : "") + paragraph;
                        }
                      }
                    } else {
                      currentChunk = heading;
                    }
                  } else {
                    currentChunk += (currentChunk ? "\n" : "") + heading;
                  }
                }
              } else {
                currentChunk = chapter;
              }
            } else {
              currentChunk += (currentChunk ? "\n" : "") + chapter;
            }
          }
        } else {
          currentChunk = section;
        }
      } else {
        currentChunk += (currentChunk ? "\n" : "") + section;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    // Filter out empty chunks and ensure minimum content
    return chunks.filter((chunk) => chunk.trim().length > 100);
  }

  // Enhanced method to extract text using multiple PDF loaders with document type-specific separators
  async extractTextFromPDF(filePath, documentType = "nbr") {
    console.log(
      `🔍 Trying multiple PDF extraction methods for best text quality...`
    );

    // Choose separator based on document type
    const separator = documentType === "customs" ? " " : "";
    console.log(
      `📄 Using separator '${separator}' for ${documentType} document`
    );

    // Method 1: Try PDFLoader with appropriate separator
    try {
      console.log(`📄 Attempting PDFLoader with '${separator}' separator...`);
      const loader = new PDFLoader(filePath, {
        splitPages: false,
        parsedItemSeparator: separator,
      });
      const docs = await loader.load();
      const text = docs.map((doc) => doc.pageContent).join("\n");

      if (text && text.trim().length > 100) {
        console.log(
          `✅ PDFLoader (${documentType}) successful: ${text.length} characters`
        );
        return text;
      }
    } catch (primaryError) {
      console.warn(
        `⚠️ PDFLoader (${documentType}) failed: ${primaryError.message}`
      );
    }

    // Method 2: Try alternative separator as fallback
    const fallbackSeparator = documentType === "customs" ? "" : " ";
    try {
      console.log(
        `📄 Attempting PDFLoader with fallback separator '${fallbackSeparator}'...`
      );
      const fallbackLoader = new PDFLoader(filePath, {
        splitPages: false,
        parsedItemSeparator: fallbackSeparator,
      });
      const fallbackDocs = await fallbackLoader.load();
      const fallbackText = fallbackDocs
        .map((doc) => doc.pageContent)
        .join("\n");

      if (fallbackText && fallbackText.trim().length > 100) {
        console.log(
          `✅ PDFLoader (fallback) successful: ${fallbackText.length} characters`
        );
        return fallbackText;
      }
    } catch (fallbackError) {
      console.warn(`⚠️ PDFLoader (fallback) failed: ${fallbackError.message}`);
    }

    // Method 3: Try unpdf (modern alternative with optimized PDF.js)
    try {
      console.log(`📄 Attempting unpdf (modern PDF.js build)...`);
      const { extractText, getDocumentProxy } = await import("unpdf");
      const fs = await import("fs/promises");

      const buffer = await fs.readFile(filePath);
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });

      if (text && text.trim().length > 100) {
        console.log(`✅ unpdf successful: ${text.length} characters`);
        return text;
      }
    } catch (unpdfError) {
      console.warn(`⚠️ unpdf failed: ${unpdfError.message}`);
    }
    // Method 4: Final fallback using pdf-parse
    try {
      console.log(`📄 Final fallback to pdf-parse...`);
      const fs = await import("fs/promises");
      const pdfParse = (await import("pdf-parse")).default;

      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);

      if (data.text && data.text.trim().length > 100) {
        console.log(`✅ pdf-parse successful: ${data.text.length} characters`);
        return data.text;
      }
    } catch (pdfParseError) {
      console.warn(`⚠️ pdf-parse failed: ${pdfParseError.message}`);
    }

    throw new Error(
      "All PDF extraction methods failed - unable to extract readable text"
    );
  }
}
