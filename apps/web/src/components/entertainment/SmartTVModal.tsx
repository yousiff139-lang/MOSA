'use client';
import React, { useState, useEffect } from 'react';
import { X, Tv, Loader2, Play } from 'lucide-react';
import { VirtualRemote } from './VirtualRemote';

export const SmartTVModal = ({ deviceId, onClose }: { deviceId: string, onClose: () => void }) => {
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch state and capabilities
    const fetchState = async () => {
      try {
        const res = await fetch(`/api/entertainment/${deviceId}/state`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        setState(data);
      } catch (err) {
        console.error("Failed to fetch TV state", err);
      } finally {
        setLoading(false);
      }
    };
    fetchState();
  }, [deviceId]);

  const sendCommand = async (action: string, value?: any) => {
    try {
      await fetch(`/api/entertainment/${deviceId}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ action, value })
      });
    } catch (err) {
      console.error("Failed to send command", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0b0f19] border border-[#1e293b] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl">
        
        {/* Left Side: Remote */}
        <div className="w-full md:w-96 bg-[#080b12] p-6 border-r border-[#1e293b] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Tv className="text-blue-500" /> Remote
            </h3>
            <button onClick={onClose} className="md:hidden p-2 text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <VirtualRemote deviceId={deviceId} onCommand={sendCommand} />
        </div>

        {/* Right Side: Smart Portal / Info */}
        <div className="flex-1 p-8 overflow-y-auto relative hidden md:block">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white bg-[#1e293b] rounded-full">
            <X className="w-5 h-5" />
          </button>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Connecting to {state?.deviceInfo?.name || 'TV'}...</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-bold text-white">{state?.deviceInfo?.name}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`w-2 h-2 rounded-full ${state?.state?.isOn ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500'}`}></span>
                  <span className="text-gray-400">{state?.state?.isOn ? 'Online' : 'Offline'}</span>
                  <span className="text-gray-600 px-2">•</span>
                  <span className="text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded text-sm">{state?.deviceInfo?.protocol}</span>
                </div>
              </div>

              {/* Apps Grid */}
              {state?.capabilities?.apps && state?.apps?.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-300 mb-4">Installed Apps</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {state.apps.map((app: any) => (
                      <button 
                        key={app.id}
                        onClick={() => sendCommand('LAUNCH_APP', app.id)}
                        className="bg-[#161e2e] hover:bg-[#1e293b] border border-[#2a374a] p-4 rounded-xl flex flex-col items-center justify-center gap-3 transition-all hover:scale-105 group"
                      >
                        <div className="w-12 h-12 bg-[#2a374a] rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                          <Play className="w-5 h-5 text-gray-300 group-hover:text-white ml-1" />
                        </div>
                        <span className="text-sm font-medium text-gray-300">{app.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Inputs List */}
              {state?.capabilities?.inputs && state?.inputs?.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-300 mb-4">Inputs</h4>
                  <div className="flex flex-wrap gap-3">
                    {state.inputs.map((input: any) => (
                      <button 
                        key={input.id}
                        onClick={() => sendCommand('SEND_KEY', input.id)}
                        className="px-4 py-2 bg-[#161e2e] border border-[#2a374a] rounded-lg text-gray-300 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        {input.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
