# Fin & Feather Feeding System

An automated, IoT-based web application and hardware ecosystem designed to precisely monitor and control feeding schedules for livestock (such as chickens and fish).

This project integrates a **Real-Time Web Dashboard** powered by **Firebase** and an **ESP8266 NodeMCU** hardware controller, complete with features for schedule management, live status monitoring, and low-feed SMS alerts.

---

## 🌟 System Architecture & Workflow

The system is split into two robust entities acting in real-time communication:

1. **The Web Dashboard (Frontend)**
   * Hosted statically (e.g., via GitHub Pages).
   * Fully mobile responsive, featuring a modern, dark-themed UI.
   * Uses Firebase Realtime Database for logging events, queuing manual feeds, and managing the active schedule.

2. **The Hardware Hub (ESP8266 + Sensors)**
   * Uses an **Ultrasonic Sensor** affixed inside the feed enclosure/hopper to dynamically measure the distance of the feed. It maps this distance into a 0-100% capacity rating.
   * Utilizes a **Servo Motor (180 degrees)** to reliably execute "dispense" commands by rotating to open a gate mechanism.
   * Integrates a **SIM900A GSM Module**. If the feed level drops below 20%, an automated SMS alert is dispatched to the administrator.

## ⚙️ How the Code Works

### The Frontend (HTML / CSS / JS)
* **Single Page Application (SPA):** The `index.html` structure utilizes lightweight DOM manipulation (`js/app.js`) to smoothly toggle between the Dashboard, Live Monitor, Schedule, Logs, Inventory, and Settings without loading new pages.
* **Authentication:** A Facebook-styled authentication layer (`login.html`) ensures that only authorized administrators can access the primary dashboard and manipulate feeding frequencies. This leverages Firebase Authentication (`js/auth.js`).
* **Firebase Listeners:** The application opens asynchronous pathways to Firebase (`firebase.database().ref()`), listening with `.on('value', ...)` to reflect changes instantaneously onto progress bars and data logs.

### The Backend / Firmware (C++)
The code found in `arduino/esp8266_feeder.ino` operates in a continuous loop (`loop()`):
1. **Distance Calculation:** It emits an ultrasonic pulse and divides the echo duration by the speed of sound.
2. **Status Pushing:** This metric is beamed directly to the Firebase Realtime Database via WiFi.
3. **Trigger Catching:** It interrogates the Firebase queue for the boolean flag `/feeder/control/dispense_now`. If `true`, the servo is triggered.
4. **Offline Capability:** Critical tasks (like the 20% SMS alert) persist even if the WiFi connection drops briefly, handled natively by the NodeMCU loops.

---

## 🚀 Setup & Host on GitHub Pages

Because this application isolates its backend to Firebase (BaaS) and runs purely on HTML, CSS, and Vanilla JavaScript, it is completely compatible with static free hosting.

### Step 1: Push to GitHub
1. Create a repository on your GitHub account.
2. Upload all the files inside this directory directly into your new repository.

### Step 2: Configure Firebase
1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication** (Email/Password) and **Realtime Database** (Start in Test Mode).
3. Open `js/firebase-config.js` and paste your newly generated Firebase Credentials array provided by Google.

### Step 3: Enable Output
1. Navigate to the **Settings** tab of your GitHub repository.
2. Select **Pages** from the sidebar.
3. Under "Build and deployment", choose the `main` branch and `/ (root)` folder.
4. Click **Save**. In ~2 minutes, your admin dashboard will be live on the internet!

---

*Note on Images*: To display the custom aesthetic background properly, ensure you have saved your imagery inside the `/images` directory named as `bg-image.jpg`.
