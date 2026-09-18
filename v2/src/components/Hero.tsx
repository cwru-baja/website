import Image from "next/image";
import Link from "next/link";
// Imported rather than referenced by path on purpose. A string src keeps the same
// /_next/image?url=/homepage-car-sr26.png&w=... URL when the file is replaced, so
// every layer that keys on that URL - Next's own image cache and the browser's -
// can hand back the previous render. A static import is content-hashed, so new
// bytes mean a new URL and a stale copy is unreachable at every width.
import carSr26 from "../../public/homepage-car-sr26.png";
import floor from "../../public/homepage-floor-sr26.webp";
import floor2x from "../../public/homepage-floor-sr26@2x.webp";
import floorBox from "@/data/hero-floor.json";

// The car image's box. The showroom floor is laid out against the same box, so
// both read from here.
const CAR_BOX = "absolute top-[4%] bottom-[2%] left-[40%] right-[1%]";
const CAR_ASPECT = 4200 / 3000;

// Showroom floor under the car: its real reflection, contact shadows and a teal
// pool, rendered in Blender from the car's own camera (artifacts/render-floor.py,
// exported by artifacts/export-floor.mjs). The image is opaque on black and
// drawn with `screen`, which on this near-black page adds the light and leaves
// black untouched. It is a still: the floor does not animate.
function ShowroomFloor() {
  // The car is object-contain, left-aligned and vertically centred in CAR_BOX,
  // so its drawn size comes from container units: whichever of width or
  // height binds. The floor box is stored in units of that drawn image.
  const iw = `min(100cqw, ${CAR_ASPECT * 100}cqh)`;
  const ih = `calc(${iw} / ${CAR_ASPECT})`;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        mixBlendMode: "screen",
        // Never end in a hard line at the bottom of the hero.
        maskImage: "linear-gradient(to bottom, black calc(100% - 110px), transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, black calc(100% - 110px), transparent)",
      }}
    >
      <div className="relative flex h-full max-w-[1600px] mx-auto">
        <div className={CAR_BOX} style={{ containerType: "size" }}>
          <div
            style={{
              position: "absolute",
              left: `calc(${iw} * ${floorBox.left})`,
              top: `calc((100cqh - ${ih}) / 2 + ${ih} * ${floorBox.top})`,
              width: `calc(${iw} * ${floorBox.width})`,
              height: `calc(${ih} * ${floorBox.height})`,
              // The render's right and bottom edges still carry light; fade them so
              // wide or tall viewports never show where the image stops.
              maskImage:
                "linear-gradient(to right, transparent, black 6%, black 88%, transparent), linear-gradient(to bottom, black 62%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 6%, black 88%, transparent), linear-gradient(to bottom, black 62%, transparent)",
              maskComposite: "intersect",
              WebkitMaskComposite: "source-in",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image would re-encode it to lossy WebP, which bands the dark gradient */}
            <img
              src={floor.src}
              srcSet={`${floor.src} 1470w, ${floor2x.src} 2940w`}
              sizes="(min-width: 1600px) 1322px, 83vw"
              alt=""
              decoding="async"
              fetchPriority="low"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative h-dvh overflow-hidden bg-bg">
      <ShowroomFloor />

      {/* Constrained inner layout */}
      <div className="relative flex h-full max-w-[1600px] mx-auto">

      {/* Left panel — text content */}
      <div className="relative z-10 flex w-[42%] flex-col justify-start pt-[18%] px-8 pl-16 lg:pl-20 xl:pl-28">
        {/* Headline */}
        <h1 className="leading-[1.05] text-white" style={{ fontSize: "clamp(3rem, 7vw, 7.5rem)" }}>
          <span className="block font-coolvetica font-bold leading-none">BUILT</span>
          <span className="block font-brier font-semibold text-livery-pop leading-none -mt-5">TO WIN.</span>
        </h1>

        {/* Subtitle */}
        <div className="mt-6">
          <p className="text-sm tracking-widest uppercase text-white/40 font-light">
            Built at Case.&nbsp;&nbsp;Raced Everywhere.
          </p>
        </div>

        {/* Description */}
        <p className="mt-6 max-w-xs text-[0.82rem] leading-relaxed text-white/40">
          We design and manufacture a competition-grade off-road vehicle from
          scratch every year, then race it against hundreds of teams across
          North America.
        </p>

        {/* CTAs */}
        <div className="mt-9 flex items-center gap-4">
          <Link
            href="/team"
            className="inline-flex items-center gap-2 bg-livery px-7 py-3 text-[0.7rem] font-semibold tracking-[0.2em] uppercase text-on-livery hover:bg-livery-hover"
          >
            Meet the Team
          </Link>
          <Link
            href="/car"
            className="inline-flex items-center gap-2 border border-white/15 px-7 py-3 text-[0.7rem] font-semibold tracking-[0.2em] uppercase text-white/55 hover:border-white/30 hover:text-white"
          >
            View the Car
          </Link>
        </div>
      </div>

      {/* Car render — fully contained, scales with viewport */}
      <div className={CAR_BOX}>
        <Image
          src={carSr26}
          alt="CWRU Motorsports Baja Car"
          fill
          sizes="59vw"
          className="object-contain"
          style={{ objectPosition: "left center" }}
          priority
        />
      </div>

      </div>{/* end constrained inner layout */}
    </section>
  );
}
