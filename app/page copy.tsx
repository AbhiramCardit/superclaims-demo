'use client';

import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, ClipboardCheck, HeartPulse, Pill, IdCard, Landmark,
  CopyCheck, Microscope, FileCheck, RotateCcw, Zap, CheckCircle2,
  Loader2, CheckCircle, X, Eye, Play, Clock, FileStack, TrendingUp,
  Activity, Cpu, Database
} from "lucide-react";

const NODE_WIDTH = 160;
const NODE_HEIGHT = 80;

const AGENTS = [
    { id: "input", label: "Input Segregation", icon: <FileStack size={24} />, type: "input" },
    { id: "claim_form_agent", label: "Claim Form Extractor", icon: <ClipboardCheck size={22} />, type: "extractor" },
    { id: "discharge_summary_agent", label: "Discharge Summary Extractor", icon: <HeartPulse size={22} />, type: "extractor" },
    { id: "pharmacy_bills_agent", label: "Pharmacy Bills Extractor", icon: <Pill size={22} />, type: "extractor" },
    { id: "cheque_or_bank_details_agent", label: "Cheque/Bank Extractor", icon: <Landmark size={22} />, type: "extractor" },
    { id: "ids_agent", label: "Identity Document Extractor", icon: <IdCard size={22} />, type: "extractor" },
    { id: "duplicate_detection_agent", label: "Duplicate Detection", icon: <CopyCheck size={22} />, type: "utility" },
    { id: "items_categorisation_agent", label: "Items Categorisation", icon: <Zap size={22} />, type: "utility" },
    { id: "nme_analysis_agent", label: "NME Analysis", icon: <Microscope size={22} />, type: "analysis" },
    { id: "patient_summary_agent", label: "Patient Summary", icon: <FileCheck size={22} />, type: "aggregate" },
    { id: "completion_aggregator", label: "Completion Aggregator", icon: <CheckCircle2 size={24} />, type: "end" },
];

const EDGES: [string, string][] = [
    ["input", "discharge_summary_agent"], ["input", "pharmacy_bills_agent"], ["input", "claim_form_agent"], ["input", "ids_agent"], ["input", "cheque_or_bank_details_agent"],
    ["pharmacy_bills_agent", "items_categorisation_agent"], ["pharmacy_bills_agent", "duplicate_detection_agent"],
    ["items_categorisation_agent", "nme_analysis_agent"],
    ["duplicate_detection_agent", "nme_analysis_agent"],
    ["nme_analysis_agent", "completion_aggregator"],
    ["discharge_summary_agent", "patient_summary_agent"], ["claim_form_agent", "patient_summary_agent"], ["cheque_or_bank_details_agent", "patient_summary_agent"], ["ids_agent", "patient_summary_agent"],
    ["patient_summary_agent", "completion_aggregator"],
];

const FINAL_AGGREGATED_OUTPUT = {
    "status": "SUCCESS", "case_id": "CASE-2025-10-12-A7B2", "timestamp": new Date().toISOString(),
    "patient_summary": { "patient_id": "P-98765", "name": "John Doe", "policy_no": "POL123456", "admission_date": "2025-10-08", "discharge_date": "2025-10-12", "diagnosis": "Acute Appendicitis" },
    "financials": { "total_claimed": 45000, "nme_deductions": 1000, "payable_amount": 44000, "bank_details": { "account_no": "XXXX-XXXX-3210", "ifsc": "HDFC0001234" }},
    "analysis_flags": { "duplicates_detected": true, "duplicate_count": 1, "policy_limit_breached": false },
    "documents_processed": 5
};

type Node = { id: string; label: string; icon: React.ReactElement; type: string };
type Position = { x: number; y: number };
type TimedStep = { id: string; from: string; to: string; startTime: number; duration: number };
type Particle = { id: string; x: number; y: number; vx: number; vy: number; life: number };

