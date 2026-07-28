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

export interface DataCache {
  manufacturers: ManufacturerOption[];
  manufacturerFiles: Record<string, ManufacturerData>;
  crossReferences: CrossRefData | null;
}

export interface FieldConfig {
  key: string;
  label: string;
  placeholder: string;
}