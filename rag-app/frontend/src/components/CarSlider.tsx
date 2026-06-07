import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Car } from "../types";
import { CarCard } from "./CarCard";

interface CarSliderProps {
  cars: Car[];
  streaming?: boolean;
}

export function CarSlider({ cars, streaming }: CarSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const prevCount = useRef(cars.length);

  const scrollToIndex = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const clamped = Math.max(0, Math.min(index, cars.length - 1));
      track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
      setActiveIndex(clamped);
    },
    [cars.length]
  );

  useEffect(() => {
    if (cars.length > prevCount.current && streaming) {
      scrollToIndex(cars.length - 1);
    }
    prevCount.current = cars.length;
  }, [cars.length, streaming, scrollToIndex]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onScroll = () => {
      const width = track.clientWidth;
      if (!width) return;
      const index = Math.round(track.scrollLeft / width);
      setActiveIndex(Math.max(0, Math.min(index, cars.length - 1)));
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [cars.length]);

  if (cars.length === 0) return null;

  const prev = () => scrollToIndex(activeIndex - 1);
  const next = () => scrollToIndex(activeIndex + 1);

  return (
    <div className="w-full animate-slide-up">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Results
          </p>
          <p className="text-sm font-semibold text-ink-800">
            {streaming && cars.length < 6 ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                Finding cars… {cars.length} found
              </span>
            ) : (
              `${cars.length} matching car${cars.length !== 1 ? "s" : ""}`
            )}
          </p>
        </div>
        {cars.length > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={prev}
              disabled={activeIndex === 0}
              className="rounded-xl bg-white p-2 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50 disabled:opacity-30"
              aria-label="Previous car"
            >
              <ChevronLeft className="h-4 w-4 text-ink-800" />
            </button>
            <span className="min-w-[3rem] text-center text-xs font-bold text-slate-500">
              {activeIndex + 1}/{cars.length}
            </span>
            <button
              onClick={next}
              disabled={activeIndex === cars.length - 1}
              className="rounded-xl bg-white p-2 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50 disabled:opacity-30"
              aria-label="Next car"
            >
              <ChevronRight className="h-4 w-4 text-ink-800" />
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <div
          ref={trackRef}
          className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-3xl"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {cars.map((car) => (
            <div key={car.vehicleId} className="w-full shrink-0 snap-center px-0.5">
              <CarCard car={car} variant="slider" />
            </div>
          ))}
        </div>
      </div>

      {cars.length > 1 && (
        <div className="mt-5 flex justify-center gap-1.5">
          {cars.map((car, i) => (
            <button
              key={car.vehicleId}
              onClick={() => scrollToIndex(i)}
              className={`rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? "h-2 w-7 bg-gradient-to-r from-brand-500 to-brand-600"
                  : "h-2 w-2 bg-slate-300 hover:bg-slate-400"
              }`}
              aria-label={`Go to car ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
