import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAabe96LMlm6lp6e14q8TraI_ndDlcvIMg",
  authDomain: "compastock-claude.firebaseapp.com",
  projectId: "compastock-claude",
  storageBucket: "compastock-claude.firebasestorage.app",
  messagingSenderId: "150315440309",
  appId: "1:150315440309:web:a431bc18bc9d3a55c286fc"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;