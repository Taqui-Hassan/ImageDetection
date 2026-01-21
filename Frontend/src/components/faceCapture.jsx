import { useRef, useState, useEffect } from "react";
import { Button, Box, CircularProgress, Alert } from "@mui/material";

export default function FaceCapture() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // 1. New State for Camera Mode ('user' = Front, 'environment' = Back)
  const [facingMode, setFacingMode] = useState("user");

  useEffect(() => {
    let currentStream = null;

    const startCamera = async () => {
      // Stop any existing stream before starting a new one
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }

      try {
        // 2. Use the facingMode state to pick the camera
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facingMode } 
        });
        
        currentStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
        setResult({ error: "Could not access camera. Allow permissions." });
      }
    };

    startCamera();

    // Cleanup: Stop camera when component unmounts or mode changes
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]); // Re-run this effect when facingMode changes

  // 3. Toggle Function
  const toggleCamera = () => {
    setFacingMode(prev => (prev === "user" ? "environment" : "user"));
  };

  const recognizeFace = async () => {
    if (!videoRef.current) return;
    setLoading(true);
    setResult(null);

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
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
          body: formData,
        });
        
        const data = await res.json();
        console.log("Recognition Data:", data);
        setResult(data);
      } catch (err) {
        console.error(err);
        setResult({ error: "Failed to connect. Is the backend running?" });
      } finally {
        setLoading(false);
      }
    }, "image/jpeg");
  };

  return (
    <Box textAlign="center" display="flex" flexDirection="column" alignItems="center">
      <Box position="relative" display="inline-block">
        <video 
            ref={videoRef} 
            autoPlay 
            playsInline // Important for iOS to not go fullscreen
            style={{ width: "100%", maxWidth: "400px", borderRadius: "8px", border: "2px solid #1976d2" }} 
        />
        
        {/* SWITCH CAMERA BUTTON (Overlay on top right of video) */}
        <Button 
            variant="contained" 
            color="secondary" 
            size="small"
            onClick={toggleCamera}
            sx={{ 
                position: "absolute", 
                top: 10, 
                right: 10, 
                opacity: 0.9,
                fontWeight: "bold"
            }}
        >
            🔄 Switch
        </Button>
      </Box>

      <canvas ref={canvasRef} style={{ display: "none" }} />
      
      <Box mt={3}>
        <Button variant="contained" size="large" onClick={recognizeFace} disabled={loading} sx={{ px: 4, py: 1.5, fontWeight: 'bold' }}>
          {loading ? <CircularProgress size={24} color="inherit" /> : "RECOGNIZE & WELCOME"}
        </Button>
      </Box>

      <Box mt={3} width="100%" sx={{ minHeight: '60px' }}>
        
        {result?.status === "matched" && result?.name && (
          <Alert severity="success" variant="filled">
            Welcome, <strong>{result.name}</strong>! WhatsApp message sent.
          </Alert>
        )}

        {result?.status === "unknown" && (
          <Alert severity="warning" variant="filled">Guest Not Found.</Alert>
        )}

        {result?.error && (
          <Alert severity="error">{result.error}</Alert>
        )}
      </Box>
    </Box>
  );
}