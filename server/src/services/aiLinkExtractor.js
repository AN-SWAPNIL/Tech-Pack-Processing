import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import axios from "axios";
import * as cheerio from "cheerio";

export class AILinkExtractor {
  constructor() {
    this.llm = new ChatGoogleGenerativeAI({
      modelName: "gemini-2.5-flash",
      temperature: 0.1,
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    });

    this.promptTemplate = PromptTemplate.fromTemplate(`
You are analyzing HTML content that contains PDF links from Bangladesh Customs website.

HTML Content (contains PDF links):
{htmlContent}

Task: Extract ALL PDF download links.

Instructions:
1. Find ALL href attributes ending with ".pdf" 
2. Convert relative paths to full URLs: https://customs.gov.bd + /files/filename.pdf
3. Extract the link text as the document title
4. Classify document type STRICTLY based on these rules:
   - "tariff": ONLY for simple tariff rate tables (usually named "Tariff-YYYY-YYYY*.pdf" - these contain HS codes with duty rates)
   - "bct": For Bangladesh Customs Tariff legal documents (usually "BCT-*.pdf" - these are legal text, not rate tables)
   - "budget": For budget documents
   - "sro": For SRO documents  
   - "finance_bill": For finance bill documents
   - "instructions": For instruction documents
   - "other": For anything else
5. Return ONLY valid JSON - no code, no explanations, no markdown

CRITICAL: Your response must be ONLY a valid JSON object. Do not include any other text, code, or explanations.

IMPORTANT: Only classify as "tariff" if the document contains actual tariff RATES/TABLES, not legal text or explanations.

Expected patterns:
- href='/files/[anything].pdf'
- href='/files/Tariff-*.pdf' → type: "tariff" (rate tables)
- href='/files/BCT-*.pdf' → type: "bct" (legal documents)
- href='/files/Budget*.pdf' → type: "budget"
- href='/files/SRO*.pdf' → type: "sro"

JSON format (ONLY):
{{
  "success": true,
  "documents": [
    {{
      "url": "https://customs.gov.bd/files/[filename].pdf",
      "title": "document_title_from_link_text", 
      "version": "extracted_year_if_found",
      "type": "tariff|bct|budget|sro|finance_bill|instructions|other",
      "confidence": 0.95
    }}
  ],
  "error": "error_message_if_failed"
}}
`);
  }

