// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAdGvgW8TE0vInU64zWKeTimVVyAIzdWTg",
  authDomain: "learn-with-mario.firebaseapp.com",
  projectId: "learn-with-mario",
  storageBucket: "learn-with-mario.firebasestorage.app",
  messagingSenderId: "1087168426088",
  appId: "1:1087168426088:web:a8f025c5423609eadccbdd",
  measurementId: "G-6Z8WYBPJ8Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);