import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

const categoryChangeSchema = z.object({
  category: z.enum(["LEARNER", "AVS", "SPECIALIST"]),
  specialty: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(30).optional(),
});

test("Admin category switch accepts valid categories", () => {
  const learner = categoryChangeSchema.safeParse({ category: "LEARNER" });
  assert.equal(learner.success, true);

  const avs = categoryChangeSchema.safeParse({ category: "AVS", contactPhone: "+216 20 111 222" });
  assert.equal(avs.success, true);

  const specialist = categoryChangeSchema.safeParse({
    category: "SPECIALIST",
    specialty: "Orthophonie",
    contactPhone: "+216 98 333 444",
  });
  assert.equal(specialist.success, true);
});

test("Admin category switch rejects unknown categories", () => {
  const invalid = categoryChangeSchema.safeParse({ category: "DOCTOR" });
  assert.equal(invalid.success, false);
});

test("Category switch resolves directoryType and visibility rules correctly", () => {
  function resolveDirectoryState(targetCategory: "LEARNER" | "AVS" | "SPECIALIST") {
    switch (targetCategory) {
      case "LEARNER":
        return {
          profileType: "STUDENT",
          postStatus: "LEARNER_ONLY",
          directoryVisible: false,
          directoryType: null,
        };
      case "AVS":
        return {
          profileType: "AVS",
          postStatus: "APPROVED_AVS",
          directoryVisible: true,
          directoryType: "AVS",
        };
      case "SPECIALIST":
        return {
          profileType: "SPECIALIST",
          postStatus: "APPROVED_SPECIALIST",
          directoryVisible: true,
          directoryType: "SPECIALIST",
        };
    }
  }

  const learnerState = resolveDirectoryState("LEARNER");
  assert.equal(learnerState.profileType, "STUDENT");
  assert.equal(learnerState.postStatus, "LEARNER_ONLY");
  assert.equal(learnerState.directoryVisible, false);

  const avsState = resolveDirectoryState("AVS");
  assert.equal(avsState.profileType, "AVS");
  assert.equal(avsState.postStatus, "APPROVED_AVS");
  assert.equal(avsState.directoryVisible, true);
  assert.equal(avsState.directoryType, "AVS");

  const specState = resolveDirectoryState("SPECIALIST");
  assert.equal(specState.profileType, "SPECIALIST");
  assert.equal(specState.postStatus, "APPROVED_SPECIALIST");
  assert.equal(specState.directoryVisible, true);
  assert.equal(specState.directoryType, "SPECIALIST");
});
