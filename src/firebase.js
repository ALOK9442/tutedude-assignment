// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDvrPzDvNCgvvUGY4Emi3gkFH5rlVCu0RQ",
  authDomain: "proctor-video.firebaseapp.com",
  projectId: "proctor-video",
  storageBucket: "proctor-video.firebasestorage.app",
  messagingSenderId: "664153253309",
  appId: "1:664153253309:web:5873f628ebb2f90f225ed4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore database
const db = getFirestore(app);

export { db };