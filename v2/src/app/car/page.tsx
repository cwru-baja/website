import { preload } from "react-dom";
import Navbar from "@/components/Navbar";
import PageContainer from "@/components/PageContainer";
import PageTitle from "@/components/PageTitle";
import CarSequence from "@/components/CarSequence";
import { PORTRAIT_SET_MEDIA, frameUrl } from "@/components/carSequenceModel";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Car — CWRU Motorsports",
  description: "Learn about the CWRU Baja SAE vehicle design and engineering.",
  alternates: { canonical: "/car" },
};

export default function CarPage() {
  // The sequence can't show anything until its first frame is in, and it only
  // asks for it once hydrated. So each set's frame 0 is preloaded, gated by the
  // query that picks the set (PORTRAIT_SET_MEDIA): the browser starts on the one
  // it will use alongside the scripts, and never fetches the other. These two
  // are the only frame URLs in the page's HTML. preload() rather than a <link>
  // element: React would emit an element twice, once as a hint.
  //
  // The landscape set plays as AVIF wherever the engine isn't Apple's (see
  // FrameFormat), so that is the one preloaded; `type` has a browser without
  // AVIF skip it. Safari fetches it and then plays the WebP - one ~75 KB frame,
  // the price of not sniffing the browser on the server.
  preload(frameUrl({ set: "landscape", format: "avif" }, 0), {
    as: "image",
    type: "image/avif",
    media: `not all and ${PORTRAIT_SET_MEDIA}`,
  });
  preload(frameUrl("portrait", 0), { as: "image", media: PORTRAIT_SET_MEDIA });

  return (
    <>
      <Navbar />

      {/* Page header */}
      <section className="bg-bg pt-40 pb-16">
        <PageContainer>
          <PageTitle lead="THE" accent="CAR." />
          <div className="mt-8 h-px w-full bg-white/8" />

          {/* No stats row here, so the blurb takes the right edge on its own. */}
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/60 lg:ml-auto lg:text-right lg:text-lg">
            Every part of this single-seat off-road vehicle is designed, built, and tested
            by our own students.
          </p>
        </PageContainer>
      </section>

      {/* Scroll-driven 360° sequence */}
      <CarSequence />

      <Footer />
    </>
  );
}