function generateCenteredPositions(width: number, height: number): Record<string, Position> {
    if (!width || !height) return {};
    const positions: Record<string, Position> = {};
    const COL_WIDTH = (width - NODE_WIDTH) / 5;
    const ROW_HEIGHT = (height - NODE_HEIGHT) / 5;

    positions["input"] = { x: 50, y: height / 2 - NODE_HEIGHT / 2 };

    const extractors = ["discharge_summary_agent", "claim_form_agent", "pharmacy_bills_agent", "ids_agent", "cheque_or_bank_details_agent"];
    extractors.forEach((id, i) => { positions[id] = { x: 50 + COL_WIDTH, y: i * ROW_HEIGHT + ROW_HEIGHT/2.5 }; });

    positions["items_categorisation_agent"] = { x: 50 + 2 * COL_WIDTH, y: 1.8 * ROW_HEIGHT + ROW_HEIGHT/2.5};
    positions["duplicate_detection_agent"] = { x: 50 + 2 * COL_WIDTH, y: 3.2 * ROW_HEIGHT + ROW_HEIGHT/2.5 };
    positions["nme_analysis_agent"] = { x: 50 + 3 * COL_WIDTH, y: 2 * ROW_HEIGHT + ROW_HEIGHT/2.5 };
    positions["patient_summary_agent"] = { x: 50 + 3 * COL_WIDTH, y: 0.8 * ROW_HEIGHT + ROW_HEIGHT/2.5 };

    positions["completion_aggregator"] = { x: width - NODE_WIDTH - 50, y: height / 2 - NODE_HEIGHT / 2 };
    return positions;
}

function pathBetween(a: Position, b: Position): string {
    const [ax, ay] = [a.x + NODE_WIDTH, a.y + NODE_HEIGHT / 2];
    const [bx, by] = [b.x, b.y + NODE_HEIGHT / 2];
    return `M ${ax} ${ay} L ${bx} ${by}`;
}

