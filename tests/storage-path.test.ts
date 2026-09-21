import { describe, it, expect } from "vitest";
import {
  extensionForMime,
  isAllowedMime,
  relativePathFor,
} from "@/lib/storage/recordings-path";

describe("storage paths & mime handling", () => {
  it("accepts common audio mime types", () => {
    expect(isAllowedMime("audio/webm")).toBe(true);
    expect(isAllowedMime("audio/webm;codecs=opus")).toBe(true);
    expect(isAllowedMime("audio/mp4")).toBe(true);
    expect(isAllowedMime("audio/mpeg")).toBe(true);
    expect(isAllowedMime("audio/ogg")).toBe(true);
    expect(isAllowedMime("audio/wav")).toBe(true);
  });

  it("rejects non-audio mime types", () => {
    expect(isAllowedMime("text/html")).toBe(false);
    expect(isAllowedMime("application/pdf")).toBe(false);
    expect(isAllowedMime("video/mp4")).toBe(false);
    expect(isAllowedMime("")).toBe(false);
  });

  it("maps mime to safe extension", () => {
    expect(extensionForMime("audio/webm")).toBe("webm");
    expect(extensionForMime("audio/mp4")).toBe("m4a");
    expect(extensionForMime("audio/mpeg")).toBe("mp3");
    expect(extensionForMime("application/octet-stream")).toBe(null);
  });

  it("builds a YYYY/MM/DD path with random filename", () => {
    const date = new Date(Date.UTC(2026, 8, 20)); // Sep 20 2026
    const path1 = relativePathFor(date, "webm");
    const path2 = relativePathFor(date, "webm");

    expect(path1.startsWith("2026/09/20/")).toBe(true);
    expect(path1.endsWith(".webm")).toBe(true);
    expect(path1).not.toBe(path2); // random filename
  });
});