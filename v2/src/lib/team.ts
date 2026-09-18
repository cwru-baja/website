import type { StaticImageData } from "next/image";
import type { HeadshotFraming } from "@/components/headshotFraming";
// Imported, not named by path: the import carries each file's dimensions, which
// `sizes` needs for anything that isn't square, and a content-hashed URL, so a
// replaced photo can't be served stale from Next's image cache at some widths.
import joshuaStout from "../../public/images/headshots/DSC00448.jpg";
import shelleyWei from "../../public/images/headshots/DSC00447.jpg";
import ciaranNimick from "../../public/images/headshots/DSC00467.jpg";
import zaneSandelin from "../../public/images/headshots/DSC00455.jpg";
import bramLoren from "../../public/images/headshots/DSC00525.jpg";
import maureenManning from "../../public/images/headshots/DSC00518.jpg";
import loganSenning from "../../public/images/headshots/A6406335.jpg";
import kurtRehm from "../../public/images/headshots/DSC00458.jpg";
import audreyWeaver from "../../public/images/headshots/DSC00438.jpg";
import matthewAlcantara from "../../public/images/headshots/DSC00503.jpg";
import anthonyRetelewski from "../../public/images/headshots/DSC00483.jpg";
import uddalakSarkar from "../../public/images/headshots/DSC00484.jpg";
import alissaFujishiroYeung from "../../public/images/headshots/DSC00452.jpg";
import davidKaplan from "../../public/images/headshots/DSC00464.jpg";
import charlesMadland from "../../public/images/headshots/DSC00477.jpg";
import sofiaAcevedo from "../../public/images/headshots/DSC00456.jpg";
import veronicaTalan from "../../public/images/headshots/DSC00500.jpg";
import andrewShen from "../../public/images/headshots/DSC00490.jpg";
import arkaNath from "../../public/images/headshots/DSC00505.jpg";
import benRoy from "../../public/images/headshots/DSC00523.jpg";
import zhansarZhaparov from "../../public/images/headshots/DSC00508.jpg";
import joshuaShropshire from "../../public/images/headshots/DSC00513.jpg";
import jamesMou from "../../public/images/headshots/DSC00530.jpg";
import jessicaShue from "../../public/images/headshots/DSC00495.jpg";
import laurenMetzler from "../../public/images/headshots/DSC00489.jpg";

export type Leader = {
  name: string;
  role: string;
  graduationYear?: string;
  linkedin?: string;
  /** Reframes the photo inside its circle; tune it with ?calibrateHeadshots=1. */
  framing?: Partial<HeadshotFraming>;
} & (
  | { usesLogo: true; image: string }
  | { usesLogo?: false; image: StaticImageData }
);

const executiveBoard: Leader[] = [
  { name: "Joshua Stout",       role: "Team Captain",                         image: joshuaStout, graduationYear: "2027", linkedin: "https://www.linkedin.com/in/joshua-martin-stout/", framing: { zoom: 1.34, x: 3.61, y: 14.17 } },
  { name: "Shelley Wei",        role: "Technical Director",                   image: shelleyWei, graduationYear: "2027", linkedin: "https://www.linkedin.com/in/shelleyywei/", framing: { zoom: 1.33, x: 0.04, y: -13.85 } },
  { name: "Ciaran Nimick",      role: "Finance Lead",                         image: ciaranNimick, graduationYear: "2028", framing: { zoom: 1.45, x: 4.32, y: 20.27 } },
  { name: "Zane Sandelin",      role: "Logistics Lead",                       image: zaneSandelin, graduationYear: "2028", linkedin: "https://www.linkedin.com/in/zane-sandelin-010b1b274/", framing: { zoom: 1.51, x: 1.84, y: -3.42 } },
  { name: "Veronica Talan",     role: "Frame & Membership Lead",              image: veronicaTalan, graduationYear: "2028", framing: { zoom: 1.36, x: 6.71, y: -15.35 } },
];