const NodeCard = ({ node, pos, isComplete, isProcessing }: { node: Node; pos: Position; isComplete: boolean; isProcessing: boolean }) => {
    const typeColors = {
        input: "from-blue-600/20 to-blue-800/20 border-blue-500/40",
        extractor: "from-violet-600/20 to-violet-800/20 border-violet-500/40",
        utility: "from-cyan-600/20 to-cyan-800/20 border-cyan-500/40",
        analysis: "from-amber-600/20 to-amber-800/20 border-amber-500/40",
        aggregate: "from-emerald-600/20 to-emerald-800/20 border-emerald-500/40",
        end: "from-orange-600/20 to-orange-800/20 border-orange-500/40"
    };

    const baseColor = typeColors[node.type as keyof typeof typeColors] || typeColors.extractor;
    
    return (
        <motion.div
            layout
            id={`node-${node.id}`}
            style={{ left: pos.x, top: pos.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
            className={`absolute rounded-xl border-2 backdrop-blur-md transition-all duration-500 bg-gradient-to-br ${baseColor}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
                scale: isProcessing ? [1, 1.05, 1] : 1, 
                opacity: 1,
                boxShadow: isComplete 
                    ? "0 0 30px rgba(249, 115, 22, 0.4)" 
                    : isProcessing 
                    ? "0 0 20px rgba(249, 115, 22, 0.2)" 
                    : "0 0 0 rgba(0,0,0,0)"
            }}
            transition={{ 
                scale: { duration: 0.4, repeat: isProcessing ? Infinity : 0 },
                opacity: { duration: 0.6, ease: "easeOut" }
            }}
        >
            {isProcessing && (
                <motion.div
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500/0 via-orange-500/20 to-orange-500/0"
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
            )}
            
            <div className="flex items-center gap-3 h-full p-4 relative z-10">
                <motion.div 
                    className="p-2.5 rounded-lg bg-slate-800/80 flex-shrink-0 border border-slate-700/50"
                    animate={isProcessing ? { rotate: [0, 5, -5, 0] } : {}}
                    transition={{ duration: 0.5, repeat: isProcessing ? Infinity : 0 }}
                >
                    <div className="text-slate-100">
                        {node.icon}
                    </div>
                </motion.div>
                <div className="text-xs font-semibold text-slate-100 leading-tight flex-1">
                    {node.label}
                </div>
                
                <AnimatePresence>
                    {isComplete && (
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0 }}
                            className="absolute -top-3 -right-3 w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/50 border-2 border-slate-900"
                        >
                            <CheckCircle2 size={14} className="text-white" />
                        </motion.div>
                    )}
                </AnimatePresence>
                
                {isProcessing && !isComplete && (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute -top-3 -right-3 w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/50 border-2 border-slate-900"
                    >
                        <Loader2 size={14} className="text-white" />
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};

const MovingDoc = ({ start, end, duration }: { start: Position; end: Position; duration: number }) => {
    const [particles, setParticles] = useState<Particle[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            setParticles(prev => {
                const newParticles = prev
                    .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.02 }))
                    .filter(p => p.life > 0);
                
                if (Math.random() > 0.7) {
                    newParticles.push({
                        id: Math.random().toString(),
                        x: 0,
                        y: 0,
                        vx: (Math.random() - 0.5) * 2,
                        vy: (Math.random() - 0.5) * 2,
                        life: 1
                    });
                }
                
                return newParticles;
            });
        }, 50);

        return () => clearInterval(interval);
    }, []);

    return (
        <>
            <motion.div
                className="absolute z-40"
                initial={{
                    x: start.x + NODE_WIDTH - 20,
                    y: start.y + NODE_HEIGHT / 2 - 20,
                    opacity: 0,
                    scale: 0.5,
                }}
                animate={{
                    x: end.x - 20,
                    y: end.y + NODE_HEIGHT / 2 - 20,
                    opacity: [0, 1, 1, 0.8],
                    scale: [0.5, 1.2, 1, 1],
                }}
                transition={{ 
                    duration: duration / 1000, 
                    ease: [0.34, 1.56, 0.64, 1],
                }}
            >
                <div className="relative">
                    <motion.div 
                        className="absolute inset-0 bg-orange-500 rounded-xl blur-xl"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0.3, 0.6] }}
                        transition={{ duration: 1, repeat: Infinity }}
                    />
                    <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-2.5 shadow-2xl flex items-center justify-center border-2 border-orange-400/50">
                        <FileText size={18} className="text-white" />
                        {particles.map(p => (
                            <div
                                key={p.id}
                                className="absolute w-1 h-1 bg-orange-300 rounded-full"
                                style={{
                                    left: `${p.x + 10}px`,
                                    top: `${p.y + 10}px`,
                                    opacity: p.life,
                                }}
                            />
                        ))}
                    </div>
                </div>
            </motion.div>
        </>
    );
};

const MetricsPanel = ({ processedDocs, activeAgents, totalTime }: { processedDocs: number; activeAgents: number; totalTime: string }) => (
    <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-8 right-8 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 shadow-2xl"
    >
        <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Live Metrics</div>
        <div className="grid grid-cols-3 gap-6">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <Database size={14} className="text-blue-400" />
                    <div className="text-xs text-slate-400">Documents</div>
                </div>
                <motion.div 
                    key={processedDocs}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className="text-2xl font-bold text-slate-100"
                >
                    {processedDocs}
                </motion.div>
            </div>
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <Cpu size={14} className="text-violet-400" />
                    <div className="text-xs text-slate-400">Active Agents</div>
                </div>
                <motion.div 
                    key={activeAgents}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className="text-2xl font-bold text-slate-100"
                >
                    {activeAgents}
                </motion.div>
            </div>
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <Activity size={14} className="text-emerald-400" />
                    <div className="text-xs text-slate-400">Time Elapsed</div>
                </div>
                <div className="text-2xl font-bold text-slate-100 tabular-nums">
                    {totalTime}
                </div>
            </div>
        </div>
    </motion.div>
);

const ResultsModal = ({ isOpen, onClose, data }: { isOpen: boolean; onClose: () => void; data: any }) => (
    <AnimatePresence>
        {isOpen && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-8"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: "spring", damping: 25 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
                >
                    <header className="flex items-center justify-between px-7 py-5 border-b border-slate-700/50 flex-shrink-0 bg-slate-900/50">
                        <div>
                            <h3 className="font-semibold text-xl text-slate-100">Processing Complete</h3>
                            <p className="text-sm text-slate-400 mt-1">Final aggregated output and analysis</p>
                        </div>
                        <button onClick={onClose} className="p-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all">
                            <X size={20} />
                        </button>
                    </header>
                    
                    <div className="grid grid-cols-3 gap-4 px-7 py-5 border-b border-slate-800/50 bg-slate-900/30">
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                            <div className="text-xs text-slate-400 mb-1">Total Claimed</div>
                            <div className="text-2xl font-bold text-slate-100">₹{data.financials.total_claimed.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                            <div className="text-xs text-slate-400 mb-1">Payable Amount</div>
                            <div className="text-2xl font-bold text-emerald-400">₹{data.financials.payable_amount.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                            <div className="text-xs text-slate-400 mb-1">Documents</div>
                            <div className="text-2xl font-bold text-slate-100">{data.documents_processed}</div>
                        </div>
                    </div>
                    
                    <main className="flex-grow p-7 overflow-auto">
                        <div className="bg-slate-950/80 rounded-xl p-5 font-mono text-xs border border-slate-800/50">
                            <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed">
                                {JSON.stringify(data, null, 2)}
                            </pre>
                        </div>
                    </main>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);

export default function DocumentJourneyInteractive() {
    const [running, setRunning] = useState(false);
    const [finished, setFinished] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [completedNodes, setCompletedNodes] = useState<Set<string>>(new Set());
    const [processingNodes, setProcessingNodes] = useState<Set<string>>(new Set());
    const [visibleDocs, setVisibleDocs] = useState<TimedStep[]>([]);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);

    const canvasRef = useRef<HTMLDivElement>(null);
    const timeoutIds = useRef<NodeJS.Timeout[]>([]);
    const finalArrivalsCounter = useRef(0);
    const timerInterval = useRef<NodeJS.Timeout | null>(null);

    const nodes = useMemo<Node[]>(() => AGENTS, []);
    const positions = useMemo(() => generateCenteredPositions(dimensions.width, dimensions.height), [dimensions]);

    useEffect(() => {
        if (canvasRef.current) {
            const { width, height } = canvasRef.current.getBoundingClientRect();
            setDimensions({ width, height });
            
            const resizeObserver = new ResizeObserver(entries => {
                if (entries[0]) {
                    const { width, height } = entries[0].contentRect;
                    setDimensions({ width, height });
                }
            });
            resizeObserver.observe(canvasRef.current);
            return () => resizeObserver.disconnect();
        }
    }, []);

    useEffect(() => {
        if (running && startTime) {
            timerInterval.current = setInterval(() => {
                setElapsedTime(Date.now() - startTime);
            }, 100);
        } else {
            if (timerInterval.current) {
                clearInterval(timerInterval.current);
                timerInterval.current = null;
            }
        }
        return () => {
            if (timerInterval.current) clearInterval(timerInterval.current);
        };
    }, [running, startTime]);

    const startDemo = () => {
        timeoutIds.current.forEach(clearTimeout);
        timeoutIds.current = [];
        finalArrivalsCounter.current = 0;

        const now = Date.now();
        setStartTime(now);
        setElapsedTime(0);
        setRunning(true);
        setFinished(false);
        setIsModalOpen(false);
        setCompletedNodes(new Set(["input"]));
        setProcessingNodes(new Set());
        setVisibleDocs([]);
        setProcessedCount(0);

        const finalNodeId = "completion_aggregator";
        const finalNodeInputs = EDGES.filter(([, to]) => to === finalNodeId).length;

        let currentTime = 500;
        const timedSequence: TimedStep[] = EDGES.map(([from, to], index) => {
            const duration = 1800 + Math.random() * 1200;
            const step = { id: `${from}-${to}-${index}`, from, to, startTime: currentTime, duration };
            currentTime += 600 + Math.random() * 600;
            return step;
        });

        timedSequence.forEach(step => {
            timeoutIds.current.push(setTimeout(() => {
                setVisibleDocs(prev => [...prev, step]);
                setProcessingNodes(prev => new Set(prev).add(step.to));
            }, step.startTime));

            timeoutIds.current.push(setTimeout(() => {
                setCompletedNodes(prev => new Set(prev).add(step.to));
                setProcessingNodes(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(step.to);
                    return newSet;
                });
                setVisibleDocs(prev => prev.filter(d => d.id !== step.id));
                setProcessedCount(c => c + 1);

                if (step.to === finalNodeId) {
                    finalArrivalsCounter.current++;
                    if (finalArrivalsCounter.current >= finalNodeInputs) {
                        setFinished(true);
                        setRunning(false);
                        setTimeout(() => setIsModalOpen(true), 800);
                    }
                }
            }, step.startTime + step.duration));
        });
    };

    useEffect(() => {
        return () => timeoutIds.current.forEach(clearTimeout);
    }, []);

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col font-sans overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800/20 via-transparent to-transparent pointer-events-none" />
            
            <header className="flex items-center justify-between px-8 py-4 flex-shrink-0 z-10 border-b border-slate-800/50 bg-slate-900/30 backdrop-blur-xl relative">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-100">Agentic Document Processing</h2>
                    <p className="text-sm text-slate-400 mt-1.5">Intelligent workflow orchestration powered by AI agents</p>
                </div>
                <div className="flex items-center gap-5">
                    <div className="flex items-center gap-4">
                        {(running || finished) && (
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex items-center gap-2.5 px-5 py-2.5 bg-slate-800/60 rounded-xl border border-slate-700/50 backdrop-blur-sm"
                            >
                                <Clock size={16} className="text-slate-400" />
                                <span className="text-sm font-semibold text-slate-200 tabular-nums">{formatTime(elapsedTime)}</span>
                            </motion.div>
                        )}
                        <motion.div 
                            className="flex items-center gap-2.5 px-5 py-2.5 bg-slate-800/60 rounded-xl border border-slate-700/50 backdrop-blur-sm"
                            animate={running ? { boxShadow: ["0 0 0 rgba(249,115,22,0)", "0 0 20px rgba(249,115,22,0.3)", "0 0 0 rgba(249,115,22,0)"] } : {}}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            {running && (
                                <>
                                    <Loader2 className="animate-spin text-orange-500" size={18}/>
                                    <span className="text-sm font-semibold text-orange-500">Processing</span>
                                </>
                            )}
                            {finished && (
                                <>
                                    <CheckCircle className="text-emerald-500" size={18}/>
                                    <span className="text-sm font-semibold text-emerald-500">Completed</span>
                                </>
                            )}
                            {!running && !finished && (
                                <span className="text-sm font-semibold text-slate-400">Ready to Process</span>
                            )}
                        </motion.div>
                    </div>
                    {finished && (
                        <motion.button
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsModalOpen(true)} 
                            className="bg-slate-800/80 border border-slate-700/50 text-slate-100 px-6 py-2.5 rounded-xl flex items-center gap-2.5 hover:bg-slate-750 transition-all text-sm font-semibold backdrop-blur-sm"
                        >
                            <Eye size={16} /> View Results
                        </motion.button>
                    )}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={startDemo} 
                        disabled={running} 
                        className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-7 py-2.5 rounded-xl flex items-center gap-2.5 hover:from-orange-700 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold shadow-lg shadow-orange-600/30"
                    >
                        {finished ? <RotateCcw size={16} /> : <Play size={16} />}
                        {finished ? "Run Again" : "Start Processing"}
                    </motion.button>
                </div>
            </header>

            <main className="flex-grow relative min-h-0">
                <div ref={canvasRef} className="absolute inset-0 w-full h-full p-8">
                    <div className="relative w-full h-full">
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="edge-gradient-inactive" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" style={{stopColor: "rgba(71, 85, 105, 0.3)"}} />
                                    <stop offset="100%" style={{stopColor: "rgba(71, 85, 105, 0.1)"}} />
                                </linearGradient>
                                <linearGradient id="edge-gradient-active" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" style={{stopColor: "rgba(249, 115, 22, 0.8)"}} />
                                    <stop offset="50%" style={{stopColor: "rgba(251, 146, 60, 0.6)"}} />
                                    <stop offset="100%" style={{stopColor: "rgba(249, 115, 22, 0.3)"}} />
                                </linearGradient>
                                <filter id="glow">
                                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                    <feMerge>
                                        <feMergeNode in="coloredBlur"/>
                                        <feMergeNode in="SourceGraphic"/>
                                    </feMerge>
                                </filter>
                            </defs>
                            {EDGES.map(([from, to]) => {
                                const posA = positions[from];
                                const posB = positions[to];
                                if (!posA || !posB) return null;
                                const isActive = completedNodes.has(from) && completedNodes.has(to);
                                const isAnimating = visibleDocs.some(d => d.from === from && d.to === to);
                                return (
                                    <g key={`${from}-${to}`}>
                                        <path 
                                            d={pathBetween(posA, posB)} 
                                            fill="none" 
                                            stroke={isActive ? "url(#edge-gradient-active)" : "url(#edge-gradient-inactive)"} 
                                            strokeWidth={isAnimating ? "3" : "2"} 
                                            className="transition-all duration-700"
                                            filter={isAnimating ? "url(#glow)" : undefined}
                                        />
                                    </g>
                                );
                            })}
                        </svg>

                        {nodes.map(n => positions[n.id] && (
                            <NodeCard 
                                key={n.id} 
                                node={n} 
                                pos={positions[n.id]} 
                                isComplete={completedNodes.has(n.id)}
                                isProcessing={processingNodes.has(n.id)}
                            />
                        ))}
                        
                        <AnimatePresence>
                            {visibleDocs.map(doc => positions[doc.from] && positions[doc.to] && (
                                <MovingDoc 
                                    key={doc.id} 
                                    start={positions[doc.from]} 
                                    end={positions[doc.to]} 
                                    duration={doc.duration} 
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
                
                <AnimatePresence>
                    {(running || finished) && (
                        <MetricsPanel 
                            processedDocs={processedCount}
                            activeAgents={processingNodes.size}
                            totalTime={formatTime(elapsedTime)}
                        />
                    )}
                </AnimatePresence>
            </main>

            <ResultsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} data={FINAL_AGGREGATED_OUTPUT} />
        </div>
    );
}