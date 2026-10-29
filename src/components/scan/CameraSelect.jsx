import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Lists every camera the browser can reach, so an iPhone used through
// Continuity Camera shows up as its own option alongside the built-in one.
export default function CameraSelect({ value, onChange, disabled }) {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const found = await navigator.mediaDevices.enumerateDevices();
      if (!active) return;
      setDevices(found.filter((device) => device.kind === 'videoinput' && device.deviceId));
    };

    // iOS hides camera labels until permission is granted, and the permission
    // prompt blurs the page — so the list is rebuilt when the app is visible again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load().catch(() => {});
    };

    load().catch(() => {});
    navigator.mediaDevices?.addEventListener('devicechange', load);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      navigator.mediaDevices?.removeEventListener('devicechange', load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (devices.length < 2) return null;

  const hasIphone = devices.some((device) => /iphone|continuity/i.test(device.label));

  return (
    <div className="mt-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Camera className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Select
          value={value || 'auto'}
          onValueChange={(next) => onChange(next === 'auto' ? '' : next)}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 border-0 bg-transparent px-1 text-sm shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Automatic (rear camera)</SelectItem>
            {devices.map((device, index) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {hasIphone ? (
        <p className="mt-1 pl-6 text-[11px] text-muted-foreground">
          iPhone camera detected — pick it above to scan with your phone.
        </p>
      ) : null}
    </div>
  );
}