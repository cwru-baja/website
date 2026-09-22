/**
 * Decodes the desktop frames the sequence is about to show, a little ahead of
 * the playhead, so no frame is decoded in the refresh that shows it.
 *
 * Every frame is downloaded long before it is needed, but downloaded is not
 * decoded. A 1920x1080 frame is ~8 MB of pixels and the whole set is ~2.5 GB,
 * so no browser keeps it all decoded: Chromium's decoded-image cache holds ~30
 * frames, WebKit's memory cache ~15. Without this, each src swap on a leg
 * decodes its frame then and there (7-10 ms of AVIF, 15 ms at the tail), and
 * the frame that shows it waits for that - measured on a 120 Hz screen, a leg
 * missed 40-60% of its refreshes.
 *
 * The timeline says which file is on screen when (StreamSchedule, the same
 * record the portrait set streams from), so this decodes whatever the next
 * `ahead` viewports of it will show, nearest first and a few at a time:
 *
 * - Layer frames are shown by <img> elements, so their Image is decode()d.
 *   That fills the per-URL decoded-image cache the element paints from, in
 *   Chromium (on raster threads) and in WebKit (off the main thread).
 * - Orbit frames are drawn to the canvas, and Chromium's canvas has a cache of
 *   its own that decode() never reaches: drawImage(img) decodes on the main
 *   thread. So where it can, each is decoded into an ImageBitmap from the file
 *   itself, which Chromium and Firefox do on a worker thread, and the canvas
 *   draws that. WebKit decodes a Blob's bitmap on the calling thread, but its
 *   drawImage uses the Image's decoded pixels, so there it is decode()d like a
 *   layer.
 *
 * Nothing here decides what is shown, only when the decoding happens: a frame
 * this has not reached yet is decoded on the spot, as it always was.
 */
import { assetDistance, type StreamAsset } from "./carFrameStream";

export const DECODE_AHEAD = {
  /** Timeline units (viewports of scroll) ahead of the playhead, the way it is moving. */
  ahead: 0.35,
  /** ...and behind it, for a small scroll back. */
  behind: 0.05,
  /** Decodes in flight at once. */
  maxInFlight: 4,
  /**
   * Milliseconds before a frame still in the window is decoded again. Chromium
   * only promises to keep a decode() for a few frames; after that it is an
   * ordinary cache entry, which asking again keeps near the front.
   */
  refresh: 1500,
  /** A decode that never settles (a tab that isn't painting) frees its slot. */
  timeout: 1000,
  /** Orbit frames held as bitmaps, nearest first. */
  bitmapKeep: 8,
} as const;

export type DecodeAheadTuning = {
  readonly [Key in keyof typeof DECODE_AHEAD]: number;
};

/**
 * Every asset nearest first. Behind the playhead counts `ahead / behind` times
 * over, so the window reaches `ahead` one way and `behind` the other.
 */
const byDistance = (
  assets: readonly StreamAsset[],
  time: number,
  direction: number,
  tuning: DecodeAheadTuning,
) =>
  assets
    .map((asset) => ({
      asset,
      distance: assetDistance(
        asset.spans,
        time,
        direction,
        tuning.ahead / tuning.behind,
      ),
    }))
    .sort((left, right) => left.distance - right.distance);

/** What to decode at `time`, nearest first: the window ahead, and a sliver behind. */
export const decodeWindow = (
  assets: readonly StreamAsset[],
  time: number,
  direction: number,
  tuning: DecodeAheadTuning = DECODE_AHEAD,
) =>
  byDistance(assets, time, direction, tuning)
    .filter(({ distance }) => distance <= tuning.ahead)
    .map(({ asset }) => asset);

export interface DecodeAheadSource {
  /** The Image that holds an asset's file, if it has been asked for yet. */
  image: (asset: StreamAsset) => HTMLImageElement | undefined;
  /** Decode orbit frames into ImageBitmaps (not in WebKit - see above). */
  bitmaps: boolean;
}

