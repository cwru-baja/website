"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GENERAL_BODY as members, type Subteam } from "@/lib/team";


const subteamColors: Record<Subteam, string> = {
  "Systems":               "bg-blue-950/60   text-blue-300   border-blue-800/40",
  "CNC":                   "bg-green-950/60  text-green-300  border-green-800/40",
  "Brakes":                "bg-red-950/60    text-red-300    border-red-800/40",
  "Manufacturing":         "bg-yellow-950/60 text-yellow-300 border-yellow-800/40",
  "Test Engineering":      "bg-orange-950/60 text-orange-300 border-orange-800/40",
  "Drivetrain":            "bg-cyan-950/60   text-cyan-300   border-cyan-800/40",
  "Frame":                 "bg-amber-950/60  text-amber-300  border-amber-800/40",
  "Suspension":            "bg-teal-950/60   text-teal-300   border-teal-800/40",
  "Panels":                "bg-lime-950/60   text-lime-300   border-lime-800/40",
  "Business Presentation": "bg-purple-950/60 text-purple-300 border-purple-800/40",
  "Finance":               "bg-pink-950/60   text-pink-300   border-pink-800/40",
};

type SortField = "name" | "classOf";
type SortDir = "asc" | "desc";

export default function GeneralBodyTable() {
  const [sort, setSort] = useState<{ field: SortField; direction: SortDir }>({
    field: "classOf",
    direction: "asc",
  });
  const { field: sortField, direction: sortDir } = sort;

  function handleSort(field: SortField) {
    setSort((current) =>
      current.field === field
        ? {
            field,
            direction: current.direction === "asc" ? "desc" : "asc",
          }
        : { field, direction: "asc" },
    );
  }

  const sorted = [...members].sort((a, b) => {
    const v = sortDir === "asc" ? 1 : -1;
    return a[sortField] > b[sortField] ? v : -v;
  });

  const arrow = (field: SortField) =>
    sortField === field ? (
      <span className="ml-1 text-white/60">{sortDir === "asc" ? "↑" : "↓"}</span>
    ) : (
      <span className="ml-1 text-white/20">↕</span>
    );
  const ariaSort = (field: SortField) =>
    sortField === field ? (sortDir === "asc" ? "ascending" : "descending") : "none";
  const chips = (subteams: Subteam[]) => (
    <div className="flex flex-wrap gap-1.5">
      {subteams.map((s) => (
        <span
          key={s}
          className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide ${subteamColors[s]}`}
        >
          {s}
        </span>
      ))}
    </div>
  );

  return (
    <section className="bg-bg pb-24">
      <div className="max-w-[1600px] mx-auto px-8 lg:px-16 xl:px-24">

        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="font-coolvetica font-bold text-2xl tracking-widest text-white/50">General Body</h2>
          <span className="text-[0.65rem] tracking-[0.12em] uppercase text-white/25">{members.length} members</span>
        </div>

        {/* Phones: a card per member. Four columns don't fit, and a table
            that scrolls sideways hides three of them. */}
        <div className="sm:hidden">
          <div className="mb-2 flex items-center gap-1">
            <span className="mr-2 text-[0.65rem] tracking-[0.18em] uppercase text-white/25">Sort</span>
            {(["name", "classOf"] as const).map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => handleSort(field)}
                aria-pressed={sortField === field}
                className={`min-h-11 px-3 text-[0.65rem] tracking-[0.18em] uppercase font-medium ${
                  sortField === field ? "text-white/70" : "text-white/35"
                }`}
              >
                {field === "name" ? "Name" : "Class of"}
                {arrow(field)}
              </button>
            ))}
          </div>
          <ul className="rounded-sm border border-white/6">
            {sorted.map((m, i) => (
              <li
                key={m.name}
                className={`px-4 py-3.5 ${i === 0 ? "" : "border-t border-white/6"} ${
                  i % 2 === 0 ? "" : "bg-white/[0.015]"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-white">{m.name}</p>
                  <p className="shrink-0 text-xs text-white/40">{m.classOf}</p>
                </div>
                <p className="mt-0.5 text-xs text-white/40">{m.major}</p>
                <div className="mt-2.5">{chips(m.subteams)}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-sm border border-white/6 overflow-hidden max-sm:hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/6 hover:bg-transparent">
                <TableHead
                  className="text-[0.65rem] tracking-[0.18em] uppercase text-white/35 font-medium cursor-pointer select-none hover:text-white/60 w-48 pr-10"
                  aria-sort={ariaSort("name")}
                >
                  <button type="button" onClick={() => handleSort("name")} className="-my-[15px] cursor-pointer py-[15px] uppercase">
                    Name {arrow("name")}
                  </button>
                </TableHead>
                <TableHead className="text-[0.65rem] tracking-[0.18em] uppercase text-white/35 font-medium">
                  Subteam
                </TableHead>
                <TableHead
                  className="text-[0.65rem] tracking-[0.18em] uppercase text-white/35 font-medium cursor-pointer select-none hover:text-white/60 w-28"
                  aria-sort={ariaSort("classOf")}
                >
                  <button type="button" onClick={() => handleSort("classOf")} className="-my-[15px] cursor-pointer py-[15px] uppercase">
                    Class of {arrow("classOf")}
                  </button>
                </TableHead>
                <TableHead className="text-[0.65rem] tracking-[0.18em] uppercase text-white/35 font-medium">
                  Major
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((m, i) => (
                <TableRow
                  key={m.name}
                  className={`border-white/6 transition-none hover:bg-white/[0.03] ${
                    i % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"
                  }`}
                >
                  <TableCell className="text-sm font-medium text-white py-3.5 pr-10">
                    {m.name}
                  </TableCell>
                  <TableCell className="py-3.5">{chips(m.subteams)}</TableCell>
                  <TableCell className="text-sm text-white/40 py-3.5">
                    {m.classOf}
                  </TableCell>
                  <TableCell className="text-sm text-white/40 py-3.5">
                    {m.major}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

      </div>
    </section>
  );
}
