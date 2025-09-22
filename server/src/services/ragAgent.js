import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import getSupabaseClient from "../config/supabase.js";
import CustomGoogleGenerativeAIEmbeddings from "./customEmbeddings.js";
import { PDFMonitorScheduler } from "./pdfMonitorScheduler.js";

export class RAGAgent {
  constructor() {
    this.supabase = getSupabaseClient();
    this.embeddings = new CustomGoogleGenerativeAIEmbeddings({
      modelName: "models/gemini-embedding-001",
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: 1536,
      title: "HS Code Tariff Database",
    });
    this.llm = new ChatGoogleGenerativeAI({
      modelName: "gemini-1.5-pro",
      temperature: 0.1,
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    });

    this.promptTemplate = PromptTemplate.fromTemplate(`
You are an expert HS code classification specialist for Bangladesh Customs.

Context from Tariff Database ({contextRowCount} context rows provided):
{context}

Product Information:
- Garment Type: {garmentType}
- Fabric Type: {fabricType}
- Materials: {materials}
- Gender: {gender}
- Description: {description}

Instructions:
1. Analyze the provided tariff context to find relevant HS codes
2. Consider the product specifications and material composition
3. Provide AT LEAST {minSuggestions} most appropriate HS code suggestions with different codes (minimum of 5, or the number of context rows available, whichever is smaller)
4. Extract exact tariff rates (CD, SD, VAT, AIT, RD, AT, TTI) from the context
5. Include confidence levels and rationale
6. Use ALL available context rows to provide diverse and comprehensive suggestions
7. Return all suggestions with confidence >= 0.20 (20%)
8. Sort suggestions by confidence score in descending order (highest confidence first)

Response format (JSON only):
{{
  "success": true,
  "suggestions": [
    {{
      "code": "string (e.g., 6109.10.00)",
      "description": "string",
      "confidence": number (0.20-1.0, minimum 0.20 required),
      "rationale": ["string"],
      "tariffInfo": {{
        "CD": number,
        "SD": number,
        "VAT": number,
        "AIT": number,
        "RD": number,
        "AT": number,
        "TTI": number
      }}
    }}
  ]
}}

IMPORTANT: 
- Only include suggestions with confidence >= 0.20 (20%)
- Sort suggestions by confidence in descending order (highest first)
- Provide at least 5 suggestions if available context supports it

Response:
`);
  }

  async classifyHSCode(techPackInfo, query) {
    try {
      console.log(
        `🔍 Starting HS code classification for: ${techPackInfo.garmentType}`
      );

      // Check if vector store is empty and populate if needed
      await this.checkVectorStoreAndPopulate();

      // Build enhanced query
      const enhancedQuery = this.buildEnhancedQuery(techPackInfo, query);

      // Retrieve relevant documents using vector search
      const relevantDocs = await this.searchRelevantDocuments(enhancedQuery);

      if (relevantDocs.length === 0) {
        throw new Error(
          "No relevant HS code information found in the tariff database. Please ensure tariff documents are available or try a different query."
        );
      }

      console.log(`📚 Found ${relevantDocs.length} relevant document chunks`);

      // Combine context from retrieved documents
      const context = relevantDocs
        .map((doc) => doc.content)
        .join("\n\n---\n\n");

      console.log(`🤖 Generating HS code suggestions with AI...`);

      // Calculate minimum suggestions based on context rows
      const contextRowCount = relevantDocs.length;
      const minSuggestions = Math.min(contextRowCount, 5); // Changed from 3 to 5

      console.log(
        `📊 Using ${contextRowCount} context rows, requiring minimum ${minSuggestions} suggestions`
      );

      // Generate response using LLM
      const chain = this.promptTemplate.pipe(this.llm);
      const response = await chain.invoke({
        context,
        contextRowCount,
        minSuggestions,
        garmentType: techPackInfo.garmentType,
        fabricType: techPackInfo.fabricType,
        materials: techPackInfo.materialPercentage
          .map((m) => `${m.percentage}% ${m.material}`)
          .join(", "),
        gender: techPackInfo.gender,
        description: techPackInfo.description,
      });

      // Parse JSON response - handle AIMessage object from LangChain
      let responseString;
      if (typeof response === "string") {
        responseString = response;
      } else if (response && typeof response.content === "string") {
        responseString = response.content; // Extract content from AIMessage
      } else {
        responseString = response.toString();
      }

      console.log(
        `🔍 AI Response type: ${typeof response}, Content preview: ${responseString.substring(
          0,
          200
        )}...`
      );

      const jsonMatch = responseString.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseString;
      const result = JSON.parse(jsonString);

      if (!result.success) {
        throw new Error("Failed to generate HS code suggestions");
      }

      let suggestions = result.suggestions || [];

      // Filter suggestions by confidence >= 20%
      suggestions = suggestions.filter((suggestion) => {
        const confidence = suggestion.confidence || 0;
        return confidence >= 0.2;
      });

      // Sort suggestions by confidence in descending order
      suggestions.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

      const expectedMinimum = Math.min(relevantDocs.length, 5); // Changed from 3 to 5

      if (suggestions.length < expectedMinimum) {
        console.warn(
          `⚠️ Generated ${suggestions.length} suggestions with >=20% confidence, expected minimum ${expectedMinimum}`
        );
      }

      console.log(
        `✅ Generated ${suggestions.length} HS code suggestions from ${relevantDocs.length} context rows (confidence >=20%, sorted by confidence)`
      );
      return suggestions;
    } catch (error) {
      console.error("❌ RAG Agent error:", error);
      throw error;
    }
  }

