import test from "node:test";
import assert from "node:assert/strict";
import {
  validateAndNormalizeCanonicalEmail,
  normalizeCanonicalEmail,
  validateAndNormalizeTunisianPhone,
  normalizeTunisianPhoneStrict,
  validatePasswordPolicy,
} from "../../src/lib/auth/canonical-identity";

// ============================================================================
// 1. CANONICAL EMAIL NORMALIZATION & GMAIL DEDUPLICATION
// ============================================================================
test("Gmail: removes dots and converts to lowercase", () => {
  const res = validateAndNormalizeCanonicalEmail("Youssef.Cherni@gmail.com");
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.canonicalEmail, "youssefcherni@gmail.com");
  }
});

test("Gmail: strips +tag aliases and multiple dots", () => {
  const res = validateAndNormalizeCanonicalEmail("y.o.u.s.s.e.f.cherni+test.promo@gmail.com");
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.canonicalEmail, "youssefcherni@gmail.com");
  }
});

test("Gmail: canonicalizes googlemail.com to gmail.com", () => {
  const res = validateAndNormalizeCanonicalEmail("youssef.cherni+alias@googlemail.com");
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.canonicalEmail, "youssefcherni@gmail.com");
  }
});

test("Gmail: normalizeCanonicalEmail helper returns identical canonical representation", () => {
  assert.equal(
    normalizeCanonicalEmail("Youssef.Cherni+b2b@Gmail.Com"),
    normalizeCanonicalEmail("youssefcherni@gmail.com"),
  );
  assert.equal(
    normalizeCanonicalEmail("YOUSSEF.CHERNI@googlemail.com"),
    "youssefcherni@gmail.com",
  );
});

test("Non-Gmail: preserves dots but trims and lowercases", () => {
  const res = validateAndNormalizeCanonicalEmail("  Sarah.BenSalem@education.tn  ");
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.canonicalEmail, "sarah.bensalem@education.tn");
  }
});

// ============================================================================
// 2. DISPOSABLE EMAIL DOMAINS REJECTION
// ============================================================================
const DISPOSABLE_SAMPLES = [
  "spammer@mailinator.com",
  "fake@tempmail.com",
  "user@10minutemail.com",
  "trash@yopmail.com",
  "anon@guerrillamail.com",
  "disposable@sharklasers.com",
  "throwaway@dispostable.com",
  "temp@trashmail.com",
];

for (const email of DISPOSABLE_SAMPLES) {
  test(`rejects disposable domain: ${email}`, () => {
    const res = validateAndNormalizeCanonicalEmail(email);
    assert.equal(res.success, false);
    if (!res.success) {
      assert.equal(res.error, "DISPOSABLE_DOMAIN");
    }
  });
}

// ============================================================================
// 3. EMAIL FORMAT VALIDATION
// ============================================================================
const INVALID_EMAILS = [
  "",
  "   ",
  "plainaddress",
  "@missinglocal.com",
  "missingdomain@",
  "spaces in@domain.com",
  "two@@at.com",
];

for (const bad of INVALID_EMAILS) {
  test(`rejects invalid email format: "${bad}"`, () => {
    const res = validateAndNormalizeCanonicalEmail(bad);
    assert.equal(res.success, false);
    if (!res.success) {
      assert.equal(res.error, "INVALID_FORMAT");
    }
  });
}

// ============================================================================
// 4. TUNISIAN PHONE NORMALIZATION (+216)
// ============================================================================
test("Phone: normalizes bare 8 digits to +216XXXXXXXX", () => {
  const res = validateAndNormalizeTunisianPhone("98123456");
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.canonicalPhone, "+21698123456");
  }
});

test("Phone: normalizes numbers with spaces, dashes, +216 prefix", () => {
  assert.equal(normalizeTunisianPhoneStrict("+216 20 311 900"), "+21620311900");
  assert.equal(normalizeTunisianPhoneStrict("00216 52-345-678"), "+21652345678");
  assert.equal(normalizeTunisianPhoneStrict("21644123456"), "+21644123456");
  assert.equal(normalizeTunisianPhoneStrict("71 123 456"), "+21671123456");
});