const operationsBoard: Leader[] = [
  { name: "Bram Loren",          role: "Front Drivetrain Lead",                image: bramLoren, graduationYear: "2028", linkedin: "https://www.linkedin.com/in/bramloren/", framing: { zoom: 1.15, x: 3, y: 7.5 } },
  { name: "Maureen Manning",     role: "Rear Drivetrain Lead",                 image: maureenManning, graduationYear: "2028", linkedin: "https://www.linkedin.com/in/maureen--manning/", framing: { zoom: 1.4, x: -2.15, y: -7.06 } },
  { name: "Andrew Shen",         role: "Test Engineering Co-Lead",             image: andrewShen, graduationYear: "2029", framing: { zoom: 1.49, x: 0.31, y: -1.17 } },
  { name: "Logan Senning",       role: "Test Engineering Co-Lead",             image: loganSenning, graduationYear: "2027", linkedin: "https://www.linkedin.com/in/logan-senning/" },
  { name: "Arka Nath",           role: "Brakes Lead",                          image: arkaNath, graduationYear: "2027", framing: { zoom: 1.15, x: -0.54, y: 6.15 } },
  { name: "Ben Roy",             role: "Systems Engineering & Radio Lead",      image: benRoy, graduationYear: "2027", framing: { zoom: 1.17, x: 0, y: 8.5 } },
  { name: "Kurt Rehm",           role: "Panels & Composites Lead",              image: kurtRehm, graduationYear: "2029", linkedin: "https://www.linkedin.com/in/kurtrehm/", framing: { zoom: 1.52, x: 1.68, y: 18 } },
  { name: "Zhansar Zhaparov",    role: "Suspension Lead",                      image: zhansarZhaparov, graduationYear: "2028", framing: { zoom: 1.26, x: -4.36, y: 9 } },
  { name: "Audrey Weaver",       role: "Manufacturing Lead",                   image: audreyWeaver, graduationYear: "2029", framing: { zoom: 1.55, x: -1.85, y: -11.32 } },
  { name: "Matthew Alcantara",   role: "Race Logistics Lead",                  image: matthewAlcantara, graduationYear: "2027", linkedin: "https://www.linkedin.com/in/matthew-allen-alcantara/", framing: { zoom: 1.36, x: 4.14, y: -11.17 } },
];

const specialtyLeads: Leader[] = [
  { name: "Anthony Retelewski",  role: "Website Lead",                         image: anthonyRetelewski, graduationYear: "2028", linkedin: "https://aretelew.com", framing: { zoom: 1.77, x: 2.51, y: 31.29 } },
  { name: "Uddalak Sarkar",      role: "PR & Media Lead",                      image: uddalakSarkar, graduationYear: "2029", linkedin: "https://www.linkedin.com/in/uddalak-sarkar-b4728a318/", framing: { zoom: 1.71, x: 5.01, y: -1.89 } },
  { name: "Alissa Fujishiro Yeung", role: "Cost Event Lead",                    image: alissaFujishiroYeung, graduationYear: "2029", framing: { zoom: 1.7, x: -1.75, y: -21.18 } },
  { name: "David Kaplan",        role: "Documentation Lead",                   image: davidKaplan, graduationYear: "2028", framing: { zoom: 1.61, x: 1.88, y: 0.36 } },
  { name: "Charles Madland",     role: "Additive Manufacturing Lead",          image: charlesMadland, graduationYear: "2029", framing: { zoom: 1.61, x: 2.45, y: 13.93 } },
  { name: "Sofia Acevedo",       role: "CNC Mini Mill Lead",                   image: sofiaAcevedo, graduationYear: "2029", framing: { zoom: 1.75, x: -0.56, y: -9.63 } },
  { name: "Joshua Shropshire",   role: "Mini Baja Lead",                       image: joshuaShropshire, graduationYear: "2029", framing: { zoom: 1.42, x: 1.5, y: -14.53 } },
  { name: "Jessica Shue",        role: "Fundraising Coordinator",              image: jessicaShue, graduationYear: "2027", framing: { zoom: 1.37, x: 1.66, y: -10.79 } },
  { name: "Lauren Metzler",      role: "Business Presentation Lead",           image: laurenMetzler, graduationYear: "2029", framing: { zoom: 1.52, x: 4.55, y: -11.76 } },
  { name: "James Mou",           role: "Engine Lead",                          image: jamesMou, graduationYear: "2029", framing: { zoom: 1.15, x: -5, y: -6.31 } },
];

export const LEADERSHIP_TIERS = [
  { title: "Executive Board", members: executiveBoard },
  { title: "Operations Board", members: operationsBoard },
  { title: "Specialty Leads", members: specialtyLeads },
];

// The team's official subteams. The page header counts this list, and every
// general-body tag must name one of them, so a new subteam starts here.
export const SUBTEAMS = [
  "Brakes",
  "Business Presentation",
  "CNC",
  "Drivetrain",
  "Frame",
  "Manufacturing",
  "Panels",
  "Suspension",
  "Systems",
  "Test Engineering",
] as const;

