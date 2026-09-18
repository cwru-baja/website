"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import HeadshotCalibration, {
  NUDGE_FINE_STEP,
  NUDGE_STEP,
} from "./HeadshotCalibration";
import {
  DEFAULT_FRAMING,
  ZOOM_RANGE,
  clampFraming,
  dragToPan,
  framedSizes,
  framingTransform,
  resolveFraming,
  type HeadshotFraming,
} from "./headshotFraming";
import { LEADERSHIP_TIERS as tiers, type Leader as Member } from "@/lib/team";

// Members wearing the team logo have nothing to reframe.
const photoMembers = tiers
  .flatMap((tier) => tier.members)
  .filter((member) => !member.usesLogo);

const shippedFraming = new Map(
  photoMembers.map((member) => [member.name, resolveFraming(member.framing)]),
);

function framingFor(name: string): HeadshotFraming {
  return shippedFraming.get(name) ?? DEFAULT_FRAMING;
}

type Calibration = {
  selected: boolean;
  onSelect: () => void;
  onPan: (x: number, y: number) => void;
};

type CalibrationProps = {
  framingOverride?: HeadshotFraming;
  calibration?: Calibration;
};

type MemberCardProps = Member & CalibrationProps;

function MemberCard({
  name,
  role,
  image,
  usesLogo,
  graduationYear,
  linkedin,
  framing,
  framingOverride,
  calibration,
}: MemberCardProps) {
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const active = framingOverride ?? framing;
  const resolved = resolveFraming(active);
  const framed = !usesLogo && active !== undefined;

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!calibration) return;
    calibration.onSelect();
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragOriginRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const pan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = dragOriginRef.current;
    if (!calibration || !origin) return;
    calibration.onPan(
      dragToPan(event.clientX - origin.x, event.currentTarget.clientWidth),
      dragToPan(event.clientY - origin.y, event.currentTarget.clientWidth),
    );
    dragOriginRef.current = { x: event.clientX, y: event.clientY };
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragOriginRef.current = null;
  };

  const photo = (
    <div
      className={`relative mx-auto aspect-square w-full max-w-44 overflow-hidden rounded-full ring-2 ring-white/10 group-hover:ring-4 group-hover:ring-livery-ink ${
        calibration
          ? `touch-none ${calibration.selected ? "cursor-grab !ring-4 !ring-livery-ink" : "cursor-pointer"}`
          : ""
      }`}
      onPointerDown={calibration ? startPan : undefined}
      onPointerMove={calibration ? pan : undefined}
      onPointerUp={calibration ? endPan : undefined}
      onPointerCancel={calibration ? endPan : undefined}
    >
      <Image
        src={image}
        alt={usesLogo ? "CWRU Motorsports logo" : name}
        fill
        className={
          usesLogo
            ? "object-contain p-[27%]"
            : framed
              ? "object-cover object-center"
              : "object-cover object-top"
        }
        sizes={
          typeof image === "string"
            ? "176px"
            : framedSizes(resolved, image.width / image.height)
        }
        style={framed ? { transform: framingTransform(resolved) } : undefined}
      />
    </div>
  );

  return (
    <div className="group flex flex-col items-center text-center">
      {linkedin ? (
        <a
          href={linkedin}
          target="_blank"
          rel="noopener noreferrer"
          // Sized like the frame: the column centres its children, so a link
          // left to shrink-wrap would give the fluid frame nothing to fill.
          className="block w-full max-w-44"
          // Selecting a headshot must not navigate away mid-calibration.
          onClick={calibration ? (event) => event.preventDefault() : undefined}
        >
          {photo}
        </a>
      ) : (
        photo
      )}
      <p className="mt-4 text-sm font-semibold text-white leading-snug">{name}</p>
      <p className="mt-0.5 text-[0.7rem] tracking-wide text-white/40 leading-snug">{role}</p>
      {graduationYear && (
        <p className="mt-1 text-[0.65rem] tracking-[0.12em] uppercase text-white/25">
          Class of {graduationYear}
        </p>
      )}
    </div>
  );
}

function Tier({
  title,
  members,
  renderProps,
}: {
  title: string;
  members: Member[];
  renderProps: (member: Member) => CalibrationProps;
}) {
  return (
    <div>
      <h2 className="font-coolvetica font-bold text-2xl tracking-widest text-white/50 mb-8">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {members.map((m) => (
          <MemberCard key={m.name} {...m} {...renderProps(m)} />
        ))}
      </div>
    </div>
  );
}

export default function LeadershipSection() {
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [draft, setDraft] = useState<Record<string, HeadshotFraming>>({});
  const [selectedName, setSelectedName] = useState(photoMembers[0]?.name ?? "");

  // Untouched members fall back to the framing they ship with, so the panel
  // always edits the live value without needing to seed state up front.
  const effective = useMemo(
    () =>
      Object.fromEntries(
        photoMembers.map((m) => [m.name, draft[m.name] ?? framingFor(m.name)]),
      ),
    [draft],
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const params = new URLSearchParams(window.location.search);
    const timer = window.setTimeout(() => {
      setCalibrationMode(params.get("calibrateHeadshots") === "1");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const updateSelected = useCallback(
    (next: HeadshotFraming) => {
      setDraft((current) => ({
        ...current,
        [selectedName]: clampFraming(next),
      }));
    },
    [selectedName],
  );

  const panSelected = useCallback(
    (x: number, y: number) => {
      setDraft((current) => {
        const base = current[selectedName] ?? framingFor(selectedName);
        return {
          ...current,
          [selectedName]: clampFraming({
            ...base,
            x: base.x + x,
            y: base.y + y,
          }),
        };
      });
    },
    [selectedName],
  );

  useEffect(() => {
    if (!calibrationMode || !selectedName) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Leave the panel's own select and slider alone.
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;

      const step = event.shiftKey ? NUDGE_FINE_STEP : NUDGE_STEP;
      const pan: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };

      if (pan[event.key]) {
        event.preventDefault();
        panSelected(...pan[event.key]);
        return;
      }

      if (event.key === "+" || event.key === "=" || event.key === "-") {
        event.preventDefault();
        setDraft((current) => {
          const base = current[selectedName] ?? framingFor(selectedName);
          const delta = event.key === "-" ? -0.05 : 0.05;
          return {
            ...current,
            [selectedName]: clampFraming({
              ...base,
              zoom: Math.min(ZOOM_RANGE.max, Math.max(ZOOM_RANGE.min, base.zoom + delta)),
            }),
          };
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [calibrationMode, panSelected, selectedName]);

  const renderProps = (member: Member): CalibrationProps => {
    if (!calibrationMode || member.usesLogo) return {};
    return {
      framingOverride: effective[member.name],
      calibration: {
        selected: selectedName === member.name,
        onSelect: () => setSelectedName(member.name),
        onPan: (x, y) => {
          if (selectedName === member.name) panSelected(x, y);
        },
      },
    };
  };

  return (
    <section className="bg-bg py-20">
      <div className="max-w-[1600px] mx-auto px-8 lg:px-16 xl:px-24 flex flex-col gap-16">
        {tiers.map((tier, index) => (
          <div key={tier.title} className="flex flex-col gap-16">
            {index > 0 && <div className="h-px w-full bg-white/6" />}
            <Tier
              title={tier.title}
              members={tier.members}
              renderProps={renderProps}
            />
          </div>
        ))}
      </div>

      {calibrationMode && selectedName && (
        <HeadshotCalibration
          names={photoMembers.map((m) => m.name)}
          selectedName={selectedName}
          framing={effective[selectedName] ?? DEFAULT_FRAMING}
          draft={effective}
          onSelectName={setSelectedName}
          onFramingChange={updateSelected}
          onReset={() => updateSelected(framingFor(selectedName))}
        />
      )}
    </section>
  );
}
