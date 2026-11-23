"use client";

import { useEffect, useState, type Ref } from "react";

// The Case Alumni Association's Blackbaud (Raiser's Edge NXT) "Give Now" form
// for the Baja campaign, the same one on casealumni.org/campaigns/baja-team/.
// The loader drops an iframe from host.nxt.blackbaud.com into the div below
// (Blackbaud allows any site to frame it: frame-ancestors *) and grows it to
// fit through postMessage. Our CSS can't reach inside; its look is set in
// Blackbaud's form designer by CAA.
//
// Pre-fill comes from THIS page's query string, which the loader forwards on
// its own - the documented route (v2/docs/donation-form-research.md):
//   ?onetimeamt=75  selects $75 (an off-list amount collapses the amount list)
//   ?rgamt=35       fills the recurring amount once the donor picks Recurring;
//                   nothing can open the form on the Recurring tab
// So /donate needs no arguments here; any link to it can carry them.
const LOADER_SRC = "https://sky.blackbaudcdn.net/static/donor-form-loader/2/main.js";
const SVC_ID = "renxt";
const ENV_ID = "p-H1WwF-_Ixk6heeeHNxlxRg";
const FORM_ID = "72512912-b204-4807-9230-1cd006122f39";
const CONTAINER_ID = `blackbaud-donation-form_${FORM_ID}`;

export const CAMPAIGN_URL = "https://casealumni.org/campaigns/baja-team/";

type Loader = {
  newBlackbaudDonationFormZoned: (svc: string, env: string, form: string, zone: string) => void;
};

declare global {
  interface Window {
    BBDonorFormLoader?: Loader;
  }
}

let loaderPromise: Promise<Loader> | null = null;

function loadLoader(): Promise<Loader> {
  if (window.BBDonorFormLoader) return Promise.resolve(window.BBDonorFormLoader);
  loaderPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LOADER_SRC;
    script.async = true;
    script.onload = () =>
      window.BBDonorFormLoader
        ? resolve(window.BBDonorFormLoader)
        : reject(new Error("Blackbaud loader missing"));
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("Blackbaud loader failed"));
    };
    document.head.appendChild(script);
  });
  return loaderPromise;
}

/** `ref` is the container the loader puts the form's iframe in. */
export default function BlackbaudForm({ ref }: { ref?: Ref<HTMLDivElement> }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLoader()
      .then((loader) => {
        const container = document.getElementById(CONTAINER_ID);
        // StrictMode runs this twice on the same node; one iframe is enough.
        if (cancelled || !container || container.querySelector("iframe")) return;
        loader.newBlackbaudDonationFormZoned(SVC_ID, ENV_ID, FORM_ID, "usa");
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <p className="text-base leading-relaxed text-neutral-600">
        The secure form didn&rsquo;t load.{" "}
        <a
          href={CAMPAIGN_URL}
          className="text-neutral-900 underline underline-offset-4"
        >
          Give on the Case Alumni page
        </a>{" "}
        instead.
      </p>
    );
  }

  // The min height holds the space while the form loads; the iframe then
  // grows itself to fit.
  return <div ref={ref} id={CONTAINER_ID} className="bb-form" style={{ minHeight: "60rem" }} />;
}
