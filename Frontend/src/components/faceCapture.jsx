import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

// ICONS
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CameraswitchIcon from '@mui/icons-material/Cameraswitch'; // 🔄 Switch Camera
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PersonIcon from '@mui/icons-material/Person';

const API_URL = import.meta.env.VITE_API_URL; // Make sure this matches backend

export default function FaceCapture() {
    const webcamRef = useRef(null);
    
    // STATES
    const [scanState, setScanState] = useState("idle"); // idle | scanning | verify | success | error
    const [detectedGuest, setDetectedGuest] = useState(null);
    const [facingMode, setFacingMode] = useState("user"); // 'user' (Front) or 'environment' (Back)

    // --- 1. CAPTURE FUNCTION (Triggered by Button) ---
    const captureAndIdentify = useCallback(async () => {
        if (!webcamRef.current) return;
        
        setScanState("scanning"); // Show spinner

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) {
            setScanState("idle");
            return;
        }

        try {
            // Convert Base64 to Blob
            const blob = await (await fetch(imageSrc)).blob();
            const formData = new FormData();
            formData.append('image', blob, 'scan.jpg');

            // Send to Fast Scan Endpoint
            const res = await axios.post(`${API_URL}/scan-face`, formData);

            if (res.data.status === "matched") {
                setDetectedGuest(res.data);
                setScanState("verify"); // 🛑 SHOW POPUP
                new Audio('/ping.mp3').play().catch(()=>{}); 
            } else {
                setScanState("error"); // Show "Unknown Guest"
                setTimeout(() => setScanState("idle"), 2000); // Reset after 2s
            }
        } catch (err) {
            console.error("Scan error", err);
            setScanState("idle");
            alert("Connection Error");
        }
    }, [webcamRef]);

    // --- 2. HANDLE CONFIRMATION (Trigger Background Process) ---
    const handleConfirm = async () => {
        if (!detectedGuest) return;

        // Show Success UI
        setScanState("success");

        // Fire & Forget Background Process
        try {
            await axios.post(`${API_URL}/confirm-visit`, {
                name: detectedGuest.name,
                tempId: detectedGuest.tempId
            });
            console.log("Background processing started...");
        } catch (err) { console.error("BG Process Failed"); }

        // Reset after 3 seconds
        setTimeout(() => {
            setScanState("idle");
            setDetectedGuest(null);
        }, 3000);
    };

    const handleReject = () => {
        setScanState("idle");
        setDetectedGuest(null);
    };

    // --- 3. SWITCH CAMERA (Front/Back) ---
    const toggleCamera = () => {
        setFacingMode(prev => prev === "user" ? "environment" : "user");
    };

    return (
        <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-700 relative w-full aspect-[9/16] md:aspect-video flex flex-col">
            
            {/* --- WEBCAM LAYER --- */}
            <div className="relative flex-1 overflow-hidden">
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ 
                        facingMode: facingMode,
                        width: { ideal: 1280 }, // HD
                        height: { ideal: 720 }
                    }}
                    className="w-full h-full object-cover"
                    playsInline={true} // CRITICAL FOR IPHONE/MOBILE
                    mirrored={facingMode === "user"} // Mirror only front camera
                />
                
                {/* Switch Camera Button (Top Right) */}
                <button 
                    onClick={toggleCamera}
                    className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/20 transition-all z-10"
                >
                    <CameraswitchIcon />
                </button>
            </div>

            {/* --- OVERLAYS --- */}

            {/* 1. SCANNING SPINNER */}
            {scanState === "scanning" && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
                </div>
            )}

            {/* 2. VERIFY POPUP (The Feature You Liked) */}
            {scanState === "verify" && detectedGuest && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-fade-in bg-black/60 backdrop-blur-md p-4">
                    <div className="bg-slate-800 border border-slate-600 p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Confirm Identity</p>
                        
                        <h2 className="text-3xl font-bold text-white mb-2">{detectedGuest.name}</h2>
                        <div className="bg-blue-600/20 text-blue-300 px-4 py-2 rounded-lg font-mono text-xl font-bold inline-block mb-8 border border-blue-500/30">
                            Seat: {detectedGuest.seat}
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={handleReject}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                            >
                                <CancelIcon /> Retry
                            </button>
                            <button 
                                onClick={handleConfirm}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                            >
                                <CheckCircleIcon /> Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. SUCCESS SCREEN */}
            {scanState === "success" && (
                <div className="absolute inset-0 z-30 bg-green-600 flex flex-col items-center justify-center text-white animate-fade-in">
                    <CheckCircleIcon style={{ fontSize: 80 }} className="mb-4 drop-shadow-md" />
                    <h2 className="text-4xl font-bold">Welcome {detectedGuest.name} San</h2>
                    <h2 className="text-4xl font-bold">Sear : {detectedGuest.seat} San</h2>
                    <p className="opacity-80 mt-2">Processing Ticket...</p>
                </div>
            )}

            {/* 4. ERROR / UNKNOWN SCREEN */}
            {scanState === "error" && (
                <div className="absolute inset-0 z-30 bg-red-600/90 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-fade-in">
                    <PersonIcon style={{ fontSize: 80 }} className="mb-4" />
                    <h2 className="text-3xl font-bold">Unknown Face</h2>
                    <p className="opacity-80 mt-2">Please try again.</p>
                </div>
            )}

            {/* --- BOTTOM CONTROLS --- */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
                {scanState === "idle" && (
                    <button 
                        onClick={captureAndIdentify}
                        className="bg-white text-black rounded-full p-5 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-110 active:scale-95 transition-all border-4 border-slate-200"
                    >
                        <CameraAltIcon style={{ fontSize: 40 }} />
                    </button>
                )}
            </div>

        </div>
    );
}