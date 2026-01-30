import React, { useState, useEffect } from 'react';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';

export default function SystemStatus() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/system-status`, { headers: { "ngrok-skip-browser-warning": "true" } });
                const data = await res.json();
                setStatus(data);
            } catch (err) {} finally { setLoading(false); }
        };
        checkStatus();
        const interval = setInterval(checkStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !status) return null;

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
            
            {/* Left: Connection */}
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative">
                    {status.whatsapp 
                        ? <WifiIcon className="text-green-500" style={{ fontSize: 32 }} /> 
                        : <WifiOffIcon className="text-red-500" style={{ fontSize: 32 }} />
                    }
                    <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${status.whatsapp ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></span>
                </div>
                <div>
                    <h4 className="text-sm font-bold text-white tracking-wide">WHATSAPP LINK</h4>
                    <p className={`text-xs font-mono ${status.whatsapp ? 'text-green-400' : 'text-red-400'}`}>
                        {status.whatsapp ? `CONNECTED: ${status.user}` : "DISCONNECTED"}
                    </p>
                </div>
            </div>

            

            {/* Right: QR Code */}
            {!status.whatsapp && status.qr && (
                <div className="bg-white p-2 rounded-lg shadow-inner">
                    <p className="text-[10px] text-center text-black font-bold mb-1">SCAN ME</p>
                    <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(status.qr)}`} 
                        alt="Scan QR" 
                        className="w-60 h-60" 
                    />
                </div>
            )}
        </div>
    );
}