// Tiny IndexedDB-backed offline queue for ticket validations.
// Used when the scanner can't reach the server — entries are replayed when online.

const DB = "palco-scanner";
const STORE = "pending";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export type PendingScan = {
  id?: number;
  qr_token: string;
  event_id: string;
  device_id: string;
  scanned_at: string;
};

export async function enqueueScan(scan: PendingScan) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(scan);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listPending(): Promise<PendingScan[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as PendingScan[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteScan(id: number) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function deviceId() {
  let id = localStorage.getItem("palco-device-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("palco-device-id", id);
  }
  return id;
}
