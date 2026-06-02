import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Upload, Trash2, Loader2, X, ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/lib/logger';
import { compressImage, formatBytes, compressionRatio } from '@/lib/imageCompression';
import {
  useSiteReportPhotos,
  usePhotoSignedUrls,
  useEnsurePhotoBucket,
  useUploadSiteReportPhoto,
  useDeleteSiteReportPhoto,
  useUpdatePhotoCaption,
  makePendingPhoto,
  revokePendingPhoto,
  type PendingPhoto,
  type SiteReportPhoto,
} from '@/hooks/useSiteReportPhotos';

type Mode = 'create' | 'edit' | 'view';

type Props = {
  mode: Mode;
  reportId: string | null;
  organisationId: string | null;
  userId: string | null;
  pendingPhotos: PendingPhoto[];
  onPendingChange: (photos: PendingPhoto[]) => void;
};

const MAX_FILE_BYTES = 25 * 1024 * 1024;        // 25MB input
const MAX_PHOTOS = 12;

export function SiteReportPhotoUploader({
  mode,
  reportId,
  organisationId,
  userId,
  pendingPhotos,
  onPendingChange,
}: Props) {
  const isView = mode === 'view';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [compressingCount, setCompressingCount] = useState(0);
  const [expandedCaptionId, setExpandedCaptionId] = useState<string | null>(null);

  // Existing photos (only when reportId is set and not in create)
  const { data: existingPhotos, isLoading: loadingExisting } = useSiteReportPhotos(
    mode !== 'create' ? reportId : null
  );
  const signedUrlMap = usePhotoSignedUrls(mode !== 'create' ? existingPhotos : undefined);
  const ensureBucket = useEnsurePhotoBucket();
  const uploadPhoto = useUploadSiteReportPhoto();
  const deletePhoto = useDeleteSiteReportPhoto();
  const updateCaption = useUpdatePhotoCaption();

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      pendingPhotos.forEach(revokePendingPhoto);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- File handling (compression + enqueue / upload) ----------

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      if (mode === 'create' && pendingPhotos.length + list.length > MAX_PHOTOS) {
        toast.error(`Max ${MAX_PHOTOS} photos`);
        return;
      }

      const valid: File[] = [];
      for (const f of list) {
        if (!f.type.startsWith('image/')) {
          toast.error(`${f.name} is not an image`);
          continue;
        }
        if (f.size > MAX_FILE_BYTES) {
          toast.error(`${f.name} is larger than ${formatBytes(MAX_FILE_BYTES)}`);
          continue;
        }
        valid.push(f);
      }
      if (valid.length === 0) return;

      setCompressingCount(c => c + valid.length);

      // Compress in parallel
      const compressed = await Promise.allSettled(
        valid.map(f => compressImage(f, { maxSize: 1600, quality: 0.8, mimeType: 'image/webp' }))
      );
      setCompressingCount(0);

      const successResults = compressed
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof compressImage>>> => r.status === 'fulfilled')
        .map(r => r.value);
      const failures = compressed.filter(r => r.status === 'rejected').length;
      if (failures > 0) toast.error(`${failures} photo(s) could not be processed`);
      if (successResults.length === 0) return;

      // Average compression ratio for the toast
      const avg = successResults.reduce((sum, r) => sum + compressionRatio(r.originalSize, r.compressedSize), 0) / successResults.length;
      const savedPct = Math.round((1 - avg) * 100);
      if (savedPct > 0) toast.success(`Compressed to WebP — saved ${savedPct}%`);

      if (mode === 'create') {
        // Hold as pending until the report is saved
        const pending = successResults.map(r =>
          makePendingPhoto(r.blob, r.fileName, r.width, r.height, r.compressedSize)
        );
        onPendingChange([...pendingPhotos, ...pending]);
      } else {
        // Edit mode: upload immediately
        if (!reportId || !organisationId || !userId) {
          toast.error('Cannot upload: missing report context');
          return;
        }
        let bucketName: string;
        try {
          bucketName = await ensureBucket.mutateAsync();
        } catch (e: any) {
          toast.error(`Bucket setup failed: ${e.message}`);
          return;
        }
        const startOrder = (existingPhotos?.length || 0);
        for (let i = 0; i < successResults.length; i++) {
          const r = successResults[i];
          try {
            await uploadPhoto.mutateAsync({
              reportId,
              organisationId,
              bucketName,
              file: { blob: r.blob, fileName: r.fileName, width: r.width, height: r.height, sizeBytes: r.compressedSize },
              userId,
              sortOrder: startOrder + i,
            });
          } catch (e: any) {
            toast.error(`Upload failed for ${r.fileName}: ${e.message}`);
          }
        }
      }
    },
    [mode, pendingPhotos, onPendingChange, reportId, organisationId, userId, ensureBucket, uploadPhoto, existingPhotos]
  );

  // -------- Drag-and-drop ----------

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (isView) return;
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isView) return;
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  // -------- Pending photo actions (create mode) ----------

  const removePending = (tempId: string) => {
    const target = pendingPhotos.find(p => p.tempId === tempId);
    if (target) revokePendingPhoto(target);
    onPendingChange(pendingPhotos.filter(p => p.tempId !== tempId));
  };

  const movePending = (tempId: string, dir: -1 | 1) => {
    const idx = pendingPhotos.findIndex(p => p.tempId === tempId);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= pendingPhotos.length) return;
    const arr = [...pendingPhotos];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    onPendingChange(arr);
  };

  const setPendingCaption = (tempId: string, caption: string) => {
    onPendingChange(pendingPhotos.map(p => p.tempId === tempId ? { ...p, caption } : p));
  };

  // -------- Existing photo actions (edit/view mode) ----------

  const onDeleteExisting = (photo: SiteReportPhoto) => {
    if (isView) return;
    if (!confirm(`Delete ${photo.file_name}?`)) return;
    deletePhoto.mutate(photo);
  };

  const onCaptionBlur = (photo: SiteReportPhoto, caption: string) => {
    if (caption === (photo.caption || '')) return;
    updateCaption.mutate({ id: photo.id, reportId: photo.report_id, caption });
  };

  // -------- Render ----------

  const totalCount = (mode === 'create' ? pendingPhotos.length : 0) + (existingPhotos?.length || 0);
  const atLimit = totalCount >= MAX_PHOTOS;
  const isBusy = compressingCount > 0 || uploadPhoto.isPending;

  return (
    <div className="space-y-3">
      {/* Drop zone — hidden in view mode */}
      {!isView && (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={
            "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors " +
            (dragOver
              ? "border-blue-500 bg-blue-50"
              : "border-zinc-300 bg-zinc-50/50 hover:border-zinc-400 hover:bg-zinc-50")
          }
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) { handleFiles(e.target.files); e.target.value = ''; } }}
            disabled={atLimit || isBusy}
          />
          <div className="flex flex-col items-center gap-2">
            {isBusy ? (
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            ) : (
              <Camera className="w-8 h-8 text-zinc-400" />
            )}
            <div className="text-sm font-semibold text-zinc-800">
              {isBusy
                ? `Processing ${compressingCount || ''} photo${compressingCount === 1 ? '' : 's'}…`
                : atLimit
                  ? `Maximum ${MAX_PHOTOS} photos reached`
                  : 'Drop photos here, or click to upload'}
            </div>
            <div className="text-xs text-zinc-500">
              {totalCount}/{MAX_PHOTOS} photos · auto-compressed to WebP (max 1600px @ 80%)
            </div>
            {!atLimit && !isBusy && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Choose files
              </button>
            )}
          </div>
        </div>
      )}

      {/* Photo grid */}
      {totalCount === 0 ? (
        <div className="text-center text-xs text-zinc-500 py-4">
          {isView ? 'No photos on this report' : 'No photos yet'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* Pending photos (create mode) */}
          {mode === 'create' && pendingPhotos.map((p, idx) => (
            <PhotoTile
              key={p.tempId}
              imageUrl={p.previewUrl}
              fileName={p.fileName}
              sizeBytes={p.sizeBytes}
              width={p.width}
              height={p.height}
              caption={p.caption}
              onCaptionChange={(c) => setPendingCaption(p.tempId, c)}
              onDelete={() => removePending(p.tempId)}
              onMoveUp={() => movePending(p.tempId, -1)}
              onMoveDown={() => movePending(p.tempId, 1)}
              canMoveUp={idx > 0}
              canMoveDown={idx < pendingPhotos.length - 1}
              editable={!isView}
              expanded={expandedCaptionId === p.tempId}
              onToggleCaption={() => setExpandedCaptionId(expandedCaptionId === p.tempId ? null : p.tempId)}
            />
          ))}
          {/* Existing photos (edit/view) */}
          {mode !== 'create' && (existingPhotos || []).map((p, idx) => {
            const signed = signedUrlMap[p.id];
            return (
              <PhotoTile
                key={p.id}
                imageUrl={signed?.signedUrl || null}
                fileName={p.file_name}
                sizeBytes={p.file_size_bytes}
                width={p.width}
                height={p.height}
                caption={p.caption || ''}
                onCaptionChange={(c) => onCaptionBlur(p, c)}
                onDelete={() => onDeleteExisting(p)}
                onMoveUp={async () => {/* reorder via direct DB update, optional for now */}}
                onMoveDown={async () => {/* same */}}
                canMoveUp={idx > 0}
                canMoveDown={idx < (existingPhotos?.length || 0) - 1}
                editable={!isView}
                expanded={expandedCaptionId === p.id}
                onToggleCaption={() => setExpandedCaptionId(expandedCaptionId === p.id ? null : p.id)}
                loading={!signed && loadingExisting}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// PhotoTile: a single photo card
// ------------------------------------------------------------
type PhotoTileProps = {
  imageUrl: string | null;
  fileName: string;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  caption: string;
  onCaptionChange: (caption: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  editable: boolean;
  expanded: boolean;
  onToggleCaption: () => void;
  loading?: boolean;
};

function PhotoTile({
  imageUrl, fileName, sizeBytes, width, height, caption, onCaptionChange,
  onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown,
  editable, expanded, onToggleCaption, loading,
}: PhotoTileProps) {
  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white flex flex-col">
      <div className="relative aspect-square bg-zinc-100">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={caption || fileName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400">
            <ImageIcon className="w-6 h-6" />
            <span className="text-[10px] mt-1">No preview</span>
          </div>
        )}

        {editable && (
          <div className="absolute top-1 right-1 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={onDelete}
              className="w-6 h-6 rounded-md bg-white/90 hover:bg-red-50 text-zinc-600 hover:text-red-600 flex items-center justify-center shadow"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {editable && (
          <div className="absolute top-1 left-1 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="w-6 h-6 rounded-md bg-white/90 hover:bg-zinc-50 text-zinc-600 disabled:opacity-30 flex items-center justify-center shadow"
              title="Move up"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="w-6 h-6 rounded-md bg-white/90 hover:bg-zinc-50 text-zinc-600 disabled:opacity-30 flex items-center justify-center shadow"
              title="Move down"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      <div className="p-2 text-[10px] text-zinc-500 flex items-center justify-between">
        <span className="truncate flex-1" title={fileName}>{fileName}</span>
        {sizeBytes != null && <span className="ml-1 text-zinc-400">{formatBytes(sizeBytes)}</span>}
      </div>

      {editable && (
        <div className="px-2 pb-2">
          {expanded ? (
            <div className="flex items-start gap-1">
              <textarea
                value={caption}
                onChange={(e) => onCaptionChange(e.target.value)}
                onBlur={onToggleCaption}
                placeholder="Add a caption…"
                rows={2}
                className="flex-1 text-[11px] border border-zinc-200 rounded-md p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                autoFocus
              />
              <button
                type="button"
                onClick={onToggleCaption}
                className="text-zinc-400 hover:text-zinc-700 mt-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggleCaption}
              className="w-full text-left text-[11px] text-zinc-500 hover:text-zinc-800 truncate"
            >
              {caption || '+ Add caption'}
            </button>
          )}
        </div>
      )}

      {!editable && caption && (
        <div className="px-2 pb-2 text-[11px] text-zinc-600 line-clamp-2">{caption}</div>
      )}
    </div>
  );
}
