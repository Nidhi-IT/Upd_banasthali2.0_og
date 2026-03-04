import React, { useRef, useState, useEffect } from 'react';
import { ShieldAlert, Camera, ScanFace, CheckCircle, XCircle, Clock } from 'lucide-react';

const GuardDashboard = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isLiveFeedActive, setIsLiveFeedActive] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  
  const [updateMessage, setUpdateMessage] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [recentVisitors, setRecentVisitors] = useState([]);

  const fetchVisitors = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/visitors');
      if (response.ok) {
        const data = await response.json();
        setRecentVisitors(data);
      }
    } catch (error) {
      console.error("Error fetching visitors:", error);
    }
  };

  useEffect(() => {
    fetchVisitors();
    const interval = setInterval(fetchVisitors, 5000);
    return () => clearInterval(interval);
  }, []);

  const startLiveFeed = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsLiveFeedActive(true);
        setScanResult(null);
        setUpdateMessage(null);
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      alert("Could not access the camera. Please allow permissions.");
    }
  };

  const handleLiveEntryTest = async () => {
    if (!isLiveFeedActive || !videoRef.current) return;

    setIsScanning(true);
    setScanResult(null);
    setUpdateMessage(null);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64Image = canvas.toDataURL('image/jpeg');

    try {
      const response = await fetch('http://localhost:5000/api/admin/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveFrame: base64Image })
      });

      const data = await response.json();
      setScanResult(data);
    } catch (error) {
      console.error("Scanning error:", error);
      setScanResult({ success: false, message: "Server error during scanning." });
    } finally {
      setIsScanning(false);
    }
  };

  const handleStatusUpdate = async (visitorId, newStatus) => {
    setIsUpdating(true);
    setUpdateMessage(null);
    try {
      const response = await fetch(`http://localhost:5000/api/admin/status/${visitorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      const data = await response.json();
      if (response.ok) {
        setUpdateMessage(`✅ Form successfully ${newStatus}!`);
        if (scanResult && scanResult.visitor && scanResult.visitor._id === visitorId) {
          setScanResult(prev => ({
            ...prev,
            visitor: { ...prev.visitor, status: newStatus }
          }));
        }
        fetchVisitors(); 
      } else {
        setUpdateMessage(`❌ Failed to update: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Update error:", error);
      setUpdateMessage("❌ Server error while updating status.");
    } finally {
      setIsUpdating(false);
      setTimeout(() => setUpdateMessage(null), 3000);
    }
  };

  const pendingForms = recentVisitors.filter(v => v.status === 'pending_review' || !v.status);

  return (
    <div className="min-h-screen bg-gray-900 p-8 pt-28 text-white">
      <div className="max-w-6xl mx-auto">
        
        <header className="mb-8 flex items-center justify-between border-b border-gray-700 pb-4">
          <div>
            <h1 className="text-3xl font-black text-blue-400">Security Guard Dashboard</h1>
            <p className="text-gray-400">Entry Shield Live Monitor & Gate Control</p>
          </div>
          <ShieldAlert className="text-blue-500 w-10 h-10" />
        </header>

        {updateMessage && (
          <div className="mb-6 p-4 rounded-lg font-bold text-center bg-blue-900/30 text-blue-300 border border-blue-500/30">
            {updateMessage}
          </div>
        )}

        <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700 mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="text-yellow-400" /> Pending Gate Passes
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-700/50 text-gray-400 border-b border-gray-600">
                <tr>
                  <th className="p-3">Visitor Name</th>
                  <th className="p-3">Vehicle No</th>
                  <th className="p-3">Host Student</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingForms.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-gray-500 font-medium">
                      No pending passes at the gate.
                    </td>
                  </tr>
                ) : (
                  pendingForms.map(visitor => (
                    <tr key={visitor._id} className="border-b border-gray-700/50 hover:bg-gray-700/20 transition">
                      <td className="p-3 font-semibold text-white">{visitor.name || 'N/A'}</td>
                      <td className="p-3 font-mono text-blue-300">{visitor.vehicleNo || 'N/A'}</td>
                      <td className="p-3">{visitor.hostName || 'N/A'}</td>
                      <td className="p-3 capitalize">{visitor.visitorType || 'N/A'}</td>
                      <td className="p-3 flex justify-center gap-2">
                        <button onClick={() => handleStatusUpdate(visitor._id, 'approved')} disabled={isUpdating} className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border border-green-600/50 px-3 py-1.5 rounded transition flex items-center gap-1 font-bold">
                          <CheckCircle size={16} /> Approve
                        </button>
                        <button onClick={() => handleStatusUpdate(visitor._id, 'rejected')} disabled={isUpdating} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-600/50 px-3 py-1.5 rounded transition flex items-center gap-1 font-bold">
                          <XCircle size={16} /> Reject
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Camera className="text-blue-400" /> Gate Surveillance Feed
            </h2>
            <div className="bg-black rounded-lg aspect-video overflow-hidden relative border border-gray-600 mb-4 flex items-center justify-center">
              {!isLiveFeedActive && <span className="text-gray-500">Camera Offline</span>}
              <video ref={videoRef} className={`w-full h-full object-cover ${!isLiveFeedActive ? 'hidden' : ''}`} />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex gap-4">
              <button onClick={startLiveFeed} disabled={isLiveFeedActive} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded transition">
                {isLiveFeedActive ? "Feed Active" : "Start Live Feed"}
              </button>
              <button onClick={handleLiveEntryTest} disabled={!isLiveFeedActive || isScanning} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded flex items-center justify-center gap-2 transition">
                <ScanFace />
                {isScanning ? "Scanning..." : "Live Scan Face/Plate"}
              </button>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
            <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">Scan Results</h2>
            {!scanResult && !isScanning && <div className="text-gray-500 text-center mt-20">Awaiting scan...</div>}
            {isScanning && <div className="text-blue-400 text-center mt-20 animate-pulse font-semibold">Running Analysis...</div>}
            {scanResult && scanResult.success && scanResult.visitor && (
              <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4 text-green-400">
                  <CheckCircle className="w-8 h-8" />
                  <h3 className="text-2xl font-bold">Match Found</h3>
                </div>
                <p className="text-sm text-green-300 mb-6">{scanResult.message}</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-400 block">Visitor Name</span><span className="font-semibold text-lg">{scanResult.visitor.name || 'N/A'}</span></div>
                    <div><span className="text-gray-400 block">Host/Student</span><span className="font-semibold text-lg">{scanResult.visitor.hostName || 'N/A'}</span></div>
                    <div><span className="text-gray-400 block">Vehicle No</span><span className="font-semibold text-lg">{scanResult.visitor.vehicleNo || 'N/A'}</span></div>
                    <div>
                      <span className="text-gray-400 block">Status</span>
                      <span className={`font-semibold text-lg capitalize ${scanResult.visitor.status === 'approved' ? 'text-green-400' : 'text-yellow-400'}`}>
                        {scanResult.visitor.status || 'Pending'}
                      </span>
                    </div>
                  </div>
                  {scanResult.visitor.status === 'pending_review' && (
                     <div className="mt-4 bg-yellow-900/40 border border-yellow-500/50 text-yellow-200 p-3 rounded text-sm text-center font-bold">
                       ⚠️ Form pending approval!
                     </div>
                  )}
                </div>
              </div>
            )}
            {scanResult && !scanResult.success && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
                <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h3>
                <p className="text-red-300">{scanResult.message}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuardDashboard;