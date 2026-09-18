"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import Image, { getImageProps, type StaticImageData } from "next/image";
import { LazyMotion, domAnimation, useReducedMotion } from "motion/react";
// Imported, not named by path: any extension works, and the content-hashed URL
// means a replaced photo can't be served stale from Next's image cache.
import arizona1 from "../../public/images/competitions/arizona/1.webp";
import arizona2 from "../../public/images/competitions/arizona/2.jpg";
import arizona3 from "../../public/images/competitions/arizona/3.png";
import california1 from "../../public/images/competitions/california/1.png";
import california2 from "../../public/images/competitions/california/2.png";
import california3 from "../../public/images/competitions/california/3.png";
import carolina1 from "../../public/images/competitions/carolina/1.jpg";
import carolina2 from "../../public/images/competitions/carolina/2.jpg";
import carolina3 from "../../public/images/competitions/carolina/3.png";
import illinois1 from "../../public/images/competitions/illinois/1.jpg";
import illinois2 from "../../public/images/competitions/illinois/2.jpg";
import illinois3 from "../../public/images/competitions/illinois/3.jpg";
import maryland1 from "../../public/images/competitions/maryland/1.jpg";
import maryland2 from "../../public/images/competitions/maryland/2.jpg";
import maryland3 from "../../public/images/competitions/maryland/3.png";
import michigan1 from "../../public/images/competitions/michigan/1.png";
import michigan2 from "../../public/images/competitions/michigan/2.png";
import michigan3 from "../../public/images/competitions/michigan/3.png";
import ohio1 from "../../public/images/competitions/ohio/1.jpg";
import ohio2 from "../../public/images/competitions/ohio/2.jpg";
import ohio3 from "../../public/images/competitions/ohio/3.jpg";
import oregon1 from "../../public/images/competitions/oregon/1.jpg";
import oregon2 from "../../public/images/competitions/oregon/2.png";
import oregon3 from "../../public/images/competitions/oregon/3.png";
import oshkosh1 from "../../public/images/competitions/oshkosh/1.jpg";
import oshkosh2 from "../../public/images/competitions/oshkosh/2.jpg";
import oshkosh3 from "../../public/images/competitions/oshkosh/3.jpg";
import rochester1 from "../../public/images/competitions/rochester/1.jpg";
import rochester2 from "../../public/images/competitions/rochester/2.jpg";
import rochester3 from "../../public/images/competitions/rochester/3.jpg";
import tennessee1 from "../../public/images/competitions/tennessee/1.jpg";
import tennessee2 from "../../public/images/competitions/tennessee/2.jpg";
import tennessee3 from "../../public/images/competitions/tennessee/3.jpg";
import williamsport1 from "../../public/images/competitions/williamsport/1.png";
import williamsport2 from "../../public/images/competitions/williamsport/2.png";
import williamsport3 from "../../public/images/competitions/williamsport/3.png";
import * as m from "motion/react-m";
import type {
  ContentTransitionEntry,
  ContentTransitionState,
  ContentTransitionToken,
} from "./contentTransition";

const CONTENT_REVEAL_SECONDS = 0.12;
const CAROUSEL_HOLD_MS = 1800;

export interface CompetitionMarker {
  id: string;
  name: string;
  location: string;
  svgX: number;
  svgY: number;
}

// Images for each competition live in /public/images/competitions/{id}/.
// To add or swap one, drop the file there and import it above.
const IMAGES: Record<string, StaticImageData[]> = {
  // Years competed: 2023, 2018, 2015
  oregon: [oregon1, oregon2, oregon3],
  // Years competed: 2023
  ohio: [ohio1, ohio2, ohio3],
  // Years competed: 2025
  carolina: [carolina1, carolina2, carolina3],
  // Years competed: 2025, 2018, 2015
  maryland: [maryland1, maryland2, maryland3],
  // Years competed: 2025, 2022
  arizona: [arizona1, arizona2, arizona3],
  // Years competed: 2024
  michigan: [michigan1, michigan2, michigan3],
  // Years competed: 2024
  williamsport: [williamsport1, williamsport2, williamsport3],
  // Years competed: 2024, 2019, 2017, 2016
  california: [california1, california2, california3],
  // Years competed: 2023
  oshkosh: [oshkosh1, oshkosh2, oshkosh3],
  // Years competed: 2022, 2019, 2016
  tennessee: [tennessee1, tennessee2, tennessee3],
  // Years competed: 2022, 2019, 2016, 2013
  rochester: [rochester1, rochester2, rochester3],
  // Years competed: 2014
  illinois: [illinois1, illinois2, illinois3],
};

