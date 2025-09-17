# 🎥 AI-Based Video Proctoring System

This project is a **real-time online proctoring system** built with **React.js**, **Tailwind CSS**, **TensorFlow.js models**, and **Firebase**.  
It helps monitor candidates during online assessments by detecting suspicious activities and generating detailed integrity reports.

---

## ✨ Features

- 🎬 **Live Candidate Feed** – Monitor the candidate through webcam.
- 🧑‍💻 **Face Detection (Blazeface)** – Detects if the candidate is present and focused.
- 📦 **Object Detection (COCO-SSD)** – Detects suspicious items like phone, book, laptop, or tablet.
- ⚠️ **Live Alerts** – Instant alerts for:
  - No face detected for more than 10 seconds
  - Candidate not focused for more than 5 seconds
  - Multiple faces detected
  - Suspicious objects detected
- 🎯 **Integrity Score** – A scoring system that decreases when alerts are triggered.
- 📜 **Event Log** – Stores all detection events in real-time.
- ☁️ **Firebase Firestore Integration** – All sessions, events, alerts, and scores are stored in the cloud.
- 📊 **Final Report Generation** – Summary of the candidate’s session (focus lost, multiple faces, suspicious items, final score).
- ⬇️ **Report Download (PDF)** – Export the report for record-keeping.

---

## 🛠️ Tech Stack

### **Frontend**
- [React.js](https://react.dev/) – UI framework
- [Tailwind CSS](https://tailwindcss.com/) – Modern styling
- [TensorFlow.js](https://www.tensorflow.org/js) – Machine learning in the browser
  - **Blazeface** – Face detection
  - **COCO-SSD** – Object detection
- [jsPDF](https://github.com/parallax/jsPDF) – Download reports as PDF

### **Backend**
- [Firebase Firestore](https://firebase.google.com/) – Cloud database for sessions, events, and reports

---

## ⚡ How It Works

1. Candidate enters their name and starts the session.  
2. Webcam feed is analyzed:
   - **Face Tracking** – Ensures the candidate is present and focused.  
   - **Object Detection** – Identifies prohibited items.  
3. Events and alerts are logged in **Firestore** in real-time.  
4. Integrity score updates dynamically based on behavior.  
5. When the session ends:
   - Final session data is saved to Firestore.  
   - Candidate/Admin can **generate and download a detailed report**.  

---

## 📥 Installation

Clone this repo and install dependencies:

```bash
git clone https://github.com/your-username/video-proctoring.git
cd video-proctoring
npm install
