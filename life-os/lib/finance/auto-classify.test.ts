import { describe, expect, it } from "vitest";
import { CATEGORIES, suggestCategory } from "./auto-classify";

describe("CATEGORIES", () => {
  it("exposes exactly the 10 categories mirrored by the DB CHECK constraint", () => {
    expect(CATEGORIES).toEqual([
      "cibo",
      "trasporto",
      "svago",
      "vestiti",
      "casa",
      "salute",
      "studio",
      "tech",
      "regalo",
      "altro",
    ]);
  });

  it("each non-fallback category has at least one keyword that matches via suggestCategory", () => {
    // ECC mid-sprint U2 L1 close: structural check. Se un giorno
    // si vuota accidentalmente la keyword list di una categoria,
    // tutte le note di quella categoria fallback-erebbero a "altro"
    // silently — niente test esplicito si accorgerebbe del bug
    // perché il classifier resta deterministico. Questo test
    // verifica via la PUBLIC API che ogni categoria (eccetto
    // "altro" che è il fallback) ha almeno una keyword che la
    // produce.
    const sampleKeywordPerCategory: Record<
      Exclude<(typeof CATEGORIES)[number], "altro">,
      string
    > = {
      cibo: "esselunga",
      trasporto: "treno",
      svago: "cinema",
      vestiti: "zara",
      casa: "affitto",
      salute: "farmacia",
      studio: "libro",
      tech: "netflix",
      regalo: "regalo",
    };
    for (const [category, sample] of Object.entries(sampleKeywordPerCategory)) {
      expect(
        suggestCategory(sample),
        `category "${category}" should match keyword "${sample}"`,
      ).toBe(category);
    }
  });
});

