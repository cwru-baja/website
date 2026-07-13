"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import Image from "next/image";
import { LazyMotion, domAnimation, useReducedMotion } from "motion/react";
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

// Images for each competition live in /public/images/competitions/{id}/
// Add files named 1.jpg, 2.jpg, 3.jpg … and list them here.
const img = (id: string, count: number) =>
  Array.from({ length: count }, (_, i) => `/images/competitions/${id}/${i + 1}.jpg`);

const IMAGES: Record<string, string[]> = {
  // Years competed: 2023, 2018, 2015
  oregon: img("oregon", 3),
  // Years competed: 2023
  ohio: img("ohio", 3),
  // Years competed: 2025
  carolina: img("carolina", 3),
  // Years competed: 2025, 2018, 2015
  maryland: img("maryland", 3),
  // Years competed: 2025, 2022
  arizona: img("arizona", 3),
  // Years competed: 2024
  michigan: img("michigan", 3),
  // Years competed: 2024
  williamsport: img("williamsport", 3),
  // Years competed: 2024, 2019, 2017, 2016
  california: img("california", 3),
  // Years competed: 2023
  oshkosh: img("oshkosh", 3),
  // Years competed: 2022, 2019, 2016
  tennessee: img("tennessee", 3),
  // Years competed: 2022, 2019, 2016, 2013
  rochester: img("rochester", 3),
  // Years competed: 2018, 2017, 2014
  kansas: img("kansas", 3),
  // Years competed: 2015
  auburn: img("auburn", 3),
  // Years competed: 2014
  illinois: img("illinois", 3),
};

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
  src: string;
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

  return (
    <>
      <div className="px-3 py-2.5">
        <p className="font-coolvetica text-white text-[11px] tracking-widest leading-tight uppercase">
          {comp.name}
        </p>
        <p className="text-white/45 text-[9px] tracking-wide mt-0.5 font-mono">
          {comp.location}
        </p>
      </div>

      <div className="relative aspect-video bg-neutral-900 border-t border-white/10">
        {displayedSrc && (
          <div key={displayedSrc} className="absolute inset-0">
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
            key={incomingSrc}
            className="absolute inset-0 bg-neutral-900"
            initial={{ opacity: 0 }}
            animate={{ opacity: carouselIncomingReady ? 1 : 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : CONTENT_REVEAL_SECONDS,
              ease: "linear",
            }}
            onAnimationComplete={handleCarouselRevealComplete}
            style={shouldReduceMotion ? undefined : { willChange: "opacity" }}
          >
            <CarouselIncomingImage
              src={incomingSrc}
              index={incomingIndex!}
              onReady={handleCarouselReady}
            />
          </m.div>
        )}

        <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1.5 py-2 bg-gradient-to-t from-black/60 to-transparent">
          {images.map((_, i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full transition-transform duration-300"
              style={{
                backgroundColor:
                  i === displayedIndex ? "white" : "rgba(255,255,255,0.2)",
                transform: i === displayedIndex ? "scale(1.4)" : "scale(1)",
              }}
            />
          ))}
        </div>
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
