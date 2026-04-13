export type BoqFormData = {
  id: string | null;
  boqNo: string;
  revisionNo: number;
  date: string;
  clientId: string;
  projectId: string;
  variantId: string;
  status: string;
  termsConditions: string;
  preface: string;
};

export type ClientOption = {
  id: string;
  client_name: string;
  discount_profile_id?: string | null;
  custom_discounts?: Record<string, number | string> | null;
};

export type ProjectOption = {
  id: string;
  project_name?: string | null;
  name?: string | null;
};

export type VariantOption = {
  id: string;
  variant_name: string;
};

export type MaterialOption = {
  id: string;
  name: string;
  sale_price?: number | string | null;
  make?: string | null;
  hsn_code?: string | null;
  hsn?: string | null;
  hsn_sac?: string | null;
  unit?: string | null;
};

export type DiscountEntry = {
  discount: number;
  variantName: string;
};

export type DiscountMap = Record<string, DiscountEntry>;

export type BoqSheet = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type BoqRow = {
  id: string;
  isHeaderRow: boolean;
  headerText?: string;
  itemId?: string;
  variantId?: string;
  variantName?: string;
  make?: string;
  quantity?: string | number;
  rate?: string | number;
  discountPercent?: string | number;
  hsn_sac?: string;
  unit?: string;
  specification?: string;
  remarks?: string;
  pressure?: string;
  thickness?: string;
  schedule?: string;
  material?: string;
  description?: string;
};

export type ItemsBySheet = Record<string, BoqRow[]>;

export type ColumnSetting = {
  key: string;
  label: string;
  width: number;
  visible: boolean;
};

export type PendingDiscountChange = {
  variantId: string;
  discount: number;
  prevDiscount: number;
} | null;

export type LoadedBoqHeader = {
  id: string;
  boq_no?: string | null;
  revision_no?: number | null;
  boq_date?: string | null;
  client_id?: string | null;
  project_id?: string | null;
  variant_id?: string | null;
  status?: string | null;
  terms_conditions?: string | null;
  preface?: string | null;
  sheets?: Array<{
    id: string;
    sheet_name?: string | null;
    is_default?: boolean | null;
    sheet_order?: number | null;
    items?: Array<{
      id: string;
      is_header_row?: boolean | null;
      header_text?: string | null;
      item_id?: string | null;
      variant_id?: string | null;
      make?: string | null;
      quantity?: string | number | null;
      rate?: string | number | null;
      discount_percent?: string | number | null;
      specification?: string | null;
      remarks?: string | null;
      pressure?: string | null;
      thickness?: string | null;
      schedule?: string | null;
      material?: string | null;
      row_order?: number | null;
    }>;
  }>;
};

export type BoqInitData = {
  clients: ClientOption[];
  projects: ProjectOption[];
  variants: VariantOption[];
  materials: MaterialOption[];
  header: LoadedBoqHeader | null;
  newBoqNo: string | null;
};

export type BoqRowProps = {
  row: BoqRow;
  index: number;
  sno: number;
  visibleColumns: ColumnSetting[];
  sheetId: string;
  variants: VariantOption[];
  makes: (string | null | undefined)[];
  defaultVariantId: string;
  baseDiscount: number;
  priceMap: Map<string, number>;
  // callbacks
  onUpdate: (index: number, field: string, value: any) => void;
  onDelete: (index: number) => void;
  onInsert: (index: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  onFocus: (index: number) => void;
  onMaterialPick: (index: number, mat: MaterialOption) => void;
  materials: MaterialOption[];
  inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>;
  materialSearchActive: { sheetId: string; index: number } | null;
  setMaterialSearchActive: (v: { sheetId: string; index: number } | null) => void;
  getVariantDiscount: (variantId: string) => number;
};