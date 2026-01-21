import { useRef, useState, useEffect } from "react";
import { Button, Box, CircularProgress, Typography, Paper, Fade, IconButton } from "@mui/material";
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PersonOffIcon from '@mui/icons-material/PersonOff';

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

  // --- CUSTOM RESULT ALERTS (Holographic Style) ---
  const HolographicAlert = ({ icon, title, subtitle, color }) => (
      <Fade in={true}>
          <Box sx={{
              mt: 3,
              p: 2,
              borderRadius: 3,
              background: `linear-gradient(135deg, rgba(${color}, 0.2) 0%, rgba(${color}, 0.05) 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid rgba(${color}, 0.3)`,
              boxShadow: `0 0 20px rgba(${color}, 0.2)`,
              display: 'flex',
              alignItems: 'center',
              gap: 2
          }}>
              {icon}
              <Box>
                  <Typography variant="h6" color="white" fontWeight="bold" sx={{ textShadow: `0 0 10px rgba(${color},0.8)` }}>
                      {title}
                  </Typography>
                  {subtitle && <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>{subtitle}</Typography>}
              </Box>
          </Box>
      </Fade>
  );

  return (
    // --- MAIN ASTRA CONTAINER ---
    <Box sx={{
        position: 'relative',
        // 👇 REPLACE THIS URL WITH YOUR OWN LOCAL IMAGE FOR PRODUCTION
        backgroundImage: 'url(https://images.unsplash.com/photo-1534796636912-3b95b3ab5980?q=80&w=2072&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 4,
        overflow: 'hidden',
        p: { xs: 2, md: 4 }, // Padding responsive
        boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.5)',
    }}>
        {/* Dark Overlay to make text pop */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bg: '#000', opacity: 0.4, zIndex: 0 }} />

        {/* --- GLASSMORPHISM SCANNER CARD --- */}
        <Paper elevation={0} sx={{
            position: 'relative',
            zIndex: 1,
            p: 1,
            borderRadius: 3,
            background: 'rgba(20, 20, 40, 0.6)', // Dark, semi-transparent blue
            backdropFilter: 'blur(12px)', // The frosted glass effect
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            maxWidth: 500,
            mx: 'auto'
        }}>
            {/* HEADER TEXT */}
            <Typography variant="h6" align="center" sx={{ color: '#fff', mb: 2, letterSpacing: 2, fontWeight: 'bold', textShadow: '0 0 10px #00d2ff' }}>
                ASTRA ID SCANNER
            </Typography>

            {/* VIDEO VIEWPORT (Sci-fi Border) */}
            <Box sx={{
                position: 'relative',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '2px solid rgba(0, 210, 255, 0.5)', // Cyan border
                boxShadow: '0 0 25px rgba(0, 210, 255, 0.3), inset 0 0 15px rgba(0,210,255,0.2)', // Cyan glow
            }}>
                <video ref={videoRef} autoPlay playsInline style={{ width: "100%", display: 'block', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
                
                {/* Switch Camera Button (Floating) */}
                <IconButton onClick={() => setFacingMode(prev => (prev === "user" ? "environment" : "user"))}
                    sx={{
                        position: "absolute", top: 10, right: 10,
                        color: '#fff',
                        bg: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(5px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        '&:hover': { bg: 'rgba(0,210,255,0.3)', boxShadow: '0 0 15px #00d2ff' }
                    }}
                >
                    <CameraswitchIcon />
                </IconButton>

                {/* Scanning Line Animation overlay */}
                {loading && (
                    <Box sx={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'linear-gradient(to bottom, transparent, rgba(0, 210, 255, 0.4), transparent)',
                        animation: 'scan 1.5s linear infinite',
                        '@keyframes scan': {
                            '0%': { transform: 'translateY(-100%)' },
                            '100%': { transform: 'translateY(100%)' }
                        }
                    }}/>
                )}
            </Box>
            <canvas ref={canvasRef} style={{ display: "none" }} />
            
            {/* SCAN BUTTON AREA */}
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Button 
                    variant="contained" 
                    size="large" 
                    fullWidth
                    onClick={recognizeFace} 
                    disabled={loading} 
                    startIcon={loading ? <CircularProgress size={24} sx={{ color: '#00d2ff' }}/> : <CameraAltIcon />}
                    sx={{ 
                        py: 1.5, 
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        color: '#fff',
                        // Neon Gradient
                        background: 'linear-gradient(45deg, #00d2ff, #3a7bd5)',
                        border: '1px solid rgba(0, 210, 255, 0.5)',
                        boxShadow: '0 0 20px rgba(0, 210, 255, 0.5)',
                        '&:hover': {
                            background: 'linear-gradient(45deg, #00d2ff, #3a7bd5)',
                            boxShadow: '0 0 40px rgba(0, 210, 255, 0.8)',
                        },
                        '&:disabled': {
                            background: 'rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.3)'
                        }
                    }}
                >
                    {loading ? "ANALYZING..." : "INITIATE SCAN"}
                </Button>

                {/* RESULTS DISPLAY */}
                <Box mt={2} minHeight={80}>
                    {result?.status === "matched" && result?.name && (
                        <HolographicAlert 
                            color="46, 204, 113" // Green RGB
                            icon={<CheckCircleIcon sx={{ color: '#2ecc71', fontSize: 40, filter: 'drop-shadow(0 0 10px #2ecc71)' }} />}
                            title={`WELCOME, ${result.name.toUpperCase()}`}
                            subtitle={`Seat Assigned: ${result.seat || "N/A"}`}
                        />
                    )}

                    {result?.status === "unknown" && (
                         <HolographicAlert 
                            color="231, 76, 60" // Red RGB
                            icon={<PersonOffIcon sx={{ color: '#e74c3c', fontSize: 40, filter: 'drop-shadow(0 0 10px #e74c3c)' }} />}
                            title="IDENTITY UNKNOWN"
                            subtitle="Access Denied. Please see registration."
                        />
                    )}

                    {result?.error && (
                         <HolographicAlert 
                            color="241, 196, 15" // Yellow RGB
                            icon={<ErrorIcon sx={{ color: '#f1c40f', fontSize: 40, filter: 'drop-shadow(0 0 10px #f1c40f)' }} />}
                            title="SYSTEM ERROR"
                            subtitle={result.error}
                        />
                    )}
                </Box>
            </Box>
        </Paper>
    </Box>
  );
}