// ============================================================================
// 5. TUNISIAN OPERATOR PREFIX VALIDATION (2, 4, 5, 7, 9)
// ============================================================================
test("Phone: accepts all valid Tunisian operators", () => {
  // 2 = Ooredoo, 4 = Tunisie Telecom, 5 = Orange, 7 = Fixe, 9 = Tunisie Telecom
  assert.equal(validateAndNormalizeTunisianPhone("21345678").success, true);
  assert.equal(validateAndNormalizeTunisianPhone("41345678").success, true);
  assert.equal(validateAndNormalizeTunisianPhone("51345678").success, true);
  assert.equal(validateAndNormalizeTunisianPhone("71345678").success, true);
  assert.equal(validateAndNormalizeTunisianPhone("91345678").success, true);
});

test("Phone: rejects invalid prefixes (0, 1, 3, 6, 8)", () => {
  for (const prefix of ["0", "1", "3", "6", "8"]) {
    const res = validateAndNormalizeTunisianPhone(`${prefix}1345678`);
    assert.equal(res.success, false);
    if (!res.success) {
      assert.equal(res.error, "INVALID_PREFIX");
    }
  }
});

// ============================================================================
// 6. DUMMY SEQUENCES REJECTION
// ============================================================================
const DUMMY_PHONES = [
  "00000000",
  "11111111",
  "22222222",
  "33333333",
  "44444444",
  "55555555",
  "66666666",
  "77777777",
  "88888888",
  "99999999",
  "12345678",
  "23456789",
  "87654321",
  "98765432",
  "12121212",
  "21212121",
];

for (const dummy of DUMMY_PHONES) {
  test(`rejects dummy phone sequence: ${dummy}`, () => {
    const res = validateAndNormalizeTunisianPhone(dummy);
    assert.equal(res.success, false);
    if (!res.success) {
      assert.ok(res.error === "DUMMY_SEQUENCE" || res.error === "INVALID_PREFIX");
    }
  });
}

test("Phone: rejects invalid lengths", () => {
  assert.equal(validateAndNormalizeTunisianPhone("2012345").success, false); // 7 digits
  assert.equal(validateAndNormalizeTunisianPhone("201234567").success, false); // 9 digits
});

// ============================================================================
// 7. PASSWORD POLICY ENFORCEMENT
// ============================================================================
test("Password Policy: accepts strong compliant password", () => {
  const check = validatePasswordPolicy("AneiSecure2026!#", {
    firstName: "Sarah",
    lastName: "Ben Salem",
    email: "sarah@gmail.com",
    phone: "98123456",
  });
  assert.equal(check.valid, true);
  assert.equal(check.errors.length, 0);
});

test("Password Policy: rejects passwords containing personal names or phone", () => {
  const checkName = validatePasswordPolicy("Sarah12345!Secure", {
    firstName: "Sarah",
    lastName: "Ben Salem",
    email: "s.bensalem@gmail.com",
    phone: "98123456",
  });
  assert.equal(checkName.valid, false);
  assert.ok(checkName.errors.includes("PASSWORD_CONTAINS_PERSONAL_INFO"));

  const checkPhone = validatePasswordPolicy("MySecret98123456!", {
    firstName: "Mohamed",
    lastName: "Trabelsi",
    email: "mohamed@gmail.com",
    phone: "98123456",
  });
  assert.equal(checkPhone.valid, false);
  assert.ok(checkPhone.errors.includes("PASSWORD_CONTAINS_PERSONAL_INFO"));
});

test("Password Policy: rejects missing character categories", () => {
  // Too short
  assert.ok(validatePasswordPolicy("Short1!").errors.includes("PASSWORD_TOO_SHORT"));
  // No uppercase
  assert.ok(validatePasswordPolicy("lowercase123456!").errors.includes("PASSWORD_NO_UPPERCASE"));
  // No lowercase
  assert.ok(validatePasswordPolicy("UPPERCASE123456!").errors.includes("PASSWORD_NO_LOWERCASE"));
  // No digit
  assert.ok(validatePasswordPolicy("NoNumbersHere!Secret").errors.includes("PASSWORD_NO_DIGIT"));
  // No special char
  assert.ok(validatePasswordPolicy("NoSpecialChars123456").errors.includes("PASSWORD_NO_SPECIAL"));
});
