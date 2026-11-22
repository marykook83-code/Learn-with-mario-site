import { auth } from "./firebase.js";
import {
  GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const watchAuth = (callback) => onAuthStateChanged(auth, callback);
export const loginGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const registerEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const loginEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);

const messages = {
  "auth/invalid-email": "That email address is not valid.",
  "auth/missing-password": "Enter a password.",
  "auth/weak-password": "Use a password with at least 6 characters.",
  "auth/email-already-in-use": "This email already has an account. Try logging in.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/user-not-found": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/popup-closed-by-user": "The Google window was closed before signing in.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups and try again.",
  "auth/unauthorized-domain": "This domain is not authorized in Firebase Authentication settings.",
  "auth/network-request-failed": "Network problem. Check your connection and try again."
};

export const authMessage = (error) => messages[error.code] || "Something went wrong. Please try again.";