const preloaded = new Set<StaticImageData>();

/**
 * Warms the browser cache with each competition's first image, using the same
 * srcset next/image renders, so switching competitions never shows a blank.
 */
export function preloadCompetitionImages(competitions: CompetitionMarker[]) {
  for (const { id } of competitions) {
    const src = IMAGES[id]?.[0];
    if (!src || preloaded.has(src)) continue;
    preloaded.add(src);

    const { props } = getImageProps({ src, alt: "", fill: true, sizes: "480px" });
    const image = new window.Image();
    image.sizes = props.sizes ?? "480px";
    if (props.srcSet) image.srcset = props.srcSet;
    image.src = props.src;
    image.decode().catch(() => {});
  }
}

function useDecodedImage(onReady: () => void) {
  const reportedRef = useRef(false);

  const reportReady = useCallback(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    onReady();
  }, [onReady]);

  const onLoad = useCallback(
    async (event: SyntheticEvent<HTMLImageElement>) => {
      try {
        await event.currentTarget.decode();
      } catch {
        // A completed load is still safe to reveal if decode() is unavailable
        // or rejects after the browser has already painted the resource.
      }
      reportReady();
    },
    [reportReady],
  );

  const onError = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      event.currentTarget.style.opacity = "0";
      reportReady();
    },
    [reportReady],
  );

  return { onLoad, onError };
}

interface CarouselIncomingImageProps {
  src: StaticImageData;
  index: number;
  onReady: (index: number) => void;
}

function CarouselIncomingImage({
  src,
  index,
  onReady,
}: CarouselIncomingImageProps) {
  const decoded = useDecodedImage(() => onReady(index));

  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="480px"
      className="object-cover"
      onLoad={decoded.onLoad}
      onError={decoded.onError}
    />
  );
}

interface CompetitionLayerProps {
  entry: ContentTransitionEntry<CompetitionMarker>;
  isIncoming: boolean;
  shouldReduceMotion: boolean;
  onPrimaryReady: (token: ContentTransitionToken) => void;
}

