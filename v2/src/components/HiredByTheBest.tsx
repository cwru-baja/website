type Employer = {
  name: string;
  file: string;
  png?: boolean;
};

const employers: Employer[] = [
  { name: "SpaceX",           file: "space-x" },
  { name: "Relativity Space", file: "relativity-space" },
  { name: "Anduril",          file: "anduril", png: true },
  { name: "Corvus Robotics",  file: "corvus-robotics" },
  { name: "Neros",            file: "neros",    png: true },
  { name: "Picogrid",         file: "picogrid", png: true },
  { name: "Apple",            file: "apple" },
  { name: "Honda",            file: "honda",    png: true },
  { name: "Neuralink",        file: "neuralink" },
];

export default function HiredByTheBest() {
  return (
    <section className="bg-bg py-24">
      <div className="max-w-[1600px] mx-auto px-8 lg:px-16 xl:px-24">

        
        <div className="leading-none mb-14 text-right">
          <div className="font-bebas text-[clamp(2rem,4.5vw,5rem)] tracking-wide text-white leading-none [paint-order:stroke_fill] [-webkit-text-stroke:0.04em_white]">
            HIRED BY
          </div>
          <div className="font-butler font-semibold text-[clamp(2rem,4.5vw,5rem)] tracking-wide text-red leading-none">
            THE BEST
          </div>
        </div>

        {/* Logo row */}
        <div className="flex flex-wrap justify-center items-center gap-x-32 gap-y-16">
          {employers.map((e) => (
            <div key={e.name} className="h-10 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/logo/employers/${e.file}${e.png ? ".png" : ".svg"}`}
                alt={e.name}
                className="h-10 w-auto"
                style={{ filter: "brightness(0) invert(1)", display: "block" }}
              />
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
