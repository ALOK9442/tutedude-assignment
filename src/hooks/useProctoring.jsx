import { useEffect, useRef, useState } from "react";
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

export const useProctoring = (candidateName, started) => {
  const videoRef = useRef(null);
  const bfModelRef = useRef(null);
  const objModelRef = useRef(null);
  const sessionRef = useRef(null);

  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [integrityScore, setIntegrityScore] = useState(100);
  const [detections, setDetections] = useState({ faces: 0, objects: [] });
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
  };

  const endSession = async () => {
    if (sessionRef.current) {
      await updateDoc(sessionRef.current, {
        endTime: serverTimestamp(),
        finalIntegrityScore: integrityScore,
      });
    }
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
    const event = { time: new Date().toLocaleTimeString(), type, message, severity };
    setEvents((prev) => [...prev, event]);
    if (sessionRef.current) {
      await updateDoc(sessionRef.current, { events: arrayUnion(event) });
    }
  };

  const addAlert = async (msg, severity = "warning") => {
    const alert = { time: new Date().toLocaleTimeString(), message: msg, severity };
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
        if (face.landmarks?.length >= 3) {
          const leftEye = face.landmarks[0];
          const rightEye = face.landmarks[1];
          const nose = face.landmarks[2];
          const eyeSlope = Math.abs(leftEye[1] - rightEye[1]);
          const faceWidth = Math.abs(rightEye[0] - leftEye[0]);
          const noseOffset = Math.abs(nose[0] - (leftEye[0] + rightEye[0]) / 2);
          const isFocused = eyeSlope < 10 && noseOffset < faceWidth * 0.3;
          if (!isFocused && Date.now() - lastFocusTime.current > 5000) {
            addEvent("not_focused", "Candidate not looking > 5s", "warning");
            addAlert("👀 Candidate not focused!", "warning");
            lastFocusTime.current = Date.now();
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

  return {
    videoRef,
    events,
    alerts,
    detections,
    integrityScore,
    report,
    startSession,
    endSession,
    generateReport,
  };
};