  buildEnhancedQuery(techPackInfo, query) {
    const baseQuery = query || "Find appropriate HS code for this garment";

    // Create a more comprehensive query with fabric type and material keywords
    const fabricKeywords = {
      knit: ["knitted", "jersey", "sweater", "pullover", "cardigan", "t-shirt"],
      woven: ["woven", "shirt", "trouser", "jacket", "coat", "dress"],
    };

    const materialKeywords = techPackInfo.materialPercentage
      .map((m) => m.material.toLowerCase())
      .join(" ");

    const fabricTypeKeywords = fabricKeywords[techPackInfo.fabricType] || [];

    return `${baseQuery}
    
Product Details:
- Type: ${techPackInfo.garmentType}
- Fabric: ${techPackInfo.fabricType} ${fabricTypeKeywords.join(" ")}
- Materials: ${techPackInfo.materialPercentage
      .map((m) => `${m.percentage}% ${m.material}`)
      .join(", ")} ${materialKeywords}
- Gender: ${techPackInfo.gender}
- Description: ${techPackInfo.description}
- Keywords: garment clothing textile apparel ${techPackInfo.garmentType} ${
      techPackInfo.fabricType
    }`;
  }

  async searchRelevantDocuments(query) {
    try {
      console.log(
        `🔍 Performing vector search for: ${query.substring(0, 100)}...`
      );

      // Generate query embedding with RETRIEVAL_QUERY task type
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Search similar documents with higher match count for better context
      const { data, error } = await this.supabase.rpc("match_documents", {
        query_embedding: queryEmbedding,
        match_count: 15, // Increased from 5 to 15 for more context
        filter: { documentType: "tariff" },
      });

      if (error) {
        throw new Error(`Vector search failed: ${error.message}`);
      }

      let results = data || [];
      console.log(`📊 Vector search returned ${results.length} results`);

      // If we don't have enough results, try a broader search
      if (results.length < 5) {
        console.log(
          `🔍 Insufficient results (${results.length}), trying broader search...`
        );

        // Try a more general query
        const generalQuery = "HS code tariff garment clothing textile apparel";
        const generalEmbedding = await this.embeddings.embedQuery(generalQuery);

        const { data: broadData, error: broadError } = await this.supabase.rpc(
          "match_documents",
          {
            query_embedding: generalEmbedding,
            match_count: 10,
            filter: { documentType: "tariff" },
          }
        );

        if (!broadError && broadData) {
          // Merge results and remove duplicates
          const existingIds = new Set(results.map((r) => r.id));
          const newResults = broadData.filter((r) => !existingIds.has(r.id));
          results = [...results, ...newResults];
          console.log(
            `📊 Broader search added ${newResults.length} more results (total: ${results.length})`
          );
        }
      }

      return results;
    } catch (error) {
      console.error("❌ Vector search error:", error);
      throw error;
    }
  }

  // Additional method for direct HS code lookup
  async lookupHSCode(hsCode) {
    try {
      console.log(`🔍 Looking up HS code: ${hsCode}`);

      const { data, error } = await this.supabase
        .from("documents")
        .select("content, metadata")
        .like("content", `%${hsCode}%`)
        .eq("metadata->documentType", "tariff")
        .limit(5);

      if (error) {
        throw error;
      }

      console.log(
        `📊 Found ${data?.length || 0} matches for HS code ${hsCode}`
      );
      return data || [];
    } catch (error) {
      console.error(`❌ HS code lookup error for ${hsCode}:`, error);
      throw error;
    }
  }

  // Method to get database status
  async getDatabaseStatus() {
    try {
      const { data: versions, error: versionsError } = await this.supabase
        .from("document_versions")
        .select("*")
        .eq("is_active", true)
        .order("processed_at", { ascending: false });

      if (versionsError) {
        throw versionsError;
      }

      const { data: documentsCount, error: countError } = await this.supabase
        .from("documents")
        .select("id", { count: "exact" });

      if (countError) {
        throw countError;
      }

      return {
        activeVersions: versions || [],
        totalDocuments: documentsCount?.length || 0,
        lastUpdated: versions?.[0]?.processed_at || null,
      };
    } catch (error) {
      console.error("❌ Database status error:", error);
      throw error;
    }
  }

  // Method to check vector store and populate if empty
  async checkVectorStoreAndPopulate() {
    try {
      // Simple check: count documents in the table
      const { count, error } = await this.supabase
        .from("documents")
        .select("id", { count: "exact" });

      if (error) {
        console.warn("⚠️ Vector store check failed:", error.message);
        return;
      }

      if (count === 0) {
        console.log(
          "📊 Vector store is empty. Triggering PDF monitor to fetch latest tariff documents..."
        );

        const pdfScheduler = new PDFMonitorScheduler();
        await pdfScheduler.checkForPDFUpdatesWithRetry();

        console.log("✅ Vector store populated from RAG agent");
      } else {
        console.log(`📊 Vector store has ${count} documents available`);
      }
    } catch (error) {
      console.error("❌ Vector store check failed:", error.message);
      // Don't fail if vector store check fails - continue with search
    }
  }

  // Method to trigger PDF monitor when vector store is empty
  async triggerPDFMonitor() {
    try {
      console.log(
        "� Triggering PDF monitor to fetch latest tariff documents..."
      );

      const pdfScheduler = new PDFMonitorScheduler();

      // Manually trigger the PDF check to fetch latest documents
      await pdfScheduler.manualCheck();

      console.log("✅ PDF monitor execution completed");
    } catch (error) {
      console.error("❌ Error triggering PDF monitor:", error);
      throw error;
    }
  }
}
