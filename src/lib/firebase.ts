// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBBqaRl_tv0LcEnTs08hU02NdDs8s9QUIM",
  authDomain: "lendeasy-6e36b.firebaseapp.com",
  projectId: "lendeasy-6e36b",
  storageBucket: "lendeasy-6e36b.firebasestorage.app",
  messagingSenderId: "131903487012",
  appId: "1:131903487012:web:e47c26167577bde730ecb1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
