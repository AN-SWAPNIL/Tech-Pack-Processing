import { GoogleGenerativeAI } from "@google/generative-ai";
import { Embeddings } from "@langchain/core/embeddings";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Custom Google Generative AI Embeddings with outputDimensionality support
 * Extends the base functionality to support the outputDimensionality parameter
 * for the gemini-embedding-001 model
 */
export class CustomGoogleGenerativeAIEmbeddings extends Embeddings {
  constructor(fields = {}) {
    super(fields);

    this.modelName = fields.modelName || "models/gemini-embedding-001";
    this.apiKey = fields.apiKey || getEnvironmentVariable("GOOGLE_API_KEY");
    this.taskType = fields.taskType || "RETRIEVAL_DOCUMENT";
    this.outputDimensionality = fields.outputDimensionality || 1536;
    this.title = fields.title;

    if (!this.apiKey) {
      throw new Error("Google API key not found");
    }

    this.client = new GoogleGenerativeAI(this.apiKey);
  }

  /**
   * Embed a single query text
   */
  async embedQuery(text) {
    return this.embedText(text, "RETRIEVAL_QUERY");
  }

  /**
   * Embed multiple documents
   */
  async embedDocuments(documents) {
    const embeddings = [];

    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map((doc) => this.embedText(doc, "RETRIEVAL_DOCUMENT"))
      );
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  /**
   * Internal method to embed text with specific task type
   */
  async embedText(text, taskType = null) {
    try {
      const effectiveTaskType = taskType || this.taskType;

      const model = this.client.getGenerativeModel({
        model: this.modelName,
      });

      // Build request parameters
      const requestParams = {
        content: {
          parts: [{ text: text }],
        },
        taskType: effectiveTaskType,
        outputDimensionality: this.outputDimensionality,
      };

      // Only add title for RETRIEVAL_DOCUMENT task type
      if (effectiveTaskType === "RETRIEVAL_DOCUMENT" && this.title) {
        requestParams.title = this.title;
      }

      // Use the correct embedContent API format
      const result = await model.embedContent(requestParams);

      if (!result.embedding || !result.embedding.values) {
        throw new Error("No embedding returned from API");
      }

      return result.embedding.values;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }
}

export default CustomGoogleGenerativeAIEmbeddings;
