/* ==========================================================================
   STORAGE.JS — IndexedDB wrapper for settings + saved case reports
   ========================================================================== */

"use strict";

const Store = (() => {
  const DB_NAME = "er-airway";
  const DB_VER = 2;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains("settings")) d.createObjectStore("settings");
        if (!d.objectStoreNames.contains("cases")) d.createObjectStore("cases", { keyPath: "id" });
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function tx(store, mode) {
    return db.transaction(store, mode).objectStore(store);
  }

  function get(store, key) {
    return new Promise((resolve, reject) => {
      const r = tx(store, "readonly").get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  function set(store, key, value) {
    return new Promise((resolve, reject) => {
      const r = tx(store, "readwrite").put(value, key);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }

  function del(store, key) {
    return new Promise((resolve, reject) => {
      const r = tx(store, "readwrite").delete(key);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }

  function all(store) {
    return new Promise((resolve, reject) => {
      const r = tx(store, "readonly").getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  /* Settings helpers */
  async function getSetting(key, fallback) {
    try { const v = await get("settings", key); return v !== undefined ? v : fallback; }
    catch { return fallback; }
  }
  async function setSetting(key, value) { return set("settings", key, value); }

  /* Case helpers */
  async function saveCase(c) {
    c.id = c.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    c.savedAt = c.savedAt || new Date().toISOString();
    await set("cases", c);
    return c;
  }
  async function listCases() { return (await all("cases")).sort((a, b) => b.savedAt.localeCompare(a.savedAt)); }
  async function deleteCase(id) { return del("cases", id); }

  return { open, getSetting, setSetting, saveCase, listCases, deleteCase };
})();
