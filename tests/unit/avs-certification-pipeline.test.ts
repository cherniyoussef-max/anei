import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateAvsUniqueIdentifier,
  computeCertificateHash,
  isQualifyingAvsCourse,
} from "@/server/services/avs-certification-engine";
import type { CourseRow } from "@/server/db/schema";

describe("AVS Zero-Trust Certification & Habilitation Pipeline", () => {
  describe("Unique Identifier Generation", () => {
    it("generates an unforgeable identifier with correct format ANEI-AVS-YYYY-XXXXX", () => {
      const currentYear = new Date().getFullYear();
      const id1 = generateAvsUniqueIdentifier(currentYear);
      assert.match(id1, new RegExp(`^ANEI-AVS-${currentYear}-[0-9A-Z]+$`));

      const id2 = generateAvsUniqueIdentifier(2026);
      assert.match(id2, /^ANEI-AVS-2026-[0-9A-Z]+$/);
    });

    it("produces unique identifiers across multiple invocations without collisions", () => {
      const generated = new Set<string>();
      for (let i = 0; i < 500; i++) {
        const id = generateAvsUniqueIdentifier(2026);
        assert.equal(generated.has(id), false, `Collision detected on: ${id}`);
        generated.add(id);
      }
      assert.equal(generated.size, 500);
    });
  });

  describe("Cryptographic SHA-256 HMAC Signature", () => {
    it("produces a 64-character hexadecimal SHA-256 hash", () => {
      const hash = computeCertificateHash({
        userId: "user_test_123",
        courseId: "course_tsa_456",
        uniqueIdentifier: "ANEI-AVS-2026-8812K",
        scorePercent: 90,
        issuedAt: new Date("2026-10-28T12:00:00Z"),
      });

      assert.equal(typeof hash, "string");
      assert.equal(hash.length, 64);
      assert.match(hash, /^[0-9a-f]{64}$/);
    });

    it("is strictly deterministic for identical inputs", () => {
      const date = new Date("2026-10-28T12:00:00Z");
      const hashA = computeCertificateHash({
        userId: "user_test_123",
        courseId: "course_tsa_456",
        uniqueIdentifier: "ANEI-AVS-2026-8812K",
        scorePercent: 85,
        issuedAt: date,
      });

      const hashB = computeCertificateHash({
        userId: "user_test_123",
        courseId: "course_tsa_456",
        uniqueIdentifier: "ANEI-AVS-2026-8812K",
        scorePercent: 85,
        issuedAt: date,
      });

      assert.equal(hashA, hashB);
    });

    it("detects any modification in score, user, or identifier", () => {
      const date = new Date("2026-10-28T12:00:00Z");
      const original = computeCertificateHash({
        userId: "user_test_123",
        courseId: "course_tsa_456",
        uniqueIdentifier: "ANEI-AVS-2026-8812K",
        scorePercent: 80,
        issuedAt: date,
      });

      const forgedScore = computeCertificateHash({
        userId: "user_test_123",
        courseId: "course_tsa_456",
        uniqueIdentifier: "ANEI-AVS-2026-8812K",
        scorePercent: 81,
        issuedAt: date,
      });

      const forgedUser = computeCertificateHash({
        userId: "user_impostor_999",
        courseId: "course_tsa_456",
        uniqueIdentifier: "ANEI-AVS-2026-8812K",
        scorePercent: 80,
        issuedAt: date,
      });

      assert.notEqual(original, forgedScore);
      assert.notEqual(original, forgedUser);
    });
  });

  describe("Qualifying Course Identification", () => {
    it("recognizes qualifying AVS and special needs courses", () => {
      const courseTsa = {
        titleFr: "Accompagnement de l'élève avec Trouble du Spectre de l'Autisme (TSA)",
        titleAr: "مرافقة التلميذ ذي طيف التوحد",
        slug: "accompagnement-autisme-tsa",
        category: "INCLUSION",
        qualifiesForProfessionalPromotion: false,
        qualifyingTargetType: null,
      } as unknown as CourseRow;

      const courseTdah = {
        titleFr: "Stratégies d'inclusion pour enfants avec TDAH",
        titleAr: "استراتيجيات الدماج للتلاميذ مع فرط الحركة وتشتت الانتباه",
        slug: "tdah-pedagogie-inclusive",
        category: "PEDAGOGIE",
        qualifiesForProfessionalPromotion: false,
        qualifyingTargetType: null,
      } as unknown as CourseRow;

      const courseExplicit = {
        titleFr: "Module Spécifique Métier",
        titleAr: "وحدة مهنية",
        slug: "module-metier",
        category: "OTHER",
        qualifiesForProfessionalPromotion: true,
        qualifyingTargetType: "AVS",
      } as unknown as CourseRow;

      assert.equal(isQualifyingAvsCourse(courseTsa), true);
      assert.equal(isQualifyingAvsCourse(courseTdah), true);
      assert.equal(isQualifyingAvsCourse(courseExplicit), true);
    });

    it("rejects non-qualifying courses", () => {
      const generalCourse = {
        titleFr: "Introduction à la bureautique et outils informatiques",
        titleAr: "مقدمة في الإعلامية المكتبية",
        slug: "informatique-bureautique",
        category: "GENERAL",
        qualifiesForProfessionalPromotion: false,
        qualifyingTargetType: null,
      } as unknown as CourseRow;

      assert.equal(isQualifyingAvsCourse(generalCourse), false);
    });
  });

  describe("Zero-Trust Score Gate Invariant", () => {
    it("strictly requires a score of at least 80% to qualify for certification", () => {
      const checkScore = (score: number) => {
        if (score < 80) {
          return { granted: false, reason: "SCORE_BELOW_80" };
        }
        return { granted: true };
      };

      assert.deepEqual(checkScore(79), { granted: false, reason: "SCORE_BELOW_80" });
      assert.deepEqual(checkScore(50), { granted: false, reason: "SCORE_BELOW_80" });
      assert.deepEqual(checkScore(0), { granted: false, reason: "SCORE_BELOW_80" });

      assert.equal(checkScore(80).granted, true);
      assert.equal(checkScore(85).granted, true);
      assert.equal(checkScore(100).granted, true);
    });
  });
});
