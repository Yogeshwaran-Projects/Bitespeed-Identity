-- CreateEnum
CREATE TYPE "public"."LinkPrecedence" AS ENUM ('primary', 'secondary');

-- CreateTable
CREATE TABLE "public"."Contact" (
    "id" SERIAL NOT NULL,
    "phoneNumber" VARCHAR(191),
    "email" VARCHAR(191),
    "linkedId" INTEGER,
    "linkPrecedence" "public"."LinkPrecedence" NOT NULL DEFAULT 'primary',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "public"."Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_phoneNumber_idx" ON "public"."Contact"("phoneNumber");

-- CreateIndex
CREATE INDEX "Contact_linkedId_idx" ON "public"."Contact"("linkedId");