  async extractPDFLinks(websiteUrl) {
    try {
      console.log(`🔍 Fetching website content from: ${websiteUrl}`);

      // Fetch website content
      const response = await axios.get(websiteUrl, {
        timeout: 30000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const $ = cheerio.load(response.data);

      // Clean HTML for AI processing
      const cleanHTML = this.cleanHTMLForAI($);

      console.log(
        `🤖 Processing HTML content with AI (${cleanHTML.length} chars)...`
      );

      // Use AI to extract PDF links
      const chain = this.promptTemplate.pipe(this.llm);
      const llmResponse = await chain.invoke({ htmlContent: cleanHTML });

      console.log(`✅ AI processing completed`);

      // Extract content from LangChain response
      const result =
        typeof llmResponse === "string"
          ? llmResponse
          : llmResponse.content ||
            llmResponse.text ||
            JSON.stringify(llmResponse);

      console.log(
        `🔍 AI Response type: ${typeof llmResponse}, Content preview: ${result.substring(
          0,
          200
        )}...`
      );

      // Parse AI response - handle both plain JSON and markdown-wrapped JSON
      let jsonString;

      // First try to extract JSON from markdown code blocks
      const markdownJsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/);
      if (markdownJsonMatch) {
        jsonString = markdownJsonMatch[1].trim();
      } else {
        // Fallback to extracting JSON object directly
        const jsonMatch = result.match(/\{[\s\S]*?\}(?=\s*(?:\n|$|```|\*\*))/);
        jsonString = jsonMatch ? jsonMatch[0] : result;
      }

      console.log(`📝 Extracted JSON: ${jsonString.substring(0, 100)}...`);

      const aiResponse = JSON.parse(jsonString);

      if (!aiResponse.success) {
        throw new Error(aiResponse.error || "AI extraction failed");
      }

      const documents = aiResponse.documents.map((doc) => ({
        url: this.normalizeUrl(doc.url, websiteUrl),
        title: doc.title,
        version: doc.version,
        type: doc.type,
        confidence: doc.confidence,
        lastModified: doc.lastModified,
      }));

      console.log(`📄 Extracted ${documents.length} PDF documents`);
      return documents;
    } catch (error) {
      console.error("❌ AI Link extraction error:", error);
      throw error;
    }
  }

  cleanHTMLForAI($) {
    // Extract only PDF links - much simpler and more reliable
    let pdfSections = [];

    // 1. Find all PDF links directly
    $("a[href*='.pdf']").each((i, link) => {
      const href = $(link).attr("href");
      const text = $(link).text().trim();
      const parent = $(link).parent().html();

      if (href && href.includes(".pdf")) {
        pdfSections.push(`<a href="${href}">${text}</a>`);
        pdfSections.push(`<!-- Context: ${parent} -->`);
      }
    });

    // 2. Search for PDF patterns in the full HTML using regex
    const fullHtml = $.html();
    const pdfLinkPattern = /href=['"][^'"]*\.pdf[^'"]*['"][^>]*>([^<]*)</gi;
    let match;

    while ((match = pdfLinkPattern.exec(fullHtml)) !== null) {
      pdfSections.push(match[0]);
    }

    // If no PDFs found in links, search for any .pdf patterns in text
    if (pdfSections.length === 0) {
      const pdfTextPattern = /[^'">\s]*\.pdf[^'"<\s]*/gi;
      const pdfMatches = fullHtml.match(pdfTextPattern);
      if (pdfMatches) {
        pdfSections.push(
          `<!-- PDF patterns found: ${pdfMatches.join(", ")} -->`
        );
      }
    }

    return pdfSections.join("\n\n").substring(0, 10000);
  }

  containsTariffKeywords(text) {
    // Simplified - just check for .pdf
    return text.toLowerCase().includes(".pdf");
  }

  normalizeUrl(url, baseUrl) {
    if (url.startsWith("http")) return url;
    if (url.startsWith("/")) return new URL(url, baseUrl).href;
    return new URL(url, baseUrl).href;
  }

  // NBR specific methods for year checking and link extraction
  async checkNBRYearUpdate() {
    try {
      console.log("🔍 Checking NBR for year updates...");

      // Use hardcoded fallback year since NBR year detection often fails
      const fallbackYear = "2025-2026";

      try {
        const response = await axios.get(
          "https://nbr.gov.bd/taxtype/tariff-schedule/eng",
          {
            headers: {
              "User-Agent": "Mozilla/5.0",
              Origin: "https://nbr.gov.bd",
              "X-Requested-With": "XMLHttpRequest",
            },
            timeout: 15000, // Reduced timeout for faster fallback
          }
        );

        // Simple regex check for year patterns instead of complex AI analysis
        const yearPattern = /20\d{2}-20\d{2}/g;
        const foundYears = [...response.data.matchAll(yearPattern)]
          .map((match) => match[0])
          .filter((year, index, arr) => arr.indexOf(year) === index) // Remove duplicates
          .sort((a, b) => b.localeCompare(a)); // Sort descending (newest first)

        const currentYear = foundYears[0] || fallbackYear;

        console.log(`📅 Found NBR years: ${foundYears.join(", ")}`);
        console.log(`📅 Using current year: ${currentYear}`);

        return {
          success: true,
          currentYear: currentYear,
          availableYears: foundYears.length > 0 ? foundYears : [fallbackYear],
          isUpdated: true,
          error: null,
        };
      } catch (fetchError) {
        console.warn(
          `⚠️ NBR website fetch failed, using fallback year: ${fallbackYear}`
        );
        return {
          success: true,
          currentYear: fallbackYear,
          availableYears: [fallbackYear],
          isUpdated: true,
          error: null,
        };
      }
    } catch (error) {
      console.error("❌ Error checking NBR year update:", error);
      return {
        success: false,
        error: error.message,
        isUpdated: false,
      };
    }
  }

  async extractNBRChapterLinks(year = "2025-2026") {
    try {
      console.log(`📋 Extracting NBR chapter links for year: ${year}`);

      const response = await axios.post(
        "https://nbr.gov.bd/frontend_controllers/taxtypes_controller/tariff_schedule_by_year/eng",
        `SelectYear=${year}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Origin: "https://nbr.gov.bd",
            Referer: "https://nbr.gov.bd/taxtype/tariff-schedule/eng",
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 30000,
        }
      );

      const promptTemplate = PromptTemplate.fromTemplate(`
You are analyzing HTML content from Bangladesh NBR website containing tariff schedule chapter links.

HTML Content:
{htmlContent}

Task: Extract ALL PDF chapter links from the HTML content.

Instructions:
1. Find ALL href attributes ending with ".pdf" 
2. Extract the chapter name/number from link text
3. Ensure URLs are complete: https://nbr.gov.bd/uploads/tariff_schedule/[filename].pdf
4. Extract section information if available
5. Return ONLY valid JSON - no code, no explanations, no markdown

CRITICAL: Your response must be ONLY a valid JSON object. Do not include any other text, code, or explanations.

JSON format (ONLY):
{{
  "success": true,
  "year": "{year}",
  "chapters": [
    {{
      "chapter": "Chapter-01",
      "pdfLink": "https://nbr.gov.bd/uploads/tariff_schedule/Chapter-011.pdf",
      "section": "01"
    }},
    {{
      "chapter": "Chapter-62", 
      "pdfLink": "https://nbr.gov.bd/uploads/tariff_schedule/Chapter-626.pdf",
      "section": "11"
    }}
  ],
  "totalChapters": 98,
  "error": null
}}
`);

      const prompt = await promptTemplate.format({
        htmlContent: response.data,
        year: year,
      });

      console.log(
        `🔍 NBR Chapter HTML Content (first 1000 chars): ${response.data.substring(
          0,
          1000
        )}`
      );
      console.log(
        `🤖 Chapter extraction prompt: ${prompt.substring(0, 500)}...`
      );

      const result = await this.llm.invoke(prompt);

      // Extract content from LangChain response
      const resultContent =
        typeof result === "string"
          ? result
          : result.content || result.text || JSON.stringify(result);

      console.log(`🤖 Raw Chapter AI Response: ${resultContent}`);

      // Parse AI response - handle both plain JSON and markdown-wrapped JSON
      let jsonString;

      // First try to extract JSON from markdown code blocks
      const markdownJsonMatch = resultContent.match(
        /```json\s*([\s\S]*?)\s*```/
      );
      if (markdownJsonMatch) {
        jsonString = markdownJsonMatch[1].trim();
        console.log(`📝 Chapter JSON from markdown: ${jsonString}`);
      } else {
        // Fallback to extracting JSON object directly
        const jsonMatch = resultContent.match(
          /\{[\s\S]*?\}(?=\s*(?:\n|$|```|\*\*))/
        );
        jsonString = jsonMatch ? jsonMatch[0] : resultContent;
        console.log(`📝 Chapter JSON directly: ${jsonString}`);
      }

      const parsedResult = JSON.parse(jsonString);
      console.log(`✅ Parsed NBR chapters result:`, parsedResult);

      return parsedResult;
    } catch (error) {
      console.error("❌ Error extracting NBR chapter links:", error);
      return {
        success: false,
        error: error.message,
        chapters: [],
      };
    }
  }
}
