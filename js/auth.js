// DOM Elements - Forms
const loginBox = document.getElementById('login-box');
const signupBox = document.getElementById('signup-box');
const forgotBox = document.getElementById('forgot-box');

// DOM Elements - Triggers
const showSignupBtn = document.getElementById('show-signup-btn');
const showForgotLink = document.getElementById('show-forgot-link');
const showLoginLink1 = document.getElementById('show-login-link-1');
const showLoginLink2 = document.getElementById('show-login-link-2');

// Initialize Firebase Auth
const auth = firebase.auth();

// UI Navigation Functions
function hideAllBoxes() {
    loginBox.style.display = 'none';
    signupBox.style.display = 'none';
    forgotBox.style.display = 'none';
}

showSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    hideAllBoxes();
    signupBox.style.display = 'block';
});

showForgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    hideAllBoxes();
    forgotBox.style.display = 'block';
});

showLoginLink1.addEventListener('click', (e) => {
    e.preventDefault();
    hideAllBoxes();
    loginBox.style.display = 'block';
});

showLoginLink2.addEventListener('click', (e) => {
    e.preventDefault();
    hideAllBoxes();
    loginBox.style.display = 'block';
});

// Firebase Authentication Logic

let isAuthAction = false; // Flag to prevent premature redirects during signup/login

function getFriendlyErrorMessage(error) {
    if (!error.code) return error.message; // Fallback if no code

    switch (error.code) {
        case 'auth/wrong-password':
            return "Incorrect password. Please try again.";
        case 'auth/user-not-found':
            return "No account found with this email address.";
        case 'auth/invalid-login-credentials':
        case 'auth/invalid-credential':
            return "Invalid email or password. Please try again.";
        case 'auth/invalid-email':
            return "Please enter a valid email address.";
        case 'auth/email-already-in-use':
            return "An account with this email already exists.";
        case 'auth/weak-password':
            return "Your password is too weak. Please use at least 6 characters.";
        case 'auth/too-many-requests':
            return "Too many unsuccessful attempts. Please try again later.";
        case 'auth/network-request-failed':
            return "Network error. Please check your internet connection.";
        default:
            return "An error occurred: " + error.message;
    }
}

// 1. Log In
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    isAuthAction = true;
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log("Logged in successfully:", userCredential.user);
            window.location.href = 'dashboard.html'; 
        })
        .catch((error) => {
            isAuthAction = false;
            alert(getFriendlyErrorMessage(error));
        });
});

// 2. Sign Up
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const deviceId = document.getElementById('signup-device-id').value.trim();

    if(!deviceId) {
        alert("Please enter a valid Device ID.");
        return;
    }

    isAuthAction = true;
    try {
        // Check if device is already registered
        const deviceRef = firebase.database().ref('devices/' + deviceId);
        const snapshot = await deviceRef.once('value');
        if(snapshot.exists() && snapshot.child('owner').exists()) {
            alert("This Device ID is already registered to another user.");
            return;
        }

        // Proceed to create user
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        // Register device to user
        await deviceRef.child('owner').set(uid);
        // Link user to device
        await firebase.database().ref('users/' + uid).set({ deviceId: deviceId });

        alert("Account created and Device registered successfully!");
        window.location.href = 'dashboard.html'; 

    } catch (error) {
        isAuthAction = false;
        alert(getFriendlyErrorMessage(error));
    }
});

// 3. Forgot Password / Reset
document.getElementById('forgot-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;

    auth.sendPasswordResetEmail(email)
        .then(() => {
            alert("Password reset email sent! Please check your inbox.");
            hideAllBoxes();
            loginBox.style.display = 'block';
        })
        .catch((error) => {
            alert(getFriendlyErrorMessage(error));
        });
});

// Check if user is already logged in
auth.onAuthStateChanged((user) => {
    // Only redirect automatically if user is logged in, on index.html, and not currently submitting a form
    if (user && window.location.pathname.includes('index.html') && !isAuthAction) {
        window.location.href = 'dashboard.html';
    }
});

// Toggle Password Visibility
function setupPasswordToggle(toggleIconId, passwordInputId) {
    const toggleIcon = document.getElementById(toggleIconId);
    const passwordInput = document.getElementById(passwordInputId);
    
    if (toggleIcon && passwordInput) {
        toggleIcon.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            // Toggle icon
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }
}

setupPasswordToggle('toggle-login-password', 'login-password');
setupPasswordToggle('toggle-signup-password', 'signup-password');
