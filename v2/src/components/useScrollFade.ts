"use client";

import { useEffect, useRef } from "react";

// Scrollbars are hidden site-wide (globals.css), which leaves a sideways
// scroller with nothing to say it scrolls. This marks the ends that have more
// content past them - data-fade-start / data-fade-end - and the .scroll-fade-x
// class in globals.css fades those edges out. Nothing fades when it all fits.
export function useScrollFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const hidden = element.scrollWidth - element.clientWidth;
      element.toggleAttribute("data-fade-start", element.scrollLeft > 1);
      element.toggleAttribute("data-fade-end", element.scrollLeft < hidden - 1);
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    // The box and its content can each change width (rotation, a tab swap).
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return ref;
}
