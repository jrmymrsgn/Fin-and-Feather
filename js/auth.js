// =============================
// FIN & FEATHER AUTH (FIXED VERSION)
// =============================

document.addEventListener("DOMContentLoaded", function () {

    console.log("AUTH SCRIPT LOADED");

    // =============================
    // UI ELEMENTS
    // =============================
    const loginBox = document.getElementById('login-box');
    const signupBox = document.getElementById('signup-box');
    const forgotBox = document.getElementById('forgot-box');

    const showSignupBtn = document.getElementById('show-signup-btn');
    const showForgotLink = document.getElementById('show-forgot-link');
    const showLoginLink1 = document.getElementById('show-login-link-1');
    const showLoginLink2 = document.getElementById('show-login-link-2');

    function hideAllBoxes() {
        if (loginBox) loginBox.style.display = 'none';
        if (signupBox) signupBox.style.display = 'none';
        if (forgotBox) forgotBox.style.display = 'none';
    }

    // =============================
    // NAVIGATION
    // =============================
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
    // FIREBASE CHECK
    // =============================
    if (!window.firebase) {
        console.error("Firebase not loaded!");
        alert("Firebase failed to load. Check script order.");
        return;
    }

    const auth = firebase.auth();
    const db = firebase.database();

    // =============================
    // LOGIN
    // =============================
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            console.log("LOGIN BUTTON CLICKED");

            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            try {
                const result = await auth.signInWithEmailAndPassword(email, password);

                console.log("LOGIN SUCCESS:", result.user.email);

               

            window.location.href = "./dashboard.html";
                
            } catch (error) {
                console.error("LOGIN ERROR:", error.code, error.message);
                alert(error.message);
            }
        });
    }

    // =============================
    // SIGNUP
    // =============================
    const signupForm = document.getElementById('signup-form');

    if (signupForm) {
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;
            const deviceId = document.getElementById('signup-device-id').value.trim();

            if (!deviceId) {
                alert("Device ID required");
                return;
            }

            try {
                const deviceRef = db.ref('devices/' + deviceId);
                const snapshot = await deviceRef.once('value');

                if (snapshot.exists() && snapshot.child('owner').exists()) {
                    alert("Device already assigned.");
                    return;
                }

                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const uid = userCredential.user.uid;

                await db.ref('users/' + uid).set({
                    deviceId: deviceId
                });

                await deviceRef.child('owner').set(uid);

                alert("Account created!");

                window.location.href = "./dashboard.html";

            } catch (error) {
                console.error(error);
                alert(error.message);
            }
        });
    }

    // =============================
    // FORGOT PASSWORD
    // =============================
    const forgotForm = document.getElementById('forgot-form');

    if (forgotForm) {
        forgotForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('forgot-email').value.trim();

            try {
                await auth.sendPasswordResetEmail(email);

                alert("Password reset email sent!");

                hideAllBoxes();
                if (loginBox) loginBox.style.display = 'block';

            } catch (error) {
                alert(error.message);
            }
        });
    }

    // =============================
    // AUTO REDIRECT
    // =============================
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log("User logged in:", user.email);

            if (window.location.pathname.includes("index.html")) {
                window.location.href = "./dashboard.html";
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

        icon.addEventListener('click', function () {
            const isPassword = input.type === "password";
            input.type = isPassword ? "text" : "password";

            this.classList.toggle("fa-eye");
            this.classList.toggle("fa-eye-slash");
        });
    }

    setupToggle('toggle-login-password', 'login-password');
    setupToggle('toggle-signup-password', 'signup-password');

});
