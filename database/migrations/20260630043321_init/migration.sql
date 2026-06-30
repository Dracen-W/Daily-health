-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "defaultWaterTargetMl" INTEGER NOT NULL DEFAULT 2000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppSettings_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IngredientScan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "imageName" TEXT NOT NULL,
    "imageMimeType" TEXT NOT NULL,
    "overallConfidence" TEXT NOT NULL,
    "uncertaintyNoteEn" TEXT NOT NULL,
    "uncertaintyNoteZh" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IngredientScan_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecognizedIngredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "displayNameEn" TEXT NOT NULL,
    "displayNameZh" TEXT NOT NULL,
    "estimatedAmount" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecognizedIngredient_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "IngredientScan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EpicurePairing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT NOT NULL,
    "sourceIngredient" TEXT NOT NULL,
    "suggestedIngredient" TEXT NOT NULL,
    "score" REAL,
    "category" TEXT,
    "reasonEn" TEXT NOT NULL,
    "reasonZh" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EpicurePairing_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "IngredientScan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "sourceScanId" TEXT,
    "cuisineStyle" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "estimatedCookingMinutes" INTEGER NOT NULL,
    "servings" INTEGER NOT NULL,
    "estimatedCaloriesPerServing" INTEGER,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recipe_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recipe_sourceScanId_fkey" FOREIGN KEY ("sourceScanId") REFERENCES "IngredientScan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "nutritionDisclaimer" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecipeTranslation_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "isRecognizedIngredient" BOOLEAN NOT NULL DEFAULT false,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER,
    "instructionEn" TEXT NOT NULL,
    "instructionZh" TEXT NOT NULL,
    CONSTRAINT "RecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeTip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "contentEn" TEXT NOT NULL,
    "contentZh" TEXT NOT NULL,
    CONSTRAINT "RecipeTip_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeMissingIngredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "RecipeMissingIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FoodLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "recipeId" TEXT,
    "date" TEXT NOT NULL,
    "mealCategory" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT,
    "calories" INTEGER,
    "notes" TEXT,
    "sourceType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FoodLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FoodLog_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaterEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amountMl" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaterEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaterTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "targetMl" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WaterTarget_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExerciseLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "estimatedCaloriesBurned" INTEGER,
    "date" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExerciseLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SleepLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hours" REAL NOT NULL,
    "quality" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SleepLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeightLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "weightKg" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeightLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_profileId_key" ON "AppSettings"("profileId");

-- CreateIndex
CREATE INDEX "AppSettings_profileId_idx" ON "AppSettings"("profileId");

-- CreateIndex
CREATE INDEX "IngredientScan_profileId_createdAt_idx" ON "IngredientScan"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "RecognizedIngredient_scanId_idx" ON "RecognizedIngredient"("scanId");

-- CreateIndex
CREATE INDEX "EpicurePairing_scanId_idx" ON "EpicurePairing"("scanId");

-- CreateIndex
CREATE INDEX "EpicurePairing_sourceIngredient_idx" ON "EpicurePairing"("sourceIngredient");

-- CreateIndex
CREATE INDEX "Recipe_profileId_idx" ON "Recipe"("profileId");

-- CreateIndex
CREATE INDEX "Recipe_sourceScanId_idx" ON "Recipe"("sourceScanId");

-- CreateIndex
CREATE INDEX "Recipe_isFavorite_idx" ON "Recipe"("isFavorite");

-- CreateIndex
CREATE INDEX "Recipe_createdAt_idx" ON "Recipe"("createdAt");

-- CreateIndex
CREATE INDEX "RecipeTranslation_recipeId_idx" ON "RecipeTranslation"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeTranslation_recipeId_locale_key" ON "RecipeTranslation"("recipeId", "locale");

-- CreateIndex
CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeStep_recipeId_idx" ON "RecipeStep"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeTip_recipeId_idx" ON "RecipeTip"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeMissingIngredient_recipeId_idx" ON "RecipeMissingIngredient"("recipeId");

-- CreateIndex
CREATE INDEX "FoodLog_profileId_date_idx" ON "FoodLog"("profileId", "date");

-- CreateIndex
CREATE INDEX "FoodLog_profileId_mealCategory_date_idx" ON "FoodLog"("profileId", "mealCategory", "date");

-- CreateIndex
CREATE INDEX "FoodLog_recipeId_idx" ON "FoodLog"("recipeId");

-- CreateIndex
CREATE INDEX "WaterEntry_profileId_date_idx" ON "WaterEntry"("profileId", "date");

-- CreateIndex
CREATE INDEX "WaterTarget_profileId_date_idx" ON "WaterTarget"("profileId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WaterTarget_profileId_date_key" ON "WaterTarget"("profileId", "date");

-- CreateIndex
CREATE INDEX "ExerciseLog_profileId_date_idx" ON "ExerciseLog"("profileId", "date");

-- CreateIndex
CREATE INDEX "SleepLog_profileId_date_idx" ON "SleepLog"("profileId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SleepLog_profileId_date_key" ON "SleepLog"("profileId", "date");

-- CreateIndex
CREATE INDEX "WeightLog_profileId_date_idx" ON "WeightLog"("profileId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WeightLog_profileId_date_key" ON "WeightLog"("profileId", "date");
