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
      modelName: "gemini-2.5-flash",
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
4. Include confidence levels and rationale
5. Use ALL available context rows to provide diverse and comprehensive suggestions
6. Return all suggestions with confidence >= 0.20 (20%) (this will only be applicable if AT LEAST {minSuggestions} suggestions is available)
7. Sort suggestions by confidence score in descending order (highest confidence first)

Response format (JSON only):
{{
  "success": true,
  "suggestions": [
    {{
      "code": "string (e.g., 6109.10.00)",
      "description": "string",
      "confidence": number (0.00-1.00),
      "rationale": ["string"]
    }}
  ]
}}

IMPORTANT: 
- Only include suggestions with confidence >= 0.15 (15%)
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

      // Build enhanced query with AI-generated alternatives
      const enhancedQuery = await this.buildEnhancedQuery(techPackInfo, query);

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

      // Filter suggestions by confidence >= 15% to be more inclusive
      suggestions = suggestions.filter((suggestion) => {
        const confidence = suggestion.confidence || 0;
        return confidence >= 0.15;
      });

      // Sort suggestions by confidence in descending order
      suggestions.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

      // Enhance suggestions with NBR metadata and customs duty information
      const enhancedSuggestions = await this.enhanceSuggestionsWithMetadata(
        suggestions,
        relevantDocs
      );

      const expectedMinimum = Math.min(relevantDocs.length, 5); // Changed from 3 to 5

      if (enhancedSuggestions.length < expectedMinimum) {
        console.warn(
          `⚠️ Generated ${enhancedSuggestions.length} suggestions with >=15% confidence, expected minimum ${expectedMinimum}`
        );
      }

      console.log(
        `✅ Generated ${enhancedSuggestions.length} HS code suggestions from ${relevantDocs.length} context rows (confidence >=15%, sorted by confidence)`
      );
      return enhancedSuggestions;
    } catch (error) {
      console.error("❌ RAG Agent error:", error);
      throw error;
    }
  }

  async generateSearchAlternatives(techPackInfo, originalQuery) {
    try {
      console.log(`🤖 Generating AI-powered search alternatives...`);

      const alternativePrompt = PromptTemplate.fromTemplate(`
You are an expert in textile industry terminology and Bangladesh customs HS code classification.

Product Information:
- Garment Type: {garmentType}
- Faasync bric Type: {fabricType} 
- Materials: {materials}
- Gender: {gender}
- Description: {description}

Original Search Query: {originalQuery}

Generate comprehensive search alternatives for this garment that would help find relevant HS codes in a tariff database. Include:

1. Alternative garment names and industry terms
2. Related fabric construction terms
3. Material composition alternatives
4. Industry-specific terminology
5. Bangladesh customs/tariff specific terms
6. HS code chapter references if applicable
7. Gender variations (men's, women's, unisex, children's)
8. Technical textile terms

Return ONLY a JSON array of alternative search terms (15-25 terms):
["term1", "term2", "term3", ...]

Focus on terms that would appear in official tariff classifications.
`);

      const response = await this.llm.invoke(
        await alternativePrompt.format({
          garmentType: techPackInfo.garmentType,
          fabricType: techPackInfo.fabricType,
          materials: techPackInfo.materialPercentage
            .map((m) => `${m.percentage}% ${m.material}`)
            .join(", "),
          gender: techPackInfo.gender,
          description: techPackInfo.description,
          originalQuery,
        })
      );

      // Parse the AI response
      let responseText =
        typeof response === "string" ? response : response.content;

      // Extract JSON array from response
      const jsonMatch = responseText.match(/\[([^\]]+)\]/);
      if (jsonMatch) {
        const alternatives = JSON.parse(jsonMatch[0]);
        console.log(
          `✨ Generated ${alternatives.length} AI-powered search alternatives`
        );
        return alternatives;
      } else {
        console.warn(`⚠️ Could not parse AI alternatives, using fallback`);
        return this.getFallbackAlternatives(techPackInfo);
      }
    } catch (error) {
      console.error(`❌ Error generating AI alternatives:`, error);
      return this.getFallbackAlternatives(techPackInfo);
    }
  }

  getFallbackAlternatives(techPackInfo) {
    // Fallback alternatives if AI fails

    // Create comprehensive search terms including alternatives
    const fabricKeywords = {
      knit: [
        "knitted",
        "jersey",
        "sweater",
        "pullover",
        "cardigan",
        "t-shirt",
        "knitwear",
      ],
      woven: ["woven", "shirt", "trouser", "jacket", "coat", "dress", "blouse"],
    };

    const fabricTypeKeywords = fabricKeywords[techPackInfo.fabricType] || [];

    // Gender-inclusive search terms
    const genderTerms = [
      "men's",
      "women's",
      "boys'",
      "girls'",
      "unisex",
      "children's",
      "adult",
      "male",
      "female",
    ];

    // Enhanced garment type alternatives
    const garmentAlternatives = {
      shirt: [
        "shirt",
        "blouse",
        "top",
        "polo",
        "button-down",
        "dress shirt",
        "casual shirt",
      ],
      blouse: ["blouse", "shirt", "top", "tunic", "camisole", "tank top"],
      trouser: [
        "trouser",
        "pant",
        "jean",
        "bottom",
        "slacks",
        "chinos",
        "cargo pants",
      ],
      dress: ["dress", "gown", "frock", "sundress", "maxi dress", "mini dress"],
      jacket: [
        "jacket",
        "blazer",
        "coat",
        "outerwear",
        "windbreaker",
        "bomber",
      ],
      "t-shirt": ["t-shirt", "tee", "top", "shirt", "polo shirt", "tank top"],
      sweater: [
        "sweater",
        "pullover",
        "jumper",
        "cardigan",
        "knit top",
        "jersey",
      ],
      cardigan: ["cardigan", "sweater", "knit jacket", "button-up sweater"],
      shorts: ["shorts", "short trouser", "bermuda", "cargo shorts"],
      skirt: [
        "skirt",
        "mini skirt",
        "maxi skirt",
        "pencil skirt",
        "a-line skirt",
      ],
      jeans: [
        "jeans",
        "denim",
        "trouser",
        "pant",
        "jean trouser",
        "denim trouser",
      ],
      polo: ["polo", "polo shirt", "t-shirt", "collared shirt", "golf shirt"],
      coat: ["coat", "overcoat", "winter coat", "trench coat", "raincoat"],
      vest: ["vest", "waistcoat", "sleeveless jacket", "gilet"],
      uniform: ["uniform", "work wear", "professional wear", "service uniform"],
      suit: [
        "suit",
        "business suit",
        "formal wear",
        "two-piece",
        "three-piece",
      ],
    };

    const garmentAlts = garmentAlternatives[
      techPackInfo.garmentType.toLowerCase()
    ] || [techPackInfo.garmentType];

    const basicTerms = [
      techPackInfo.garmentType,
      techPackInfo.fabricType,
      "apparel",
      "clothing",
      "textile",
      "garment",
      "HS code",
      "tariff",
      "customs",
      "classification",
      ...techPackInfo.materialPercentage.map((m) => m.material),
      ...genderTerms,
      ...garmentAlts,
      ...fabricTypeKeywords,
    ];

    return basicTerms;
  }

  async buildEnhancedQuery(techPackInfo, query) {
    const baseQuery = query || "Find appropriate HS code for this garment";

    // Generate AI-powered search alternatives
    const aiAlternatives = await this.generateSearchAlternatives(
      techPackInfo,
      baseQuery
    );

    // Always include gender variations
    const genderTerms = [
      "men's",
      "women's",
      "boys'",
      "girls'",
      "unisex",
      "children's",
      "adult",
      "male",
      "female",
    ];

    // Combine AI alternatives with gender terms
    const allAlternatives = [...new Set([...aiAlternatives, ...genderTerms])];

    return `${baseQuery}
    
Product Details:
- Type: ${techPackInfo.garmentType}
- Fabric: ${techPackInfo.fabricType}
- Materials: ${techPackInfo.materialPercentage
      .map((m) => `${m.percentage}% ${m.material}`)
      .join(", ")}
- Gender: ${techPackInfo.gender}
- Description: ${techPackInfo.description}

AI-Generated Search Alternatives:
${allAlternatives.join(" ")}

Tariff Classification Terms:
HS code tariff customs classification Bangladesh apparel textile garment clothing`;
  }

  async searchRelevantDocuments(query) {
    try {
      console.log(
        `🔍 Performing enhanced vector search for: ${query.substring(
          0,
          100
        )}...`
      );

      // Generate query embedding with RETRIEVAL_QUERY task type
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // PRIMARY SEARCH: Try NBR chapter documents first
      console.log(`🎯 Searching NBR chapter documents (primary)...`);

      const { data: nbrData, error: nbrError } = await this.supabase.rpc(
        "match_chapter_documents",
        {
          query_embedding: queryEmbedding,
          match_count: 15,
          filter: {},
        }
      );

      let results = [];
      let source = "nbr";

      if (nbrError) {
        console.warn(`⚠️ NBR search failed: ${nbrError.message}`);
      } else if (nbrData && nbrData.length > 0) {
        results = nbrData.map((doc) => ({
          ...doc,
          source: "nbr",
        }));
        console.log(`📊 NBR search returned ${results.length} results`);
      }

      // FALLBACK SEARCH: If NBR search fails or returns insufficient results
      if (results.length < 5) {
        console.log(
          `🔄 NBR results insufficient (${results.length}), falling back to customs documents...`
        );

        const { data: customsData, error: customsError } =
          await this.supabase.rpc("match_documents", {
            query_embedding: queryEmbedding,
            match_count: 15,
            filter: { documentType: "tariff" },
          });

        if (customsError) {
          console.error(
            `❌ Customs fallback search failed: ${customsError.message}`
          );
          if (results.length === 0) {
            throw new Error(`Both NBR and customs vector searches failed`);
          }
        } else if (customsData && customsData.length > 0) {
          const customsResults = customsData.map((doc) => ({
            ...doc,
            source: "customs",
          }));

          // Combine NBR and customs results, prioritizing NBR
          results = [...results, ...customsResults];
          source = results.some((r) => r.source === "nbr")
            ? "mixed"
            : "customs";

          console.log(
            `📊 Combined search returned ${results.length} results (NBR: ${
              results.filter((r) => r.source === "nbr").length
            }, Customs: ${
              results.filter((r) => r.source === "customs").length
            })`
          );
        }
      }

      // If still not enough results, try alternative search strategies
      if (results.length < 8) {
        console.log(
          `🔍 Still insufficient results (${results.length}), trying alternative searches...`
        );

        // Extract key terms from the enhanced query for focused searches
        const queryLines = query.split("\n");
        const alternativesLine = queryLines.find((line) =>
          line.includes("AI-Generated Search Alternatives:")
        );

        if (alternativesLine) {
          const alternatives = alternativesLine
            .replace("AI-Generated Search Alternatives:", "")
            .trim()
            .split(" ");

          // Try searches with different combinations of alternatives
          const searchVariations = [
            alternatives.slice(0, 5).join(" "), // First 5 alternatives
            alternatives.slice(5, 10).join(" "), // Next 5 alternatives
            alternatives
              .filter(
                (term) =>
                  term.includes("cotton") ||
                  term.includes("polyester") ||
                  term.includes("wool")
              )
              .join(" "), // Material focus
            alternatives
              .filter(
                (term) =>
                  term.includes("shirt") ||
                  term.includes("trouser") ||
                  term.includes("dress")
              )
              .join(" "), // Garment focus
          ];

          for (const variation of searchVariations) {
            if (variation.trim() && results.length < 12) {
              try {
                const variationEmbedding = await this.embeddings.embedQuery(
                  variation
                );
                const { data: varData } = await this.supabase.rpc(
                  "match_documents",
                  {
                    query_embedding: variationEmbedding,
                    match_count: 5,
                    filter: { documentType: "tariff" },
                  }
                );

                if (varData) {
                  const existingIds = new Set(results.map((r) => r.id));
                  const newResults = varData.filter(
                    (r) => !existingIds.has(r.id)
                  );
                  results = [...results, ...newResults];
                  console.log(
                    `📊 Alternative search "${variation.substring(
                      0,
                      30
                    )}..." added ${newResults.length} results`
                  );
                }
              } catch (err) {
                console.warn(
                  `⚠️ Alternative search failed for "${variation.substring(
                    0,
                    30
                  )}...": ${err.message}`
                );
              }
            }
          }
        }

        // Final fallback with general terms
        if (results.length < 5) {
          const generalQuery =
            "HS code tariff garment clothing textile apparel Bangladesh customs";
          const generalEmbedding = await this.embeddings.embedQuery(
            generalQuery
          );

          const { data: broadData, error: broadError } =
            await this.supabase.rpc("match_documents", {
              query_embedding: generalEmbedding,
              match_count: 8,
              filter: { documentType: "tariff" },
            });

          if (!broadError && broadData) {
            const existingIds = new Set(results.map((r) => r.id));
            const newResults = broadData.filter((r) => !existingIds.has(r.id));
            results = [...results, ...newResults];
            console.log(
              `📊 General fallback search added ${newResults.length} more results`
            );
          }
        }
      }

      console.log(`✨ Total search results: ${results.length}`);
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

  // // Method to get database status
  // async getDatabaseStatus() {
  //   try {
  //     // Get unique document types and versions from metadata
  //     const { data: documents, error: documentsError } = await this.supabase
  //       .from("documents")
  //       .select("metadata")
  //       .order("created_at", { ascending: false });

  //     if (documentsError) {
  //       throw documentsError;
  //     }

  //     // Extract version info from metadata
  //     const versions = documents
  //       .filter((doc) => doc.metadata?.version && doc.metadata?.documentType)
  //       .map((doc) => ({
  //         document_type: doc.metadata.documentType,
  //         version: doc.metadata.version,
  //         file_url: doc.metadata.fileUrl,
  //         processed_at: doc.metadata.created_at || new Date().toISOString(),
  //         is_active: true,
  //       }))
  //       .filter(
  //         (v, i, arr) =>
  //           // Remove duplicates based on document_type and version
  //           arr.findIndex(
  //             (item) =>
  //               item.document_type === v.document_type &&
  //               item.version === v.version
  //           ) === i
  //       );

  //     const { data: documentsCount, error: countError } = await this.supabase
  //       .from("documents")
  //       .select("id", { count: "exact" });

  //     if (countError) {
  //       throw countError;
  //     }

  //     return {
  //       activeVersions: versions || [],
  //       totalDocuments: documentsCount?.length || 0,
  //       lastUpdated: versions?.[0]?.processed_at || null,
  //     };
  //   } catch (error) {
  //     console.error("❌ Database status error:", error);
  //     throw error;
  //   }
  // }

  // Method to check vector store and populate if empty
  async checkVectorStoreAndPopulate() {
    try {
      // Check documents table (customs tariff documents)
      const { count: documentsCount, error: documentsError } =
        await this.supabase.from("documents").select("id", { count: "exact" });

      if (documentsError) {
        console.warn(
          "⚠️ Documents table check failed:",
          documentsError.message
        );
      }

      // Check chapter_documents table (NBR tariff documents)
      const { count: chapterCount, error: chapterError } = await this.supabase
        .from("chapter_documents")
        .select("id", { count: "exact" });

      if (chapterError) {
        console.warn(
          "⚠️ Chapter documents table check failed:",
          chapterError.message
        );
      }

      const documentsEmpty = documentsCount === 0;
      const chapterDocumentsEmpty = chapterCount === 0;

      if (documentsEmpty || chapterDocumentsEmpty) {
        console.log(
          `📊 Vector stores status - Documents: ${
            documentsCount || 0
          }, Chapter Documents: ${chapterCount || 0}`
        );

        if (documentsEmpty) {
          console.log(
            "📊 Documents table is empty. Triggering PDF monitor for customs tariff documents..."
          );
        }

        if (chapterDocumentsEmpty) {
          console.log(
            "📊 Chapter documents table is empty. Triggering NBR chapter processing..."
          );
        }

        const pdfScheduler = new PDFMonitorScheduler();
        await pdfScheduler.checkForPDFUpdatesWithRetry();

        console.log("✅ Vector stores populated from RAG agent");
      } else {
        console.log(
          `📊 Vector stores available - Documents: ${documentsCount}, Chapter Documents: ${chapterCount}`
        );
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

  // Enhance suggestions with NBR metadata and tariff info from database
  async enhanceSuggestionsWithMetadata(suggestions, relevantDocs) {
    try {
      console.log(
        `🔗 Enhancing ${suggestions.length} suggestions with metadata and tariff info...`
      );

      const enhancedSuggestions = [];

      for (const suggestion of suggestions) {
        let enhancedSuggestion = { ...suggestion };

        // Use the code field (which contains the HS code)
        const hsCode = suggestion.code;

        // Find the most relevant document for this suggestion
        const relevantDoc =
          relevantDocs.find(
            (doc) =>
              doc.content &&
              hsCode &&
              doc.content.toLowerCase().includes(hsCode.toLowerCase())
          ) || relevantDocs[0]; // Fallback to first doc if no exact match

        // Add NBR source information
        if (relevantDoc && relevantDoc.source) {
          enhancedSuggestion.source = relevantDoc.source;

          // Add NBR specific metadata if available
          if (relevantDoc.source === "nbr" && relevantDoc.metadata) {
            enhancedSuggestion.chapter = relevantDoc.metadata.chapter;
            enhancedSuggestion.pdfLink = relevantDoc.metadata.pdfLink;
            enhancedSuggestion.year = relevantDoc.metadata.year;
          }
        } else {
          enhancedSuggestion.source = "customs"; // Default fallback
        }

        // Fetch tariff information from customs_tariff_rates table
        if (hsCode) {
          try {
            const { data: tariffData } = await this.supabase
              .from("customs_tariff_rates")
              .select("*")
              .eq("hs_code", hsCode)
              .single();

            if (tariffData) {
              enhancedSuggestion.tariffInfo = {
                CD: tariffData.cd || 0,
                SD: tariffData.sd || 0,
                VAT: tariffData.vat || 0,
                AIT: tariffData.ait || 0,
                RD: tariffData.rd || 0,
                AT: tariffData.at || 0,
                TTI: tariffData.tti || 0,
              };
              console.log(`📊 Found tariff info for HS code ${hsCode}`);
            } else {
              console.warn(`⚠️ No tariff info found for HS code ${hsCode}`);
              // Set default values if no tariff data found
              enhancedSuggestion.tariffInfo = {
                CD: 0,
                SD: 0,
                VAT: 0,
                AIT: 0,
                RD: 0,
                AT: 0,
                TTI: 0,
              };
            }
          } catch (tariffError) {
            console.warn(
              `⚠️ Error fetching tariff info for HS code ${hsCode}:`,
              tariffError.message
            );
            // Set default values on error
            enhancedSuggestion.tariffInfo = {
              CD: 0,
              SD: 0,
              VAT: 0,
              AIT: 0,
              RD: 0,
              AT: 0,
              TTI: 0,
            };
          }
        }

        enhancedSuggestions.push(enhancedSuggestion);
      }

      console.log(
        `✅ Enhanced ${enhancedSuggestions.length} suggestions with metadata and tariff info`
      );
      return enhancedSuggestions;
    } catch (error) {
      console.error("❌ Error enhancing suggestions with metadata:", error);
      // Return original suggestions if enhancement fails
      return suggestions;
    }
  }
}
