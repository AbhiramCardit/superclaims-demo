'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Activity, CheckCircle, Loader2, GitMerge } from 'lucide-react';

// --- A more professional and modern take on converging lines ---
const ConvergingLines = ({
  agentRefs,
  currentLayer,
  show
}: {
  agentRefs: React.RefObject<HTMLDivElement>[][];
  currentLayer: number;
  show: boolean;
}) => {
  if (!show || currentLayer < 0 || !agentRefs[currentLayer]) return null;

  const lines: JSX.Element[] = [];

  agentRefs[currentLayer].forEach((ref, idx) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const cardLeftX = rect.left;
    const cardRightX = rect.right;
    const cardCenterY = rect.top + rect.height / 2;

    const leftEdgeX = 0;
    const leftEdgeY = window.innerHeight / 2;
    const rightEdgeX = window.innerWidth;
    const rightEdgeY = window.innerHeight / 2;

    // Control points for more organic curves
    const controlPointLeftX = cardLeftX - (cardLeftX / 2);
    const controlPointRightX = cardRightX + (window.innerWidth - cardRightX) / 2;

    const leftPathD = `M ${cardLeftX},${cardCenterY} Q ${controlPointLeftX},${cardCenterY} ${leftEdgeX},${leftEdgeY}`;
    lines.push(
      <g key={`left-${idx}`}>
        <path d={leftPathD} stroke="#fb923c" strokeOpacity="0.1" strokeWidth="2" fill="none" />
        <path d={leftPathD} stroke="url(#cometGradient)" strokeWidth="2" fill="none" className="animate-comet" style={{ filter: 'url(#glow)' }}/>
      </g>
    );

    const rightPathD = `M ${cardRightX},${cardCenterY} Q ${controlPointRightX},${cardCenterY} ${rightEdgeX},${rightEdgeY}`;
    lines.push(
      <g key={`right-${idx}`}>
        <path d={rightPathD} stroke="#fb923c" strokeOpacity="0.1" strokeWidth="2" fill="none" />
        <path d={rightPathD} stroke="url(#cometGradient)" strokeWidth="2" fill="none" className="animate-comet" style={{ filter: 'url(#glow)' }}/>
      </g>
    );
  });

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
      <defs>
        <linearGradient id="cometGradient">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
        </linearGradient>
         <filter id="glow">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
      </defs>
      {lines}
    </svg>
  );
};

// --- A more professional and modern take on flow connectors ---
const FlowConnectors = ({
  prevRef,
  currentRefs,
  show
}: {
  prevRef: React.RefObject<HTMLDivElement>;
  currentRefs: React.RefObject<HTMLDivElement>[];
  show: boolean;
}) => {
  if (!show || !prevRef.current || currentRefs.some(r => !r.current)) return null;

  const prevRect = prevRef.current.getBoundingClientRect();
  const currentRects = currentRefs.map(r => r.current!.getBoundingClientRect());

  const x1 = prevRect.right;
  const y1 = prevRect.top + prevRect.height / 2;

  const lines = currentRects.map((rect, i) => {
    const x2 = rect.left;
    const y2 = rect.top + rect.height / 2;

    const pathD = `M ${x1},${y1} C ${x1 + 60},${y1} ${x2 - 60},${y2} ${x2},${y2}`;

    return (
      <g key={i}>
        <path
          d={pathD}
          stroke="#fb923c"
          strokeOpacity="0.1"
          strokeWidth="2"
          fill="none"
        />
        <path
          d={pathD}
          stroke="url(#cometGradient)"
          strokeWidth="2"
          fill="none"
          className="animate-comet"
          style={{ filter: 'url(#glow)' }}
        />
      </g>
    );
  });

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
      <defs>
        <linearGradient id="cometGradient">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
        </linearGradient>
         <filter id="glow">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
      </defs>
      {lines}
    </svg>
  );
};

