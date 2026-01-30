import React, { useState } from 'react';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

export default function UploadExcel() {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState(null); // 'success' | 'error'
    const [message, setMessage] = useState("");

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setStatus(null);
        setMessage("");
    };

    const handleUpload = async () => {
        if (!file) {
            setStatus("error");
            setMessage("Please select a file first.");
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/upload-excel`, {
                method: "POST",
                body: formData,
                headers: {
                    "ngrok-skip-browser-warning": "true"
                }
            });
            const data = await res.json();

            if (data.status === "success") {
                setStatus("success");
                setMessage(`Successfully enrolled ${data.enrolled} guests!`);
                setFile(null); // Clear input
            } else {
                throw new Error(data.message || "Upload failed");
            }
        } catch (err) {
            console.error(err);
            setStatus("error");
            setMessage("Upload Failed. Check backend connection.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
            <div className="text-center mb-8">
                <CloudUploadIcon className="text-blue-500 mb-4" style={{ fontSize: 60 }} />
                <h2 className="text-2xl font-bold text-white mb-2">Import Guest List</h2>
                <p className="text-slate-400">Upload an Excel (.xlsx) file with columns: <b>Name, Phone, Seat</b></p>
            </div>

            <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:bg-slate-700/30 transition-colors relative">
                <input 
                    type="file" 
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                {file ? (
                    <div className="text-blue-300 font-medium">
                        <span className="text-2xl block mb-2">📄</span>
                        {file.name}
                    </div>
                ) : (
                    <div className="text-slate-500">
                        <p className="font-bold">Click to Browse</p>
                        <p className="text-sm">or drag and drop file here</p>
                    </div>
                )}
            </div>

            {/* STATUS MESSAGES */}
            {status === 'success' && (
                <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3 text-green-400">
                    <CheckCircleIcon />
                    <span>{message}</span>
                </div>
            )}

            {status === 'error' && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
                    <ErrorIcon />
                    <span>{message}</span>
                </div>
            )}

            <button
                onClick={handleUpload}
                disabled={uploading || !file}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                {uploading ? "Uploading..." : "Upload List"}
            </button>
        </div>
    );
}