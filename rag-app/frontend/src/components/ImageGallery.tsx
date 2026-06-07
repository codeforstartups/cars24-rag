import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ImageGalleryProps {
  images: string[];
  title: string;
  size?: "default" | "large";
}

export function ImageGallery({ images, title, size = "default" }: ImageGalleryProps) {
  const [index, setIndex] = useState(0);
  const list = images.length > 0 ? images : [];

  const heightClass = size === "large" ? "h-52 sm:h-56" : "h-44";

  if (list.length === 0) {
    return (
      <div className={`flex ${heightClass} items-center justify-center rounded-t-2xl bg-slate-100 text-sm text-slate-400`}>
        No photos available
      </div>
    );
  }

  const prev = () => setIndex((i) => (i === 0 ? list.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === list.length - 1 ? 0 : i + 1));

  return (
    <div className={`group relative overflow-hidden rounded-t-2xl bg-slate-100`}>
      <img
        src={list[index]}
        alt={`${title} — photo ${index + 1}`}
        className={`${heightClass} w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]`}
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200' viewBox='0 0 400 200'%3E%3Crect fill='%23e2e8f0' width='400' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-size='14'%3ENo image%3C/text%3E%3C/svg%3E";
        }}
      />

      {list.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-4 w-4 text-slate-700" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white"
            aria-label="Next photo"
          >
            <ChevronRight className="h-4 w-4 text-slate-700" />
          </button>

          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {list.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/60"
                }`}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}

      {list.length > 1 && (
        <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
          {index + 1}/{list.length}
        </span>
      )}
    </div>
  );
}
