// Your web app's Firebase configuration
// REPLACE THIS WITH YOUR ACTUAL FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyDIMtKQqlR7_R35lkrDWVn1agPnGDaAUiY",
  authDomain: "helmet-alert-system.firebaseapp.com",
  databaseURL: "https://helmet-alert-system-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "helmet-alert-system",
  storageBucket: "helmet-alert-system.firebasestorage.app",
  messagingSenderId: "426356613178",
  appId: "1:426356613178:web:4238d6c44f20331f091503"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();
