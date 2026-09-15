import { EMPTY_WEEK, parseSettingsSnapshot, type SettingsSnapshot } from "./models";

describe("settings snapshot parsing", () => {
  it("normalizes days omitted by Realtime Database to empty arrays", () => {
    const parsed = parseSettingsSnapshot({
      schemaVersion: 1,
      course: "INFO 3",
      filter: { group: true, qdl: false, groupLetter: "D" },
      savedEvents: {},
      updatedAt: 123,
    });

    expect(parsed).toEqual<SettingsSnapshot>({
      schemaVersion: 1,
      course: "INFO 3",
      filter: { group: true, qdl: false, groupLetter: "D" },
      savedEvents: EMPTY_WEEK(),
    });
  });

  it("rejects unsupported schemas and invalid filters", () => {
    expect(
      parseSettingsSnapshot({
        schemaVersion: 2,
        filter: { group: true, qdl: false, groupLetter: "A" },
      }),
    ).toBeUndefined();
    expect(
      parseSettingsSnapshot({
        schemaVersion: 1,
        filter: { group: "true", qdl: false, groupLetter: "A" },
      }),
    ).toBeUndefined();
  });

  it("rejects malformed saved events instead of partially applying them", () => {
    expect(
      parseSettingsSnapshot({
        schemaVersion: 1,
        filter: { group: false, qdl: false, groupLetter: "" },
        savedEvents: { mon: [{ courseId: "incomplete" }] },
      }),
    ).toBeUndefined();
  });
});
