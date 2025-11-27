import { GeneratedImage } from '../types';

const DB_NAME = 'LuminaDB';
const STORE_NAME = 'image_history';
const REFINE_STORE_NAME = 'refine_history';
const DB_VERSION = 2;

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event);
            reject("Could not open database");
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            if (!db.objectStoreNames.contains(REFINE_STORE_NAME)) {
                const refineStore = db.createObjectStore(REFINE_STORE_NAME, { keyPath: 'id' });
                refineStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
};

export const saveImageToHistory = async (image: GeneratedImage): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // 1. Add the new image
        const addRequest = store.add(image);

        addRequest.onerror = () => {
            console.error("Error adding image to history");
            reject("Error adding image");
        };

        addRequest.onsuccess = () => {
            // 2. Check count and delete oldest if > 50
            // We use the timestamp index to find the oldest
            const index = store.index('timestamp');
            const countRequest = store.count();

            countRequest.onsuccess = () => {
                const count = countRequest.result;
                if (count > 50) {
                    // Get the oldest keys (smallest timestamp)
                    // We need to delete (count - 50) items
                    const deleteCount = count - 50;

                    const cursorRequest = index.openCursor(); // Default direction is 'next' (ascending)
                    let deleted = 0;

                    cursorRequest.onsuccess = (e) => {
                        const cursor = (e.target as IDBRequest).result;
                        if (cursor && deleted < deleteCount) {
                            store.delete(cursor.primaryKey);
                            deleted++;
                            cursor.continue();
                        }
                    };
                }
                resolve();
            };
        };
    });
};

export const getHistory = async (): Promise<GeneratedImage[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');

        // Get all items sorted by timestamp descending (newest first)
        // 'prev' direction iterates from highest key to lowest
        const request = index.getAll();

        request.onsuccess = () => {
            // getAll() returns array sorted by key (timestamp) ascending
            // So we reverse it to get newest first
            const result = request.result as GeneratedImage[];
            resolve(result.reverse());
        };

        request.onerror = () => {
            reject("Error fetching history");
        };
    });
};

export const saveRefinedImageToHistory = async (image: GeneratedImage): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([REFINE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(REFINE_STORE_NAME);

        // 1. Add the new image
        const addRequest = store.add(image);

        addRequest.onerror = () => {
            console.error("Error adding refined image to history");
            reject("Error adding refined image");
        };

        addRequest.onsuccess = () => {
            // 2. Check count and delete oldest if > 20
            const index = store.index('timestamp');
            const countRequest = store.count();

            countRequest.onsuccess = () => {
                const count = countRequest.result;
                if (count > 20) {
                    // Get the oldest keys (smallest timestamp)
                    const deleteCount = count - 20;

                    const cursorRequest = index.openCursor();
                    let deleted = 0;

                    cursorRequest.onsuccess = (e) => {
                        const cursor = (e.target as IDBRequest).result;
                        if (cursor && deleted < deleteCount) {
                            store.delete(cursor.primaryKey);
                            deleted++;
                            cursor.continue();
                        }
                    };
                }
                resolve();
            };
        };
    });
};

export const getRefinedHistory = async (): Promise<GeneratedImage[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([REFINE_STORE_NAME], 'readonly');
        const store = transaction.objectStore(REFINE_STORE_NAME);
        const index = store.index('timestamp');

        const request = index.getAll();

        request.onsuccess = () => {
            const result = request.result as GeneratedImage[];
            resolve(result.reverse());
        };

        request.onerror = () => {
            reject("Error fetching refined history");
        };
    });
};
