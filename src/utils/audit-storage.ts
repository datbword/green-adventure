import type { AuditPhoto, AuditRecord } from "~/types/audit";

const DB_NAME = "lockbuilder-audits";
const DB_VERSION = 1;
const AUDITS = "audits";
const PHOTOS = "photos";

export function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => resolve(null);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUDITS)) db.createObjectStore(AUDITS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function saveAudit(audit: AuditRecord): Promise<boolean> {
  const db = await openDB(); if (!db) return false;
  return new Promise((resolve) => { const r = db.transaction(AUDITS, "readwrite").objectStore(AUDITS).put(audit); r.onerror = () => resolve(false); r.onsuccess = () => resolve(true); });
}
export async function getAllAudits(): Promise<AuditRecord[]> {
  const db = await openDB(); if (!db) return [];
  return new Promise((resolve) => { const r = db.transaction(AUDITS).objectStore(AUDITS).getAll(); r.onerror = () => resolve([]); r.onsuccess = () => resolve(r.result as AuditRecord[]); });
}
export async function getAudit(id: string): Promise<AuditRecord | null> {
  const db = await openDB(); if (!db) return null;
  return new Promise((resolve) => { const r = db.transaction(AUDITS).objectStore(AUDITS).get(id); r.onerror = () => resolve(null); r.onsuccess = () => resolve((r.result as AuditRecord | undefined) ?? null); });
}
export async function deleteAudit(id: string): Promise<boolean> {
  const db = await openDB(); if (!db) return false;
  return new Promise((resolve) => { const r = db.transaction(AUDITS, "readwrite").objectStore(AUDITS).delete(id); r.onerror = () => resolve(false); r.onsuccess = () => resolve(true); });
}
export async function savePhoto(photo: AuditPhoto): Promise<boolean> {
  const db = await openDB(); if (!db) return false;
  return new Promise((resolve) => { const r = db.transaction(PHOTOS, "readwrite").objectStore(PHOTOS).put(photo); r.onerror = () => resolve(false); r.onsuccess = () => resolve(true); });
}
export async function getPhotosForCheckpoint(checkpointId: string): Promise<AuditPhoto[]> {
  const db = await openDB(); if (!db) return [];
  return new Promise((resolve) => { const r = db.transaction(PHOTOS).objectStore(PHOTOS).getAll(); r.onerror = () => resolve([]); r.onsuccess = () => resolve((r.result as AuditPhoto[]).filter((p) => p.checkpointId === checkpointId)); });
}
export async function exportAuditAsJSON(id: string): Promise<string | null> { const audit = await getAudit(id); return audit ? JSON.stringify(audit, null, 2) : null; }
