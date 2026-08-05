import { Link } from "@tanstack/react-router";
import { Calendar, MapPin } from "lucide-react";
import { fmtDate } from "@/lib/format";

export type EventCardData = {
  id: string;
  slug: string;
  name: string;
  cover_url: string | null;
  venue: string | null;
  starts_at: string;
  min_price_cents?: number | null;
};

export function EventCard({ event }: { event: EventCardData }) {
  return (
    <Link
      to="/eventos/$slug"
      params={{ slug: event.slug }}
      className="group block overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-primary/60 hover:shadow-[0_8px_40px_-12px] hover:shadow-primary/40"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {event.cover_url ? (
          <img
            src={event.cover_url}
            alt={event.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary/30 to-accent/20 text-4xl font-display font-bold opacity-60">
            {event.name[0]}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent" />
      </div>
      <div className="space-y-3 p-5">
        <h3 className="line-clamp-2 font-display text-lg font-semibold leading-tight">{event.name}</h3>
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {fmtDate(event.starts_at)}
          </div>
          {event.venue && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{event.venue}</span>
            </div>
          )}
        </div>
        {typeof event.min_price_cents === "number" && (
          <div className="pt-1 text-sm">
            <span className="text-muted-foreground">a partir de </span>
            <span className="font-semibold text-primary">
              {(event.min_price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
