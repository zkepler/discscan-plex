import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import BarcodeScanner from '@/components/scan/BarcodeScanner';
import BulkScanner from '@/components/scan/BulkScanner';
import ScanResultForm from '@/components/scan/ScanResultForm';
import TitleSearch from '@/components/scan/TitleSearch';
import { Layers, Loader2, ScanLine, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTabReselect } from '@/lib/tabReset';
import { useTabActive } from '@/lib/tabActive';
import { playScanChime } from '@/lib/chime';

const MODES = [
  { id: 'scan', label: 'Scan', icon: ScanLine },
  { id: 'bulk', label: 'Pile mode', icon: Layers },
  { id: 'title', label: 'By title', icon: Search },
];

export default function Scan() {
  const { toast } = useToast();
  const [capture, setCapture] = useState(null);
  const [looking, setLooking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [manual, setManual] = useState('');
  const [mode, setMode] = useState('scan');
  const busyRef = useRef(false);

  const identify = useCallback(
    async (raw) => {
      const code = String(raw || '').replace(/\D/g, '');
      if (code.length < 8) {
        toast({ variant: 'destructive', title: 'Unread barcode', description: 'Try again, or type the number below.' });
        return;
      }
      if (busyRef.current) return;
      busyRef.current = true;
      playScanChime();
      setPaused(true);
      setLooking(true);

      try {
        const existing = await base44.entities.Disc.filter({ upc: code }, { limit: 1 });
        const already = existing.items?.[0];
        if (already) {
          toast({ title: 'Already on your shelf', description: already.title });
          setTimeout(() => {
            busyRef.current = false;
            setPaused(false);
          }, 1600);
          return;
        }

        const response = await base44.functions.invoke('lookupBarcode', { upc: code });
        const data = response.data || {};
        setCapture({
          upc: code,
          title: data.title || '',
          year: data.year || '',
          format: data.format || '',
          image: data.image || '',
          details: data.details || null,
          found: !!data.found,
        });
      } catch (error) {
        setCapture({ upc: code, title: '', image: '', found: false });
      } finally {
        busyRef.current = false;
        setLooking(false);
      }
    },
    [toast]
  );

  const pickTitle = async (result) => {
    setPaused(true);
    const picked = {
      upc: result.upc || '',
      title: result.title || '',
      image: result.image || '',
      year: result.year || '',
      format: result.format || '',
      details: null,
      detailsPending: true,
      found: true,
    };
    setCapture(picked);

    try {
      const response = await base44.functions.invoke('lookupBarcode', {
        title: picked.title,
        year: picked.year || undefined,
      });
      const details = response.data?.details || null;
      setCapture((prev) =>
        !prev || prev.title !== picked.title
          ? prev
          : {
              ...prev,
              details,
              detailsPending: false,
              year: prev.year || details?.year || '',
              image: prev.image || details?.poster || '',
            }
      );
    } catch {
      setCapture((prev) => (!prev || prev.title !== picked.title ? prev : { ...prev, detailsPending: false }));
    }
  };

  const reset = () => {
    setCapture(null);
    setPaused(false);
    setManual('');
  };

  const submitManual = () => {
    identify(manual);
  };

  useTabReselect('/scan', reset);

  const tabActive = useTabActive();

  // Leaving the scanner returns it to its default settings.
  useEffect(() => {
    if (tabActive) return;
    reset();
    setMode('scan');
  }, [tabActive]);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Add to the archive</p>
      <h1 className="mt-2 font-display text-4xl leading-none text-foreground sm:text-5xl">Scan a disc</h1>
      <p className="mt-3 max-w-lg text-sm text-muted-foreground">
        Point the camera at the barcode on the case or tape sleeve. We look up the title, then check whether it is
        already in your Plex library.
      </p>

      {!capture ? (
        <div className="mt-6 grid grid-cols-3 gap-1 rounded-full border border-border p-1">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                'flex select-none items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs transition-colors',
                mode === id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        {capture ? (
          <ScanResultForm capture={capture} onDone={reset} onCancel={reset} />
        ) : mode === 'title' ? (
          <TitleSearch onPick={pickTitle} />
        ) : mode === 'bulk' ? (
          <BulkScanner />
        ) : (
          <>
            <BarcodeScanner onDetected={identify} paused={paused} />

            {looking ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Looking that barcode up…
              </div>
            ) : null}
          </>
        )}
      </div>

      {!capture && mode === 'scan' ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <Label htmlFor="manual-upc" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Or enter the barcode
          </Label>
          <div className="mt-2 flex gap-2">
            <Input
              id="manual-upc"
              value={manual}
              inputMode="numeric"
              placeholder="0 24543 12345 6"
              onChange={(event) => setManual(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitManual();
              }}
            />
            <Button variant="secondary" onClick={submitManual} disabled={looking}>
              Look up
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}