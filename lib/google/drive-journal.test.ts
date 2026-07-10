import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __driveJsonForTests,
  buildFrontmatter,
  parseFrontmatter,
} from "./drive-journal";
import {
  DriveFileCreateSchema,
  DriveFilesListSchema,
} from "@/lib/validation/drive-api";

describe("buildFrontmatter", () => {
  it("includes date and mood when mood is a plain string", () => {
    const out = buildFrontmatter("2026-05-12", "stanco ma ok");
    expect(out).toBe("---\ndate: 2026-05-12\nmood: stanco ma ok\n---");
  });

  it("omits mood line entirely when mood is null (no fallback)", () => {
    const out = buildFrontmatter("2026-05-12", null);
    expect(out).toBe("---\ndate: 2026-05-12\n---");
    expect(out).not.toContain("mood:");
  });

  it("omits mood line when mood is empty string", () => {
    const out = buildFrontmatter("2026-05-12", "");
    expect(out).not.toContain("mood:");
  });

  it("omits mood line when mood is whitespace only", () => {
    const out = buildFrontmatter("2026-05-12", "   ");
    expect(out).not.toContain("mood:");
  });

  it("quotes mood when it contains YAML-special chars (colon)", () => {
    const out = buildFrontmatter("2026-05-12", "in flow: top");
    expect(out).toContain('mood: "in flow: top"');
  });

  it("preserves mood text with embedded quotes (not necessarily quoted)", () => {
    const out = buildFrontmatter("2026-05-12", 'tipo "esame" ansia');
    expect(out).toContain("tipo");
  });

  it("flattens newlines inside mood to spaces", () => {
    const out = buildFrontmatter("2026-05-12", "line1\nline2");
    expect(out).toContain("mood: line1 line2");
    expect(out.split("\n").filter((l) => l.startsWith("mood:")).length).toBe(1);
  });
});

describe("parseFrontmatter", () => {
  it("parses a well-formed entry with date and mood", () => {
    const md = "---\ndate: 2026-05-12\nmood: in flow\n---\n\nOggi è andata bene.";
    const out = parseFrontmatter(md);
    expect(out.date).toBe("2026-05-12");
    expect(out.mood).toBe("in flow");
    expect(out.body).toBe("Oggi è andata bene.");
  });

  it("returns null fields and full body when no frontmatter", () => {
    const md = "Solo testo senza frontmatter.";
    const out = parseFrontmatter(md);
    expect(out.date).toBeNull();
    expect(out.mood).toBeNull();
    expect(out.body).toBe(md);
  });

  it("returns null fields when opening --- has no closing", () => {
    const md = "---\ndate: 2026-05-12\nmood: x\n(no closing)";
    const out = parseFrontmatter(md);
    expect(out.date).toBeNull();
    expect(out.mood).toBeNull();
    expect(out.body).toBe(md);
  });

  it("strips surrounding double-quotes from mood value", () => {
    const md = '---\ndate: 2026-05-12\nmood: "in flow: top"\n---\n\nbody';
    const out = parseFrontmatter(md);
    expect(out.mood).toBe("in flow: top");
  });

  it("returns null mood when mood key is absent but date is present", () => {
    const md = "---\ndate: 2026-05-12\n---\n\nbody";
    const out = parseFrontmatter(md);
    expect(out.date).toBe("2026-05-12");
    expect(out.mood).toBeNull();
  });

  it("preserves body lines including any internal --- inside the content", () => {
    const md = "---\ndate: 2026-05-12\n---\n\nFirst line\n\n---\n\nSeparator";
    const out = parseFrontmatter(md);
    expect(out.body).toBe("First line\n\n---\n\nSeparator");
  });

  it("returns empty body when frontmatter is the only content", () => {
    const md = "---\ndate: 2026-05-12\n---\n";
    const out = parseFrontmatter(md);
    expect(out.body).toBe("");
  });

  it("handles CRLF line endings in the frontmatter delimiter", () => {
    const md = "---\r\ndate: 2026-05-12\r\n---\r\n\r\nbody";
    const out = parseFrontmatter(md);
    expect(out.date).toBe("2026-05-12");
    expect(out.body).toBe("body");
  });

  it("roundtrips: buildFrontmatter → parseFrontmatter recovers fields", () => {
    const fm = buildFrontmatter("2026-05-12", "stanco");
    const md = `${fm}\n\nGiornata pesante ma chiusa.`;
    const out = parseFrontmatter(md);
    expect(out.date).toBe("2026-05-12");
    expect(out.mood).toBe("stanco");
    expect(out.body).toBe("Giornata pesante ma chiusa.");
  });

  it("roundtrips when mood was omitted (no fallback path)", () => {
    const fm = buildFrontmatter("2026-05-12", null);
    const md = `${fm}\n\nbody`;
    const out = parseFrontmatter(md);
    expect(out.date).toBe("2026-05-12");
    expect(out.mood).toBeNull();
    expect(out.body).toBe("body");
  });
});

