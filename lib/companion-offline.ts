import type { CompanionEventCard } from "@/lib/companion-data";
import type { DoorGuest, DoorStats, ScanTicketResult } from "@/lib/host-scanning";

const DB_NAME = "venturo-companion";
const DB_VERSION = 1;

export type CachedDoor = {
  eventId: string;
  title: string;
  stats: DoorStats;
  guests: DoorGuest[];
  cachedAt: string;
};

export type QueuedScan = {
  id: string;
  eventId: string;
  code: string;
  queuedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("events")) {
        db.createObjectStore("events", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("doors")) {
        db.createObjectStore("doors", { keyPath: "eventId" });
      }
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage."));
  });
}

function runStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = work(store);
        tx.oncomplete = () => {
          db.close();
          if (request) resolve(request.result);
          else resolve(undefined as T);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("Offline storage failed."));
        };
        if (request) {
          request.onerror = () => {
            reject(request.error ?? new Error("Offline storage failed."));
          };
        }
      }),
  );
}

export async function saveCompanionEvents(events: CompanionEventCard[]) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("events", "readwrite");
    const store = tx.objectStore("events");
    store.clear();
    events.forEach((event) => store.put(event));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Could not save events offline."));
    };
  });
}

export async function loadCompanionEvents(): Promise<CompanionEventCard[]> {
  const rows = await runStore<CompanionEventCard[]>("events", "readonly", (store) => store.getAll());
  return rows ?? [];
}

export async function saveCachedDoor(door: CachedDoor) {
  await runStore("doors", "readwrite", (store) => store.put(door));
}

export async function loadCachedDoor(eventId: string): Promise<CachedDoor | null> {
  const row = await runStore<CachedDoor | undefined>("doors", "readonly", (store) => store.get(eventId));
  return row ?? null;
}

export async function queueScan(eventId: string, code: string): Promise<QueuedScan> {
  const item: QueuedScan = {
    id: crypto.randomUUID(),
    eventId,
    code,
    queuedAt: new Date().toISOString(),
  };
  await runStore("queue", "readwrite", (store) => store.put(item));
  return item;
}

export async function listQueuedScans(eventId?: string): Promise<QueuedScan[]> {
  const rows = await runStore<QueuedScan[]>("queue", "readonly", (store) => store.getAll());
  const all = rows ?? [];
  return eventId ? all.filter((item) => item.eventId === eventId) : all;
}

export async function removeQueuedScan(id: string) {
  await runStore("queue", "readwrite", (store) => store.delete(id));
}

export function applyLocalCheckIn(
  guests: DoorGuest[],
  stats: DoorStats,
  result: ScanTicketResult,
): { guests: DoorGuest[]; stats: DoorStats } {
  if (!result.ticket) {
    return { guests, stats };
  }

  const scannedAt = result.ticket.scannedAt || new Date().toISOString();
  let found = false;
  const nextGuests = guests.map((guest) => {
    if (guest.code.toUpperCase() !== result.ticket!.code.toUpperCase()) return guest;
    found = true;
    return {
      ...guest,
      isScanned: true,
      scannedAt,
    };
  });

  if (!found && result.ticket) {
    nextGuests.unshift({
      ticketId: result.ticket.id,
      code: result.ticket.code,
      ticketTypeName: result.ticket.ticketTypeName,
      buyerId: null,
      guestName: result.ticket.guestName,
      guestEmail: result.ticket.guestEmail,
      guestPhone: null,
      scannedAt,
      scannedBy: null,
      purchasedAt: scannedAt,
      isScanned: true,
    });
  }

  const scannedGuests = nextGuests.filter((guest) => guest.isScanned).length;
  const totalGuests = nextGuests.length;
  return {
    guests: nextGuests,
    stats: result.stats ?? {
      eventId: stats.eventId,
      totalGuests,
      scannedGuests,
      remainingGuests: Math.max(totalGuests - scannedGuests, 0),
    },
  };
}
