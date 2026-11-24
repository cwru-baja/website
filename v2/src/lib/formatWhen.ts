/** A moment as "Nov 24, 11:32 AM", in the viewer's time zone. */
export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
