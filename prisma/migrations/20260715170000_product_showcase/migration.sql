CREATE TYPE "VideoOutputMode" AS ENUM ('STANDARD', 'PRODUCT_SHOWCASE');

ALTER TABLE "Project"
ADD COLUMN "outputMode" "VideoOutputMode" NOT NULL DEFAULT 'STANDARD';

CREATE TABLE "ProjectProduct" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT,
    "websiteUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectProduct_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BrandSource" ADD COLUMN "productId" TEXT;

CREATE INDEX "ProjectProduct_projectId_sortOrder_idx"
ON "ProjectProduct"("projectId", "sortOrder");

CREATE INDEX "BrandSource_productId_idx" ON "BrandSource"("productId");

ALTER TABLE "ProjectProduct"
ADD CONSTRAINT "ProjectProduct_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrandSource"
ADD CONSTRAINT "BrandSource_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "ProjectProduct"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
