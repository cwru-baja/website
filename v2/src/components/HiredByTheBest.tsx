// Employer logos go in /public/logo/employers/
// Swap the `placeholder: true` entries for `file: "filename"` (SVG) or `file: "filename", png: true`
// once you've added the images.

type Employer = {
  name: string;
  file?: string;
  png?: boolean;
  placeholder?: true;
};

const employers: Employer[] = [
  { name: "SpaceX",            placeholder: true },
  { name: "Boeing",            placeholder: true },
  { name: "NASA",              placeholder: true },
  { name: "Tesla",             placeholder: true },
  { name: "Lockheed Martin",   placeholder: true },
  { name: "Rivian",            placeholder: true },
  { name: "Apple",             placeholder: true },
  { name: "Google",            placeholder: true },
];

export default function HiredByTheBest() {
  return (
    <section className="bg-bg py-24">
      <div className="max-w-[1600px] mx-auto px-8 lg:px-16 xl:px-24">

        {/* Heading */}
        <p className="text-[0.65rem] font-medium tracking-[0.22em] uppercase text-white/30 mb-4">
          Our alumni go on to
        </p>
        <h2
          className="font-bebas leading-[0.88] tracking-tight text-white mb-14"
          style={{ fontSize: "clamp(3rem, 5vw, 5.5rem)" }}
        >
          Hired by the{" "}
          <span className="text-red">Best.</span>
        </h2>

        {/* Logo grid */}
        <div className="grid grid-cols-2 gap-px sm:grid-cols-4 lg:grid-cols-8 border border-white/6 overflow-hidden rounded-sm">
          {employers.map((e) => (
            <div
              key={e.name}
              className="flex items-center justify-center px-8 py-10 bg-surface border-white/6 opacity-50 hover:opacity-100 hover:bg-white/[0.03] transition-all duration-200"
            >
              {e.placeholder || !e.file ? (
                // Text placeholder — replace with <img> once logos are added
                <span className="text-[0.7rem] font-semibold tracking-widest uppercase text-white whitespace-nowrap">
                  {e.name}
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/logo/employers/${e.file}${e.png ? ".png" : ".svg"}`}
                  alt={e.name}
                  className="h-8 w-auto"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
