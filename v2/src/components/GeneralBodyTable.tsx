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

type Member = {
  name: string;
  subteams: string[];
  classOf: string;
  major: string;
};

const members: Member[] = [
  { name: "Abra Giddings",            subteams: ["Systems", "Test Engineering"],       classOf: "2028", major: "Computer Engineering & Computer Science" },
  { name: "Abraham Loren",            subteams: ["CNC"],                               classOf: "2028", major: "Mechanical Engineering" },
  { name: "AJ Williams",              subteams: ["Frame", "Drivetrain"],               classOf: "2027", major: "Mechanical Engineering" },
  { name: "Ana Newton",               subteams: ["Manufacturing"],                     classOf: "2027", major: "Mechanical Engineering" },
  { name: "Arka Nath",                subteams: ["Brakes"],                            classOf: "2027", major: "Mechanical Engineering" },
  { name: "Aryeh Rothenberg",         subteams: ["Manufacturing"],                     classOf: "2027", major: "Mechanical Engineering" },
  { name: "Avaneesh Rao",             subteams: ["Brakes", "Suspension"],              classOf: "2027", major: "Mechanical Engineering" },
  { name: "Ben Roy",                  subteams: ["Test Engineering"],                  classOf: "2027", major: "Electrical Engineering" },
  { name: "Cameron Griffith",         subteams: ["Manufacturing"],                     classOf: "2027", major: "Mechanical Engineering" },
  { name: "Ciaran Nimick",            subteams: ["Test Engineering"],                  classOf: "2028", major: "Mechanical Engineering" },
  { name: "Cole Smith",               subteams: ["Systems"],                           classOf: "2026", major: "Electrical Engineering" },
  { name: "Daniel de Dios Molina",    subteams: ["Test Engineering"],                  classOf: "2028", major: "Mechanical & Aerospace Engineering" },
  { name: "David Kaplan",             subteams: ["Drivetrain"],                        classOf: "2028", major: "Mechanical Engineering" },
  { name: "Evan Zhou",                subteams: ["Manufacturing"],                     classOf: "2028", major: "Electrical Engineering" },
  { name: "Finn Barrett",             subteams: ["Manufacturing"],                     classOf: "2028", major: "Mechanical Engineering" },
  { name: "Isaac Hugenberger",        subteams: ["Design"],                            classOf: "2028", major: "Mechanical Engineering" },
  { name: "Jack Fink",                subteams: ["Manufacturing"],                     classOf: "2028", major: "Mechanical Engineering" },
  { name: "Jake Meltzer",             subteams: ["Manufacturing"],                     classOf: "2028", major: "Astronomy" },
  { name: "James Evans",              subteams: ["Manufacturing"],                     classOf: "2026", major: "Mechanical Engineering" },
  { name: "Jesse Nevling",            subteams: ["Drivetrain"],                        classOf: "2028", major: "Mechanical Engineering" },
  { name: "Jonah Keller",             subteams: ["Manufacturing"],                     classOf: "2026", major: "Mechanical Engineering" },
  { name: "Jonah Lorenzo",            subteams: ["Systems"],                           classOf: "2026", major: "Computer Science" },
  { name: "Karthik Rajasekar",        subteams: ["Manufacturing"],                     classOf: "2027", major: "Mechanical Engineering" },
  { name: "Kyle Rosenbaum",           subteams: ["Manufacturing"],                     classOf: "2026", major: "Mechanical Engineering" },
  { name: "Laith Wattar",             subteams: ["Suspension"],                        classOf: "2026", major: "Mechanical Engineering" },
  { name: "Lucas Powell",             subteams: ["Manufacturing"],                     classOf: "2026", major: "Mechanical Engineering" },
  { name: "McKenzie Roman",           subteams: ["Drivetrain"],                        classOf: "2026", major: "Mechanical Engineering" },
  { name: "Morgan Ernst",             subteams: ["Business Presentation"],             classOf: "2028", major: "Materials Science & Engineering" },
  { name: "Nathan Fenster",           subteams: ["Frame"],                             classOf: "2028", major: "Mechanical Engineering" },
  { name: "Neel Mani Sulkunte",       subteams: ["Manufacturing"],                     classOf: "2027", major: "Mechanical Engineering" },
  { name: "Nick Bulawa",              subteams: ["Manufacturing"],                     classOf: "2027", major: "Mechanical Engineering" },
  { name: "Niranjan Girish",          subteams: ["Systems"],                           classOf: "2027", major: "Computer & Electrical Engineering" },
  { name: "Sai Charmitha Yelampalli", subteams: ["Business Presentation", "Systems"],  classOf: "2027", major: "Biomedical Engineering (Pre-med)" },
  { name: "Sai Subramanian",          subteams: ["Systems"],                           classOf: "2027", major: "Electrical Engineering" },
  { name: "Steven Chen",              subteams: ["Manufacturing"],                     classOf: "2027", major: "Mechanical Engineering" },
  { name: "Thomas Murphy",            subteams: ["Manufacturing"],                     classOf: "2026", major: "Mechanical Engineering" },
  { name: "Veronica Talan",           subteams: ["Drivetrain", "Manufacturing"],       classOf: "2028", major: "Biomedical Engineering (Pre-med)" },
  { name: "Zach Wolf",                subteams: ["Manufacturing"],                     classOf: "2028", major: "Mechanical Engineering" },
  { name: "Zhansar Zhaparov",         subteams: ["Manufacturing"],                     classOf: "2028", major: "Mechanical Engineering" },
];

