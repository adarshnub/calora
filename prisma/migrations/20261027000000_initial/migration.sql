-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";


-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleConnection" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'green',
    "grantedScopes" TEXT[],
    "encryptedTokens" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'connected',
    "credentialVersion" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthTransaction" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expectedSub" TEXT,
    "returnPath" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSource" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "googleCalendarId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "accessRole" TEXT NOT NULL,
    "accessStatus" TEXT NOT NULL DEFAULT 'available',
    "accessStatusVersion" INTEGER NOT NULL DEFAULT 1,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "displayColor" TEXT,
    "lastDiscoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,

    CONSTRAINT "CalendarSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventReference" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,

    CONSTRAINT "EventReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSnapshot" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "rangeStart" TIMESTAMP(3) NOT NULL,
    "rangeEnd" TIMESTAMP(3) NOT NULL,
    "queryZone" TEXT NOT NULL,
    "queryVersion" INTEGER NOT NULL DEFAULT 1,
    "generation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'staging',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotEvent" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "eventReferenceId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "startInstant" TIMESTAMP(3),
    "endInstant" TIMESTAMP(3),
    "startDate" TEXT,
    "endDate" TEXT,
    "data" JSONB NOT NULL,

    CONSTRAINT "SnapshotEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "ownerId" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("ownerId")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceIds" TEXT[],
    "mode" TEXT NOT NULL DEFAULT 'merged',

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "GoogleConnection_ownerId_status_idx" ON "GoogleConnection"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleConnection_ownerId_googleSub_key" ON "GoogleConnection"("ownerId", "googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthTransaction_stateHash_key" ON "OAuthTransaction"("stateHash");

-- CreateIndex
CREATE INDEX "OAuthTransaction_expiresAt_idx" ON "OAuthTransaction"("expiresAt");

-- CreateIndex
CREATE INDEX "CalendarSource_connectionId_idx" ON "CalendarSource"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSource_connectionId_googleCalendarId_key" ON "CalendarSource"("connectionId", "googleCalendarId");

-- CreateIndex
CREATE UNIQUE INDEX "EventReference_sourceId_googleEventId_key" ON "EventReference"("sourceId", "googleEventId");

-- CreateIndex
CREATE INDEX "CalendarSnapshot_sourceId_rangeStart_rangeEnd_status_idx" ON "CalendarSnapshot"("sourceId", "rangeStart", "rangeEnd", "status");

-- CreateIndex
CREATE INDEX "CalendarSnapshot_expiresAt_idx" ON "CalendarSnapshot"("expiresAt");

-- CreateIndex
CREATE INDEX "SnapshotEvent_snapshotId_startInstant_idx" ON "SnapshotEvent"("snapshotId", "startInstant");

-- CreateIndex
CREATE INDEX "SnapshotEvent_snapshotId_startDate_idx" ON "SnapshotEvent"("snapshotId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotEvent_snapshotId_googleEventId_key" ON "SnapshotEvent"("snapshotId", "googleEventId");

-- CreateIndex
CREATE INDEX "SavedView_ownerId_idx" ON "SavedView"("ownerId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleConnection" ADD CONSTRAINT "GoogleConnection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthTransaction" ADD CONSTRAINT "OAuthTransaction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSource" ADD CONSTRAINT "CalendarSource_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "GoogleConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReference" ADD CONSTRAINT "EventReference_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CalendarSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSnapshot" ADD CONSTRAINT "CalendarSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CalendarSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotEvent" ADD CONSTRAINT "SnapshotEvent_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CalendarSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotEvent" ADD CONSTRAINT "SnapshotEvent_eventReferenceId_fkey" FOREIGN KEY ("eventReferenceId") REFERENCES "EventReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce one published generation per exact query key.
CREATE UNIQUE INDEX "CalendarSnapshot_one_active_query"
ON "CalendarSnapshot" ("sourceId", "rangeStart", "rangeEnd", "queryZone", "queryVersion")
WHERE "status" = 'active';

-- Timed instants and date-only all-day values are mutually exclusive.
ALTER TABLE "SnapshotEvent" ADD CONSTRAINT "SnapshotEvent_typed_interval" CHECK (
  ("startInstant" IS NOT NULL AND "endInstant" > "startInstant" AND "startDate" IS NULL AND "endDate" IS NULL)
  OR ("startInstant" IS NULL AND "endInstant" IS NULL AND "startDate" IS NOT NULL AND "endDate" > "startDate")
);
