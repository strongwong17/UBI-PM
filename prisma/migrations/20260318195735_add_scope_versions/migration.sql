-- CreateTable
CREATE TABLE "ScopeVersion" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByName" TEXT,
    "confirmToken" TEXT,
    "inquiryId" TEXT NOT NULL,

    CONSTRAINT "ScopeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScopeVersion_confirmToken_key" ON "ScopeVersion"("confirmToken");

-- AddForeignKey
ALTER TABLE "ScopeVersion" ADD CONSTRAINT "ScopeVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeVersion" ADD CONSTRAINT "ScopeVersion_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
