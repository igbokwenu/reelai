import { describe, expect, it } from "vitest";

import { preserveOriginalValues } from "./structured-repair";

describe("structured output repair", () => {
  it("keeps substantive original concept fields when repair returns blanks", () => {
    expect(
      preserveOriginalValues(
        {
          concepts: [
            {
              title: "Polo in motion",
              hook: "A clean silhouette reveal.",
              visualStyle: "Pearl studio light and tactile cotton detail.",
              motionPlan: { humanPresence: "NO_PEOPLE" },
            },
          ],
        },
        {
          concepts: [
            {
              title: "",
              hook: " ",
              visualStyle: null,
              motionPlan: { humanPresence: "NO_PERSON" },
            },
          ],
        },
      ),
    ).toEqual({
      concepts: [
        {
          title: "Polo in motion",
          hook: "A clean silhouette reveal.",
          visualStyle: "Pearl studio light and tactile cotton detail.",
          motionPlan: { humanPresence: "NO_PERSON" },
        },
      ],
    });
  });

  it("allows repaired arrays to intentionally remove invalid extra items", () => {
    expect(preserveOriginalValues(["one", "two"], ["one"])).toEqual(["one"]);
  });
});
