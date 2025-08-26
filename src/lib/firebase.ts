// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAIgZ0mA5uhWpLnD1nutXzdN_ajnalUJI0",
  authDomain: "lendeasytimote.firebaseapp.com",
  projectId: "lendeasytimote",
  storageBucket: "lendeasytimote.firebasestorage.app",
  messagingSenderId: "401998057385",
  appId: "1:401998057385:web:10cd0a8815bceaec46beb8",
  measurementId: "G-5D26QYCQX5"
  
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
