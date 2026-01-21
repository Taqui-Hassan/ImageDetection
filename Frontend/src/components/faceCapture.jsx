import { useRef, useState, useEffect } from "react";
import { Button, Box, CircularProgress, Alert, Typography, Paper, Fade } from "@mui/material";
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import CameraAltIcon from '@mui/icons-material/CameraAlt';

export default function FaceCapture() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [facingMode, setFacingMode] = useState("user");

  useEffect(() => {
    let currentStream = null;
    const startCamera = async () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode } });
        currentStream = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) { console.error("Camera error:", err); }
    };
    startCamera();
    return () => { if (currentStream) currentStream.getTracks().forEach(track => track.stop()); };
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
          method: "POST",
          headers: { "ngrok-skip-browser-warning": "true" },
          body: formData,
        });
        const data = await res.json();
        setResult(data);
      } catch (err) { setResult({ error: "Connection Failed" }); } 
      finally { setLoading(false); }
    }, "image/jpeg");
  };

  return (
    <Paper elevation={4} sx={{ p: 1, borderRadius: 4, overflow: 'hidden', bgcolor: '#000', position: 'relative', maxWidth: 500, mx: 'auto' }}>
      <Box position="relative" display="flex" justifyContent="center">
        {/* VIDEO FEED */}
        <video ref={videoRef} autoPlay playsInline style={{ width: "100%", borderRadius: "16px", opacity: 0.9 }} />
        
        {/* OVERLAY UI */}
        <Button 
            variant="contained" color="inherit" size="small" onClick={() => setFacingMode(prev => (prev === "user" ? "environment" : "user"))}
            sx={{ position: "absolute", top: 15, right: 15, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(5px)', color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.4)' } }}
        >
            <CameraswitchIcon fontSize="small" />
        </Button>
      </Box>

      <canvas ref={canvasRef} style={{ display: "none" }} />
      
      {/* ACTION AREA */}
      <Box sx={{ p: 3, textAlign: 'center', bgcolor: '#fff', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
        <Button 
            variant="contained" 
            size="large" 
            fullWidth
            onClick={recognizeFace} 
            disabled={loading} 
            startIcon={loading ? <CircularProgress size={20} color="inherit"/> : <CameraAltIcon />}
            sx={{ 
                py: 1.5, 
                fontSize: '1.1rem',
                background: 'linear-gradient(45deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)'
            }}
        >
          {loading ? "Processing..." : "Scan Guest"}
        </Button>

        {/* RESULTS */}
        <Box mt={2}>
            <Fade in={!!result}>
                <Box>
                    {result?.status === "matched" && (
                    <Alert severity="success" variant="filled" sx={{ borderRadius: 2 }}>
                        🎉 Welcome, <strong>{result.name}</strong>!<br/> Seat: {result.seat || "N/A"}
                    </Alert>
                    )}
                    {result?.status === "unknown" && (
                    <Alert severity="warning" variant="filled" sx={{ borderRadius: 2 }}>
                        ⚠️ Guest Not Found
                    </Alert>
                    )}
                    {result?.error && <Alert severity="error">{result.error}</Alert>}
                </Box>
            </Fade>
        </Box>
      </Box>
    </Paper>
  );
}