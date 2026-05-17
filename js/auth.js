// ===============================
// FIN & FEATHER FEEDING SYSTEM
// AUTH.JS - FULL UPDATED VERSION
// ===============================

// ===============================
// DOM ELEMENTS - FORMS
// ===============================
const loginBox = document.getElementById('login-box');
const signupBox = document.getElementById('signup-box');
const forgotBox = document.getElementById('forgot-box');

// ===============================
// DOM ELEMENTS - BUTTONS/LINKS
// ===============================
const showSignupBtn = document.getElementById('show-signup-btn');
const showForgotLink = document.getElementById('show-forgot-link');
const showLoginLink1 = document.getElementById('show-login-link-1');
const showLoginLink2 = document.getElementById('show-login-link-2');

// ===============================
// FIREBASE AUTH
// ===============================
const auth = firebase.auth();
const database = firebase.database();

// ===============================
// HIDE ALL BOXES
// ===============================
function hideAllBoxes() {
    loginBox.style.display = 'none';
    signupBox.style.display = 'none';
    forgotBox.style.display = 'none';
}

// ===============================
// SHOW SIGNUP
// ===============================
showSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();

    hideAllBoxes();

    signupBox.style.display = 'block';
});

// ===============================
// SHOW FORGOT PASSWORD
// ===============================
showForgotLink.addEventListener('click', (e) => {
    e.preventDefault();

    hideAllBoxes();

    forgotBox.style.display = 'block';
});

// ===============================
// SHOW LOGIN
// ===============================
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

// ===============================
// FRIENDLY ERROR MESSAGES
// ===============================
function getFriendlyErrorMessage(error) {

    switch (error.code) {

        case 'auth/wrong-password':
            return 'Incorrect password.';

        case 'auth/user-not-found':
            return 'No account found with this email.';

        case 'auth/invalid-email':
            return 'Invalid email address.';

        case 'auth/email-already-in-use':
            return 'Email already registered.';

        case 'auth/weak-password':
            return 'Password must be at least 6 characters.';

        case 'auth/network-request-failed':
            return 'Please check your internet connection.';

        case 'auth/too-many-requests':
            return 'Too many attempts. Try again later.';

        default:
            return error.message;
    }
}

// ===============================
// LOGIN
// ===============================
document.getElementById('login-form')
.addEventListener('submit', async (e) => {

    e.preventDefault();

    const email =
        document.getElementById('login-email').value.trim();

    const password =
        document.getElementById('login-password').value;

    try {

        await auth.signInWithEmailAndPassword(
            email,
            password
        );

        alert('Login successful!');

        window.location.href = 'dashboard.html';

    } catch (error) {

        alert(getFriendlyErrorMessage(error));

    }
});

// ===============================
// SIGNUP
// ===============================
document.getElementById('signup-form')
.addEventListener('submit', async (e) => {

    e.preventDefault();

    const deviceId =
        document.getElementById('signup-device-id')
        .value
        .trim();

    const email =
        document.getElementById('signup-email')
        .value
        .trim();

    const password =
        document.getElementById('signup-password')
        .value;

    // Validation
    if (!deviceId) {
        alert('Please enter Device ID.');
        return;
    }

    if (password.length < 6) {
        alert('Password must be at least 6 characters.');
        return;
    }

    try {

        // Check device existence
        const deviceRef =
            database.ref('devices/' + deviceId);

        const snapshot =
            await deviceRef.once('value');

        // Device already owned
        if (
            snapshot.exists() &&
            snapshot.child('owner').exists()
        ) {

            alert(
                'This Device ID is already registered.'
            );

            return;
        }

        // Create user
        const userCredential =
            await auth.createUserWithEmailAndPassword(
                email,
                password
            );

        const uid = userCredential.user.uid;

        // Save user device
        await database.ref('users/' + uid).set({
            deviceId: deviceId,
            email: email,
            createdAt: Date.now()
        });

        // Save device owner
        await deviceRef.update({
            owner: uid
        });

        alert('Account created successfully!');

        window.location.href = 'dashboard.html';

    } catch (error) {

        alert(getFriendlyErrorMessage(error));

    }
});

// ===============================
// FORGOT PASSWORD
// ===============================
document.getElementById('forgot-form')
.addEventListener('submit', async (e) => {

    e.preventDefault();

    const email =
        document.getElementById('forgot-email')
        .value
        .trim();

    try {

        await auth.sendPasswordResetEmail(email);

        alert(
            'Password reset email sent successfully!'
        );

        hideAllBoxes();

        loginBox.style.display = 'block';

    } catch (error) {

        alert(getFriendlyErrorMessage(error));

    }
});

// ===============================
// AUTO LOGIN CHECK
// ===============================
auth.onAuthStateChanged((user) => {

    if (
        user &&
        window.location.pathname.includes('index.html')
    ) {

        window.location.href = 'dashboard.html';
    }
});

// ===============================
// PASSWORD TOGGLE
// ===============================
function setupPasswordToggle(
    toggleIconId,
    passwordInputId
) {

    const toggleIcon =
        document.getElementById(toggleIconId);

    const passwordInput =
        document.getElementById(passwordInputId);

    if (!toggleIcon || !passwordInput) return;

    toggleIcon.addEventListener('click', () => {

        const type =
            passwordInput.getAttribute('type') === 'password'
            ? 'text'
            : 'password';

        passwordInput.setAttribute('type', type);

        toggleIcon.classList.toggle('fa-eye');
        toggleIcon.classList.toggle('fa-eye-slash');
    });
}

// ===============================
// INIT PASSWORD TOGGLES
// ===============================
setupPasswordToggle(
    'toggle-login-password',
    'login-password'
);

setupPasswordToggle(
    'toggle-signup-password',
    'signup-password'
);
