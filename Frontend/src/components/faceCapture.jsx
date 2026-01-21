import { useRef, useState, useEffect } from "react";
import { Button, Box, CircularProgress, Typography, Paper, Fade, IconButton } from "@mui/material";
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';

export default function FaceCapture() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [facingMode, setFacingMode] = useState("user");

  useEffect(() => {
    let currentStream = null;
    const startCamera = async () => {
        if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
            if (videoRef.current) videoRef.current.srcObject = stream;
            currentStream = stream;
        } catch (err) { console.error(err); }
    };
    startCamera();
    return () => currentStream?.getTracks().forEach(t => t.stop());
  }, [facingMode]);

  const recognizeFace = async () => {
    if (!videoRef.current) return;
    setLoading(true); setResult(null);
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("image", blob, "capture.jpg");
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/recognize-guest`, {
            method: "POST", headers: { "ngrok-skip-browser-warning": "true" }, body: formData
        });
        setResult(await res.json());
      } catch (err) { setResult({ error: "System Offline" }); } 
      finally { setLoading(false); }
    }, "image/jpeg");
  };

  return (
    <Paper sx={{ p: 2, bgcolor: '#000', borderRadius: 4, overflow: 'hidden', position: 'relative', border: '1px solid #334155' }}>
        {/* HEADER */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} px={1}>
            <Box display="flex" alignItems="center" gap={1}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444', animation: 'pulse 2s infinite' }} />
                <Typography variant="h6" color="textSecondary" fontSize="0.75rem">LIVE FEED // REC</Typography>
            </Box>
            <IconButton size="small" onClick={() => setFacingMode(prev => prev === "user" ? "environment" : "user")} sx={{ color: '#94a3b8', border: '1px solid #334155' }}>
                <CameraswitchIcon fontSize="small" />
            </IconButton>
        </Box>

        {/* VIEWFINDER */}
        <Box sx={{ position: 'relative', borderRadius: 3, overflow: 'hidden', bgcolor: '#0f172a', aspectRatio: '4/3' }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
            
            {/* SCANNING OVERLAY */}
            {loading && (
                <Box sx={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'linear-gradient(to bottom, transparent, rgba(59, 130, 246, 0.5), transparent)',
                    animation: 'scan 1.2s linear infinite',
                    '@keyframes scan': { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100%)' } }
                }} />
            )}
            
            {/* CORNER BRACKETS */}
            <Box sx={{ position: 'absolute', top: 20, left: 20, width: 40, height: 40, borderTop: '2px solid rgba(255,255,255,0.3)', borderLeft: '2px solid rgba(255,255,255,0.3)' }} />
            <Box sx={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderTop: '2px solid rgba(255,255,255,0.3)', borderRight: '2px solid rgba(255,255,255,0.3)' }} />
            <Box sx={{ position: 'absolute', bottom: 20, left: 20, width: 40, height: 40, borderBottom: '2px solid rgba(255,255,255,0.3)', borderLeft: '2px solid rgba(255,255,255,0.3)' }} />
            <Box sx={{ position: 'absolute', bottom: 20, right: 20, width: 40, height: 40, borderBottom: '2px solid rgba(255,255,255,0.3)', borderRight: '2px solid rgba(255,255,255,0.3)' }} />
        </Box>
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* CONTROLS */}
        <Box mt={2}>
            <Button fullWidth variant="contained" size="large" onClick={recognizeFace} disabled={loading} startIcon={!loading && <CameraAltIcon />}
                sx={{ py: 2, bgcolor: '#fff', color: '#000', '&:hover': { bgcolor: '#e2e8f0' } }}>
                {loading ? "PROCESSING..." : "CAPTURE"}
            </Button>
        </Box>

        {/* TECH RESULT CARD */}
        {result && (
            <Fade in={true}>
                <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: result.status === 'matched' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${result.status === 'matched' ? '#10b981' : '#ef4444'}` }}>
                    <Box display="flex" alignItems="center" gap={2}>
                        {result.status === 'matched' ? <CheckCircleIcon sx={{ color: '#10b981' }} /> : <WarningIcon sx={{ color: '#ef4444' }} />}
                        <Box>
                            <Typography variant="subtitle2" sx={{ color: result.status === 'matched' ? '#10b981' : '#ef4444', textTransform: 'uppercase', fontWeight: 'bold' }}>
                                {result.status === 'matched' ? 'IDENTITY VERIFIED' : 'NO MATCH FOUND'}
                            </Typography>
                            {result.name && (
                                <Typography variant="h5" color="white" fontWeight="bold">
                                    {result.name}
                                </Typography>
                            )}
                            {result.seat && (
                                <Typography variant="body2" sx={{ color: '#94a3b8', fontFamily: 'monospace', mt: 0.5 }}>
                                    SEAT ASSIGNMENT: <span style={{ color: '#fff' }}>{result.seat}</span>
                                </Typography>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Fade>
        )}
    </Paper>
  );
}