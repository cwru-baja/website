"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ComponentProps } from "react";

type AfterLoadPrefetchLinkProps = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & {
  href: string;
};

/**
 * A <Link> whose route is prefetched once the current page has finished
 * loading, not the moment it scrolls into view.
 *
 * A prefetch applies the target's resource hints: /car preloads its first frame
 * (~75 KB), which on a phone downloaded alongside the home hero and held its
 * largest paint back. The route is still warm before anyone taps it, just not
 * at the expense of the page they are looking at.
 */
export default function AfterLoadPrefetchLink({ href, ...props }: AfterLoadPrefetchLinkProps) {
  const router = useRouter();

  useEffect(() => {
    let idle = 0;
    let timer = 0;
    const prefetch = () => {
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(() => router.prefetch(href), { timeout: 2000 });
      } else {
        timer = window.setTimeout(() => router.prefetch(href), 200);
      }
    };

    if (document.readyState === "complete") prefetch();
    else window.addEventListener("load", prefetch, { once: true });

    return () => {
      window.removeEventListener("load", prefetch);
      if (idle) window.cancelIdleCallback(idle);
      if (timer) window.clearTimeout(timer);
    };
  }, [href, router]);

  return <Link href={href} prefetch={false} {...props} />;
}
