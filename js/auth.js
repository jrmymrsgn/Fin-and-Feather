// =============================
// AUTH UI ELEMENTS
// =============================
const loginBox = document.getElementById('login-box');
const signupBox = document.getElementById('signup-box');
const forgotBox = document.getElementById('forgot-box');

const showSignupBtn = document.getElementById('show-signup-btn');
const showForgotLink = document.getElementById('show-forgot-link');
const showLoginLink1 = document.getElementById('show-login-link-1');
const showLoginLink2 = document.getElementById('show-login-link-2');

// =============================
// SAFETY CHECK (IMPORTANT)
// =============================
if (!loginBox || !signupBox || !forgotBox) {
    console.error("Auth UI elements not found. Check HTML IDs.");
}

// =============================
// NAVIGATION
// =============================
function hideAllBoxes() {
    if (loginBox) loginBox.style.display = 'none';
    if (signupBox) signupBox.style.display = 'none';
    if (forgotBox) forgotBox.style.display = 'none';
}

if (showSignupBtn) {
    showSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllBoxes();
        signupBox.style.display = 'block';
    });
}

if (showForgotLink) {
    showForgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllBoxes();
        forgotBox.style.display = 'block';
    });
}

if (showLoginLink1) {
    showLoginLink1.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllBoxes();
        loginBox.style.display = 'block';
    });
}

if (showLoginLink2) {
    showLoginLink2.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllBoxes();
        loginBox.style.display = 'block';
    });
}

// =============================
// FIREBASE AUTH
// =============================
const auth = firebase.auth();

// =============================
// LOGIN
// =============================
const loginForm = document.getElementById('login-form');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        console.log("Attempting login:", email);

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);

            console.log("LOGIN SUCCESS:", userCredential.user.email);

            alert("Login successful!");

            // small delay ensures Firebase session is set
            setTimeout(() => {
                window.location.href = './dashboard.html';
            }, 500);

        } catch (error) {
            console.error("LOGIN ERROR:", error.code, error.message);
            alert(getFriendlyErrorMessage(error));
        }
    });
}

// =============================
// SIGNUP
// =============================
const signupForm = document.getElementById('signup-form');

if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const deviceId = document.getElementById('signup-device-id').value.trim();

        if (!deviceId) {
            alert("Device ID is required");
            return;
        }

        try {
            const deviceRef = firebase.database().ref('devices/' + deviceId);
            const snapshot = await deviceRef.once('value');

            if (snapshot.exists() && snapshot.child('owner').exists()) {
                alert("Device already assigned.");
                return;
            }

            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const uid = userCredential.user.uid;

            await firebase.database().ref('users/' + uid).set({
                deviceId: deviceId
            });

            await deviceRef.child('owner').set(uid);

            alert("Account created!");

            window.location.href = './dashboard.html';

        } catch (error) {
            console.error(error);
            alert(getFriendlyErrorMessage(error));
        }
    });
}

// =============================
// FORGOT PASSWORD
// =============================
const forgotForm = document.getElementById('forgot-form');

if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('forgot-email').value.trim();

        try {
            await auth.sendPasswordResetEmail(email);
            alert("Reset email sent!");
            hideAllBoxes();
            loginBox.style.display = 'block';
        } catch (error) {
            alert(getFriendlyErrorMessage(error));
        }
    });
}

// =============================
// ERROR HANDLER
// =============================
function getFriendlyErrorMessage(error) {
    console.log("Firebase error:", error);

    switch (error.code) {
        case 'auth/user-not-found':
            return "No account found.";
        case 'auth/wrong-password':
            return "Wrong password.";
        case 'auth/invalid-email':
            return "Invalid email.";
        case 'auth/network-request-failed':
            return "Network error.";
        default:
            return error.message;
    }
}

// =============================
// AUTO LOGIN REDIRECT
// =============================
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("User already logged in:", user.email);
        if (window.location.pathname.includes('index.html')) {
            window.location.href = './dashboard.html';
        }
    }
});

// =============================
// PASSWORD TOGGLE
// =============================
function setupToggle(iconId, inputId) {
    const icon = document.getElementById(iconId);
    const input = document.getElementById(inputId);

    if (!icon || !input) return;

    icon.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    });
}

setupToggle('toggle-login-password', 'login-password');
setupToggle('toggle-signup-password', 'signup-password');
