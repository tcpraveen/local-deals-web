'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { divIcon } from 'leaflet';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import DealTimer from '@/app/DealTimer';
import { Deal, slugifyStoreName } from '@/lib/deals';
import { calculateDistance } from '@/lib/geo';

interface DealMapProps {
  deals: Deal[];
  userCoordinates: { lat: number; lng: number } | null;
}

const FALLBACK_CENTER = { lat: 8.7642, lng: 78.1348 };

function MapCenter({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  return null;
}

function markerIcon(deal: Deal) {
  const discount = deal.discountBadge || deal.discount || 'Offer';
  const safeDiscount = discount
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  return divIcon({
    className: 'deal-map-marker-shell',
    html: `<span class="deal-map-marker">${safeDiscount}</span>`,
    iconSize: [92, 34],
    iconAnchor: [46, 34],
  });
}

export default function DealMap({ deals, userCoordinates }: DealMapProps) {
  const center = useMemo<[number, number]>(
    () => userCoordinates
      ? [userCoordinates.lat, userCoordinates.lng]
      : [FALLBACK_CENTER.lat, FALLBACK_CENTER.lng],
    [userCoordinates]
  );
  const mappableDeals = deals.filter(
    (deal) => typeof deal.lat === 'number' && typeof deal.lng === 'number'
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        className="h-[460px] w-full sm:h-[560px]"
      >
        <MapCenter center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {userCoordinates && (
          <CircleMarker
            center={center}
            radius={8}
            pathOptions={{ color: '#bfdbfe', fillColor: '#2563eb', fillOpacity: 1, weight: 3 }}
          >
            <Popup>You are here</Popup>
          </CircleMarker>
        )}
        {mappableDeals.map((deal) => {
          const distance = userCoordinates
            ? calculateDistance(userCoordinates.lat, userCoordinates.lng, deal.lat!, deal.lng!)
            : null;

          return (
            <Marker
              key={deal.id}
              position={[deal.lat!, deal.lng!]}
              icon={markerIcon(deal)}
            >
              <Popup>
                <article className="w-56 space-y-2 text-slate-900">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    {deal.category || 'Local deal'}
                  </p>
                  <h3 className="text-sm font-extrabold">{deal.business}</h3>
                  <p className="text-xs font-semibold text-slate-700">{deal.title}</p>
                  <p className="text-xs font-bold text-emerald-700">{deal.discount}</p>
                  <p className="text-xs text-slate-600">
                    {distance === null ? deal.location || 'Local offer' : `${distance.toFixed(2)} km away`}
                  </p>
                  <DealTimer expiresAt={deal.expires_at} />
                  <Link
                    href={`/store/${slugifyStoreName(deal.business)}`}
                    className="block rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-bold text-white"
                  >
                    View Details
                  </Link>
                </article>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      {!mappableDeals.length && (
        <p className="absolute left-3 right-3 top-3 z-[1000] rounded-xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-center text-xs text-slate-200">
          No active deals with map coordinates are available in the current results.
        </p>
      )}
      {!userCoordinates && (
        <p className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-slate-950/90 px-2.5 py-1.5 text-[11px] text-slate-300">
          Showing Thoothukudi area · enable GPS for distances
        </p>
      )}
    </div>
  );
}
