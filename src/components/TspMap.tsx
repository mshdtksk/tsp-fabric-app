import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMapEvents } from 'react-leaflet';

import type { AddressItem, RoutePlanItem } from '@/services/tsp';

interface TspMapProps {
  addresses: AddressItem[];
  route: RoutePlanItem | null;
  onMapClick: (latitude: number, longitude: number) => void;
}

const DEFAULT_CENTER: [number, number] = [35.681236, 139.767125];

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export function TspMap({ addresses, route, onMapClick }: TspMapProps) {
  const center: [number, number] = addresses[0]
    ? [addresses[0].latitude, addresses[0].longitude]
    : DEFAULT_CENTER;
  const routePolyline = route
    ? route.routeCoordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number]
      )
    : [];

  return (
    <MapContainer center={center} zoom={11} scrollWheelZoom className="h-[420px] w-full rounded-xl">
      <MapClickHandler onMapClick={onMapClick} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {addresses.map((address, index) => (
        <CircleMarker
          key={address.id}
          center={[address.latitude, address.longitude]}
          radius={8}
          pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.7 }}
        >
          <Tooltip direction="top">
            {index + 1}. {address.rawAddress}
          </Tooltip>
        </CircleMarker>
      ))}
      {routePolyline.length > 1 && (
        <Polyline positions={routePolyline} pathOptions={{ color: '#dc2626', weight: 5 }} />
      )}
    </MapContainer>
  );
}
