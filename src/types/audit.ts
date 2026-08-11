export interface AuditCheckpoint {
  id: string;
  text: string;
  category: string;
}

export interface CheckpointResult {
  checkpointId: string;
  status: "pass" | "fail" | "attention";
  note: string;
  photoIds: string[];
  links?: string[];
}

export interface AuditPhoto {
  id: string;
  checkpointId: string;
  dataUrl: string;
  annotation?: { type: string; data: any };
  timestamp: number;
}

export interface AuditRecord {
  id: string;
  clientName: string;
  address: string;
  date: string;
  purpose: string;
  auditType: "residential" | "commercial";
  results: CheckpointResult[];
  photos: AuditPhoto[];
  createdAt: number;
  updatedAt: number;
  reportGenerated: boolean;
}
