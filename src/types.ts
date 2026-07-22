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

export interface DataCache {
  manufacturers: ManufacturerOption[];
  manufacturerFiles: Record<string, ManufacturerData>;
}

export interface FieldConfig {
  key: string;
  label: string;
  placeholder: string;
}