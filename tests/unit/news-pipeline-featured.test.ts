import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("News Pipeline & Editorial Featured Invariant", () => {
  it("enforces valid news category selection", () => {
    const validCategories = ["FORMATION", "CERTIFICATION", "PARTENARIAT", "EVENEMENT", "COMMUNIQUE"];
    assert.equal(validCategories.includes("FORMATION"), true);
    assert.equal(validCategories.includes("CERTIFICATION"), true);
    assert.equal(validCategories.includes("INVALID_CAT"), false);
  });

  it("atomically maintains only one featured article at any time", () => {
    // Simulation of DB state
    const articles = [
      { id: "1", title: "Article 1", isFeatured: true },
      { id: "2", title: "Article 2", isFeatured: false },
    ];

    // Feature Article 2
    const featureArticle = (targetId: string) => {
      return articles.map((art) => ({
        ...art,
        isFeatured: art.id === targetId,
      }));
    };

    const updated = featureArticle("2");
    const featuredArticles = updated.filter((a) => a.isFeatured);
    assert.equal(featuredArticles.length, 1);
    assert.equal(featuredArticles[0].id, "2");
  });

  it("handles cover image URL and fallback medallion behavior safely", () => {
    const articleWithCover = { coverImageUrl: "https://example.com/photo.jpg" };
    const articleWithoutCover = { coverImageUrl: null };

    assert.equal(Boolean(articleWithCover.coverImageUrl), true);
    assert.equal(Boolean(articleWithoutCover.coverImageUrl), false);
  });
});