export type Subteam = (typeof SUBTEAMS)[number];

export type GeneralMember = {
  name: string;
  subteams: Subteam[];
  classOf: string;
  major: string;
};

export const GENERAL_BODY: GeneralMember[] = [
  { name: "Abra Giddings",            subteams: ["Systems", "Test Engineering"],       classOf: "2028", major: "Computer Engineering & Computer Science" },
  { name: "Abby Hendrix",             subteams: ["Manufacturing"],                     classOf: "2029", major: "—" },
  { name: "AJ Williams",              subteams: ["Frame", "Drivetrain"],               classOf: "2027", major: "Mechanical Engineering" },
  { name: "Ana Newton",               subteams: ["Drivetrain"],                        classOf: "2028", major: "Mechanical Engineering" },
  { name: "Aryeh Rothenberg",         subteams: ["Manufacturing"],                     classOf: "2027", major: "Mechanical Engineering" },
  { name: "Avaneesh Rao",             subteams: ["Brakes"],                            classOf: "2027", major: "Mechanical & Aerospace Engineering" },
  { name: "Cameron Griffith",         subteams: ["Manufacturing"],                     classOf: "2027", major: "Mechanical Engineering" },
  { name: "Davis Clarke",             subteams: ["Drivetrain", "Business Presentation", "Manufacturing"], classOf: "2029", major: "—" },
  { name: "Elad Dov Kleinerman Mordkowitz", subteams: ["CNC"],                        classOf: "2027", major: "—" },
  { name: "Finn Barrett",             subteams: ["Manufacturing"],                     classOf: "2028", major: "Mechanical Engineering" },
  { name: "Isaac Hugenberger",        subteams: ["Drivetrain", "Panels", "Brakes"],   classOf: "2028", major: "Mechanical Engineering" },
  { name: "Jack Fink",                subteams: ["Drivetrain"],                        classOf: "2028", major: "Mechanical Engineering" },
  { name: "Jake Meltzer",             subteams: ["Manufacturing"],                     classOf: "2028", major: "Astronomy" },
  { name: "Jason Wei",                subteams: ["Systems"],                           classOf: "2029", major: "—" },
  { name: "Jennifer Gonzalez",        subteams: ["Drivetrain"],                        classOf: "2029", major: "—" },
  { name: "Karthik Rajasekar",        subteams: ["Manufacturing"],                     classOf: "2027", major: "Mechanical Engineering" },
  { name: "Lucy Ma",                  subteams: ["Drivetrain"],                        classOf: "2027", major: "—" },
  { name: "Morgan Ernst",             subteams: ["Business Presentation"],             classOf: "2028", major: "Materials Science & Engineering" },
  { name: "Nathan Fenster",           subteams: ["Frame"],                             classOf: "2028", major: "Mechanical Engineering" },
  { name: "Neel Mani Sulkunte",       subteams: ["Manufacturing"],                     classOf: "2027", major: "Mechanical Engineering" },
  { name: "Nick Bulawa",              subteams: ["Drivetrain"],                        classOf: "2027", major: "Mechanical Engineering" },
  { name: "Nikhil Ramani",            subteams: ["Brakes", "Manufacturing"],          classOf: "2029", major: "Mechanical & Aerospace Engineering" },
  { name: "Niranjan Girish",          subteams: ["Systems"],                           classOf: "2027", major: "Computer & Electrical Engineering" },
  { name: "Sai Charmitha Yelampalli", subteams: ["Business Presentation", "Systems"],  classOf: "2027", major: "Biomedical Engineering (Pre-med)" },
  { name: "Sai Subramanian",          subteams: ["Systems"],                           classOf: "2027", major: "Electrical Engineering" },
  { name: "Syed Hayyan Ali Zaidi",    subteams: ["Suspension"],                        classOf: "2029", major: "—" },
];

// Leads and general members, each person once however many lists they're on.
export const MEMBER_COUNT = new Set([
  ...LEADERSHIP_TIERS.flatMap((tier) => tier.members.map((m) => m.name)),
  ...GENERAL_BODY.map((m) => m.name),
]).size;

// Headline stats round down to a tidy floor ("51" reads as "50+"), so they
// stay true as the roster grows or shrinks between tens.
export function roundedDown(count: number): number {
  return Math.floor(count / 10) * 10;
}
