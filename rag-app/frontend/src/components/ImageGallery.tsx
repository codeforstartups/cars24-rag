import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";

interface ImageGalleryProps {
  images: string[];
  title: string;
  size?: "default" | "large";
}

const FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='240' viewBox='0 0 400 240'%3E%3Crect fill='%23f1f5f9' width='400' height='240'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-size='14' font-family='sans-serif'%3ENo image%3C/text%3E%3C/svg%3E";

export function ImageGallery({ images, title, size = "default" }: ImageGalleryProps) {
  const [index, setIndex] = useState(0);
  const list = images.length > 0 ? images : [];
  const heightClass = size === "large" ? "h-56 sm:h-64" : "h-44";

  if (list.length === 0) {
    return (
      <div
        className={`flex ${heightClass} flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-50 text-slate-400`}
      >
        <ImageIcon className="h-8 w-8 opacity-40" />
        <span className="text-xs font-medium">No photo</span>
      </div>
    );
  }

  const prev = () => setIndex((i) => (i === 0 ? list.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === list.length - 1 ? 0 : i + 1));

  return (
    <div className="group relative overflow-hidden bg-slate-900">
      <img
        src={list[index]}
        alt={`${title} — photo ${index + 1}`}
        className={`${heightClass} w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]`}
        onError={(e) => {
          (e.target as HTMLImageElement).src = FALLBACK;
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

      {list.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/95 p-2 shadow-lg backdrop-blur-sm transition hover:bg-white"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-4 w-4 text-ink-900" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/95 p-2 shadow-lg backdrop-blur-sm transition hover:bg-white"
            aria-label="Next photo"
          >
            <ChevronRight className="h-4 w-4 text-ink-900" />
          </button>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
            {list.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`rounded-full transition-all ${
                  i === index ? "h-1.5 w-5 bg-white" : "h-1.5 w-1.5 bg-white/50"
                }`}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