describe("suggestCategory — empty / null input", () => {
  it("returns null for empty string", () => {
    expect(suggestCategory("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(suggestCategory("   ")).toBeNull();
    expect(suggestCategory("\t\n  ")).toBeNull();
  });
});

describe("suggestCategory — happy match per category", () => {
  it("cibo: 'Esselunga'", () => {
    expect(suggestCategory("Esselunga")).toBe("cibo");
  });

  it("cibo: 'Spesa di sabato' (substring on real-world note)", () => {
    expect(suggestCategory("Spesa di sabato")).toBe("cibo");
  });

  it("cibo: 'McDonald'", () => {
    expect(suggestCategory("McDonald")).toBe("cibo");
  });

  it("trasporto: 'Frecciarossa Roma'", () => {
    expect(suggestCategory("Frecciarossa Roma")).toBe("trasporto");
  });

  it("trasporto: 'Benzina pieno'", () => {
    expect(suggestCategory("Benzina pieno")).toBe("trasporto");
  });

  it("svago: 'cinema'", () => {
    expect(suggestCategory("cinema")).toBe("svago");
  });

  it("svago: 'Concerto Vasco'", () => {
    expect(suggestCategory("Concerto Vasco")).toBe("svago");
  });

  it("svago vs tech: 'Spotify ticket Coldplay' is svago (more-specific keyword wins by scanning svago first)", () => {
    expect(suggestCategory("Spotify ticket Coldplay")).toBe("svago");
  });

  it("vestiti: 'Zara felpa'", () => {
    expect(suggestCategory("Zara felpa")).toBe("vestiti");
  });

  it("vestiti: 'Nike scarpe nuove'", () => {
    expect(suggestCategory("Nike scarpe nuove")).toBe("vestiti");
  });

  it("casa: 'Bolletta luce gennaio'", () => {
    expect(suggestCategory("Bolletta luce gennaio")).toBe("casa");
  });

  it("casa: 'Affitto maggio'", () => {
    expect(suggestCategory("Affitto maggio")).toBe("casa");
  });

  it("salute: 'Farmacia tachipirina'", () => {
    expect(suggestCategory("Farmacia tachipirina")).toBe("salute");
  });

  it("salute: 'Visita dentista'", () => {
    // matches "visita" first in salute keyword order; also matches
    // "dentista" — both in salute, no ambiguity.
    expect(suggestCategory("Visita dentista")).toBe("salute");
  });

  it("studio: 'Libro algoritmi'", () => {
    expect(suggestCategory("Libro algoritmi")).toBe("studio");
  });

  it("studio: 'Tasse universitarie ateneo'", () => {
    expect(suggestCategory("Tasse universitarie ateneo")).toBe("studio");
  });

  it("tech: 'netflix' (lowercase)", () => {
    expect(suggestCategory("netflix")).toBe("tech");
  });

  it("tech: 'Spotify abbonamento mensile'", () => {
    // "spotify" matches tech; il "spotify ticket" disambiguator
    // sotto svago non scatta perché manca la stringa "ticket".
    expect(suggestCategory("Spotify abbonamento mensile")).toBe("tech");
  });

  it("tech: 'Anthropic Claude API'", () => {
    expect(suggestCategory("Anthropic Claude API")).toBe("tech");
  });

  it("regalo: 'Regalo per mamma'", () => {
    expect(suggestCategory("Regalo per mamma")).toBe("regalo");
  });

  it("regalo: 'Gift Sara compleanno'", () => {
    expect(suggestCategory("Gift Sara compleanno")).toBe("regalo");
  });
});

describe("suggestCategory — case-insensitivity", () => {
  it("matches uppercase notes", () => {
    expect(suggestCategory("ESSELUNGA")).toBe("cibo");
    expect(suggestCategory("UBER")).toBe("trasporto");
  });

  it("matches mixed-case notes", () => {
    expect(suggestCategory("EsseLunga")).toBe("cibo");
    expect(suggestCategory("FrEcCiArOsSa")).toBe("trasporto");
  });
});

describe("suggestCategory — substring match (not full-word)", () => {
  it("matches keyword embedded in a longer word", () => {
    // "treno" è dentro "trenoroma" pure se l'utente non mette spazi.
    expect(suggestCategory("trenoroma 12.50")).toBe("trasporto");
  });

  it("matches keyword surrounded by punctuation", () => {
    expect(suggestCategory("Pranzo @bar 11€")).toBe("cibo");
  });
});

describe("suggestCategory — no match fallback", () => {
  it("returns 'altro' for non-empty note with no keyword match", () => {
    expect(suggestCategory("xyzzy plugh foo")).toBe("altro");
  });

  it("returns 'altro' for note with only numbers / punctuation", () => {
    expect(suggestCategory("12.50 €")).toBe("altro");
  });

  it("returns 'altro' for plausible Italian word that isn't a keyword", () => {
    expect(suggestCategory("amaca")).toBe("altro");
  });
});

describe("suggestCategory — ordering / priority", () => {
  it("when a note matches keywords in multiple categories, the FIRST category in CATEGORY_KEYWORDS order wins (cibo before trasporto)", () => {
    // "pizza" → cibo, "uber" → trasporto. cibo viene per prima
    // nel mapping, quindi vince.
    expect(suggestCategory("Pizza ordinata via Uber")).toBe("cibo");
  });

  it("svago 'spotify ticket' wins over tech 'spotify' because svago is scanned earlier", () => {
    expect(suggestCategory("Spotify ticket concerto")).toBe("svago");
  });

  it("tim (casa) DOES match 'tim mobile' (true positive)", () => {
    expect(suggestCategory("Tim mobile")).toBe("casa");
  });

  it("KNOWN FALSE POSITIVE: 'ottimo libro' matches casa via substring 'tim' inside 'ottimo'", () => {
    // Documenta il limite del substring matching (non
    // word-boundary). Quando si introduce \b in V2, questo test
    // diventa rosso e il classifier produrrà "studio" via "libro".
    // L'utente può comunque cambiare il chip manualmente — la
    // categoria è solo un suggerimento.
    expect(suggestCategory("Ottimo libro")).toBe("casa");
  });

  it("KNOWN FALSE POSITIVE: 'bar' (cibo) matcha anche 'barba' senza word-boundary", () => {
    expect(suggestCategory("Barba dal barbiere")).toBe("cibo");
  });
});

describe("suggestCategory — Italian/English bilingual keyword coverage", () => {
  it("'università' matches studio via the 'universit' prefix keyword", () => {
    // ECC mid-sprint U2 L2 close: aggiunto "universit" come
    // prefix che copre sia "università" (it) sia "university"
    // (en) senza richiedere NFD accent normalization.
    expect(suggestCategory("università milano")).toBe("studio");
  });

  it("'University of Pisa' matches studio (English variant)", () => {
    expect(suggestCategory("University of Pisa")).toBe("studio");
  });
});

describe("suggestCategory — defensive on bad input types", () => {
  it("returns null on non-string input", () => {
    // @ts-expect-error — testing runtime guard
    expect(suggestCategory(null)).toBeNull();
    // @ts-expect-error — testing runtime guard
    expect(suggestCategory(undefined)).toBeNull();
    // @ts-expect-error — testing runtime guard
    expect(suggestCategory(42)).toBeNull();
  });
});
