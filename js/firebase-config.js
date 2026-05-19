// Our web app's Firebase configuration
// REPLACE THIS WITH ACTUAL FIREBASE CONFIG
const firebaseConfig = {
     apiKey: "AIzaSyCXQopu0o9BMSp3Dr62QnR_FLw6dMGryC0",
  authDomain: "fin-and-feather-feeding-3e5c3.firebaseapp.com",
  databaseURL: "https://fin-and-feather-feeding-3e5c3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fin-and-feather-feeding-3e5c3",
  storageBucket: "fin-and-feather-feeding-3e5c3.firebasestorage.app",
  messagingSenderId: "99913608949",
  appId: "1:99913608949:web:7a9dfe18c68bbbea539fbc"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();
