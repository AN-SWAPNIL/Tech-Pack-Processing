import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import axios from "axios";
import * as cheerio from "cheerio";

export class AILinkExtractor {
  constructor() {
    this.llm = new ChatGoogleGenerativeAI({
      modelName: "gemini-1.5-pro",
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
4. Guess document type from filename (tariff, budget, sro, finance, instruction, etc.)

Expected patterns:
- href='/files/[anything].pdf'
- href='/files/Tariff-*.pdf' 
- href='/files/Budget*.pdf'
- href='/files/SRO*.pdf'

Return JSON format:
{{
  "success": true,
  "documents": [
    {{
      "url": "https://customs.gov.bd/files/[filename].pdf",
      "title": "document_title_from_link_text", 
      "version": "extracted_year_if_found",
      "type": "tariff|budget|sro|finance_bill|instructions|other",
      "confidence": 0.95
    }}
  ],
  "error": "error_message_if_failed"
}}

Response:
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
}