// ============================================================
// driveJson — schema-validation integration
//
// Exposed via __driveJsonForTests so we can exercise the
// drive_api_invalid_response branch without bringing Supabase
// mocks into the test. fetch is stubbed per test.
// ============================================================

describe("driveJson (schema validation)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetchOk(jsonBody: unknown): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(jsonBody), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  }

  function stubFetchStatus(status: number, body: string): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(body, {
          status,
          statusText: status === 500 ? "Internal Server Error" : "Error",
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );
  }

  it("passes through a well-formed files-list response", async () => {
    stubFetchOk({
      files: [
        { id: "fid_1", name: "2026-05-12.md" },
        { id: "fid_2", name: "2026-05-13.md" },
      ],
    });
    const out = await __driveJsonForTests(
      "https://drive.test/files",
      { headers: { Authorization: "Bearer fake" } },
      "list_entries_test",
      DriveFilesListSchema,
    );
    expect(out.files?.[0]?.id).toBe("fid_1");
    expect(out.files?.[1]?.name).toBe("2026-05-13.md");
  });

  it("passes through a well-formed create response (id only)", async () => {
    stubFetchOk({ id: "newly_created_id" });
    const out = await __driveJsonForTests(
      "https://drive.test/files",
      { method: "POST" },
      "create_entry_test",
      DriveFileCreateSchema,
    );
    expect(out.id).toBe("newly_created_id");
  });

  it("throws drive_api_invalid_response when create returns no id", async () => {
    // Google returned 200 OK but the body is wrong shape — schema
    // must catch this BEFORE we read .id (which would silently be
    // undefined and crash deeper in the call stack).
    stubFetchOk({ kind: "drive#file" });
    await expect(
      __driveJsonForTests(
        "https://drive.test/files",
        { method: "POST" },
        "create_entry_2026-05-12",
        DriveFileCreateSchema,
      ),
    ).rejects.toThrow(/drive_api_invalid_response/);
  });

  it("throws drive_api_invalid_response when files entry is missing id", async () => {
    stubFetchOk({ files: [{ name: "2026-05-12.md" }] });
    await expect(
      __driveJsonForTests(
        "https://drive.test/files",
        {},
        "list_entries_test",
        DriveFilesListSchema,
      ),
    ).rejects.toThrow(/drive_api_invalid_response/);
  });

  it("error message includes the `what` label so failures are traceable", async () => {
    stubFetchOk({ files: "not_an_array" });
    let caught: Error | null = null;
    try {
      await __driveJsonForTests(
        "https://drive.test/files",
        {},
        "find_folder Life-OS",
        DriveFilesListSchema,
      );
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toContain("drive_api_invalid_response");
    expect(caught!.message).toContain("find_folder Life-OS");
  });

  it("HTTP errors still surface as drive_api_error (not invalid_response)", async () => {
    // Schema validation only runs on 2xx. A 500 must still produce
    // the distinct drive_api_error slug — the two error paths stay
    // separate.
    stubFetchStatus(500, "internal boom");
    await expect(
      __driveJsonForTests(
        "https://drive.test/files",
        {},
        "list_entries_test",
        DriveFilesListSchema,
      ),
    ).rejects.toThrow(/drive_api_error/);
  });
});
