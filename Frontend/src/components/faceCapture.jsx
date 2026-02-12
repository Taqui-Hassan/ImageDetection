import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

// ICONS
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CameraswitchIcon from '@mui/icons-material/Cameraswitch'; 
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PersonIcon from '@mui/icons-material/Person';
import KeyboardIcon from '@mui/icons-material/Keyboard'; // ⌨️ New Icon
import SearchIcon from '@mui/icons-material/Search';

const API_URL = import.meta.env.VITE_API_URL; 

export default function FaceCapture() {
    const webcamRef = useRef(null);
    
    // STATES
    const [scanState, setScanState] = useState("idle"); // idle | scanning | verify | success | error | manual
    const [detectedGuest, setDetectedGuest] = useState(null);
    const [facingMode, setFacingMode] = useState("user");
    const [manualPhone, setManualPhone] = useState(""); // 🔢 Stores phone input

    // --- 1. AI SCAN FUNCTION ---
    const captureAndIdentify = useCallback(async () => {
        if (!webcamRef.current) return;
        setScanState("scanning");

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) { setScanState("idle"); return; }

        try {
            const blob = await (await fetch(imageSrc)).blob();
            const formData = new FormData();
            formData.append('image', blob, 'scan.jpg');

            const res = await axios.post(`${API_URL}/scan-face`, formData);

            if (res.data.status === "matched") {
                setDetectedGuest(res.data);
                setScanState("verify");
                new Audio('/ping.mp3').play().catch(()=>{}); 
            } else {
                setScanState("error");
                setTimeout(() => setScanState("idle"), 2000);
            }
        } catch (err) {
            console.error(err);
            setScanState("idle");
        }
    }, [webcamRef]);

    // --- 2. MANUAL PHONE SUBMIT (NEW FEATURE) ---
    const handleManualSubmit = async (e) => {
        e.preventDefault();
        if (!manualPhone || manualPhone.length < 4) return;
        
        setScanState("scanning"); // Show loading

        // 📸 CAPTURE PHOTO ANYWAY (So we can send it to WhatsApp)
        const imageSrc = webcamRef.current.getScreenshot();
        
        try {
            const blob = await (await fetch(imageSrc)).blob();
            const formData = new FormData();
            formData.append('image', blob, 'manual.jpg');
            formData.append('phone', manualPhone); // Send phone too

            const res = await axios.post(`${API_URL}/manual-entry`, formData);

            if (res.data.status === "matched") {
                setDetectedGuest(res.data);
                setScanState("verify"); // Go to same verification screen
                new Audio('/ping.mp3').play().catch(()=>{}); 
            } else {
                alert("Phone number not found in Guest List!");
                setScanState("manual"); // Go back to input
            }
        } catch (err) {
            alert("Connection Error");
            setScanState("manual");
        }
    };

    // --- 3. HANDLE CONFIRMATION (Shared by AI & Manual) ---
    const handleConfirm = async () => {
        if (!detectedGuest) return;
        setScanState("success");

        try {
            await axios.post(`${API_URL}/confirm-visit`, {
                name: detectedGuest.name,
                tempId: detectedGuest.tempId
            });
        } catch (err) { console.error("BG Process Failed"); }

        setTimeout(() => {
            setScanState("idle");
            setDetectedGuest(null);
            setManualPhone("");
        }, 3000);
    };

    const handleReject = () => {
        setScanState("idle");
        setDetectedGuest(null);
        setManualPhone("");
    };

    const toggleCamera = () => setFacingMode(prev => prev === "user" ? "environment" : "user");

    return (
        <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-700 relative w-full aspect-[9/16] md:aspect-video flex flex-col">
            
            {/* WEBCAM LAYER */}
            <div className="relative flex-1 overflow-hidden">
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }}
                    className="w-full h-full object-cover"
                    playsInline={true} 
                    mirrored={facingMode === "user"} 
                />
                
                <button onClick={toggleCamera} className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-3 rounded-full text-white z-10">
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

            {/* 2. VERIFY POPUP (Works for AI & Manual) */}
            {scanState === "verify" && detectedGuest && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-fade-in bg-black/60 backdrop-blur-md p-4">
                    <div className="bg-slate-800 border border-slate-600 p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Confirm Identity</p>
                        <h2 className="text-3xl font-bold text-white mb-2">{detectedGuest.name}</h2>
                        <div className="bg-blue-600/20 text-blue-300 px-4 py-2 rounded-lg font-mono text-xl font-bold inline-block mb-8 border border-blue-500/30">
                            Seat: {detectedGuest.seat}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleReject} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                                <CancelIcon /> Retry
                            </button>
                            <button onClick={handleConfirm} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
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
                    <h2 className="text-4xl font-bold">Welcome!</h2>
                    <p className="opacity-80 mt-2">Processing Ticket...</p>
                </div>
            )}

            {/* 4. ERROR SCREEN */}
            {scanState === "error" && (
                <div className="absolute inset-0 z-30 bg-red-600/90 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-fade-in">
                    <PersonIcon style={{ fontSize: 80 }} className="mb-4" />
                    <h2 className="text-3xl font-bold">Unknown Face</h2>
                    <p className="opacity-80 mt-2">Please try again or use manual entry.</p>
                </div>
            )}

            {/* 5. MANUAL PHONE INPUT SCREEN */}
            {scanState === "manual" && (
                <div className="absolute inset-0 z-30 bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in">
                    <h2 className="text-2xl font-bold text-white mb-6">Manual Entry</h2>
                    <form onSubmit={handleManualSubmit} className="w-full max-w-xs">
                        <input 
                            type="tel" 
                            placeholder="Enter last 10 digits of Phone" 
                            className="w-full bg-slate-800 border border-slate-600 text-white text-xl text-center py-4 rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={manualPhone}
                            onChange={e => setManualPhone(e.target.value)}
                            autoFocus
                        />
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg mb-3">
                            <SearchIcon /> Look Up Guest
                        </button>
                        <button type="button" onClick={() => setScanState("idle")} className="w-full text-slate-400 font-bold py-3">
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            {/* --- BOTTOM CONTROLS --- */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-6 z-10">
                {scanState === "idle" && (
                    <>
                        {/* Manual Button */}
                        <button 
                            onClick={() => setScanState("manual")}
                            className="bg-slate-800/80 backdrop-blur text-white rounded-full p-4 shadow-lg hover:bg-slate-700 transition-all"
                        >
                            <KeyboardIcon fontSize="large" />
                        </button>

                        {/* Scan Button (Center) */}
                        <button 
                            onClick={captureAndIdentify}
                            className="bg-white text-black rounded-full p-6 shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:scale-110 active:scale-95 transition-all border-4 border-slate-200"
                        >
                            <CameraAltIcon style={{ fontSize: 40 }} />
                        </button>

                        {/* Dummy Spacer to balance layout */}
                        <div className="w-[60px]"></div>
                    </>
                )}
            </div>

        </div>
    );
}