export class DecodeAhead {
  private assets: StreamAsset[] = [];
  private time = 0;
  private direction = 1;
  private inFlight = 0;
  private decodedAt = new Map<string, number>();
  private bitmaps = new Map<number, ImageBitmap>();
  private making = new Set<number>();
  private disposed = false;

  constructor(
    private readonly source: DecodeAheadSource,
    private readonly tuning: DecodeAheadTuning = DECODE_AHEAD,
  ) {}

  /** Nothing is decoded until the first seek says where the playhead is. */
  setSchedule(assets: readonly StreamAsset[]) {
    this.assets = [...assets];
  }

  /** Where the playhead is, in timeline units, and which way it is moving. */
  seek(time: number, direction: number) {
    this.time = time;
    this.direction = direction < 0 ? -1 : 1;
    this.pump();
  }

  /** An orbit frame's bitmap, if it has one. */
  bitmap(frame: number) {
    return this.bitmaps.get(frame);
  }

  dispose() {
    this.disposed = true;
    this.bitmaps.forEach((bitmap) => bitmap.close());
    this.bitmaps.clear();
  }

  private pump() {
    if (this.disposed || this.inFlight >= this.tuning.maxInFlight) return;
    const wanted = decodeWindow(this.assets, this.time, this.direction, this.tuning);
    const now = performance.now();
    let canvasFrames = 0;
    for (const asset of wanted) {
      if (this.inFlight >= this.tuning.maxInFlight) break;
      const frame = asset.canvasFrame;
      const bitmap = frame !== undefined && this.source.bitmaps;
      if (bitmap) {
        // No more than are kept: one made past them would be let go at once.
        canvasFrames += 1;
        if (canvasFrames > this.tuning.bitmapKeep) continue;
        if (this.bitmaps.has(frame) || this.making.has(frame)) continue;
      }
      const image = this.source.image(asset);
      // Only what has arrived: decoding a file still downloading would hold a
      // slot until it lands, and the loader already has it in hand.
      if (!image?.complete || !image.naturalWidth) continue;
      // Also what keeps a failed decode from being retried on every pump.
      const last = this.decodedAt.get(asset.url);
      if (last !== undefined && now - last < this.tuning.refresh) continue;
      this.decodedAt.set(asset.url, now);
      if (bitmap) this.makeBitmap(asset, frame);
      else this.settle(image.decode());
    }
  }

  private makeBitmap(asset: StreamAsset, frame: number) {
    // From the file, not the Image: Chromium decodes an Image's bitmap on the
    // calling thread. The file is in the HTTP cache once the Image has it.
    this.making.add(frame);
    const made = fetch(asset.url)
      .then((response) => response.blob())
      .then((blob) => createImageBitmap(blob))
      .then((bitmap) => {
        if (this.disposed) {
          bitmap.close();
          return;
        }
        this.bitmaps.set(frame, bitmap);
        this.trimBitmaps();
      })
      .finally(() => this.making.delete(frame));
    this.settle(made);
  }

  /** Keeps the bitmaps nearest the playhead; each is ~8 MB. */
  private trimBitmaps() {
    if (this.bitmaps.size <= this.tuning.bitmapKeep) return;
    const nearest = byDistance(this.assets, this.time, this.direction, this.tuning);
    const keep = new Set(
      nearest
        .map(({ asset }) => asset.canvasFrame)
        .filter((frame) => frame !== undefined && this.bitmaps.has(frame))
        .slice(0, this.tuning.bitmapKeep),
    );
    this.bitmaps.forEach((bitmap, frame) => {
      if (keep.has(frame)) return;
      bitmap.close();
      this.bitmaps.delete(frame);
    });
  }

  private settle(work: Promise<unknown>) {
    this.inFlight += 1;
    let done = false;
    const free = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      this.inFlight -= 1;
      this.pump();
    };
    const timer = window.setTimeout(free, this.tuning.timeout);
    work.then(free, free);
  }
}
