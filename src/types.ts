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
  options: SeriesOptions;
  examples: string[];
}

export interface SeriesOptions {
  function: SeriesOption[];
  finish: SeriesOption[];
  keyway: SeriesOption[];
  handing: SeriesOption[];
  backset: SeriesOption[];
  style?: SeriesOption[];
  grade?: SeriesOption[];
}

export interface SeriesOption {
  code: string;
  name: string;
  description?: string;
}

export interface Selection {
  manufacturerId: string | null;
  manufacturerName: string | null;
  series: ProductSeries | null;
  function: SeriesOption | null;
  finish: SeriesOption | null;
  keyway: SeriesOption | null;
  handing: SeriesOption | null;
  backset: SeriesOption | null;
  style: SeriesOption | null;
  grade: SeriesOption | null;
}

export interface DataCache {
  manufacturers: ManufacturerOption[];
  manufacturerFiles: Record<string, ManufacturerData>;
}

export interface FieldConfig {
  key: keyof Selection;
  label: string;
  placeholder: string;
}