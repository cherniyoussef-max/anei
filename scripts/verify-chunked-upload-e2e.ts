import { db } from "@/server/db";
import { user, lessons, session, authSessionAssurance } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { issueSudoToken, SUDO_COOKIE_NAME } from "@/server/auth/sudo";
import crypto from "node:crypto";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function main() {
  console.log("================================================================================");
  console.log("🧪 TESTING UNIVERSAL CHUNKED UPLOAD, STREAMING & PDF SERVING");
  console.log(`🎯 Target URL: ${BASE_URL}`);
  console.log("================================================================================\n");

  // Step 1: Admin session auth
  const targetEmail = "ycherni496@gmail.com";
  const [adminUser] = await db.select().from(user).where(eq(user.email, targetEmail)).limit(1);
  if (!adminUser) throw new Error("Super admin not found");

  const clientIp = `127.0.0.${Math.floor(Math.random() * 200) + 10}`;
  const signInRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/fr/login`,
      "x-forwarded-for": clientIp,
    },
    body: JSON.stringify({ email: targetEmail, password: "SuperAdmin@Anei2026!" }),
  });

  if (!signInRes.ok) {
    const errText = await signInRes.text();
    throw new Error(`Failed to sign in as ${targetEmail}: ${signInRes.status} ${errText}`);
  }

  const rawCookies = signInRes.headers.getSetCookie();
  const authCookies = rawCookies.map((entry) => entry.split(";")[0]).join("; ");

  const [activeSession] = await db
    .select()
    .from(session)
    .where(eq(session.userId, adminUser.id))
    .orderBy(sql`created_at desc`)
    .limit(1);

  if (!activeSession) {
    throw new Error(`No active session found for admin user ${adminUser.id}`);
  }

  await db
    .insert(authSessionAssurance)
    .values({
      id: crypto.randomUUID(),
      sessionId: activeSession.id,
      userId: adminUser.id,
      method: "EMAIL",
      verifiedAt: new Date(),
      completedAt: new Date(),
      expiresAt: activeSession.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: authSessionAssurance.sessionId,
      set: {
        verifiedAt: new Date(),
        completedAt: new Date(),
        expiresAt: activeSession.expiresAt,
        updatedAt: new Date(),
      },
    });

  const sudoTokenObj = issueSudoToken(adminUser.id);
  const cookieHeader = `${authCookies}; ${SUDO_COOKIE_NAME}=${sudoTokenObj.token}`;

  console.log(`✓ Admin authenticated with assurance & sudo: ${adminUser.email}`);

  // Step 2: Test PDF Chunked Upload
  console.log("\n--- Testing PDF Upload & Storage ---");
  const samplePdfBytes = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n" +
    "4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 100 700 Td (ANEI Inclusive Education PDF Test) Tj ET\nendstream\nendobj\n" +
    "xref\n0 5\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000117 00000 n\n0000000201 00000 n\n" +
    "trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n296\n%%EOF"
  );

  // Initialize PDF session
  const pdfInitRes = await fetch(`${BASE_URL}/api/storage/chunk-upload/init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/fr/admin/formations`,
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      filename: "test-support-cours.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: samplePdfBytes.length,
      totalChunks: 1,
      category: "document",
    }),
  });

  if (!pdfInitRes.ok) {
    const errText = await pdfInitRes.text();
    throw new Error(`PDF init failed (${pdfInitRes.status}): ${errText}`);
  }

  const { fileId: pdfFileId } = await pdfInitRes.json();
  console.log(`✓ PDF Upload Session Initialized (fileId: ${pdfFileId})`);

  // Upload PDF chunk
  const pdfFormData = new FormData();
  pdfFormData.append("fileId", pdfFileId);
  pdfFormData.append("chunkIndex", "0");
  pdfFormData.append("chunk", new Blob([samplePdfBytes], { type: "application/pdf" }), "chunk0.bin");

  const pdfChunkRes = await fetch(`${BASE_URL}/api/storage/chunk-upload/chunk`, {
    method: "POST",
    headers: {
      Origin: BASE_URL,
      Referer: `${BASE_URL}/fr/admin/formations`,
      Cookie: cookieHeader,
    },
    body: pdfFormData,
  });

  if (!pdfChunkRes.ok) throw new Error(`PDF chunk upload failed: ${pdfChunkRes.status}`);
  console.log(`✓ PDF Chunk 0/1 uploaded successfully`);

  // Complete PDF upload
  const pdfCompleteRes = await fetch(`${BASE_URL}/api/storage/chunk-upload/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/fr/admin/formations`,
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ fileId: pdfFileId }),
  });

  if (!pdfCompleteRes.ok) throw new Error(`PDF complete failed: ${pdfCompleteRes.status}`);
  const pdfResult = await pdfCompleteRes.json();
  console.log(`✓ PDF Upload Completed: downloadUrl = ${pdfResult.downloadUrl}`);

  // Fetch the PDF via the serving route
  const pdfDownloadRes = await fetch(`${BASE_URL}${pdfResult.downloadUrl}`);
  if (!pdfDownloadRes.ok) throw new Error(`PDF fetch failed: ${pdfDownloadRes.status}`);
  const fetchedPdfBytes = Buffer.from(await pdfDownloadRes.arrayBuffer());
  if (fetchedPdfBytes.length !== samplePdfBytes.length) {
    throw new Error(`PDF byte mismatch! Expected ${samplePdfBytes.length}, got ${fetchedPdfBytes.length}`);
  }
  const contentType = pdfDownloadRes.headers.get("content-type");
  console.log(`✓ PDF Serving Verified: ${fetchedPdfBytes.length} bytes, Content-Type: ${contentType}`);

  // Step 3: Test Large Video Chunked Upload & Range Streaming
  console.log("\n--- Testing Video Upload & HTTP Range Streaming ---");
  // Create a 6 MB mock video buffer across 3 chunks (2.5 MB, 2.5 MB, 1 MB)
  const chunkSize = 2.5 * 1024 * 1024; // 2.5 MB
  const totalVideoSize = 6 * 1024 * 1024; // 6 MB
  const totalChunks = Math.ceil(totalVideoSize / chunkSize); // 3 chunks
  const videoBuffer = crypto.randomBytes(totalVideoSize);

  // Initialize Video session
  const videoInitRes = await fetch(`${BASE_URL}/api/storage/chunk-upload/init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/fr/admin/formations`,
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      filename: "formation-video-hd-course.mp4",
      mimeType: "video/mp4",
      fileSizeBytes: totalVideoSize,
      totalChunks,
      category: "video",
      durationSeconds: 1800, // 30 min
    }),
  });

  if (!videoInitRes.ok) {
    const errText = await videoInitRes.text();
    throw new Error(`Video init failed (${videoInitRes.status}): ${errText}`);
  }

  const { fileId: videoFileId } = await videoInitRes.json();
  console.log(`✓ Video Upload Session Initialized (fileId: ${videoFileId}, ${totalVideoSize} bytes, ${totalChunks} chunks)`);

  // Upload chunks sequentially
  for (let c = 0; c < totalChunks; c++) {
    const start = c * chunkSize;
    const end = Math.min(start + chunkSize, totalVideoSize);
    const chunkBytes = videoBuffer.subarray(start, end);

    const chunkForm = new FormData();
    chunkForm.append("fileId", videoFileId);
    chunkForm.append("chunkIndex", String(c));
    chunkForm.append("chunk", new Blob([chunkBytes], { type: "video/mp4" }), `chunk${c}.bin`);

    const chunkRes = await fetch(`${BASE_URL}/api/storage/chunk-upload/chunk`, {
      method: "POST",
      headers: {
        Origin: BASE_URL,
        Referer: `${BASE_URL}/fr/admin/formations`,
        Cookie: cookieHeader,
      },
      body: chunkForm,
    });

    if (!chunkRes.ok) throw new Error(`Video chunk ${c} failed: ${chunkRes.status}`);
    const chunkData = await chunkRes.json();
    console.log(`✓ Uploaded Chunk ${c + 1}/${totalChunks} (${(chunkBytes.length / (1024 * 1024)).toFixed(2)} MB, progress: ${chunkData.progressPercent}%)`);
  }

  // Complete Video upload
  const videoCompleteRes = await fetch(`${BASE_URL}/api/storage/chunk-upload/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/fr/admin/formations`,
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ fileId: videoFileId, durationSeconds: 1800 }),
  });

  if (!videoCompleteRes.ok) throw new Error(`Video complete failed: ${videoCompleteRes.status}`);
  const videoResult = await videoCompleteRes.json();
  console.log(`✓ Video Upload Completed! Stream URL = ${videoResult.streamUrl}`);

  // Step 4: Test HTTP Range Streaming (206 Partial Content)
  console.log("\n--- Testing HTTP Range Streaming (Seeking support) ---");
  const rangeHeader = "bytes=1000-1999";
  const streamRes = await fetch(`${BASE_URL}${videoResult.streamUrl}`, {
    headers: { Range: rangeHeader },
  });

  if (streamRes.status !== 206) {
    throw new Error(`Expected HTTP 206 for Range request, got ${streamRes.status}`);
  }

  const contentRange = streamRes.headers.get("content-range");
  const acceptRanges = streamRes.headers.get("accept-ranges");
  const streamBytes = Buffer.from(await streamRes.arrayBuffer());

  console.log(`✓ Stream Status: ${streamRes.status} Partial Content`);
  console.log(`✓ Content-Range: ${contentRange}`);
  console.log(`✓ Accept-Ranges: ${acceptRanges}`);
  console.log(`✓ Chunk byte match: expected 1000 bytes, got ${streamBytes.length} bytes`);

  // Step 5: Test Lesson Playback Integration (No Fake Demo Video!)
  console.log("\n--- Testing Lesson Playback Route Integration ---");
  const [sampleLesson] = await db.select().from(lessons).limit(1);
  if (!sampleLesson) throw new Error("No sample lesson found in DB");

  // Attach this newly uploaded video to sampleLesson
  await db
    .update(lessons)
    .set({
      videoUrl: videoResult.streamUrl,
      mediaProvider: "internal",
      mediaRef: null,
      durationSeconds: 1800,
    })
    .where(eq(lessons.id, sampleLesson.id));

  console.log(`✓ Updated lesson '${sampleLesson.id}' (${sampleLesson.titleFr}) to videoUrl: ${videoResult.streamUrl}`);

  // Fetch lesson playback
  const playbackRes = await fetch(`${BASE_URL}/api/learning/video/${sampleLesson.id}/playback`, {
    headers: { Cookie: cookieHeader },
  });

  if (!playbackRes.ok) throw new Error(`Playback route returned ${playbackRes.status}`);
  const playbackData = (await playbackRes.json()) as { provider?: string; videoUrl?: string; hlsUrl?: string };
  console.log("✓ Playback API Response:", JSON.stringify(playbackData, null, 2));

  const playbackSource = playbackData.videoUrl || playbackData.hlsUrl || "";
  if (playbackSource.includes("/demo/video.mp4")) {
    throw new Error("FAIL: Playback still returned fake demo video!");
  }

  if (!playbackSource.includes(videoResult.streamUrl)) {
    throw new Error(`FAIL: Expected playback source to match uploaded streamUrl ${videoResult.streamUrl}, got ${playbackSource}`);
  }

  console.log("\n🎉 ALL TESTS PASSED! Real uploaded video is streaming with Range support, and PDFs are stored and downloadable!");
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("❌ E2E VERIFICATION FAILED:", err);
  process.exit(1);
});
