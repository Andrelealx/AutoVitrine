import { Link } from "react-router-dom";
import { Vehicle } from "../../lib/types";
import { formatCurrency } from "../../lib/format";

export function VehicleCard({
  vehicle,
  slug,
  primaryColor,
  secondaryColor
}: {
  vehicle: Vehicle;
  slug: string;
  primaryColor: string;
  secondaryColor: string;
}) {
  const cover = vehicle.images.find((image) => image.isCover) || vehicle.images[0];

  return (
    <Link
      to={`/loja/${slug}/veiculos/${vehicle.id}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-black/30 transition hover:-translate-y-1 hover:shadow-luxe"
      style={{ backgroundColor: secondaryColor }}
    >
      <div className="relative h-52 overflow-hidden">
        <img
          src={cover?.url || "https://placehold.co/600x380?text=Sem+foto"}
          alt={`${vehicle.brand} ${vehicle.model}`}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        {vehicle.featured ? (
          <span className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: primaryColor, color: "#101010" }}>
            Em destaque
          </span>
        ) : null}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="font-display text-2xl text-white">
          {vehicle.brand} {vehicle.model}
        </h3>
        <p className="text-sm text-zinc-300">
          {vehicle.year} • {vehicle.mileage.toLocaleString("pt-BR")} km • {vehicle.transmission}
        </p>
        <p className="text-xl font-semibold" style={{ color: primaryColor }}>
          {formatCurrency(Number(vehicle.price))}
        </p>
      </div>
    </Link>
  );
}