function CompetitionLayer({
  entry,
  isIncoming,
  shouldReduceMotion,
  onPrimaryReady,
}: CompetitionLayerProps) {
  const { value: comp } = entry;
  const images = IMAGES[comp.id] ?? [];
  const [displayedIndex, setDisplayedIndex] = useState(0);
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null);
  const [carouselIncomingReady, setCarouselIncomingReady] = useState(false);
  const primaryReady = useDecodedImage(() => onPrimaryReady(entry));

  useEffect(() => {
    if (isIncoming || images.length <= 1 || incomingIndex !== null) return;

    const timeout = window.setTimeout(() => {
      setCarouselIncomingReady(false);
      setIncomingIndex((displayedIndex + 1) % images.length);
    }, CAROUSEL_HOLD_MS);

    return () => window.clearTimeout(timeout);
  }, [displayedIndex, images.length, incomingIndex, isIncoming]);

  const handleCarouselReady = useCallback(
    (index: number) => {
      if (index !== incomingIndex) return;

      if (shouldReduceMotion) {
        setDisplayedIndex(Number(index));
        setIncomingIndex(null);
        setCarouselIncomingReady(false);
        return;
      }

      setCarouselIncomingReady(true);
    },
    [incomingIndex, shouldReduceMotion],
  );

  const handleCarouselRevealComplete = useCallback(() => {
    if (!carouselIncomingReady || incomingIndex === null) return;
    setDisplayedIndex(incomingIndex);
    setIncomingIndex(null);
    setCarouselIncomingReady(false);
  }, [carouselIncomingReady, incomingIndex]);

  const displayedSrc = images[displayedIndex];
  const incomingSrc = incomingIndex === null ? null : images[incomingIndex];
  // The square moves the moment the next photo starts to appear, not after
  // its crossfade finishes.
  const activeIndex =
    carouselIncomingReady && incomingIndex !== null ? incomingIndex : displayedIndex;

  return (
    <>
      <div className="px-3 py-2.5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-coolvetica text-white text-[11px] tracking-widest leading-tight uppercase truncate">
            {comp.name}
          </p>
          <p className="text-white/45 text-[9px] tracking-wide mt-0.5 font-mono truncate">
            {comp.location}
          </p>
        </div>

        {images.length > 1 && (
          <div className="flex items-center gap-1" style={{ flexShrink: 0 }} aria-hidden>
            {images.map((_, i) => {
              const size = i === activeIndex ? 8 : 5;
              return (
                <div
                  key={i}
                  style={{
                    width: size,
                    height: size,
                    backgroundColor:
                      i === activeIndex ? "var(--livery)" : "rgba(255,255,255,0.2)",
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="relative aspect-video bg-neutral-900 border-t border-white/10">
        {displayedSrc && (
          <div key={displayedSrc.src} className="absolute inset-0">
            <Image
              src={displayedSrc}
              alt=""
              fill
              sizes="480px"
              className="object-cover"
              onLoad={isIncoming ? primaryReady.onLoad : undefined}
              onError={isIncoming ? primaryReady.onError : undefined}
            />
          </div>
        )}

        {incomingSrc && (
          <m.div
            key={incomingSrc.src}
            className="absolute inset-0 bg-neutral-900"
            initial={{ opacity: 0 }}
            animate={{ opacity: carouselIncomingReady ? 1 : 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : CONTENT_REVEAL_SECONDS,
              ease: "linear",
            }}
            onAnimationComplete={(definition) => {
              // Only the fade *in* finishes a reveal. The layer's initial
              // hidden animation also completes, and when the next photo was
              // already decoded (always true wrapping back to the first) that
              // completion used to promote it instantly, skipping the fade.
              if (
                typeof definition === "object" &&
                !Array.isArray(definition) &&
                definition.opacity === 1
              ) {
                handleCarouselRevealComplete();
              }
            }}
            style={shouldReduceMotion ? undefined : { willChange: "opacity" }}
          >
            <CarouselIncomingImage
              src={incomingSrc}
              index={incomingIndex!}
              onReady={handleCarouselReady}
            />
          </m.div>
        )}
      </div>

    </>
  );
}

interface Props {
  transition: ContentTransitionState<CompetitionMarker> | null;
  onIncomingReady: (token: ContentTransitionToken) => void;
  onIncomingRevealed: (token: ContentTransitionToken) => void;
}

export const CompetitionCard = forwardRef<HTMLDivElement, Props>(
  function CompetitionCard(
    { transition, onIncomingReady, onIncomingRevealed },
    ref,
  ) {
    const shouldReduceMotion = useReducedMotion() ?? false;

    const handleIncomingReady = useCallback(
      (token: ContentTransitionToken) => {
        onIncomingReady(token);
        if (shouldReduceMotion) onIncomingRevealed(token);
      },
      [onIncomingReady, onIncomingRevealed, shouldReduceMotion],
    );

    const layers = transition
      ? [transition.displayed, ...(transition.incoming ? [transition.incoming] : [])]
      : [];

    return (
      <LazyMotion features={domAnimation}>
        <div
          ref={ref}
          className="fixed top-0 left-0 z-50 pointer-events-none w-[480px] rounded-xl overflow-hidden border border-white/15 bg-black shadow-2xl opacity-0 scale-[0.88]"
        >
          <div className="invisible pointer-events-none select-none" aria-hidden>
            <div className="px-3 py-2.5">
              <p className="text-[11px] leading-tight">&#8203;</p>
              <p className="text-[9px] mt-0.5">&#8203;</p>
            </div>
            <div className="aspect-video border-t border-transparent" />
          </div>

          {layers.map((entry) => {
            const isIncoming = entry === transition?.incoming;
            const isRevealing = isIncoming && transition?.phase === "revealing";

            return (
              <m.div
                key={`${entry.session}:${entry.generation}`}
                className="absolute inset-0 bg-black"
                initial={isIncoming ? { opacity: 0 } : false}
                animate={{ opacity: isIncoming ? (isRevealing ? 1 : 0) : 1 }}
                transition={{
                  duration:
                    isIncoming && isRevealing && !shouldReduceMotion
                      ? CONTENT_REVEAL_SECONDS
                      : 0,
                  ease: "linear",
                }}
                onAnimationComplete={() => {
                  if (isRevealing) onIncomingRevealed(entry);
                }}
                style={isIncoming ? { willChange: "opacity" } : undefined}
              >
                <CompetitionLayer
                  entry={entry}
                  isIncoming={isIncoming}
                  shouldReduceMotion={shouldReduceMotion}
                  onPrimaryReady={handleIncomingReady}
                />
              </m.div>
            );
          })}
        </div>
      </LazyMotion>
    );
  },
);
