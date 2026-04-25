import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getComplaints, ComplaintRecord } from '../lib/db';
import { MapPin, AlertTriangle, ShieldCheck } from 'lucide-react';

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create custom icons based on urgency
const getIcon = (urgency: string) => {
  const color = urgency === 'Emergency' ? 'red' : urgency === 'High' ? 'orange' : urgency === 'Medium' ? 'gold' : 'blue';
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const ADDIS_ABABA_COORDS: [number, number] = [9.005401, 38.763611];

function MapBounds({ complaints }: { complaints: (ComplaintRecord & { coords: [number, number] })[] }) {
  const map = useMap();
  useEffect(() => {
    if (complaints.length > 0) {
      const bounds = L.latLngBounds(complaints.map(c => c.coords));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [complaints, map]);
  return null;
}

const NEIGHBORHOOD_COORDS: Record<string, [number, number]> = {
  'bole': [9.000, 38.780],
  'kazanchis': [9.015, 38.766],
  'megenagna': [9.020, 38.800],
  'piassa': [9.030, 38.750],
  'saris': [8.970, 38.760],
  'mexico': [9.010, 38.740],
  'merkato': [9.030, 38.730],
  'ayat': [9.035, 38.850],
  'jemo': [8.940, 38.690],
  'kera': [8.990, 38.740],
  'gerji': [8.995, 38.810],
  'cmc': [9.020, 38.830],
  'sarbet': [8.990, 38.730],
  'lebu': [8.960, 38.700]
};

function getCoordinatesForArea(areaName: string): [number, number] {
  const normalizedArea = areaName.toLowerCase();
  for (const [key, coords] of Object.entries(NEIGHBORHOOD_COORDS)) {
    if (normalizedArea.includes(key)) {
      // Add slight jitter so identical bounds don't overlap completely
      const jitterLat = (Math.random() - 0.5) * 0.005;
      const jitterLng = (Math.random() - 0.5) * 0.005;
      return [coords[0] + jitterLat, coords[1] + jitterLng];
    }
  }
  // Default fallback somewhere in Addis Ababa with more random distribution
  const randomLat = ADDIS_ABABA_COORDS[0] + (Math.random() - 0.5) * 0.08;
  const randomLng = ADDIS_ABABA_COORDS[1] + (Math.random() - 0.5) * 0.08;
  return [randomLat, randomLng];
}

export function MapDashboard({ language = 'English' }: { language?: 'English' | 'Amharic' }) {
  const [complaints, setComplaints] = useState<(ComplaintRecord & { coords: [number, number] })[]>([]);

  useEffect(() => {
    const loadData = () => {
      const activeComplaints = getComplaints()
        .filter(c => c.status !== 'Resolved')
        .map(c => ({
          ...c,
          coords: getCoordinatesForArea(c.area)
        }));
      setComplaints(activeComplaints);
    };
    
    loadData();
    window.addEventListener('complaints_updated', loadData);
    return () => window.removeEventListener('complaints_updated', loadData);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{language === 'English' ? 'Live Map Dashboard' : 'የቀጥታ ካርታ ዳሽቦርድ'}</h2>
          <p className="text-sm text-gray-500 mt-1">{language === 'English' ? 'Visualizing infrastructure hotspots across the city.' : 'በከተማዋ ያሉ ማእከላዊ የችግር ቦታዎች እይታ።'}</p>
        </div>
        <div className="flex bg-white px-4 py-2 rounded-lg border border-gray-100 shadow-sm items-center gap-2 text-sm font-medium text-gray-600">
          <MapPin className="w-4 h-4 text-blue-500" />
          <span>{complaints.length} {language === 'English' ? 'Active Issues' : 'የአየር ላይ ችግሮች'}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
        <div className="h-[600px] w-full z-0 relative">
          <MapContainer center={ADDIS_ABABA_COORDS} zoom={12} style={{ height: '100%', width: '100%', zIndex: 10 }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBounds complaints={complaints} />
            {complaints.map(complaint => (
              <Marker 
                key={complaint.id} 
                position={complaint.coords}
                icon={getIcon(complaint.urgency)}
              >
                <Popup>
                  <div className="p-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2 font-bold text-sm border-b pb-2 text-gray-900">
                      <span className={`w-2 h-2 rounded-full ${complaint.urgency === 'Emergency' ? 'bg-red-500' : complaint.urgency === 'High' ? 'bg-orange-500' : 'bg-blue-500'}`}></span>
                      {complaint.category}
                    </div>
                    <p className="text-xs text-gray-600 mb-1"><strong>{language === 'English' ? 'Location:' : 'ቦታ:'}</strong> {complaint.area}</p>
                    <p className="text-xs text-gray-600 mb-2"><strong>{language === 'English' ? 'Started:' : 'የጀመረው:'}</strong> {complaint.timeStarted}</p>
                    <div className="flex justify-between items-center text-xs mt-2 bg-gray-50 p-2 rounded">
                      <span className="font-semibold text-gray-700">{Math.max(complaint.reportCount || 1, 1)} {language === 'English' ? 'reports' : 'ሪፖርቶች'}</span>
                      {complaint.verified && (
                        <span className="flex items-center gap-1 text-green-700 font-bold">
                          <ShieldCheck className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        
        {/* Legend Overlay */}
        <div className="absolute bottom-6 right-6 bg-white p-4 rounded-xl shadow-lg border border-gray-100 z-[20]">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">{language === 'English' ? 'Urgency Legend' : 'የአደጋ ደረጃ ማብራሪያ'}</h4>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm"></div>
              <span>{language === 'English' ? 'Emergency' : 'ድንገተኛ አደጋ'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white shadow-sm"></div>
              <span>{language === 'English' ? 'High' : 'ከፍተኛ'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#ffd700] border-2 border-white shadow-sm"></div>
              <span>{language === 'English' ? 'Medium' : 'መካከለኛ'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
              <span>{language === 'English' ? 'Low / Normal' : 'ዝቅተኛ / መደበኛ'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
