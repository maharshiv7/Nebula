import { useState } from 'react';
import { ChevronDown, ChevronUp, Cpu, Globe, Brain, CheckCircle, Clock } from 'lucide-react';

export default function TransparencyPanel({ msg }) {
  const [isOpen, setIsOpen] = useState(false);

  // If no metadata is present, don't show the panel toggle
  if (!msg.model_used && !msg.sources?.length && !msg.memory_recalled?.length && !msg.verification) {
    return null;
  }

  return (
    <div className="mt-3 pt-2 border-t border-gray-200/80">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors cursor-pointer py-1"
      >
        <Cpu size={14} />
        <span>Reasoning & Transparency Log</span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isOpen && (
        <div className="mt-2.5 p-3.5 bg-slate-900 text-slate-100 rounded-xl text-xs space-y-3.5 border border-slate-800 shadow-inner animate-fadeIn">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1.5 flex items-center justify-between">
            <span>System Decision Pipeline</span>
            <span className="text-[10px] text-emerald-400 font-mono">Status: Stream Complete</span>
          </div>

          {/* 1. Model Routing */}
          {msg.model_used && (
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded bg-purple-950/80 text-purple-400 mt-0.5 border border-purple-800/50">
                <Cpu size={14} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-200">Model Routing Decision</div>
                <div className="text-slate-400 mt-0.5 font-mono">
                  Model: <span className="text-purple-300">{msg.model_used}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Routed based on prompt complexity heuristic & classification.
                </div>
              </div>
            </div>
          )}

          {/* 2. Web Search Context */}
          {msg.sources && msg.sources.length > 0 && (
            <div className="flex items-start gap-2.5 border-t border-slate-800/80 pt-2.5">
              <div className="p-1.5 rounded bg-blue-950/80 text-blue-400 mt-0.5 border border-blue-800/50">
                <Globe size={14} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-200">Live Web RAG Injected</div>
                <div className="text-slate-400 mt-1 space-y-1">
                  {msg.sources.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-blue-400">•</span>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-300 truncate max-w-[280px]">
                        {s.title}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. Vector Memory Retrieval */}
          {msg.memory_recalled && msg.memory_recalled.length > 0 && (
            <div className="flex items-start gap-2.5 border-t border-slate-800/80 pt-2.5">
              <div className="p-1.5 rounded bg-indigo-950/80 text-indigo-400 mt-0.5 border border-indigo-800/50">
                <Brain size={14} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-200">Long-Term Memory Recalled</div>
                <div className="text-slate-400 mt-1 space-y-1 font-mono text-[11px]">
                  {msg.memory_recalled.map((mem, idx) => (
                    <div key={idx} className="bg-slate-950 p-1.5 rounded border border-slate-800 text-indigo-300">
                      "{mem}"
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. Verification Check */}
          {msg.verification && (
            <div className="flex items-start gap-2.5 border-t border-slate-800/80 pt-2.5">
              <div className={`p-1.5 rounded mt-0.5 border ${
                msg.verification.status === 'PASSED' 
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50' 
                  : 'bg-amber-950/80 text-amber-400 border-amber-800/50'
              }`}>
                <CheckCircle size={14} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-200">Output Quality Verification</div>
                <div className={`mt-0.5 font-medium ${
                  msg.verification.status === 'PASSED' ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  [{msg.verification.status}] {msg.verification.message}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
