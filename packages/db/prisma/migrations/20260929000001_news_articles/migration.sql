CREATE TABLE "NewsArticle" (
    "id" UUID NOT NULL,
    "source" VARCHAR(80) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "originalUrl" TEXT NOT NULL,
    "canonicalUrlHash" CHAR(64) NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
    "language" VARCHAR(16),
    "sourceCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "affectedAssets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "category" VARCHAR(80),
    "priority" INTEGER,
    "impactScore" DOUBLE PRECISION,
    "classificationConfidence" DOUBLE PRECISION,
    "classifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsArticle_canonicalUrlHash_key" ON "NewsArticle"("canonicalUrlHash");
CREATE INDEX "NewsArticle_publishedAt_source_idx" ON "NewsArticle"("publishedAt", "source");
CREATE INDEX "NewsArticle_category_publishedAt_idx" ON "NewsArticle"("category", "publishedAt");
CREATE INDEX "NewsArticle_fetchedAt_idx" ON "NewsArticle"("fetchedAt");
CREATE INDEX "NewsArticle_affectedAssets_gin_idx" ON "NewsArticle" USING GIN ("affectedAssets");
