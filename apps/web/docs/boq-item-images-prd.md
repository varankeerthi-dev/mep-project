# PRD: Item Images for BOQ & Quotation

## Problem

BOQ items have no visual reference. Users (site engineers, procurement) need to see item catalog photos, installation references, or site photos directly inside BOQ and quotation documents.

---

## 1. Data Model

### 1.1 DB Migration

```sql
-- est_boq_items
ALTER TABLE est_boq_items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- quotation_items
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS image_url TEXT;
```

### 1.2 Schema Update (Zod)

Add to `boqItemSchema` in `src/features/estimation/model/schemas/index.ts`:
```ts
image_url: z.string().optional().nullable()
```

Add to `quotation_items` schema (wherever defined).

### 1.3 Supabase Storage Bucket

| Property | Value |
|----------|-------|
| Bucket name | `boq-item-images` |
| Path pattern | `{organisation_id}/{item_id}_{timestamp}.webp` |
| Compression | Client-side WebP via `src/lib/imageCompression.ts` (max 1600px, 80% quality) |

### 1.4 Storage RLS Policy

```sql
CREATE POLICY "boq_item_images_org_access" ON storage.objects
  FOR ALL USING (
    bucket_id = 'boq-item-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'org_id')
  );
```

---

## 2. BOQ Form Page (`BOQFormPage.tsx`)

### 2.1 New Column

Add to `DEFAULT_COLUMNS`:
```ts
{ key: 'image', label: 'Image', width: 80, visible: false }
```

### 2.2 Cell Rendering

- If `image_url` exists: render 40x40px thumbnail with hover-to-enlarge tooltip
- If no image: show "+" upload button
- Hover overlay "X" to remove image

### 2.3 Upload Flow

1. File picker (accept="image/*")
2. Compress via `compressImage()` → WebP
3. Upload: `supabase.storage.from('boq-item-images').upload(path, blob)`
4. Get URL: `supabase.storage.from('boq-item-images').getPublicUrl(path)`
5. Store in local state: `updateItem(index, 'image_url', publicUrl)`

### 2.4 Remove Flow

1. Delete from storage (best-effort)
2. Clear local state

### 2.5 Save

`image_url` is upserted alongside all other item fields via `replaceSectionItems`.

---

## 3. BOQ Detail Page (`BOQDetailPage.tsx`)

- Image upload/change/remove controls in the item edit form
- Current thumbnail displayed when editing

---

## 4. Quotation

### 4.1 Quotation Item Grid

- Optional "Image" column (same pattern as BOQ)
- Thumbnail, upload, remove controls
- Column visibility toggle

### 4.2 BOQ → Quotation Conversion

Map `image_url` from `est_boq_items` → `quotation_items` in `CreateQuotation/index.tsx`.

---

## 5. PDF Export Optimization

### 5.1 Challenge

jsPDF + jspdf-autotable does **not** natively support images inside table cells.

### 5.2 Approach (Recommended)

Use `didDrawCell` hook to overlay images:

```ts
autoTable(doc, {
  columns: [...tableColumns, { title: '', dataKey: '_image' }],
  body: items.map(item => ({
    ...rowData,
    _image: item.image_url || ''
  })),
  didDrawCell(data) {
    if (data.column.dataKey === '_image' && data.cell.raw) {
      try {
        doc.addImage(data.cell.raw, 'WEBP',
          data.cell.x + 2, data.cell.y + 2, 20, 20);
      } catch { /* skip broken images */ }
    }
  }
});
```

### 5.3 Thumbnail Pipeline for PDF

1. Before PDF generation, resize all images to 200px max dimension at 60% quality
2. Convert to base64 data URLs
3. Embed in PDF using `doc.addImage()`
4. Cost per image: ~5-15KB per 200px WebP thumbnail

### 5.4 UI

Show "Preparing PDF..." loading state during async image processing.

### 5.5 Quotation PDF

- `proGridQuotationPdf.ts` and `enterpriseQuotationPdf.ts` need the same `didDrawCell` image overlay treatment
- Images are optional — if none present, no behavioral change

---

## 6. Implementation Order

| # | Task | Files | Est. Time |
|---|------|-------|-----------|
| 1 | Run DB migration | SQL script | 15min |
| 2 | Add `image_url` to Zod schemas | `model/schemas/index.ts`, quotation schema | 15min |
| 3 | Add upload/download API helpers | `src/features/estimation/api/images.ts` | 1h |
| 4 | Add Image column to BOQ grid | `BOQFormPage.tsx` | 3h |
| 5 | Add image upload to BOQ detail | `BOQDetailPage.tsx` | 1.5h |
| 6 | Storage bucket setup + RLS | SQL + Supabase | 30min |
| 7 | Add Image column to Quotation | `CreateQuotation/index.tsx` | 2h |
| 8 | BOQ → Quotation image carry-over | Conversion logic | 30min |
| 9 | PDF optimization — BOQ | `BOQFormPage.tsx` (exportToPDF) | 3h |
| 10 | PDF optimization — Quotation | `proGridQuotationPdf.ts`, `enterpriseQuotationPdf.ts` | 2h |

**Total: ~14h**

---

## 7. Open Questions

1. **Upload limit?** — 5MB raw, auto-compressed to WebP (≤1600px). Stored ~100-400KB.
2. **Legacy `boq_items` table?** — No, skip unless migration needed.
3. **Bulk upload?** — Nice-to-have, not MVP.
4. **How does the image column appear in exported Excel?** — Image URLs as text, or skip the column.
