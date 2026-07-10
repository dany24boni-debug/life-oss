import { describe, it, expect } from "vitest";
import {
  DriveFileMetadataSchema,
  DriveFilesListSchema,
  DriveFileCreateSchema,
} from "./drive-api";

describe("DriveFileMetadataSchema", () => {
  it("accepts id + name", () => {
    const r = DriveFileMetadataSchema.parse({
      id: "1A2b3C4d5E",
      name: "2026-05-12.md",
    });
    expect(r.id).toBe("1A2b3C4d5E");
    expect(r.name).toBe("2026-05-12.md");
  });

  it("accepts id without name (name is optional)", () => {
    const r = DriveFileMetadataSchema.parse({ id: "abc" });
    expect(r.id).toBe("abc");
    expect(r.name).toBeUndefined();
  });

  it("rejects empty id", () => {
    expect(DriveFileMetadataSchema.safeParse({ id: "" }).success).toBe(false);
  });

  it("rejects missing id", () => {
    expect(DriveFileMetadataSchema.safeParse({ name: "x" }).success).toBe(false);
  });

  it("ignores unknown extra keys (Google may add fields)", () => {
    const r = DriveFileMetadataSchema.parse({
      id: "abc",
      name: "x",
      mimeType: "text/markdown",
      modifiedTime: "2026-05-12T10:00:00Z",
    });
    expect(r.id).toBe("abc");
  });
});

describe("DriveFilesListSchema", () => {
  it("accepts a populated list", () => {
    const r = DriveFilesListSchema.parse({
      files: [
        { id: "a", name: "2026-05-11.md" },
        { id: "b", name: "2026-05-12.md" },
      ],
    });
    expect(r.files?.length).toBe(2);
  });

  it("accepts an empty body (no files key)", () => {
    const r = DriveFilesListSchema.parse({});
    expect(r.files).toBeUndefined();
  });

  it("accepts nextPageToken", () => {
    const r = DriveFilesListSchema.parse({
      files: [],
      nextPageToken: "abc123",
    });
    expect(r.nextPageToken).toBe("abc123");
  });

  it("rejects files of wrong shape", () => {
    expect(
      DriveFilesListSchema.safeParse({ files: "not_an_array" }).success,
    ).toBe(false);
  });

  it("rejects file entries with empty id", () => {
    expect(
      DriveFilesListSchema.safeParse({
        files: [{ id: "", name: "x" }],
      }).success,
    ).toBe(false);
  });
});

describe("DriveFileCreateSchema", () => {
  it("accepts {id: '...'}", () => {
    const r = DriveFileCreateSchema.parse({ id: "1A2b3C" });
    expect(r.id).toBe("1A2b3C");
  });

  it("rejects empty id", () => {
    expect(DriveFileCreateSchema.safeParse({ id: "" }).success).toBe(false);
  });

  it("rejects missing id", () => {
    expect(DriveFileCreateSchema.safeParse({}).success).toBe(false);
  });
});
