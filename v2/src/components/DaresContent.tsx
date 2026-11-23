"use client";

import Link from "next/link";

import DaresBoard from "@/components/DaresBoard";
import PageContainer from "@/components/PageContainer";
import PageTitle from "@/components/PageTitle";
import RaisedMeter from "@/components/RaisedMeter";
import { DARE_MEMBERS } from "@/lib/dares";
import { useDaresLive } from "@/lib/useDaresLive";

export default function DaresContent() {
  const live = useDaresLive();

  return (
    <>
      <header className="pt-36 pb-10 sm:pt-40 sm:pb-14">
        <PageContainer>
          <PageTitle lead="DARE" accent="US." />
          <p className="mt-8 max-w-2xl text-base leading-relaxed text-white/60 lg:text-lg">
            {live ? (
              <>
                Pick from {DARE_MEMBERS.length} of our members, choose a dare, and donate. Every
                dollar funds the car, and whoever you picked has to do it.
              </>
            ) : (
              <>
                The dares are closed. Thank you to everyone who gave. You can still{" "}
                <Link href="/support" className="text-white underline underline-offset-4">
                  support the team
                </Link>
                .
              </>
            )}
          </p>
          <RaisedMeter />
        </PageContainer>
      </header>

      {live && (
        <PageContainer>
          <DaresBoard />
        </PageContainer>
      )}
    </>
  );
}
