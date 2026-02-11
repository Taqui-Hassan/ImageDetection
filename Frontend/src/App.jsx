import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import GuestList from './components/GuestList';
import QRCode from 'react-qr-code'; // Ensure you have this: npm install react-qr-code

// --- CONFIGURATION ---
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const webcamRef = useRef(null);
  const [scannedName, setScannedName] = useState(null);
  const [status, setStatus] = useState("Ready to Scan");
  const [loading, setLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  
  // WHATSAPP STATES
  const [waConnected, setWaConnected] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [showQrModal, setShowQrModal] = useState(false); // 🆕 Control visibility

  // --- POLL SYSTEM STATUS (Check for QR / Connection) ---
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await axios.get(`${API_URL}/system-status`);
        setWaConnected(res.data.whatsapp);
        setQrCode(res.data.qr);
        
        // Auto-close modal if connected
        if (res.data.whatsapp) setShowQrModal(false);
      } catch (err) {
        console.error("Status check failed", err);
      }
    };
    
    const interval = setInterval(checkStatus, 2000); // Check every 2 seconds
    return () => clearInterval(interval);
  }, []);

  // --- CAPTURE & SEND TO AI ---
  const captureAndCheck = async () => {
    if (!webcamRef.current || loading) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setLoading(true);
    setStatus("🔍 Analyzing...");

    try {
      const blob = await (await fetch(imageSrc)).blob();
      const formData = new FormData();
      formData.append('image', blob, 'capture.jpg');

      const res = await axios.post(`${API_URL}/recognize-guest`, formData);

      if (res.data.status === 'matched') {
        setScannedName(res.data.name);
        setStatus(`✅ Welcome, ${res.data.name}!`);
        new Audio('/success.mp3').play().catch(() => {});
      } else {
        setStatus("❌ Face not recognized");
      }
    } catch (err) {
      console.error(err);
      setStatus("⚠️ Server Error");
    } finally {
      setLoading(false);
      if (autoMode) setTimeout(() => captureAndCheck(), 2000);
    }
  };

  useEffect(() => {
    if (autoMode) {
      const interval = setInterval(() => {
        if (!loading) captureAndCheck();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [autoMode, loading]);

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-6 relative">
      
      {/* HEADER */}
      <header className="mb-8 flex justify-between items-center bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            🚀 Event Manager AI
          </h1>
          <p className="text-slate-400 text-xs">Photoroom Edition</p>
        </div>
        
        <div className="flex items-center gap-4">
            {/* WHATSAPP BUTTON */}
            <button 
                onClick={() => !waConnected && setShowQrModal(true)}
                className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 ${
                    waConnected 
                    ? 'bg-green-500/20 border-green-500 text-green-400 cursor-default' 
                    : 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30'
                }`}
            >
                {waConnected ? "🟢 WhatsApp Active" : "🔴 Connect WhatsApp"}
            </button>

            <button 
                onClick={() => setAutoMode(!autoMode)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${autoMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
                {autoMode ? "🔄 Auto-Scan ON" : "⏸️ Paused"}
            </button>
        </div>
      </header>

      {/* 🟢 QR CODE MODAL (The Fix) */}
      {showQrModal && !waConnected && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center relative animate-fade-in">
                <button 
                    onClick={() => setShowQrModal(false)}
                    className="absolute top-2 right-2 text-gray-500 hover:text-black font-bold text-xl px-2"
                >
                    ✕
                </button>
                <h2 className="text-slate-900 text-xl font-bold mb-2">Scan with WhatsApp</h2>
                <p className="text-slate-500 text-xs mb-4">Open WhatsApp on your phone {'>'} Settings {'>'} Linked Devices</p>
                
                <div className="bg-white p-2 inline-block border-2 border-slate-200 rounded-lg">
                    {qrCode ? (
                        <QRCode value={qrCode} size={256} />
                    ) : (
                        <div className="w-64 h-64 flex items-center justify-center text-slate-400 animate-pulse bg-slate-100 rounded">
                            Loading QR...
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-slate-800 p-4 rounded-2xl shadow-2xl border border-slate-700 relative overflow-hidden group">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="w-full rounded-xl border-2 border-slate-600 group-hover:border-blue-500 transition-colors"
              videoConstraints={{ facingMode: "user" }}
            />
            {loading && <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan z-20" />}
          </div>
          {scannedName && (
             <div className="bg-gradient-to-r from-green-900/50 to-slate-800 p-6 rounded-2xl border border-green-500/30 animate-fade-in">
               <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Just Verified</h3>
               <p className="text-3xl font-bold text-white">{scannedName}</p>
             </div>
          )}
        </div>

        <div className="lg:col-span-8">
           <GuestList />
        </div>
      </div>
    </div>
  );
}

export default App;