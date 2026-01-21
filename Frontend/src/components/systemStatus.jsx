import React, { useState, useEffect } from 'react';
import { Paper, Box, Typography, Chip, CircularProgress, Fade } from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import QrCodeIcon from '@mui/icons-material/QrCode';

export default function SystemStatus() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    // Poll status every 3 seconds
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/system-status`, {
                    headers: { "ngrok-skip-browser-warning": "true" }
                });
                const data = await res.json();
                setStatus(data);
            } catch (err) {
                console.error("Status check failed");
            } finally {
                setLoading(false);
            }
        };

        checkStatus(); // Initial run
        const interval = setInterval(checkStatus, 3000); // Loop
        return () => clearInterval(interval);
    }, []);

    if (loading || !status) return null;

    return (
        <Fade in={true}>
            <Paper sx={{ 
                p: 2, 
                mb: 4, 
                border: '1px solid #334155', 
                bgcolor: '#0f172a', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2
            }}>
                {/* LEFT: Connection Status */}
                <Box display="flex" alignItems="center" gap={2}>
                    <Box sx={{ position: 'relative' }}>
                        {status.whatsapp 
                            ? <WifiIcon sx={{ color: '#10b981', fontSize: 30 }} /> 
                            : <WifiOffIcon sx={{ color: '#ef4444', fontSize: 30 }} />
                        }
                        <Box sx={{ 
                            position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', 
                            bgcolor: status.whatsapp ? '#10b981' : '#ef4444', 
                            boxShadow: `0 0 10px ${status.whatsapp ? '#10b981' : '#ef4444'}` 
                        }} />
                    </Box>
                    <Box>
                        <Typography variant="subtitle2" color="white" fontWeight="bold">
                            WHATSAPP LINK
                        </Typography>
                        <Typography variant="caption" sx={{ color: status.whatsapp ? '#10b981' : '#ef4444' }}>
                            {status.whatsapp ? `CONNECTED: ${status.user}` : "DISCONNECTED"}
                        </Typography>
                    </Box>
                </Box>

                {/* MIDDLE: Battery (If connected) */}
                {status.whatsapp && status.battery && (
                    <Chip 
                        icon={<BatteryChargingFullIcon />} 
                        label={`${status.battery.battery}% Phone Battery`} 
                        variant="outlined" 
                        sx={{ color: '#94a3b8', borderColor: '#334155' }} 
                    />
                )}

                {/* RIGHT: QR Code (If disconnected) */}
                {!status.whatsapp && status.qr && (
                    <Box sx={{ textAlign: 'center', bgcolor: '#fff', p: 1, borderRadius: 2 }}>
                        <Typography variant="caption" color="black" display="block" mb={0.5}>SCAN ME</Typography>
                        {/* Use free API to render QR */}
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(status.qr)}`} 
                            alt="Scan QR" 
                            style={{ width: 100, height: 100 }} 
                        />
                    </Box>
                )}
                
                {!status.whatsapp && !status.qr && (
                     <Box display="flex" alignItems="center" gap={1} color="#f59e0b">
                        <CircularProgress size={16} color="inherit" />
                        <Typography variant="caption">INITIALIZING CLIENT...</Typography>
                     </Box>
                )}
            </Paper>
        </Fade>
    );
}