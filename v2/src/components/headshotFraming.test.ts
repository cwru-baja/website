import { describe, expect, it } from "vitest";
import {
  DEFAULT_FRAMING,
  clampFraming,
  clampZoom,
  dragToPan,
  framedSizes,
  framingTransform,
  isDefaultFraming,
  panLimit,
  resolveFraming,
  roundFraming,
} from "./headshotFraming";

describe("panLimit", () => {
  it("leaves no room to pan a square photo in a square frame", () => {
    expect(panLimit(1)).toBe(0);
  });

  it("splits the overflow evenly between opposite edges", () => {
    expect(panLimit(1.5)).toBeCloseTo(25);
    expect(panLimit(2)).toBeCloseTo(50);
  });
});

describe("clampZoom", () => {
  it("keeps the photo at least as large as the frame", () => {
    expect(clampZoom(0.4)).toBe(1);
  });

  it("falls back to the minimum for unusable numbers", () => {
    expect(clampZoom(Number.NaN)).toBe(1);
  });
});

describe("clampFraming", () => {
  it("pins an unzoomed photo to the centre", () => {
    expect(clampFraming({ zoom: 1, x: 30, y: -20 })).toEqual({
      zoom: 1,
      x: 0,
      y: 0,
    });
  });

  it("allows offsets up to the edge of the overflow", () => {
    expect(clampFraming({ zoom: 2, x: 40, y: -50 })).toEqual({
      zoom: 2,
      x: 40,
      y: -50,
    });
  });

  it("stops an offset before the frame shows through", () => {
    expect(clampFraming({ zoom: 1.5, x: 90, y: -90 })).toEqual({
      zoom: 1.5,
      x: 25,
      y: -25,
    });
  });
});

describe("resolveFraming", () => {
  it("fills in the untouched axes", () => {
    expect(resolveFraming({ zoom: 1.5, y: -10 })).toEqual({
      zoom: 1.5,
      x: 0,
      y: -10,
    });
  });

  it("returns the default when nothing is set", () => {
    expect(resolveFraming()).toEqual(DEFAULT_FRAMING);
  });
});

describe("framingTransform", () => {
  it("translates before scaling so a nudge is zoom-independent", () => {
    expect(framingTransform({ zoom: 1.5, x: 10, y: -5 })).toBe(
      "translate(10%, -5%) scale(1.5)",
    );
  });
});

describe("framedSizes", () => {
  it("asks for more source pixels as the framing pushes in", () => {
    expect(framedSizes()).toBe("176px");
    expect(framedSizes({ zoom: 2 })).toBe("352px");
  });

  // object-cover fills the frame with the short side, so a 3:2 file renders
  // half again wider than the frame and the browser must be told so.
  it("sizes a cropped photo by the side that overflows the frame", () => {
    expect(framedSizes({ zoom: 1 }, 2048 / 1365)).toBe("265px");
    expect(framedSizes({ zoom: 1.37 }, 2048 / 1365)).toBe("362px");
    expect(framedSizes({ zoom: 1 }, 1365 / 2048)).toBe("265px");
  });
});

describe("isDefaultFraming", () => {
  it("treats an offset that clamps away as untouched", () => {
    expect(isDefaultFraming({ zoom: 1, x: 12 })).toBe(true);
    expect(isDefaultFraming({ zoom: 1.4 })).toBe(false);
  });
});

describe("dragToPan", () => {
  it("reads a drag as a share of the frame", () => {
    expect(dragToPan(176)).toBeCloseTo(100);
    expect(dragToPan(-44)).toBeCloseTo(-25);
  });
});

describe("roundFraming", () => {
  it("trims values to what is worth pasting back into the source", () => {
    expect(roundFraming({ zoom: 1.3679890, x: 2.44449, y: -4.5001 })).toEqual({
      zoom: 1.368,
      x: 2.44,
      y: -4.5,
    });
  });
});
