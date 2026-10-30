import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { readMetadataFile } from '@/lib/discMetadata';
import { ImagePlus, Loader2, FileUp } from 'lucide-react';

export default function MetadataImport({ onImport, onCover }) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const coverRef = useRef(null);
  const [busy, setBusy] = useState('');

  async function handleMetadata(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy('metadata');
    try {
      const patch = await readMetadataFile(file);
      const count = Object.keys(patch).length;
      if (!count) {
        toast({
          variant: 'destructive',
          title: 'Nothing to read in that file',
          description: 'No title, cast or other details Shelfmark recognises.',
        });
        return;
      }
      onImport(patch);
      toast({
        title: 'Metadata loaded',
        description: `${count} field${count === 1 ? '' : 's'} filled from ${file.name}`,
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not read that file', description: error.message });
    } finally {
      setBusy('');
    }
  }

  async function handleCover(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy('cover');
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      onCover(file_url);
      toast({ title: 'Cover updated' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not upload that image', description: error.message });
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="rounded-lg border border-border/70 bg-secondary/30 p-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="select-none"
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
        >
          {busy === 'metadata' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="mr-2 h-4 w-4" />
          )}
          Upload metadata file
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="select-none"
          onClick={() => coverRef.current?.click()}
          disabled={!!busy}
        >
          {busy === 'cover' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="mr-2 h-4 w-4" />
          )}
          Upload cover
        </Button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Drop in a .nfo, .xml or .json file from your media software and the fields below fill in. You can edit
        anything afterwards.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".nfo,.xml,.json,application/json,text/xml"
        className="hidden"
        onChange={handleMetadata}
      />
      <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCover} />
    </div>
  );
}