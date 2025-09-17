import React, { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import {
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import ReportScreen from "./reportScreen";

const VideoProctoring = () => {
  const videoRef = useRef(null);
  const bfModelRef = useRef(null);
  const objModelRef = useRef(null);
  const sessionRef = useRef(null);

  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [integrityScore, setIntegrityScore] = useState(100);
  const [detections, setDetections] = useState({ faces: 0, objects: [] });

  const [candidateName, setCandidateName] = useState("");
  const [started, setStarted] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [report, setReport] = useState(null);

  const lastFaceTime = useRef(Date.now());
  const lastFocusTime = useRef(Date.now());

  useEffect(() => {
    const loadModels = async () => {
      bfModelRef.current = await blazeface.load();
      objModelRef.current = await cocoSsd.load();
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (!started) return;
    const startCamera = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    };
    startCamera();
  }, [started]);

  const startSession = async () => {
    const sessionId = `${candidateName}_${Date.now()}`;
    sessionRef.current = doc(db, "proctoringSessions", sessionId);

    await setDoc(sessionRef.current, {
      candidateName,
      startTime: serverTimestamp(),
      integrityScore: 100,
      events: [],
      alerts: [],
    });

    setStarted(true);
  };

  const endSession = async () => {
    if (sessionRef.current) {
      await updateDoc(sessionRef.current, {
        endTime: serverTimestamp(),
        finalIntegrityScore: integrityScore,
      });
    }
    setStarted(false);
    setSessionEnded(true);
  };

  const generateReport = async () => {
    if (!sessionRef.current) return;
    const docSnap = await getDoc(sessionRef.current);
    if (docSnap.exists()) {
      const data = docSnap.data();

      const focusLost = data.events.filter((e) => e.type === "not_focused").length;
      const multipleFaces = data.events.filter((e) => e.type === "multiple_faces").length;
      const suspiciousItems = data.events.filter((e) => e.type === "suspicious_item").length;

      setReport({
        candidateName: data.candidateName,
        startTime: data.startTime?.toDate().toLocaleString(),
        endTime: data.endTime?.toDate().toLocaleString(),
        duration: data.startTime && data.endTime
          ? Math.floor((data.endTime.seconds - data.startTime.seconds) / 60) + " mins"
          : "N/A",
        focusLost,
        multipleFaces,
        suspiciousItems,
        integrityScore: data.finalIntegrityScore ?? data.integrityScore,
      });
    }
  };

  const addEvent = async (type, message, severity = "info") => {
    const event = {
      time: new Date().toLocaleTimeString(),
      type,
      message,
      severity,
    };
    setEvents((prev) => [...prev, event]);
    if (sessionRef.current) {
      await updateDoc(sessionRef.current, {
        events: arrayUnion(event),
      });
    }
  };

  const addAlert = async (msg, severity = "warning") => {
    const alert = {
      time: new Date().toLocaleTimeString(),
      message: msg,
      severity,
    };
    setAlerts((prev) => [...prev, alert]);
    const deduction = severity === "error" ? 10 : 5;
    setIntegrityScore((prev) => Math.max(prev - deduction, 0));
    if (sessionRef.current) {
      await updateDoc(sessionRef.current, {
        alerts: arrayUnion(alert),
        integrityScore: integrityScore - deduction,
      });
    }
  };

  useEffect(() => {
    if (!started) return;
    let interval;
    const runDetection = async () => {
      if (!videoRef.current || !bfModelRef.current) return;
      const faces = await bfModelRef.current.estimateFaces(videoRef.current, false);
      const objects = objModelRef.current ? await objModelRef.current.detect(videoRef.current) : [];

      setDetections({ faces: faces.length, objects: objects.map((o) => o.class) });

      if (faces.length === 0) {
        if (Date.now() - lastFaceTime.current > 10000) {
          addEvent("no_face", "No face detected > 10s", "error");
          addAlert("🚨 Candidate left screen!", "error");
          lastFaceTime.current = Date.now();
        }
      } else {
        lastFaceTime.current = Date.now();
        const face = faces[0];
        if (face.landmarks && face.landmarks.length >= 3) {
          const leftEye = face.landmarks[0];
          const rightEye = face.landmarks[1];
          const nose = face.landmarks[2];
          const eyeSlope = Math.abs(leftEye[1] - rightEye[1]);
          const faceWidth = Math.abs(rightEye[0] - leftEye[0]);
          const noseOffset = Math.abs(nose[0] - (leftEye[0] + rightEye[0]) / 2);
          const isFocused = eyeSlope < 10 && noseOffset < faceWidth * 0.3;
          if (!isFocused) {
            if (Date.now() - lastFocusTime.current > 5000) {
              addEvent("not_focused", "Candidate not looking > 5s", "warning");
              addAlert("👀 Candidate not focused!", "warning");
              lastFocusTime.current = Date.now();
            }
          } else {
            lastFocusTime.current = Date.now();
          }
        }
      }
      if (faces.length > 1) {
        addEvent("multiple_faces", "Multiple faces detected", "error");
        addAlert("⚠️ Multiple people detected!", "error");
      }
      objects.forEach((obj) => {
        if (["cell phone", "book", "laptop", "tablet"].includes(obj.class)) {
          addEvent("suspicious_item", `${obj.class} detected`, "error");
          addAlert(`📱 Suspicious item: ${obj.class}`, "error");
        }
      });
    };
    interval = setInterval(runDetection, 1000);
    return () => clearInterval(interval);
  }, [started]);

  if (!started && !sessionEnded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600">
        <div className="bg-white/20 backdrop-blur-xl shadow-2xl rounded-2xl p-8 w-full max-w-md text-center">
          <h2 className="text-2xl font-extrabold text-white mb-6">
            Enter Candidate Details
          </h2>
          <input
            type="text"
            placeholder="Enter your name"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            className="w-full p-3 rounded-xl border border-white/40 bg-white/30 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-pink-400 mb-6"
          />
          <button
            disabled={!candidateName.trim()}
            onClick={startSession}
            className={`w-full py-3 rounded-xl font-semibold text-lg transition-transform transform ${
              candidateName.trim()
                ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:scale-105 shadow-lg"
                : "bg-gray-400 text-gray-200 cursor-not-allowed"
            }`}
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-8 text-white">
      {!sessionEnded ? (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl">
              <h2 className="text-2xl font-bold mb-4">
                Candidate Feed –{" "}
                <span className="text-pink-400">{candidateName}</span>
              </h2>
              <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full h-80 rounded-xl border border-white/30 bg-black shadow-inner"
              />
              <div className="mt-4 text-sm text-gray-200">
                <p>👤 Faces detected: {detections.faces}</p>
                <p>
                  🎒 Objects:{" "}
                  {detections.objects.length > 0
                    ? detections.objects.join(", ")
                    : "None"}
                </p>
              </div>
              <button
                onClick={endSession}
                className="mt-6 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl font-semibold hover:scale-105 transform transition shadow-lg"
              >
                End Interview
              </button>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-4">⚡ Live Alerts</h2>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {alerts.slice(-5).map((alert, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl font-medium shadow ${
                    alert.severity === "error"
                      ? "bg-red-500/20 text-red-300"
                      : "bg-yellow-500/20 text-yellow-200"
                  }`}
                >
                  {alert.message}
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="font-bold mb-2">
                🎯 Integrity Score: {integrityScore}
              </h3>
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 bg-gradient-to-r from-green-400 to-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${integrityScore}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="col-span-3">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl mt-6">
              <h2 className="text-2xl font-bold mb-4">📜 Event Log</h2>
              <div className="border border-white/20 rounded-xl p-4 h-56 overflow-y-auto text-sm space-y-2 bg-black/30">
                {events.map((e, i) => (
                  <div key={i} className="border-b border-white/10 pb-1">
                    <span className="font-bold text-pink-400">[{e.time}]</span>{" "}
                    {e.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-lg mx-auto text-center">
          <button
            onClick={generateReport}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:scale-105 transform transition shadow-lg mb-6"
          >
            📊 Generate Report
          </button>

          {report && (
            <ReportScreen report={report} />
          )}
        </div>
      )}
    </div>
  );
};

export default VideoProctoring;