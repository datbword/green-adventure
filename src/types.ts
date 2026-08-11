// ── Per-Manufacturer Data Schema (from Data Engineer) ──

export interface ManufacturerOption {
  id: string;
  name: string;
}

export interface ManufacturerData {
  manufacturer: string;
  website: string;
  lastUpdated?: string;
  pdfLinks: { label: string; url: string }[];
  diagramUrls: { label: string; url: string }[];
  products: ProductSeries[];
  crossReferences: Record<string, Record<string, string>>;
  contact?: {
    customerService: { phone: string; email: string };
    techSupport: { phone: string; email: string };
    address: string;
    timezone: string;
    website: string;
  };
}

export interface ProductSeries {
  series: string;
  name: string;
  type: string;
  description: string;
  productPageUrl: string;
  partNumberPattern: string;
  pdfLinks: { label: string; url: string }[];
  diagramUrls: { label: string; url: string }[];
  options: Record<string, SeriesOption[]>;
  examples: string[];
}

export interface SeriesOption {
  code: string;
  name: string;
  description?: string;
  note?: string;
  availablePins?: number[];
  backsetType?: string;
  family?: string;
}

export interface Selection {
  manufacturerId: string | null;
  manufacturerName: string | null;
  series: ProductSeries | null;
  pins: number | null;
  options: Record<string, SeriesOption | null>;
}

export interface CrossRefProduct {
  manufacturerId: string;
  productName: string;
  series: string;
}

export interface CrossRefFamily {
  id: string;
  name: string;
  description: string;
  products: CrossRefProduct[];
}

export interface CrossRefData {
  families: CrossRefFamily[];
}

export interface UusAttributeEntry {
  product_name?: string;
  product_category?: string;
  category_source?: string;
  grade?: string;
  grade_source?: string;
  functions?: { code: string; uus_function: string }[];
  design_styles?: string[];
  design_style_names?: string[];
  sizing_power?: string[];
  finish_family?: string[];
  cylinder_types?: string[];
}
export type UusAttributesFile = Record<string, Record<string, UusAttributeEntry>>;
export interface DataCache {
  manufacturers: ManufacturerOption[];
  manufacturerFiles: Record<string, ManufacturerData>;
  crossReferences: CrossRefData | null;
  constraintTable: unknown; // ConstraintTable from src/utils/uus-constraints.ts (loaded lazily to avoid cycle)
}

export interface FieldConfig {
  key: string;
  label: string;
  placeholder: string;
}

// ── Key Blanks ──

export interface KeyBlank {
  axxessNumber: string;
  ilcoNumber: string;
  fits: string;
  category: string;
  keyway: string;
}

// ── ILCO Directory ──

export interface IlcoCrossRefValue {
  code: string | null;
  id: string | null;
}

export interface IlcoCrossRefs {
  ilcoCatalogId?: string;
  original?: IlcoCrossRefValue;
  axxess?: IlcoCrossRefValue;
  jma?: IlcoCrossRefValue;
  silca?: IlcoCrossRefValue;
  jet?: IlcoCrossRefValue;
  taylor?: IlcoCrossRefValue;
  curtis?: IlcoCrossRefValue;
  dominion?: IlcoCrossRefValue;
  esp?: IlcoCrossRefValue;
}

export interface IlcoBlank {
  ilcoNumber: string;
  family: string;
  familyName: string;
  brand: string;
  branchRole?: "master" | "standard" | "pass-through";
  masterFor?: string[];
  cutFrom?: string;
  isPassThrough?: boolean;
  pinCount?: number;
  keyway?: string;
  shoulderType?: string;
  description?: string;
  crossReferences: IlcoCrossRefs;
  tags?: string[];
  flag?: string;
}

export interface IlcoFamily {
  family: string;
  familyName: string;
  brand: string;
  description?: string;
  blanks: IlcoBlank[];
}

export interface IlcoDirectoryData {
  families: IlcoFamily[];
  meta?: {
    description?: string;
    lastUpdated?: string;
    totalFamilies?: number;
    totalBlanks?: number;
    uncertainCount?: number;
  };
}