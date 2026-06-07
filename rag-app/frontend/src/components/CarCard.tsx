import {
  ExternalLink,
  Fuel,
  Gauge,
  MapPin,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import type { Car } from "../types";
import { displayOriginalPrice } from "../utils/format";
import { ImageGallery } from "./ImageGallery";

interface CarCardProps {
  car: Car;
  variant?: "grid" | "slider";
}

function SpecChip({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
      <Icon className="h-4 w-4 shrink-0 text-brand-500" strokeWidth={2} />
      <span className="text-xs font-semibold text-ink-800">{label}</span>
    </div>
  );
}

export function CarCard({ car, variant = "grid" }: CarCardProps) {
  const images =
    car.images?.length > 0
      ? car.images
      : car.imageUrl
        ? [car.imageUrl]
        : [];

  const isSlider = variant === "slider";
  const original = displayOriginalPrice(car.originalPrice, car.emi);

  return (
    <article
      className={`overflow-hidden bg-white transition-shadow duration-300 ${
        isSlider
          ? "rounded-3xl shadow-card hover:shadow-card-hover"
          : "animate-slide-up rounded-2xl shadow-sm"
      }`}
    >
      <ImageGallery images={images} title={car.title} size={isSlider ? "large" : "default"} />

      <div className="space-y-4 p-5">
        <div className="space-y-2">
          {car.badge && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-brand-100">
              <ShieldCheck className="h-3 w-3" />
              {car.badge}
            </span>
          )}
          <h3 className="text-base font-bold leading-snug text-ink-900 sm:text-lg">
            {car.title || `${car.make} ${car.model}`}
          </h3>
        </div>

        <div className="flex items-end justify-between gap-3 rounded-2xl bg-gradient-to-r from-brand-50/80 to-orange-50/50 px-4 py-3 ring-1 ring-brand-100/60">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600/80">
              Price
            </p>
            <p className="text-2xl font-extrabold tracking-tight text-brand-600">
              {car.price}
            </p>
          </div>
          <div className="text-right">
            {original && (
              <p className="text-xs font-medium text-slate-400 line-through">
                {original}
              </p>
            )}
            {car.emi && (
              <p className="text-xs font-semibold text-ink-700">
                EMI {car.emi}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {car.mileage && <SpecChip icon={Gauge} label={car.mileage} />}
          {car.fuel && <SpecChip icon={Fuel} label={car.fuel} />}
          {car.transmission && (
            <SpecChip icon={Settings2} label={car.transmission} />
          )}
        </div>

        {car.location && (
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span className="text-xs font-medium leading-relaxed text-slate-600">
              {car.location}
            </span>
          </div>
        )}

        {(car.owners || car.rto) && (
          <p className="text-center text-[11px] font-medium text-slate-400">
            {[car.owners, car.rto && `RTO ${car.rto}`].filter(Boolean).join("  ·  ")}
          </p>
        )}

        {car.detailUrl && (
          <a
            href={car.detailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group/btn inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink-900 px-4 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-ink-800 hover:shadow-lg active:scale-[0.98]"
          >
            View on Cars24
            <ExternalLink className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
          </a>
        )}
      </div>
    </article>
  );
}
