import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';
import BarcodeScanner from '@/components/scan/BarcodeScanner';
import BulkScanLog from '@/components/scan/BulkScanLog';
import { Button } from '@/components/ui/button';
import { findPlexMatch } from '@/lib/matching';
import { emitDisc } from '@/lib/discEvents';
import { FORMATS } from '@/lib/constants';

// The camera keeps re-reading a barcode that stays in frame, so a code is only
// taken once per window while the card is still on screen.
const REPEAT_MS = 8000;
const MAX_ROWS = 40;

let rowSeq = 0;

export default function BulkScanner() {
  const [rows, setRows] = useState([]);
  const queueRef = useRef([]);
  const workingRef = useRef(false);
  const seenRef = useRef(new Map());

  const patch = (id, changes) =>
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...changes } : row)));

  const saveOne = async (code, id) => {
    const { items } = await base44.entities.Disc.filter({ upc: code }, { limit: 1 });
    const existing = items?.[0];
    if (existing) {
      patch(id, { title: existing.title, status: 'duplicate' });
      return;
    }

    const response = await base44.functions.invoke('lookupBarcode', { upc: code });
    const data = response.data || {};
    if (!data.found || !data.title) {
      patch(id, { title: data.title || '', status: 'unknown' });
      return;
    }

    const format = FORMATS.includes(data.format) ? data.format : 'DVD';
    const year = data.year ? Number(data.year) : null;
    const cover = data.image || data.details?.poster || '';
    const match = await findPlexMatch(data.title, year, format);

    const disc = await base44.entities.Disc.create({
      title: data.title,
      upc: code,
      year,
      format,
      cover_url: cover,
      plex_rating_key: match?.rating_key || null,
      plex_title: match?.title || null,
    });

    emitDisc({ type: 'create', disc });
    patch(id, { title: data.title, year, format, cover_url: cover, status: 'saved' });
    navigator.vibrate?.(45);
  };

  // Saves are handled one at a time so a quick burst of barcodes cannot collide.
  const drain = async () => {
    workingRef.current = true;
    while (queueRef.current.length) {
      const { code, id } = queueRef.current.shift();
      try {
        await saveOne(code, id);
      } catch (error) {
        patch(id, { status: 'failed', title: error.message });
      }
    }
    workingRef.current = false;
  };

  const take = (raw) => {
    const code = String(raw || '').replace(/\D/g, '');
    if (code.length < 8) return;

    const now = Date.now();
    if (now - (seenRef.current.get(code) || 0) < REPEAT_MS) return;
    seenRef.current.set(code, now);

    rowSeq += 1;
    const id = `bulk-${rowSeq}`;
    setRows((prev) => [{ id, upc: code, title: '', status: 'saving' }, ...prev].slice(0, MAX_ROWS));

    queueRef.current.push({ code, id });
    if (!workingRef.current) drain();
  };

  const saved = rows.filter((row) => row.status === 'saved').length;

  return (
    <div className="space-y-4">
      <BarcodeScanner onDetected={take} />

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Pile mode</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {saved ? `${saved} added this session` : 'Each disc is identified and shelved as you go'}
            </p>
          </div>
          {rows.length ? (
            <Button variant="ghost" size="sm" onClick={() => setRows([])}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          ) : null}
        </div>

        <div className="mt-3">
          <BulkScanLog rows={rows} />
        </div>
      </div>
    </div>
  );
}