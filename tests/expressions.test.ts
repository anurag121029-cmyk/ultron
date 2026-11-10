import { describe, expect, it } from "vitest";
import { expressionFromReply, roughEmotionFromBlendshapes, roughEmotionFromGeometry } from "../lib/expressions";

describe("expressionFromReply", () => {
  it("maps praise to happy", () => { expect(expressionFromReply("Great job, that's wonderful!")).toBe("happy"); });
  it("maps apology to sad", () => { expect(expressionFromReply("Sorry, unfortunately that failed.")).toBe("sad"); });
  it("maps surprise words to surprised", () => { expect(expressionFromReply("Wow, that's incredible!")).toBe("surprised"); });
  it("maps questions to thinking", () => { expect(expressionFromReply("What do you mean by that?")).toBe("thinking"); });
  it("defaults to neutral", () => { expect(expressionFromReply("Here is the answer.")).toBe("neutral"); });
});

describe("roughEmotionFromBlendshapes", () => {
  it("detects happy from smile", () => { expect(roughEmotionFromBlendshapes({ mouthSmileLeft: 0.8, mouthSmileRight: 0.7 })).toBe("happy"); });
  it("detects surprised from jaw + brows", () => { expect(roughEmotionFromBlendshapes({ jawOpen: 0.8, browInnerUp: 0.6 })).toBe("surprised"); });
  it("detects sad from frown", () => { expect(roughEmotionFromBlendshapes({ browDownLeft: 0.7, browDownRight: 0.6 })).toBe("sad"); });
  it("defaults to neutral on empty scores", () => { expect(roughEmotionFromBlendshapes({})).toBe("neutral"); });
});

describe("roughEmotionFromGeometry", () => {
  it("detects surprised from open mouth + raised brows", () => { expect(roughEmotionFromGeometry({ smileWidth: 0.35, mouthOpen: 0.2, browRaise: 0.1 })).toBe("surprised"); });
  it("detects happy from wide smile", () => { expect(roughEmotionFromGeometry({ smileWidth: 0.5, mouthOpen: 0.02, browRaise: 0.0 })).toBe("happy"); });
  it("detects sad from narrow mouth", () => { expect(roughEmotionFromGeometry({ smileWidth: 0.25, mouthOpen: 0.02, browRaise: 0.0 })).toBe("sad"); });
  it("defaults to neutral", () => { expect(roughEmotionFromGeometry({ smileWidth: 0.36, mouthOpen: 0.05, browRaise: 0.02 })).toBe("neutral"); });
});
