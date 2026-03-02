import Image from "next/image";

type Member = {
  name: string;
  role: string;
  img: string;
  graduationYear: string;
  linkedin?: string;
};

const executiveBoard: Member[] = [
  { name: "Brendan Flanagan",     role: "Team Captain",                              img: "LMF04560", graduationYear: "2026", linkedin: "https://www.linkedin.com/in/brendan-flanagan-3220492a3/" },
  { name: "Ammar Ali Asghar",     role: "Technical Director",                        img: "LMF04478", graduationYear: "2026", linkedin: "https://www.linkedin.com/in/ammar-ali-asghar-8129b524b/" },
  { name: "Shelley Wei",          role: "Finance Lead",                              img: "LMF04542", graduationYear: "2027", linkedin: "https://www.linkedin.com/in/shelleyywei/" },
  { name: "Lucy Ma",              role: "Membership Lead",                           img: "LMF04627", graduationYear: "2027", linkedin: "https://www.linkedin.com/in/lucyma-/" },
  { name: "John Scherer",         role: "Logistics Lead",                            img: "A6406330",  graduationYear: "2027", linkedin: "https://www.linkedin.com/in/john-scherer-299264300/" },
];

const operationsBoard: Member[] = [
  { name: "Arnav Manu",           role: "Front Drivetrain Lead",                     img: "LMF04640", graduationYear: "2026", linkedin: "https://www.linkedin.com/in/arnav-manu-667444253/" },
  { name: "Maureen Manning",      role: "Manufacturing Lead",                        img: "A6406832",  graduationYear: "2028", linkedin: "https://www.linkedin.com/in/maureen--manning/" },
  { name: "Giovanni Ricupero",    role: "Brakes & Throttle Lead",                    img: "A6406819",  graduationYear: "2026", linkedin: "https://www.linkedin.com/in/ricupgio/" },
  { name: "Joshua Stout",         role: "Suspension Lead",                           img: "LMF04466", graduationYear: "2027", linkedin: "https://www.linkedin.com/in/joshua-martin-stout/" },
  { name: "Elad Dov Kleinerman",  role: "CNC Manufacturing Lead",                    img: "A6406861",  graduationYear: "2027", linkedin: "https://www.linkedin.com/in/elad-dov-kleinerman-mordkowitz-19b423199/" },
  { name: "Bram Loren",           role: "Panels & Composites Lead",                  img: "A6406817",  graduationYear: "2028", linkedin: "https://www.linkedin.com/in/bramloren/" },
  { name: "Auston Govender",      role: "Race Logistics Lead",                       img: "LMF04525", graduationYear: "2026", linkedin: "https://www.linkedin.com/in/auston-govender/" },
  { name: "Kenji Miyake",         role: "Frame & Radio Lead",                        img: "LMF04655", graduationYear: "2026", linkedin: "https://www.linkedin.com/in/gabrielkenjimiyake/" },
  { name: "Evan Grover",          role: "Electronics & Systems Lead",                img: "A6406798",  graduationYear: "2026", linkedin: "https://www.linkedin.com/in/ehgrover/" },
  { name: "Matthew Alcantara",    role: "Rear Drivetrain Lead",                      img: "A6406322",  graduationYear: "2027", linkedin: "https://www.linkedin.com/in/matthew-allen-alcantara/" },
  { name: "Logan Senning",        role: "Test Engineering Lead",                     img: "A6406335",  graduationYear: "2027", linkedin: "https://www.linkedin.com/in/logan-senning/" },
];

const specialtyLeads: Member[] = [
  { name: "Daniel Clare",         role: "Static Events Coordinator",                 img: "LMF04609", graduationYear: "2026", linkedin: "https://www.linkedin.com/in/daniel-clare-5b49aa227/" },
  { name: "Anthony Retelewski",   role: "Website Lead",                              img: "A6406847",  graduationYear: "2028", linkedin: "https://www.linkedin.com/in/anthony-retelewski-4340402aa/" },
  { name: "Zane Sandelin",        role: "Cost Report Coordinator",                   img: "A6406791",  graduationYear: "2028", linkedin: "https://www.linkedin.com/in/zane-sandelin-010b1b274/" },
  { name: "Suhani Dangre",        role: "Business Presentation & Social Media Lead", img: "A6406349",  graduationYear: "2028", linkedin: "https://www.linkedin.com/in/suhani-dangre/" },
  { name: "Jessica Shue",         role: "Documentation Lead",                        img: "LMF04721", graduationYear: "2027", linkedin: "https://www.linkedin.com/in/jessica-s-7b7935268/" },
];

function MemberCard({ name, role, img, graduationYear, linkedin }: Member) {
  const photo = (
    <div className="relative mx-auto h-44 w-44 overflow-hidden rounded-full ring-2 ring-white/10 transition-all duration-100 group-hover:ring-4 group-hover:ring-red">
      <Image
        src={`/images/headshots/${img}.jpg`}
        alt={name}
        fill
        className="object-cover object-top"
        sizes="176px"
      />
    </div>
  );

  return (
    <div className="group flex flex-col items-center text-center">
      {linkedin ? (
        <a href={linkedin} target="_blank" rel="noopener noreferrer" className="block">
          {photo}
        </a>
      ) : (
        photo
      )}
      <p className="mt-4 text-sm font-semibold text-white leading-snug">{name}</p>
      <p className="mt-0.5 text-[0.7rem] tracking-wide text-white/40 leading-snug">{role}</p>
      <p className="mt-1 text-[0.65rem] tracking-[0.12em] uppercase text-white/25">
        Class of {graduationYear}
      </p>
    </div>
  );
}

function Tier({ title, members }: { title: string; members: Member[] }) {
  return (
    <div>
      <h2 className="font-bebas text-2xl tracking-widest text-white/50 mb-8">
        {title}
      </h2>
      <div className="grid grid-cols-3 gap-x-8 gap-y-12 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {members.map((m) => (
          <MemberCard key={m.name} {...m} />
        ))}
      </div>
    </div>
  );
}

export default function LeadershipSection() {
  return (
    <section className="bg-bg py-20">
      <div className="max-w-[1600px] mx-auto px-8 lg:px-16 xl:px-24 flex flex-col gap-16">
        <Tier title="Executive Board" members={executiveBoard} />
        <div className="h-px w-full bg-white/6" />
        <Tier title="Operations Board" members={operationsBoard} />
        <div className="h-px w-full bg-white/6" />
        <Tier title="Specialty Leads" members={specialtyLeads} />
      </div>
    </section>
  );
}
