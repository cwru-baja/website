"use client";

import { DARES_MILESTONES, useDaresRaised } from "@/lib/daresRaised";
import { formatUsd } from "@/lib/money";

const short = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k` : `$${n}`;

/**
 * How much the dares have raised, against the milestones. Its height never
 * changes, loaded or not, so nothing below it moves when the total arrives.
 */
export default function RaisedMeter() {
  const data = useDaresRaised();
  const goal = DARES_MILESTONES[DARES_MILESTONES.length - 1].amount;
  const raised = data?.raised ?? 0;
  const next = DARES_MILESTONES.find((m) => m.amount > raised);
  const fill = Math.min(raised / goal, 1);

  return (
    <div className="mt-10 max-w-3xl" aria-busy={data === null}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="flex items-baseline gap-3">
          <span className="font-clash text-4xl font-medium tracking-wide text-white sm:text-5xl">
            {data ? formatUsd(raised) : "$—"}
          </span>
          <span className="font-coolvetica text-xs tracking-[0.18em] text-white/45 uppercase">
            raised
          </span>
        </p>
        <p className="text-sm text-white/55">
          {!data
            ? " "
            : next
              ? `${formatUsd(next.amount - raised)} to the ${formatUsd(next.amount)} milestone`
              : "Goal reached. Thank you!"}
        </p>
      </div>

      <div
        role="meter"
        aria-label="Raised toward the goal"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={raised}
        aria-valuetext={`${formatUsd(raised)} of ${formatUsd(goal)}`}
        className="relative mt-5 h-2 bg-white/10"
      >
        <div
          className="absolute inset-y-0 left-0 bg-livery transition-[width] duration-700 ease-out"
          style={{ width: `${fill * 100}%` }}
        />
        {DARES_MILESTONES.slice(0, -1).map((m) => (
          <span
            key={m.amount}
            aria-hidden="true"
            className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 bg-bg"
            style={{ left: `${(m.amount / goal) * 100}%` }}
          />
        ))}
      </div>

      <div aria-hidden="true" className="relative mt-2 h-4 text-xs">
        {DARES_MILESTONES.map((m, i) => {
          const last = i === DARES_MILESTONES.length - 1;
          return (
            <span
              key={m.amount}
              className={`absolute whitespace-nowrap ${last ? "right-0" : "-translate-x-1/2"} ${
                raised >= m.amount ? "text-white" : "text-white/40"
              }`}
              style={last ? undefined : { left: `${(m.amount / goal) * 100}%` }}
            >
              {short(m.amount)}
            </span>
          );
        })}
      </div>

      {DARES_MILESTONES.some((m) => m.label) && (
        <ul className="mt-6 space-y-2 text-sm">
          {DARES_MILESTONES.filter((m) => m.label).map((m) => (
            <li key={m.amount} className={raised >= m.amount ? "text-white" : "text-white/50"}>
              <span className="mr-3 font-satoshi font-bold tabular-nums">{formatUsd(m.amount)}</span>
              {m.label}
              {raised >= m.amount && <span className="ml-2 text-livery-pop">Unlocked</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
