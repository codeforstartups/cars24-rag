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

  const scrollToIndex = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(index, cars.length - 1));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
    setActiveIndex(clamped);
  }, [cars.length]);

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
    <div className="relative w-full">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">
          {streaming && cars.length < 6
            ? `Finding cars… ${cars.length} so far`
            : `${cars.length} car${cars.length !== 1 ? "s" : ""} found`}
        </span>
        <span className="text-xs font-medium text-slate-400">
          {activeIndex + 1} / {cars.length}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl">
        {cars.length > 1 && (
          <>
            <button
              onClick={prev}
              disabled={activeIndex === 0}
              className="absolute left-3 top-[140px] z-10 rounded-full bg-white/95 p-2.5 shadow-lg ring-1 ring-slate-200/80 transition hover:bg-white disabled:opacity-0"
              aria-label="Previous car"
            >
              <ChevronLeft className="h-5 w-5 text-slate-800" />
            </button>
            <button
              onClick={next}
              disabled={activeIndex === cars.length - 1}
              className="absolute right-3 top-[140px] z-10 rounded-full bg-white/95 p-2.5 shadow-lg ring-1 ring-slate-200/80 transition hover:bg-white disabled:opacity-0"
              aria-label="Next car"
            >
              <ChevronRight className="h-5 w-5 text-slate-800" />
            </button>
          </>
        )}

        <div
          ref={trackRef}
          className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {cars.map((car, i) => (
            <div
              key={car.vehicleId}
              className="w-full shrink-0 snap-center"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <CarCard car={car} variant="slider" />
            </div>
          ))}
        </div>
      </div>

      {cars.length > 1 && (
        <div className="mt-4 flex justify-center gap-1.5">
          {cars.map((car, i) => (
            <button
              key={car.vehicleId}
              onClick={() => scrollToIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === activeIndex
                  ? "w-6 bg-brand-500"
                  : "w-2 bg-slate-300 hover:bg-slate-400"
              }`}
              aria-label={`Go to car ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
