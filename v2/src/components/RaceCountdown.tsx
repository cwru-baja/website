interface TimeLeft { days: number; hours: number; minutes: number; seconds: number; }

function calcTimeLeft(target: Date, now: number): TimeLeft {
  const diff = target.getTime() - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000)  / 60000),
    seconds: Math.floor((diff % 60000)    / 1000),
  };
}

function pad(n: number) { return String(n).padStart(2, "0"); }

export default function RaceCountdown({ target, now }: { target: Date; now: number }) {
  const t = calcTimeLeft(target, now);

  const units = [
    { value: t.days,    label: "D" },
    { value: t.hours,   label: "H" },
    { value: t.minutes, label: "M" },
    { value: t.seconds, label: "S" },
  ];

  return (
    <div
      role="timer"
      aria-label={`${t.days} days, ${t.hours} hours, ${t.minutes} minutes until the race starts`}
      className="flex flex-wrap items-baseline select-none"
    >
      {units.map(({ value, label }, i) => {
        const last = i === units.length - 1;
        return (
          <div key={label} aria-hidden className="flex items-baseline">
            <span
              className={`font-coolvetica font-bold leading-none tabular-nums ${last ? "text-livery-pop" : "text-white"}`}
              style={{ fontSize: "clamp(3rem, 8.5vw, 9.5rem)" }}
            >
              {pad(value)}
            </span>
            <span
              className={`font-coolvetica font-bold leading-none ${last ? "text-livery-pop/35" : "text-white/20"}`}
              style={{
                fontSize: "clamp(2rem, 5.2vw, 6rem)",
                marginLeft: "0.04em",
                marginRight: last ? 0 : "0.14em",
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
