import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBjK1Fbl8doARlaZeeBFgWzsITGCFra4U8",
  authDomain: "qa-hub-fb.firebaseapp.com",
  databaseURL: "https://qa-hub-fb-default-rtdb.firebaseio.com",
  projectId: "qa-hub-fb",
  storageBucket: "qa-hub-fb.firebasestorage.app",
  messagingSenderId: "650078709869",
  appId: "1:650078709869:web:f0220b73e98b2ce71df764"
};


const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const storageAPI = {
  async get(key) {
    const snap = await get(ref(db, key));
    return snap.exists() ? { value: JSON.stringify(snap.val()) } : null;
  },
  async set(key, value) {
    await set(ref(db, key), JSON.parse(value));
    return true;
  },
  async delete(key) {
    await set(ref(db, key), null);
    return true;
  },
  subscribe(key, callback) {
    return onValue(ref(db, key), (snap) => {
      callback(
        snap.exists() ? { value: JSON.stringify(snap.val()) } : null
      );
    });
  }
};