import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/logger';

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
export type SiteReportPhoto = {
  id: string;
  organisation_id: string;
  report_id: string;
  bucket_name: string;
  file_path: string;
  file_name: string;
  caption: string | null;
  sort_order: number;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
};

export type PhotoWithUrl = SiteReportPhoto & {
  signedUrl: string | null;
  signedUrlExpiresAt: number;  // epoch ms
};

// ------------------------------------------------------------
// Query: list photos for a report
// ------------------------------------------------------------
export function useSiteReportPhotos(reportId: string | null | undefined) {
  return useQuery({
    queryKey: ['site-report-photos', reportId],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_report_photos')
        .select('*')
        .eq('report_id', reportId as string)
        .order('sort_order', { ascending: true })
        .order('uploaded_at', { ascending: true });
      if (error) throw error;
      return (data || []) as SiteReportPhoto[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ------------------------------------------------------------
// Hook: signed URLs for a list of photos (refreshed on demand)
// ------------------------------------------------------------
const SIGNED_URL_TTL_SECONDS = 3600;
const URL_REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export function usePhotoSignedUrls(photos: SiteReportPhoto[] | undefined) {
  const [urls, setUrls] = useState<Record<string, PhotoWithUrl>>({});

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (!photos || photos.length === 0) {
        setUrls({});
        return;
      }
      const now = Date.now();
      const next: Record<string, PhotoWithUrl> = { ...urls };

      for (const p of photos) {
        const existing = urls[p.id];
        if (existing && existing.signedUrl && existing.signedUrlExpiresAt - now > URL_REFRESH_BUFFER_MS) {
          next[p.id] = existing;
          continue;
        }
        try {
          const { data, error } = await supabase.storage
            .from(p.bucket_name)
            .createSignedUrl(p.file_path, SIGNED_URL_TTL_SECONDS);
          if (error) throw error;
          next[p.id] = {
            ...p,
            signedUrl: data?.signedUrl || null,
            signedUrlExpiresAt: now + SIGNED_URL_TTL_SECONDS * 1000,
          };
        } catch (e) {
          next[p.id] = { ...p, signedUrl: null, signedUrlExpiresAt: 0 };
        }
      }
      if (!cancelled) setUrls(next);
    };

    refresh();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos?.map(p => p.id).join(',')]);

  return urls;
}

// ------------------------------------------------------------
// Mutation: ensure the per-org bucket exists
// ------------------------------------------------------------
export function useEnsurePhotoBucket() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('ensure_site_report_photos_bucket');
      if (error) throw error;
      return data as string;
    },
  });
}

// ------------------------------------------------------------
// Mutation: upload a single photo for a report
// (Use after the report exists. For pending photos, see PendingPhoto.)
// ------------------------------------------------------------
export function useUploadSiteReportPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      reportId: string;
      organisationId: string;
      bucketName: string;
      file: { blob: Blob; fileName: string; width: number; height: number; sizeBytes: number };
      userId: string;
      caption?: string;
      sortOrder?: number;
    }) => {
      const { reportId, organisationId, bucketName, file, userId, caption, sortOrder } = params;
      const fileId = crypto.randomUUID();
      const filePath = `${reportId}/${fileId}.webp`;

      // 1. Upload to storage
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file.blob, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: false,
        });
      if (uploadError) throw uploadError;

      // 2. Insert row in site_report_photos
      const { data, error } = await supabase
        .from('site_report_photos')
        .insert({
          organisation_id: organisationId,
          report_id: reportId,
          bucket_name: bucketName,
          file_path: filePath,
          file_name: file.fileName,
          caption: caption || null,
          sort_order: sortOrder || 0,
          file_size_bytes: file.sizeBytes,
          width: file.width,
          height: file.height,
          uploaded_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as SiteReportPhoto;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['site-report-photos', vars.reportId] });
    },
  });
}

// ------------------------------------------------------------
// Mutation: delete a photo
// ------------------------------------------------------------
export function useDeleteSiteReportPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (photo: SiteReportPhoto) => {
      // 1. Remove from storage (best-effort)
      const { error: storageError } = await supabase.storage
        .from(photo.bucket_name)
        .remove([photo.file_path]);
      if (storageError) console.warn('Storage delete failed (continuing):', storageError);

      // 2. Remove row
      const { error } = await supabase
        .from('site_report_photos')
        .delete()
        .eq('id', photo.id);
      if (error) throw error;
      return photo;
    },
    onSuccess: (photo) => {
      queryClient.invalidateQueries({ queryKey: ['site-report-photos', photo.report_id] });
      toast.success('Photo removed');
    },
    onError: (e: any) => toast.error(`Failed to delete: ${e.message}`),
  });
}

// ------------------------------------------------------------
// Mutation: update caption
// ------------------------------------------------------------
export function useUpdatePhotoCaption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; reportId: string; caption: string }) => {
      const { data, error } = await supabase
        .from('site_report_photos')
        .update({ caption: params.caption || null })
        .eq('id', params.id)
        .select()
        .single();
      if (error) throw error;
      return data as SiteReportPhoto;
    },
    onSuccess: (photo) => {
      queryClient.invalidateQueries({ queryKey: ['site-report-photos', photo.report_id] });
    },
  });
}

// ------------------------------------------------------------
// PendingPhoto: a photo held in client state, not yet uploaded
// (Used during create-mode when the report_id doesn't exist yet.)
// ------------------------------------------------------------
export type PendingPhoto = {
  tempId: string;
  blob: Blob;
  previewUrl: string;        // local URL.createObjectURL
  fileName: string;
  width: number;
  height: number;
  sizeBytes: number;
  caption: string;
};

export function makePendingPhoto(
  blob: Blob,
  fileName: string,
  width: number,
  height: number,
  sizeBytes: number
): PendingPhoto {
  return {
    tempId: crypto.randomUUID(),
    blob,
    previewUrl: URL.createObjectURL(blob),
    fileName,
    width,
    height,
    sizeBytes,
    caption: '',
  };
}

export function revokePendingPhoto(p: PendingPhoto) {
  try { URL.revokeObjectURL(p.previewUrl); } catch {}
}
