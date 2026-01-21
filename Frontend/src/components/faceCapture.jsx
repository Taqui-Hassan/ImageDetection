import { useRef, useState, useEffect } from "react";
import { Button, Box, CircularProgress, Alert } from "@mui/material";

export default function FaceCapture() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera error:", err);
      }
    };
    startCamera();
  }, []);

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
          // 👇 FIX 1: ADD THIS HEADER TO BYPASS NGROK WARNING
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
          body: formData,
        });
        
        const data = await res.json();
        console.log("Recognition Data:", data); // Debugging log
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
      <video ref={videoRef} autoPlay style={{ width: 400, borderRadius: "8px", border: "2px solid #1976d2" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      
      <Box mt={3}>
        <Button variant="contained" size="large" onClick={recognizeFace} disabled={loading} sx={{ px: 4, py: 1.5, fontWeight: 'bold' }}>
          {loading ? <CircularProgress size={24} color="inherit" /> : "RECOGNIZE & WELCOME"}
        </Button>
      </Box>

      <Box mt={3} width="100%" sx={{ minHeight: '60px' }}>
        
        {/* 👇 FIX 2: LOWERCASE "matched" TO MATCH BACKEND */}
        {result?.status === "matched" && result?.name && (
          <Alert severity="success" variant="filled">
            Welcome, <strong>{result.name}</strong>! WhatsApp message sent.
          </Alert>
        )}

        {/* 👇 FIX 2: LOWERCASE "unknown" TO MATCH BACKEND */}
        {result?.status === "unknown" && (
          <Alert severity="warning" variant="filled">Guest Not Found.</Alert>
        )}

        {/* ERROR CASE */}
        {result?.error && (
          <Alert severity="error">{result.error}</Alert>
        )}
      </Box>
    </Box>
  );
}