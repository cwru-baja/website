import Image from "next/image";
import Link from "next/link";
// Imported rather than referenced by path on purpose. A string src keeps the same
// /_next/image?url=/<file>&w=... URL when the file is replaced, so every layer that
// keys on that URL - Next's own image cache and the browser's - can hand back the
// previous render. A static import is content-hashed, so new bytes mean a new URL
// and a stale copy is unreachable at every width. The car sits in src/assets rather
// than public/ so its source has no URL of its own to be fetched at full size.
import carSr26 from "@/assets/homepage-car-sr26.webp";
import floor from "../../public/homepage-floor-sr26.webp";
import floor2x from "../../public/homepage-floor-sr26@2x.webp";
import floorBox from "@/data/hero-floor.json";

// The car image's box on desktop. The showroom floor is laid out against the
// same box, so both read from here.
const CAR_BOX = "absolute top-[4%] bottom-[2%] left-[40%] right-[1%]";
const CAR_ASPECT = 4200 / 3000;

// Showroom floor under the car: its real reflection, contact shadows and a teal
// pool, rendered in Blender from the car's own camera (artifacts/render-floor.py,
// exported by artifacts/export-floor.mjs). The image is opaque on black and
// drawn with `screen`, which on this near-black page adds the light and leaves
// black untouched. It is a still: the floor does not animate.
//
// Laid out in units of the car image, so its parent must be a size container
// with the car image's box. The car is object-contain, left-aligned and
// vertically centred in that box, so its drawn size comes from container units:
// whichever of width or height binds.
function FloorInCarBox() {
  const iw = `min(100cqw, ${CAR_ASPECT * 100}cqh)`;
  const ih = `calc(${iw} / ${CAR_ASPECT})`;
  return (
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
  );
}

// Desktop: the floor spans the hero behind both columns, against a copy of the
// car's box.
function ShowroomFloor() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 max-lg:hidden"
      style={{
        mixBlendMode: "screen",
        // Never end in a hard line at the bottom of the hero.
        maskImage: "linear-gradient(to bottom, black calc(100% - 110px), transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, black calc(100% - 110px), transparent)",
      }}
    >
      <div className="relative flex h-full max-w-[1600px] mx-auto">
        <div className={CAR_BOX} style={{ containerType: "size" }}>
          <FloorInCarBox />
        </div>
      </div>
    </div>
  );
}

// Below lg the hero stacks: headline and tagline, the car on its floor, the
// buttons, then the description. The text column turns into `display: contents`
// so its children and the car share one flex column and `order` can put the car
// between them; the desktop markup is untouched.
export default function Hero() {
  return (
    <section className="relative min-h-svh overflow-hidden bg-bg lg:h-dvh">
      <ShowroomFloor />

      {/* Constrained inner layout */}
      <div className="relative flex h-full max-w-[1600px] mx-auto max-lg:min-h-svh max-lg:flex-col max-lg:justify-center max-lg:px-8 max-lg:pt-28 max-lg:pb-12">

      {/* Left panel — text content */}
      <div className="relative z-10 flex flex-col justify-start max-lg:contents lg:w-[42%] lg:pt-[18%] lg:px-8 lg:pl-20 xl:pl-28">
        {/* Headline */}
        <h1 className="leading-[1.05] text-white text-[length:clamp(3rem,14vw,4.5rem)] max-lg:order-1 lg:text-[length:clamp(3rem,7vw,7.5rem)]">
          <span className="block font-coolvetica font-bold leading-none">BUILT</span>
          <span className="block font-brier font-semibold text-livery-pop leading-none -mt-[0.2em] lg:-mt-5">TO WIN.</span>
        </h1>

        {/* Subtitle */}
        <div className="mt-6 max-lg:order-2 max-lg:mt-4">
          <p className="text-sm tracking-widest uppercase text-white/40 font-light">
            Built at Case.&nbsp;&nbsp;Raced Everywhere.
          </p>
        </div>

        {/* Description */}
        <p className="mt-6 max-w-xs text-[0.82rem] leading-relaxed text-white/40 max-lg:relative max-lg:z-10 max-lg:order-5">
          We design and manufacture a competition-grade off-road vehicle from
          scratch every year, then race it against hundreds of teams across
          North America.
        </p>

        {/* CTAs. On a phone they share the row and wrap onto two only when the
            screen is too narrow for both (320px). */}
        <div className="mt-9 flex items-center gap-4 max-lg:relative max-lg:z-10 max-lg:order-4 max-lg:mt-8 max-lg:flex-wrap max-lg:gap-3">
          <Link
            href="/team"
            className="inline-flex items-center gap-2 bg-livery px-7 py-3 text-[0.7rem] font-semibold tracking-[0.2em] uppercase text-on-livery hover:bg-livery-hover max-lg:min-h-11 max-lg:justify-center max-lg:whitespace-nowrap max-sm:grow max-sm:basis-36 max-sm:px-4"
          >
            Meet the Team
          </Link>
          <Link
            href="/car"
            className="inline-flex items-center gap-2 border border-white/15 px-7 py-3 text-[0.7rem] font-semibold tracking-[0.2em] uppercase text-white/55 hover:border-white/30 hover:text-white max-lg:min-h-11 max-lg:justify-center max-lg:whitespace-nowrap max-sm:grow max-sm:basis-36 max-sm:px-4"
          >
            View the Car
          </Link>
        </div>
      </div>

      {/* Car render — fully contained, scales with viewport. Below lg it is in
          the flow at the image's own aspect, capped so a sideways phone still
          shows it whole, and carries its own copy of the floor. */}
      <div className="relative mx-auto mt-8 aspect-[7/5] w-full max-w-[112svh] max-lg:order-3 lg:absolute lg:top-[4%] lg:bottom-[2%] lg:left-[40%] lg:right-[1%] lg:mx-0 lg:mt-0 lg:aspect-auto lg:w-auto lg:max-w-none">
        {/* The size container is this blended layer, not the car's box: a
            container is a stacking context, and the floor has to blend with
            the page behind the hero, not with an empty group. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{ mixBlendMode: "screen", containerType: "size" }}
        >
          <FloorInCarBox />
        </div>
        <Image
          src={carSr26}
          alt="CWRU Motorsports Baja Car"
          fill
          sizes="(max-width: 1023px) 100vw, 59vw"
          className="object-contain"
          style={{ objectPosition: "left center" }}
          priority
        />
      </div>

      </div>{/* end constrained inner layout */}
    </section>
  );
}
