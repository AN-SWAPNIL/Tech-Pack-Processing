-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Simple documents table for vector search
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  metadata JSONB, -- Now includes version, fileUrl, documentType, etc.
  embedding VECTOR(1536), -- Google embeddings dimension
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_documents_embedding ON documents
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Simple similarity search function
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 5,
  filter JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE d.metadata @> filter
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Customs tariff rates table for duty information
CREATE TABLE customs_tariff_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hs_code VARCHAR(10) NOT NULL,
  tariff_description TEXT NOT NULL,
  cd DECIMAL(8,3) DEFAULT 0, -- Customs Duty (increased precision)
  sd DECIMAL(8,3) DEFAULT 0, -- Supplementary Duty  
  vat DECIMAL(8,3) DEFAULT 0, -- VAT
  ait DECIMAL(8,3) DEFAULT 0, -- Advance Income Tax
  rd DECIMAL(8,3) DEFAULT 0, -- Regulatory Duty
  at DECIMAL(8,3) DEFAULT 0, -- Advance Tax
  tti DECIMAL(8,3) DEFAULT 0, -- Total Tax Incidence (increased precision)
  document_version VARCHAR(50) DEFAULT '2025-2026', -- Track which tariff version
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(hs_code, document_version)
);

-- Index for fast HS code lookup
CREATE INDEX idx_customs_tariff_rates_hs_code ON customs_tariff_rates(hs_code);
-- Index for fast version lookup
CREATE INDEX idx_customs_tariff_rates_version ON customs_tariff_rates(document_version);

-- NBR chapter documents table for vector search
CREATE TABLE chapter_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  metadata JSONB, -- {chapter: "Chapter-01", pdfLink: "https://...", year: "2025-2026", section: "01"}
  embedding VECTOR(1536),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for chapter documents embedding search
CREATE INDEX idx_chapter_documents_embedding ON chapter_documents
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Chapter documents similarity search function
CREATE OR REPLACE FUNCTION match_chapter_documents(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 5,
  filter JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM chapter_documents d
  WHERE (filter = '{}' OR d.metadata @> filter)
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;