const subteamColors: Record<string, string> = {
  "Systems":               "bg-blue-950/60   text-blue-300   border-blue-800/40",
  "CNC":                   "bg-green-950/60  text-green-300  border-green-800/40",
  "Brakes":                "bg-red-950/60    text-red-300    border-red-800/40",
  "Manufacturing":         "bg-yellow-950/60 text-yellow-300 border-yellow-800/40",
  "Test Engineering":      "bg-orange-950/60 text-orange-300 border-orange-800/40",
  "Drivetrain":            "bg-cyan-950/60   text-cyan-300   border-cyan-800/40",
  "Frame":                 "bg-amber-950/60  text-amber-300  border-amber-800/40",
  "Suspension":            "bg-teal-950/60   text-teal-300   border-teal-800/40",
  "Design":                "bg-zinc-800/60   text-zinc-300   border-zinc-600/40",
  "Business Presentation": "bg-purple-950/60 text-purple-300 border-purple-800/40",
};

type SortField = "name" | "classOf";
type SortDir = "asc" | "desc";

export default function GeneralBodyTable() {
  const [sortField, setSortField] = useState<SortField>("classOf");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sorted = [...members].sort((a, b) => {
    const v = sortDir === "asc" ? 1 : -1;
    return a[sortField] > b[sortField] ? v : -v;
  });

  return (
    <section className="bg-bg pb-24">
      <div className="max-w-[1600px] mx-auto px-8 lg:px-16 xl:px-24">

        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="font-bebas text-2xl tracking-widest text-white/50">General Body</h2>
          <span className="text-[0.65rem] tracking-[0.12em] uppercase text-white/25">{members.length} members</span>
        </div>

        <div className="rounded-sm border border-white/6 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/6 hover:bg-transparent">
                <TableHead
                  className="text-[0.65rem] tracking-[0.18em] uppercase text-white/35 font-medium cursor-pointer select-none hover:text-white/60 transition-colors w-48"
                  onClick={() => handleSort("name")}
                >
                  Name {sortField === "name" ? (sortDir === "asc" ? <span className="ml-1 text-white/60">↑</span> : <span className="ml-1 text-white/60">↓</span>) : <span className="ml-1 text-white/20">↕</span>}
                </TableHead>
                <TableHead className="text-[0.65rem] tracking-[0.18em] uppercase text-white/35 font-medium">
                  Subteam
                </TableHead>
                <TableHead
                  className="text-[0.65rem] tracking-[0.18em] uppercase text-white/35 font-medium cursor-pointer select-none hover:text-white/60 transition-colors w-28"
                  onClick={() => handleSort("classOf")}
                >
                  Class of {sortField === "classOf" ? (sortDir === "asc" ? <span className="ml-1 text-white/60">↑</span> : <span className="ml-1 text-white/60">↓</span>) : <span className="ml-1 text-white/20">↕</span>}
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
                  className={`border-white/6 transition-colors duration-100 hover:bg-white/[0.03] ${
                    i % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"
                  }`}
                >
                  <TableCell className="text-sm font-medium text-white py-3.5">
                    {m.name}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {m.subteams.map((s) => (
                        <span
                          key={s}
                          className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide ${subteamColors[s] ?? "bg-zinc-800/60 text-zinc-300 border-zinc-600/40"}`}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </TableCell>
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
