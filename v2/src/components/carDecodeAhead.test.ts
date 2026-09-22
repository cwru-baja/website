import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DECODE_AHEAD,
  DecodeAhead,
  decodeWindow,
  type DecodeAheadTuning,
} from "./carDecodeAhead";
import { StreamSchedule, type StreamAsset } from "./carFrameStream";

const url = (index: number) => `/f/${index}.avif`;
const indexOf = (asset: StreamAsset) => Number(asset.url.match(/(\d+)\.avif$/)?.[1]);

/** 41 frames over 4 viewports: frame i is on screen from 0.1i - 0.05 to 0.1i + 0.05. */
const run = (canvas = false) => {
  const schedule = new StreamSchedule();
  schedule.run(url, 0, 40, 0, 4, canvas);
  return schedule.build();
};

describe("decode window", () => {
  it("reaches ahead the way the playhead is moving, nearest first", () => {
    expect(decodeWindow(run(), 1.02, 1).map(indexOf)).toEqual([10, 11, 12, 13, 14]);
  });

  it("keeps only a sliver behind, and turns round with the playhead", () => {
    // Frame 11 is 0.03 behind, which counts seven times over; frame 12 is out.
    expect(decodeWindow(run(), 1.02, -1).map(indexOf)).toEqual([10, 9, 8, 11, 7]);
  });
});

/** Just enough of an Image: arrived or not, and a decode the test settles. */
const fakeImage = (arrived = true) => {
  const settles: (() => void)[] = [];
  return {
    complete: arrived,
    naturalWidth: arrived ? 1920 : 0,
    decode: vi.fn(() => new Promise<void>((resolve) => settles.push(resolve))),
    settleAll: () => settles.splice(0).forEach((settle) => settle()),
  };
};
type FakeImage = ReturnType<typeof fakeImage>;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("decode ahead", () => {
  let images: Map<number, FakeImage>;
  const decodedFrames = () =>
    [...images].filter(([, image]) => image.decode.mock.calls.length).map(([index]) => index);
  const settleAll = () => images.forEach((image) => image.settleAll());

  beforeEach(() => {
    vi.stubGlobal("window", globalThis);
    images = new Map(Array.from({ length: 41 }, (_, index) => [index, fakeImage()]));
  });
  afterEach(() => vi.unstubAllGlobals());

  const decoderFor = (bitmaps = false, tuning: DecodeAheadTuning = DECODE_AHEAD) =>
    new DecodeAhead(
      {
        image: (asset) => images.get(indexOf(asset)) as unknown as HTMLImageElement,
        bitmaps,
      },
      tuning,
    );

  it("decodes the nearest few, then the rest of the window as they finish", async () => {
    const decoder = decoderFor();
    decoder.setSchedule(run());
    decoder.seek(1.02, 1);
    expect(decodedFrames()).toEqual([10, 11, 12, 13]);
    settleAll();
    await flush();
    expect(decodedFrames()).toEqual([10, 11, 12, 13, 14]);
  });

  it("leaves a frame still downloading to the loader", () => {
    images.set(11, fakeImage(false));
    const decoder = decoderFor();
    decoder.setSchedule(run());
    decoder.seek(1.02, 1);
    expect(decodedFrames()).toEqual([10, 12, 13, 14]);
  });

  it("does not decode a frame again while it is fresh", async () => {
    const decoder = decoderFor();
    decoder.setSchedule(run());
    decoder.seek(1.02, 1);
    settleAll();
    await flush();
    settleAll();
    await flush();
    decoder.seek(1.03, 1);
    expect(images.get(10)?.decode).toHaveBeenCalledTimes(1);
  });

  it("decodes orbit frames into bitmaps from the file, and keeps the nearest", async () => {
    const closed: number[] = [];
    vi.stubGlobal("fetch", (address: string) =>
      Promise.resolve({ blob: () => Promise.resolve(address) }),
    );
    vi.stubGlobal("createImageBitmap", (blob: string) =>
      Promise.resolve({ close: () => closed.push(Number(blob.match(/(\d+)\.avif$/)?.[1])) }),
    );
    const decoder = decoderFor(true, { ...DECODE_AHEAD, bitmapKeep: 3 });
    const made = () => images.keys().toArray().filter((frame) => decoder.bitmap(frame));
    const numeric = (frames: number[]) => [...frames].sort((left, right) => left - right);
    decoder.setSchedule(run(true));
    decoder.seek(1.02, 1);
    await flush();
    await flush();
    // The canvas's frames never go through the Image's decode(), and only as
    // many are made as are kept, nearest first.
    expect(decodedFrames()).toEqual([]);
    expect(made()).toEqual([10, 11, 12]);
    expect(closed).toEqual([]);
    // Further on, the new ones push out the ones left behind.
    decoder.seek(2.02, 1);
    await flush();
    await flush();
    expect(made()).toEqual([20, 21, 22]);
    expect(numeric(closed)).toEqual([10, 11, 12]);
    decoder.dispose();
    expect(numeric(closed)).toEqual([10, 11, 12, 20, 21, 22]);
  });
});
