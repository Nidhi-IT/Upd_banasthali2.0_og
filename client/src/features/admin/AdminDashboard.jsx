import React, { useState, useEffect } from 'react';
import { Shield, Users, CheckCircle, XCircle, Clock, Edit, Trash2, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const [visitors, setVisitors] = useState([]);
  const [isEditing, setIsEditing] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  const fetchVisitors = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/visitors');
      if (response.ok) {
        const data = await response.json();
        setVisitors(data);
      }
    } catch (error) {
      console.error("Error fetching visitors:", error);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  const handleDelete = async (id) => {
    if(!window.confirm("Are you sure you want to permanently delete this record?")) return;
    try {
      const res = await fetch(`http://localhost:5000/api/admin/visitors/${id}`, { method: 'DELETE' });
      if(res.ok) fetchVisitors();
    } catch(err) {
      console.error("Delete failed", err);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:5000/api/admin/visitors/${isEditing}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      if(res.ok) {
        setIsEditing(null);
        fetchVisitors();
      }
    } catch(err) {
      console.error("Edit failed", err);
    }
  };

  const openEditModal = (visitor) => {
    setIsEditing(visitor._id);
    setEditFormData({
      name: visitor.name || "",
      hostName: visitor.hostName || "",
      vehicleNo: visitor.vehicleNo || "",
      status: visitor.status || "pending_review"
    });
  };

  // Dashboard Stats
  const total = visitors.length;
  const approved = visitors.filter(v => v.status === 'approved').length;
  const pending = visitors.filter(v => v.status === 'pending_review' || !v.status).length;
  const rejected = visitors.filter(v => v.status === 'rejected').length;

  return (
    <div className="min-h-screen bg-[#0b0808] p-8 pt-28 text-white">
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h1 className="text-3xl font-black text-[#d99330]">Master Admin Control Panel</h1>
            <p className="text-gray-400">Full System Overview & Database Management</p>
          </div>
          <Link to="/guard" className="flex items-center gap-2 bg-[#3070d9] hover:bg-[#4085e0] px-4 py-2 rounded-lg font-bold transition">
            <Camera size={20} /> Launch Scanner View
          </Link>
        </header>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#171212] p-6 rounded-xl border border-white/10 flex items-center gap-4">
            <div className="p-4 bg-blue-500/20 rounded-lg"><Users className="text-blue-500 w-8 h-8" /></div>
            <div><p className="text-gray-400 text-sm font-bold uppercase">Total Visitors</p><h2 className="text-3xl font-black">{total}</h2></div>
          </div>
          <div className="bg-[#171212] p-6 rounded-xl border border-white/10 flex items-center gap-4">
            <div className="p-4 bg-green-500/20 rounded-lg"><CheckCircle className="text-green-500 w-8 h-8" /></div>
            <div><p className="text-gray-400 text-sm font-bold uppercase">Approved</p><h2 className="text-3xl font-black text-green-400">{approved}</h2></div>
          </div>
          <div className="bg-[#171212] p-6 rounded-xl border border-white/10 flex items-center gap-4">
            <div className="p-4 bg-yellow-500/20 rounded-lg"><Clock className="text-yellow-500 w-8 h-8" /></div>
            <div><p className="text-gray-400 text-sm font-bold uppercase">Pending</p><h2 className="text-3xl font-black text-yellow-400">{pending}</h2></div>
          </div>
          <div className="bg-[#171212] p-6 rounded-xl border border-white/10 flex items-center gap-4">
            <div className="p-4 bg-red-500/20 rounded-lg"><XCircle className="text-red-500 w-8 h-8" /></div>
            <div><p className="text-gray-400 text-sm font-bold uppercase">Rejected</p><h2 className="text-3xl font-black text-red-400">{rejected}</h2></div>
          </div>
        </div>

        {/* DATA VISUALIZATION BAR */}
        <div className="bg-[#171212] p-6 rounded-xl border border-white/10 mb-8">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-wider">Status Distribution</h3>
          <div className="w-full bg-gray-800 h-6 rounded-full flex overflow-hidden shadow-inner">
            <div style={{ width: `${(approved/total)*100}%` }} className="bg-green-500 transition-all duration-1000" title={`Approved: ${approved}`}></div>
            <div style={{ width: `${(pending/total)*100}%` }} className="bg-yellow-500 transition-all duration-1000" title={`Pending: ${pending}`}></div>
            <div style={{ width: `${(rejected/total)*100}%` }} className="bg-red-500 transition-all duration-1000" title={`Rejected: ${rejected}`}></div>
          </div>
          <div className="flex gap-6 mt-3 text-xs font-bold">
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-full"></div> Approved ({((approved/total)*100||0).toFixed(1)}%)</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-500 rounded-full"></div> Pending ({((pending/total)*100||0).toFixed(1)}%)</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Rejected ({((rejected/total)*100||0).toFixed(1)}%)</span>
          </div>
        </div>

        {/* FULL DATABASE TABLE */}
        <div className="bg-[#171212] rounded-xl shadow-lg border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="text-[#d99330]" /> Comprehensive Database Logs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-white/5 text-gray-400 border-b border-white/10">
                <tr>
                  <th className="p-4">Visitor</th>
                  <th className="p-4">Vehicle</th>
                  <th className="p-4">Host Student</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map(v => (
                  <tr key={v._id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="p-4 font-semibold text-white">{v.name || 'N/A'}</td>
                    <td className="p-4 font-mono text-blue-300">{v.vehicleNo || 'N/A'}</td>
                    <td className="p-4">{v.hostName || 'N/A'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold capitalize ${v.status === 'approved' ? 'bg-green-500/20 text-green-400' : v.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {v.status || 'pending'}
                      </span>
                    </td>
                    <td className="p-4 flex justify-end gap-3">
                      <button onClick={() => openEditModal(v)} className="text-blue-400 hover:text-blue-300 transition" title="Edit Record"><Edit size={18} /></button>
                      <button onClick={() => handleDelete(v._id)} className="text-red-500 hover:text-red-400 transition" title="Delete Record"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* EDIT MODAL */}
        {isEditing && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#171212] border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl">
              <h3 className="text-2xl font-bold mb-6 text-[#d99330]">Edit Visitor Record</h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input type="text" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} className="w-full bg-black border border-white/10 p-2 rounded text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Host Student</label>
                  <input type="text" value={editFormData.hostName} onChange={e => setEditFormData({...editFormData, hostName: e.target.value})} className="w-full bg-black border border-white/10 p-2 rounded text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Vehicle No</label>
                  <input type="text" value={editFormData.vehicleNo} onChange={e => setEditFormData({...editFormData, vehicleNo: e.target.value})} className="w-full bg-black border border-white/10 p-2 rounded text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Status</label>
                  <select value={editFormData.status} onChange={e => setEditFormData({...editFormData, status: e.target.value})} className="w-full bg-black border border-white/10 p-2 rounded text-white">
                    <option value="pending_review">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsEditing(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 p-2 rounded font-bold transition">Cancel</button>
                  <button type="submit" className="flex-1 bg-[#1eb854] text-black hover:bg-[#199d47] p-2 rounded font-bold transition">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;