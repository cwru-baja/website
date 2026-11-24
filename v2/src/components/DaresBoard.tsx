"use client";

import { useState } from "react";
import Image from "next/image";

import { framingTransform, resolveFraming } from "@/components/headshotFraming";
import { DARE_MEMBERS, DARES, type Dare, type DareMember } from "@/lib/dares";
import { formatUsd } from "@/lib/money";
import { buildDareLines, describeDares, looksLikeEmail, newDareDraft, stashDare } from "@/lib/dareLog";

const eyebrow = "font-coolvetica text-xs uppercase tracking-[0.18em] text-white/45";
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";
// Phones get a 40px avatar so two columns of names fit at 375; sm+ keeps 48.
const AVATAR = 48;

const MAX_COUNT = 10;

const STEP_WHO = "dares-who";
const STEP_DARE = "dares-dare";
const CUSTOM_TEXT = "dares-custom-text";
const STEP_FROM = "dares-from";
const STEP_EXTRA = "dares-extra";
/** Matches the relay's limit (DARE_LIMITS.message). */
const MESSAGE_MAX = 500;
const FROM_INPUT = "dares-from-name";
const EMAIL_INPUT = "dares-from-email";

// Most donors are on a phone, so the board is built for one first: two
// columns of compact name chips with a search box, dares as one-line rows,
// and a tally bar whose button walks you to whatever is still missing.
export default function DaresBoard() {
  const [picked, setPicked] = useState<string[]>([]);
  // Dare id -> how many times. Absent means not picked.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [customText, setCustomText] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [email, setEmail] = useState("");
  // The "doesn't look right" hint waits until they leave the field.
  const [emailTouched, setEmailTouched] = useState(false);

  // Any number of dares, each any number of times. Prices are per person, so
  // the total is (sum of price x count) x people. The custom dare has no price.
  const chosen = DARES.filter((d) => counts[d.id]).map((dare) => ({ dare, count: counts[dare.id] }));
  const hasCustom = chosen.some(({ dare }) => dare.price === null);
  const needsText = hasCustom && customText.trim() === "";
  const hasFrom = from.trim() !== "";
  const hasEmail = looksLikeEmail(email);
  const ready = picked.length > 0 && chosen.length > 0 && !needsText && hasFrom && hasEmail;
  const perPerson = chosen.reduce((sum, { dare, count }) => sum + (dare.price ?? 0) * count, 0);
  const total = perPerson > 0 ? perPerson * picked.length : null;
  const lines = buildDareLines(chosen, customText);
  const summary = ready ? `${describeDares(lines)} for ${picked.join(", ")}` : "";

  const q = query.trim().toLowerCase();
  const shown = q ? DARE_MEMBERS.filter((m) => m.name.toLowerCase().includes(q)) : DARE_MEMBERS;

  const setCount = (id: string, n: number) => {
    setCounts((c) => {
      const next = { ...c };
      if (n > 0) next[id] = Math.min(n, MAX_COUNT);
      else delete next[id];
      return next;
    });
  };

  const toggle = (name: string) => {
    setPicked((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));
  };

  // The dare goes to /donate through localStorage (lib/dareLog.ts), and /donate
  // records it: the form's "Other" box never reaches the team. Made fresh each
  // time Donate is opened (click, middle-click or the context menu), so one
  // visit can send several dares.
  const handOff = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const draft = newDareDraft({
      from: from.trim(),
      email: email.trim(),
      members: picked,
      dares: lines,
      total,
      message: message.trim() || null,
    });
    stashDare(draft);
    const params = new URLSearchParams();
    if (total) params.set("onetimeamt", String(total));
    params.set("dare", draft.id);
    e.currentTarget.href = `/donate?${params}`;
  };

  // A step scrolls to its top; a field is centred and focused.
  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const field = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    el.scrollIntoView({ behavior: "smooth", block: field ? "center" : "start" });
    if (field) el.focus({ preventScroll: true });
  };

  // Step 01's empty fields, in page order: the button names them all and goes to the first.
  const missingContact = [
    ...(hasFrom ? [] : [{ word: "name", field: FROM_INPUT }]),
    ...(hasEmail ? [] : [{ word: "email", field: EMAIL_INPUT }]),
  ];

  const next = !picked.length
    ? { label: "Pick who", arrow: "↑", target: STEP_WHO }
    : !chosen.length
      ? { label: "Pick a dare", arrow: "↓", target: STEP_DARE }
      : needsText
        ? { label: "Describe your dare", arrow: "↓", target: CUSTOM_TEXT }
        : {
            label: `Add your ${missingContact.map((m) => m.word).join(" and ")}`,
            arrow: "↑",
            target: missingContact[0]?.field ?? STEP_FROM,
          };

  // Replaced with the dare's own link the moment Donate is opened (handOff).
  const donateHref = total ? `/donate?onetimeamt=${total}` : "/donate";

  return (
    <div className="pb-48 sm:pb-40">
      <Step id={STEP_FROM} number="01" title="Who's it from?" hint="So they know who to thank. Only the team sees these.">
        <div className="grid gap-3 sm:max-w-3xl sm:grid-cols-2">
          <label className="block">
            <span className="sr-only">Your name</span>
            <input
              id={FROM_INPUT}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              maxLength={80}
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="block min-h-12 w-full border border-white/15 bg-transparent px-4 text-base text-white placeholder:text-white/35 focus:border-white focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="sr-only">Your email</span>
            <input
              id={EMAIL_INPUT}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              placeholder="Your email"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              enterKeyHint="done"
              aria-invalid={emailTouched && email !== "" && !hasEmail}
              aria-describedby={`${EMAIL_INPUT}-hint`}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="block min-h-12 w-full border border-white/15 bg-transparent px-4 text-base text-white placeholder:text-white/35 focus:border-white focus:outline-none aria-invalid:border-livery-pop"
            />
            <span id={`${EMAIL_INPUT}-hint`} className="mt-2 block min-h-5 text-sm text-livery-pop">
              {emailTouched && email !== "" && !hasEmail ? "That email doesn\u2019t look right." : ""}
            </span>
          </label>
        </div>
      </Step>

      <Step id={STEP_WHO} number="02" title="Pick who" hint="One or more. The price is per person.">
        <label className="mb-4 block sm:max-w-xs">
          <span className="sr-only">Find a member</span>
          {/* text-base: anything smaller makes iOS zoom the page on focus. */}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a name"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="block min-h-12 w-full border border-white/15 bg-transparent px-4 text-base text-white placeholder:text-white/35 focus:border-white focus:outline-none"
          />
        </label>

        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((m) => (
            <li key={m.name}>
              <MemberChip member={m} selected={picked.includes(m.name)} onToggle={toggle} />
            </li>
          ))}
        </ul>
        {shown.length === 0 && (
          <p className="py-6 text-sm text-white/45">No one by that name on the board.</p>
        )}
      </Step>

      <Step id={STEP_DARE} number="03" title="Pick a dare" hint="One or more, as many times as you like. Their prices add up.">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {DARES.map((d) => (
            <li key={d.id}>
              <DareCard
                dare={d}
                count={counts[d.id] ?? 0}
                onToggle={() => {
                  setCount(d.id, counts[d.id] ? 0 : 1);
                }}
                onStep={(delta) => setCount(d.id, (counts[d.id] ?? 0) + delta)}
              />
            </li>
          ))}
        </ul>

        {hasCustom && (
          <label className="mt-4 block">
            <span className={eyebrow}>Your dare</span>
            <textarea
              id={CUSTOM_TEXT}
              value={customText}
              onChange={(e) => {
                setCustomText(e.target.value);
              }}
              rows={2}
              maxLength={160}
              placeholder="What should they do?"
              className="mt-3 block w-full resize-none border border-white/15 bg-transparent p-4 text-base text-white placeholder:text-white/30 focus:border-white focus:outline-none"
            />
            <span className="mt-2 block text-sm text-white/45">
              They name the price. Give what you think it&rsquo;s worth; the form lets you
              enter any amount.
            </span>
          </label>
        )}
      </Step>

      <Step id={STEP_EXTRA} number="04" title="Anything else?" hint="Optional.">
        <label className="block sm:max-w-2xl">
          <span className="sr-only">Anything else (optional)</span>
          <textarea
            id={STEP_EXTRA + "-text"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={MESSAGE_MAX}
            placeholder="Add a note for the team"
            className="block w-full resize-none border border-white/15 bg-transparent p-4 text-base text-white placeholder:text-white/30 focus:border-white focus:outline-none"
          />
        </label>
      </Step>

      {/* The tally rides along the bottom once anything is picked, so the
          Donate button is never a scroll away from the board. Solid on phones:
          a blur over a scrolling page costs frames there. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-bg pb-[env(safe-area-inset-bottom)] transition-transform duration-300 md:bg-bg/90 md:backdrop-blur-xl ${
          picked.length || chosen.length ? "translate-y-0" : "translate-y-full"
        }`}
        aria-live="polite"
      >
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-4 lg:px-16 xl:px-24">
          <div className="flex min-w-0 items-baseline justify-between gap-3">
            {/* Who first: a long dare title truncates instead of the count. */}
            <p className="min-w-0 truncate text-sm text-white/60">
              {picked.length
                ? picked.length === 1
                  ? picked[0]
                  : `${picked.length} people`
                : "No one yet"}
              {" · "}
              {chosen.length ? (
                <span className="text-white">
                  {chosen.length > 1
                    ? `${chosen.length} dares`
                    : `${chosen[0].dare.price === null ? "Custom dare" : chosen[0].dare.title}${
                        chosen[0].count > 1 ? ` ×${chosen[0].count}` : ""
                      }`}
                </span>
              ) : (
                "no dare yet"
              )}
            </p>
            {picked.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPicked([]);
                }}
                className="-my-3 inline-flex min-h-11 shrink-0 cursor-pointer items-center px-2 text-xs text-white/45 underline underline-offset-4 hover:text-white sm:hidden"
              >
                Clear
              </button>
            )}
          </div>
          {ready && (
            <p
              className="-mt-2 hidden truncate font-satoshi text-xs text-white/40 sm:mt-1 sm:block"
              title={summary}
            >
              {summary}
            </p>
          )}

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {ready ? (
              <>
                <a
                  href={donateHref}
                  target="_blank"
                  rel="noopener"
                  onClick={handOff}
                  onAuxClick={handOff}
                  onContextMenu={handOff}
                  className={`inline-flex min-h-12 flex-1 items-center justify-center gap-3 bg-livery px-6 font-coolvetica text-sm uppercase tracking-[0.12em] text-on-livery hover:bg-livery-hover sm:flex-none ${focusRing}`}
                >
                  Donate{total ? ` ${formatUsd(total)}` : ""}
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </>
            ) : (
              <button
                type="button"
                onClick={() => goTo(next.target)}
                className={`inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 border border-white/20 px-6 font-coolvetica text-sm uppercase tracking-[0.12em] text-white hover:border-white/50 sm:flex-none ${focusRing}`}
              >
                {next.label}
                <span aria-hidden="true">{next.arrow}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({
  id,
  number,
  title,
  hint,
  children,
}: {
  id?: string;
  number: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 py-10 sm:scroll-mt-24 sm:py-14">
      <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-clash text-sm text-livery-pop">{number}</span>
        <h2 className="font-coolvetica text-2xl tracking-wide text-white uppercase sm:text-3xl">
          {title}
        </h2>
        {hint && <p className="w-full text-sm text-white/45 sm:w-auto">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * A row on phones (title left, price right) so all 16 fit in a few screens; a
 * card from sm up. The whole card toggles the dare; once picked, a stepper sets
 * how many times. The toggle is a full-card button underneath the content
 * rather than a wrapper, since the stepper's buttons can't nest inside it. The
 * stepper's slot is always reserved, so picking a dare never changes its height.
 */
function DareCard({
  dare,
  count,
  onToggle,
  onStep,
}: {
  dare: Dare;
  count: number;
  onToggle: () => void;
  onStep: (delta: number) => void;
}) {
  const selected = count > 0;
  const price = dare.price === null ? "price you name" : `${formatUsd(dare.price)} per person`;
  return (
    <div
      className={`relative flex h-full min-h-20 items-center justify-between gap-4 px-4 py-3 sm:min-h-36 sm:flex-col sm:items-stretch sm:p-5 ${
        selected ? "text-on-livery" : "text-white"
      }`}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className={`absolute inset-0 cursor-pointer border ${focusRing} ${
          selected ? "border-livery bg-livery" : "border-white/15 hover:border-white/40"
        }`}
      >
        <span className="sr-only">
          {dare.title}, {price}
        </span>
      </button>

      <span
        aria-hidden="true"
        className="pointer-events-none relative text-[0.95rem] leading-snug font-medium sm:text-base"
      >
        {dare.title}
      </span>

      {/* Phones: the column is always the stepper's width, so picking never
          rewraps the title. */}
      <div className="pointer-events-none relative flex w-[5.5rem] shrink-0 flex-col items-end gap-1.5 sm:w-auto sm:flex-row sm:items-end sm:justify-between">
        <span
          aria-hidden="true"
          className="flex items-baseline font-clash text-xl leading-none font-medium tracking-wide whitespace-nowrap sm:text-2xl"
        >
          {/* Once picked, the card shows that dare's share: price x count, per person. */}
          {dare.price === null ? "$ ?" : formatUsd(dare.price * Math.max(count, 1))}
          {/* Gives way to the stepper once picked: a 4-column card at 1024 is
              too narrow for both. */}
          {dare.price !== null && !selected && (
            <span className="ml-1 hidden text-sm text-white/45 sm:inline">
              / person
            </span>
          )}
        </span>
        <span className="flex h-8 items-center">
          {selected ? (
            <span className="pointer-events-auto flex items-center bg-on-livery/10">
              <button
                type="button"
                onClick={() => onStep(-1)}
                aria-label={`One fewer: ${dare.title}`}
                className={`grid h-8 w-8 cursor-pointer place-items-center text-lg leading-none hover:bg-on-livery/15 ${focusRing}`}
              >
                &minus;
              </button>
              <span
                aria-live="polite"
                aria-label={`${count} times`}
                className="w-6 text-center font-satoshi text-sm font-bold tabular-nums"
              >
                {count}
              </span>
              <button
                type="button"
                onClick={() => onStep(1)}
                disabled={count >= MAX_COUNT}
                aria-label={`One more: ${dare.title}`}
                className={`grid h-8 w-8 cursor-pointer place-items-center text-lg leading-none hover:bg-on-livery/15 disabled:cursor-not-allowed disabled:opacity-35 ${focusRing}`}
              >
                +
              </button>
            </span>
          ) : (
            dare.price !== null && (
              <span aria-hidden="true" className="text-xs text-white/45 sm:hidden">
                each
              </span>
            )
          )}
        </span>
      </div>
    </div>
  );
}

function MemberChip({
  member,
  selected,
  onToggle,
}: {
  member: DareMember;
  selected: boolean;
  onToggle: (name: string) => void;
}) {
  const initials = member.name
    .split(/[\s-]+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  const framing = resolveFraming(member.framing);
  const image = member.image;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(member.name)}
      className={`flex min-h-14 w-full cursor-pointer items-center gap-2.5 border p-1.5 pr-2 text-left sm:gap-3 sm:p-2 sm:pr-3 ${focusRing} ${
        selected
          ? "border-livery bg-livery/15 text-white"
          : "border-white/10 text-white/80 hover:border-white/35"
      }`}
    >
      <span className="relative shrink-0">
        <span
          className={`relative grid h-10 w-10 place-items-center overflow-hidden rounded-full font-clash text-xs text-white/70 ring-2 sm:h-12 sm:w-12 sm:text-sm ${
            selected ? "ring-livery" : "ring-white/10"
          } ${image ? "" : "bg-white/[0.06]"}`}
        >
          {image ? (
            <Image
              src={image}
              alt=""
              fill
              className="object-cover object-center"
              sizes={`${Math.ceil(AVATAR * Math.max(image.width / image.height, image.height / image.width) * framing.zoom)}px`}
              style={{ transform: framingTransform(framing) }}
            />
          ) : (
            initials
          )}
        </span>
        {/* Phones: the check rides on the avatar, leaving the width to the name. */}
        <span
          aria-hidden="true"
          className={`absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full border-2 border-bg bg-livery text-[0.6rem] text-on-livery sm:hidden ${
            selected ? "scale-100" : "scale-0"
          }`}
        >
          ✓
        </span>
      </span>
      {/* hyphens-auto: a long surname breaks at a syllable instead of
          running under its neighbour on a 375px phone. */}
      <span className="min-w-0 flex-1 text-[0.8125rem] leading-tight font-medium hyphens-auto [overflow-wrap:anywhere] sm:text-sm">
        {member.name}
      </span>
      <span
        aria-hidden="true"
        className={`hidden h-5 w-5 shrink-0 place-items-center rounded-full border text-[0.65rem] sm:grid ${
          selected ? "border-livery bg-livery text-on-livery" : "border-white/20 text-transparent"
        }`}
      >
        ✓
      </span>
    </button>
  );
}
