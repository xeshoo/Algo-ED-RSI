/* ==========================================================================
   STORAGE.JS — thin IndexedDB wrapper.
   Two stores: "settings" (key/value app prefs) and "cases" (saved case logs
   for the documentation generator / audit trail).
   ========================================================================== */

const DB_NAME = "er-airway-assistant";
const DB_VERSION = 1;
let _dbPromise = null;

function openDB(){
  if(_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath:"key" });
      if(!db.objectStoreNames.contains("cases")) db.createObjectStore("cases", { keyPath:"id", autoIncrement:true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return _dbPromise;
}

const Store = {
  async getSetting(key, fallback){
    try{
      const db = await openDB();
      return await new Promise((resolve) => {
        const tx = db.transaction("settings","readonly");
        const req = tx.objectStore("settings").get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
        req.onerror = () => resolve(fallback);
      });
    } catch(e){ return fallback; }
  },
  async setSetting(key, value){
    try{
      const db = await openDB();
      return await new Promise((resolve) => {
        const tx = db.transaction("settings","readwrite");
        tx.objectStore("settings").put({ key, value });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch(e){ return false; }
  },
  async saveCase(caseRecord){
    try{
      const db = await openDB();
      return await new Promise((resolve) => {
        const tx = db.transaction("cases","readwrite");
        const req = tx.objectStore("cases").add(caseRecord);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
    } catch(e){ return null; }
  },
  async listCases(){
    try{
      const db = await openDB();
      return await new Promise((resolve) => {
        const tx = db.transaction("cases","readonly");
        const req = tx.objectStore("cases").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch(e){ return []; }
  }
};
