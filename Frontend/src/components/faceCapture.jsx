import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

// ICONS
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

// Make sure this matches your backend URL
const API_URL = 'http://localhost:8000'; 

export default function FaceCapture() {
    const webcamRef = useRef(null);
    const [scanState, setScanState] = useState("scanning"); // scanning | verify | success | error
    const [detectedGuest, setDetectedGuest] = useState(null); // { name, seat, tempId }
    const [autoScan, setAutoScan] = useState(true);

    // --- 1. SCAN LOOP ---
    useEffect(() => {
        let interval;
        if (autoScan && scanState === "scanning") {
            interval = setInterval(() => captureAndIdentify(), 2500);
        }
        return () => clearInterval(interval);
    }, [autoScan, scanState]);

    // --- 2. CAPTURE & IDENTIFY ---
    const captureAndIdentify = async () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        try {
            const blob = await (await fetch(imageSrc)).blob();
            const formData = new FormData();
            formData.append('image', blob, 'scan.jpg');

            // Call FAST Endpoint
            const res = await axios.post(`${API_URL}/scan-face`, formData);

            if (res.data.status === "matched") {
                // STOP SCANNING & SHOW POPUP
                setDetectedGuest(res.data);
                setScanState("verify"); 
                new Audio('/ping.mp3').play().catch(()=>{}); 
            }
        } catch (err) {
            console.error("Scan error", err);
        }
    };

    // --- 3. HANDLE CONFIRMATION ---
    const handleConfirm = async () => {
        if (!detectedGuest) return;

        // A. Show Success UI Immediately
        setScanState("success");

        // B. Trigger Background Process (Fire & Forget)
        try {
            await axios.post(`${API_URL}/confirm-visit`, {
                name: detectedGuest.name,
                tempId: detectedGuest.tempId
            });
            console.log("Background processing started...");
        } catch (err) {
            console.error("Failed to start processing");
        }

        // C. Reset after 3 seconds
        setTimeout(() => {
            setScanState("scanning");
            setDetectedGuest(null);
        }, 3000);
    };

    const handleReject = () => {
        setScanState("scanning");
        setDetectedGuest(null);
    };

    return (
        <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 relative w-full aspect-video">
            
            {/* WEBCAM LAYER */}
            <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                className={`w-full h-full object-cover transition-opacity duration-300 ${scanState === "scanning" ? "opacity-100" : "opacity-30 blur-sm"}`}
                videoConstraints={{ facingMode: "user" }}
            />

            {/* OVERLAY: SCANNING LINE */}
            {scanState === "scanning" && (
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,1)] animate-scan" />
            )}

            {/* OVERLAY: VERIFICATION MODAL */}
            {scanState === "verify" && detectedGuest && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 animate-fade-in">
                    <div className="bg-slate-800/90 p-6 rounded-2xl border border-slate-600 text-center shadow-2xl backdrop-blur-md max-w-sm w-full mx-4">
                        <p className="text-slate-400 text-sm uppercase tracking-widest font-bold mb-2">Identify Verification</p>
                        
                        <h2 className="text-3xl font-bold text-white mb-1">{detectedGuest.name}</h2>
                        <div className="bg-slate-700/50 rounded-lg py-2 px-4 inline-block mb-6 border border-slate-600">
                            <span className="text-slate-300">Seat: </span>
                            <span className="text-blue-400 font-bold text-xl">{detectedGuest.seat}</span>
                        </div>

                        <div className="flex gap-3 justify-center">
                            <button 
                                onClick={handleReject}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                            >
                                <CancelIcon /> No / Retry
                            </button>
                            <button 
                                onClick={handleConfirm}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/20"
                            >
                                <CheckCircleIcon /> Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OVERLAY: SUCCESS MESSAGE */}
            {scanState === "success" && detectedGuest && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-green-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white text-green-700 p-8 rounded-full mb-4 shadow-2xl scale-125">
                        <CheckCircleIcon style={{ fontSize: 60 }} />
                    </div>
                    <h2 className="text-4xl font-bold text-white mb-2">Welcome!</h2>
                    <p className="text-green-200 text-lg">Access Granted</p>
                </div>
            )}

        </div>
    );
}