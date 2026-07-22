-- CreateTable
CREATE TABLE "StagePreset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StagePreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagePresetStage" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "offsetDays" INTEGER,
    "durationDays" INTEGER,

    CONSTRAINT "StagePresetStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagePresetTask" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "offsetDays" INTEGER,

    CONSTRAINT "StagePresetTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StagePreset_ownerId_idx" ON "StagePreset"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "StagePreset_ownerId_name_key" ON "StagePreset"("ownerId", "name");

-- CreateIndex
CREATE INDEX "StagePresetStage_presetId_idx" ON "StagePresetStage"("presetId");

-- CreateIndex
CREATE INDEX "StagePresetTask_stageId_idx" ON "StagePresetTask"("stageId");

-- AddForeignKey
ALTER TABLE "StagePreset" ADD CONSTRAINT "StagePreset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagePresetStage" ADD CONSTRAINT "StagePresetStage_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "StagePreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagePresetTask" ADD CONSTRAINT "StagePresetTask_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "StagePresetStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