const AgentFlowDemo = () => {
  const [file, setFile] = useState<File | null>(null);
  const [currentLayer, setCurrentLayer] = useState(-1);
  const [processingAgents, setProcessingAgents] = useState<Set<string>>(new Set());
  const [completedAgents, setCompletedAgents] = useState<Set<string>>(new Set());
  const [lineDirection, setLineDirection] = useState('none');

  const PROCESSING_TIME = 2.5;

  const layers = [
    {
      name: 'Segregation',
      agents: [{ id: 'input', name: 'Document Segregation', icon: FileText }]
    },
    {
      name: 'Parallel Extraction',
      agents: [
        { id: 'discharge_summary', name: 'Discharge Summary', icon: FileText },
        { id: 'pharmacy_bills', name: 'Pharmacy Bills', icon: FileText },
        { id: 'claim_form', name: 'Claim Form', icon: FileText },
        { id: 'ids', name: 'Identity Docs', icon: FileText },
        { id: 'cheque_bank', name: 'Bank Details', icon: FileText }
      ]
    },
    {
      name: 'Initial Analysis',
      agents: [
        { id: 'items_categorisation', name: 'Items Categorization', icon: Activity },
        { id: 'duplicate_detection', name: 'Duplicate Detection', icon: Activity }
      ]
    },
    {
      name: 'Advanced Analysis',
      agents: [{ id: 'nme_analysis', name: 'NME Analysis', icon: Activity }]
    },
    {
      name: 'Patient Summary',
      agents: [{ id: 'patient_summary', name: 'Patient Summary Aggregation', icon: GitMerge }]
    },
    {
      name: 'Completion',
      agents: [{ id: 'completion', name: 'Final Aggregation', icon: CheckCircle }]
    }
  ];

  const prevLayerRef = useRef<HTMLDivElement>(null);
  const agentRefs = layers.map(layer => layer.agents.map(() => useRef<HTMLDivElement>(null)));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setTimeout(() => setCurrentLayer(0), 500);
    }
  };

  const processLayer = (layerIndex: number) => {
    if (layerIndex >= layers.length) {
      setLineDirection('none');
      return;
    }

    setLineDirection('in');

    const currentAgents = layers[layerIndex].agents.map(a => a.id);

    setTimeout(() => {
      setProcessingAgents(new Set(currentAgents));

      setTimeout(() => {
        setCompletedAgents(prev => new Set([...prev, ...currentAgents]));
        setProcessingAgents(new Set());
        setLineDirection('out');

        if (layerIndex < layers.length - 1) {
          setTimeout(() => setCurrentLayer(layerIndex + 1), 700);
        } else {
          setTimeout(() => setLineDirection('none'), 1000);
        }
      }, PROCESSING_TIME * 1000);
    }, 500);
  };

  useEffect(() => {
    if (currentLayer > -1) processLayer(currentLayer);
  }, [currentLayer]);

  const getAgentStatus = (agentId: string) => {
    if (completedAgents.has(agentId)) return 'completed';
    if (processingAgents.has(agentId)) return 'processing';
    return 'pending';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center font-sans p-4 overflow-hidden relative">
      <ConvergingLines
        agentRefs={agentRefs}
        currentLayer={currentLayer}
        show={lineDirection !== 'none'}
      />

      <div className="w-full max-w-lg mx-auto z-10 relative">
        {currentLayer > 0 && (
          <FlowConnectors
            prevRef={prevLayerRef}
            currentRefs={agentRefs[currentLayer]}
            show={lineDirection === 'in' || lineDirection === 'out'}
          />
        )}

        {currentLayer === -1 ? (
          <div className="text-center transition-opacity duration-500 ease-in-out animate-fadeIn">
            <div className="mb-8 p-8 bg-gray-800/30 rounded-2xl backdrop-blur-sm border border-gray-700/50">
              <Upload className="w-20 h-20 mx-auto text-orange-400 mb-4" />
              <h2 className="text-3xl font-bold text-white mb-2">Initiate Processing</h2>
              <p className="text-gray-400">Upload medical documents to begin the agentic workflow.</p>
            </div>

            <label className="relative inline-block cursor-pointer">
              <input type="file" onChange={handleFileUpload} className="hidden" accept=".pdf,.jpg,.png" />
              <div className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-orange-500/20">
                Select File
              </div>
            </label>
          </div>
        ) : (
          <div key={currentLayer} className="transition-all duration-700 ease-out animate-slideUp" ref={prevLayerRef}>
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-bold text-orange-400">{layers[currentLayer].name}</h3>
              <p className="text-gray-500 text-sm">
                Step {currentLayer + 1} of {layers.length}
              </p>
            </div>

            <div className="space-y-3">
              {layers[currentLayer].agents.map((agent, idx) => {
                const status = getAgentStatus(agent.id);
                const Icon = agent.icon;
                return (
                  <div
                    key={agent.id}
                    ref={agentRefs[currentLayer][idx]}
                    className={`bg-gray-800/50 border border-gray-700/80 p-4 rounded-xl flex items-center gap-4 transition-all duration-500 backdrop-blur-sm ${
                      status === 'completed'
                        ? 'border-green-500/50'
                        : status === 'processing'
                        ? 'border-orange-500/60 shadow-2xl shadow-orange-500/20'
                        : ''
                    }`}
                  >
                    <div
                      className={`p-3 rounded-lg ${
                        status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : status === 'processing'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-gray-700/50 text-gray-400'
                      }`}
                    >
                      {status === 'processing' ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </div>

                    <div className="flex-1">
                      <h4 className="font-semibold text-white">{agent.name}</h4>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <div
                        className={`w-2 h-2 rounded-full transition-colors ${
                          status === 'completed'
                            ? 'bg-green-500'
                            : status === 'processing'
                            ? 'bg-orange-500 animate-pulse'
                            : 'bg-gray-600'
                        }`}
                      ></div>
                      <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    </div>

                    {status === 'completed' && (
                      <CheckCircle className="w-6 h-6 text-green-500 animate-fadeIn" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-comet {
            stroke-dasharray: 20 200;
            stroke-dashoffset: 0;
            animation: comet 2s linear infinite;
        }

        @keyframes comet {
            0% {
                stroke-dashoffset: 220;
            }
            100% {
                stroke-dashoffset: 0;
            }
        }
      `}</style>
    </div>
  );
};

export default AgentFlowDemo;