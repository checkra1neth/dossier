import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface UnwatchData {
  message: string;
}

export function UnwatchReport({ data }: { data: UnwatchData }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".verdict-box", { y: 12, autoAlpha: 0, duration: 0.5, ease: "power3.out" });
    });
  }, { scope: ref });

  return (
    <div ref={ref}>
      <div className="report-top">
        <div className="report-wallet">
          <h2>Unwatch</h2>
        </div>
      </div>
      <div className="verdict-box">
        <strong>Confirmation</strong>
        {data.message}
      </div>
    </div>
  );
}
