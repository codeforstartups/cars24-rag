import {
  ExternalLink,
  Fuel,
  Gauge,
  MapPin,
  Settings2,
  Tag,
} from "lucide-react";
import type { Car } from "../types";
import { ImageGallery } from "./ImageGallery";

interface CarCardProps {
  car: Car;
  variant?: "grid" | "slider";
}

export function CarCard({ car, variant = "grid" }: CarCardProps) {
  const images =
    car.images?.length > 0
      ? car.images
      : car.imageUrl
        ? [car.imageUrl]
        : [];

  const isSlider = variant === "slider";

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md ${
        isSlider ? "h-full" : "animate-slide-up"
      }`}
    >
      <ImageGallery images={images} title={car.title} size={isSlider ? "large" : "default"} />

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900 leading-tight">
              {car.title || `${car.make} ${car.model}`}
            </h3>
            {car.badge && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                <Tag className="h-3 w-3" />
                {car.badge}
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-brand-600">{car.price}</p>
            {car.originalPrice && (
              <p className="text-xs text-slate-400 line-through">
                {car.originalPrice}
              </p>
            )}
            {car.emi && (
              <p className="text-xs text-slate-500">EMI {car.emi}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          {car.mileage && (
            <span className="flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-slate-400" />
              {car.mileage}
            </span>
          )}
          {car.fuel && (
            <span className="flex items-center gap-1.5">
              <Fuel className="h-3.5 w-3.5 text-slate-400" />
              {car.fuel}
            </span>
          )}
          {car.transmission && (
            <span className="flex items-center gap-1.5">
              <Settings2 className="h-3.5 w-3.5 text-slate-400" />
              {car.transmission}
            </span>
          )}
          {car.location && (
            <span className="flex items-center gap-1.5 col-span-2">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              {car.location}
            </span>
          )}
        </div>

        {(car.owners || car.rto) && (
          <p className="text-xs text-slate-500">
            {[car.owners, car.rto && `RTO ${car.rto}`].filter(Boolean).join(" · ")}
          </p>
        )}

        {car.detailUrl && (
          <a
            href={car.detailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            View on Cars24
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </article>
  );
}
