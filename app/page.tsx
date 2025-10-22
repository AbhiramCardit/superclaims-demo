'use client';

import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, ClipboardCheck, HeartPulse, Pill, IdCard, Landmark,
  CopyCheck, Microscope, FileCheck, RotateCcw, Zap, CheckCircle2,
  Loader2, CheckCircle, X, Eye, Play,
} from "lucide-react";

// --- Configuration: Nodes, Edges, and Mock Data ---

const NODE_WIDTH = 160;
const NODE_HEIGHT = 80;

const AGENTS = [
    { id: "input", label: "Input Segregation", icon: <FileText size={24} />, type: "input" },
    { id: "claim_form_agent", label: "Claim Form Extractor", icon: <ClipboardCheck size={20} />, type: "extractor" },
    { id: "discharge_summary_agent", label: "Discharge Summary Extractor", icon: <HeartPulse size={20} />, type: "extractor" },
    { id: "pharmacy_bills_agent", label: "Pharmacy Bills Extractor", icon: <Pill size={20} />, type: "extractor" },
    { id: "cheque_or_bank_details_agent", label: "Cheque/Bank Extractor", icon: <Landmark size={20} />, type: "extractor" },
    { id: "ids_agent", label: "Identity Document Extractor", icon: <IdCard size={20} />, type: "extractor" },
    { id: "duplicate_detection_agent", label: "Duplicate Detection", icon: <CopyCheck size={20} />, type: "utility" },
    { id: "items_categorisation_agent", label: "Items Categorisation", icon: <Zap size={20} />, type: "utility" },
    { id: "nme_analysis_agent", label: "NME Analysis", icon: <Microscope size={20} />, type: "analysis" },
    { id: "patient_summary_agent", label: "Patient Summary", icon: <FileCheck size={20} />, type: "aggregate" },
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

// --- Type Definitions ---
type Node = { id: string; label: string; icon: React.ReactElement; type: string };
type Position = { x: number; y: number };
type TimedStep = { id: string; from: string; to: string; startTime: number; duration: number };

// --- Layout & Drawing Utilities ---
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
    const [cx1, cy1] = [ax + 80, ay];
    const [cx2, cy2] = [bx - 80, by];
    return `M ${ax} ${ay} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${bx} ${by}`;
}

// --- React Components ---

const NodeCard = ({ node, pos, isComplete }: { node: Node; pos: Position; isComplete: boolean; }) => {
    const typeStyles = {
        input: {
            gradient: "from-emerald-500 via-teal-500 to-cyan-500",
            bg: "bg-gradient-to-br from-emerald-500/15 via-teal-500/15 to-cyan-500/15",
            border: "border-emerald-400/60",
            text: "text-emerald-100",
            iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500",
            shadow: "shadow-emerald-500/25"
        },
        extractor: {
            gradient: "from-blue-500 via-indigo-500 to-purple-500",
            bg: "bg-gradient-to-br from-blue-500/15 via-indigo-500/15 to-purple-500/15",
            border: "border-blue-400/60",
            text: "text-blue-100",
            iconBg: "bg-gradient-to-br from-blue-400 to-indigo-500",
            shadow: "shadow-blue-500/25"
        },
        utility: {
            gradient: "from-amber-500 via-orange-500 to-red-500",
            bg: "bg-gradient-to-br from-amber-500/15 via-orange-500/15 to-red-500/15",
            border: "border-amber-400/60",
            text: "text-amber-100",
            iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
            shadow: "shadow-amber-500/25"
        },
        analysis: {
            gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
            bg: "bg-gradient-to-br from-violet-500/15 via-purple-500/15 to-fuchsia-500/15",
            border: "border-violet-400/60",
            text: "text-violet-100",
            iconBg: "bg-gradient-to-br from-violet-400 to-purple-500",
            shadow: "shadow-violet-500/25"
        },
        aggregate: {
            gradient: "from-rose-500 via-pink-500 to-purple-500",
            bg: "bg-gradient-to-br from-rose-500/15 via-pink-500/15 to-purple-500/15",
            border: "border-rose-400/60",
            text: "text-rose-100",
            iconBg: "bg-gradient-to-br from-rose-400 to-pink-500",
            shadow: "shadow-rose-500/25"
        },
        end: {
            gradient: "from-green-500 via-emerald-500 to-teal-500",
            bg: "bg-gradient-to-br from-green-500/15 via-emerald-500/15 to-teal-500/15",
            border: "border-green-400/60",
            text: "text-green-100",
            iconBg: "bg-gradient-to-br from-green-400 to-emerald-500",
            shadow: "shadow-green-500/25"
        }
    };

    const styles = typeStyles[node.type as keyof typeof typeStyles] || typeStyles.extractor;
    const completionClass = isComplete 
        ? 'border-orange-400 shadow-orange-400/40 ring-2 ring-orange-400/30' 
        : `border-white/20 ${styles.shadow}`;

    return (
        <motion.div
            layout
            id={`node-${node.id}`}
            style={{ left: pos.x, top: pos.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
            className={`absolute p-3 rounded-2xl shadow-2xl border-2 backdrop-blur-xl transition-all duration-700 ${styles.bg} ${completionClass} hover:scale-105 hover:shadow-3xl`}
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.8, type: "spring", stiffness: 120, damping: 15 }}
            whileHover={{ 
                scale: 1.05,
                transition: { duration: 0.2 }
            }}
        >
            <div className="flex items-center gap-3 h-full relative">
                <div className={`p-2 rounded-xl ${styles.iconBg} shadow-lg backdrop-blur-sm border border-white/20`}>
                    <div className="text-white drop-shadow-lg">
                        {node.icon}
                    </div>
                </div>
                <div className={`text-xs font-bold ${styles.text} leading-tight tracking-wide`}>
                    {node.label}
                </div>
                
                {/* Subtle inner glow effect */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${styles.gradient} opacity-5 pointer-events-none`} />
                
                {/* Completion indicator */}
                {isComplete && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white/80"
                    >
                        <CheckCircle2 size={14} className="text-white" />
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};

const MovingDoc = ({ start, end, duration }: { start: Position; end: Position; duration: number; }) => (
    <motion.div
        className="absolute z-40"
        initial={{
            x: start.x + NODE_WIDTH - 20,
            y: start.y + NODE_HEIGHT / 2 - 20,
            opacity: 0,
            scale: 0.5,
            rotate: -15
        }}
        animate={{
            x: end.x - 20,
            y: end.y + NODE_HEIGHT / 2 - 20,
            opacity: 1,
            scale: 1,
            rotate: 0
        }}
        transition={{ 
            duration: duration / 1000, 
            ease: [0.25, 0.46, 0.45, 0.94],
            scale: { duration: 0.3 },
            rotate: { duration: 0.4 }
        }}
    >
        <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full blur-md opacity-60 scale-110" />
            
            {/* Main icon */}
            <div className="relative bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-500 rounded-full p-3 shadow-2xl flex items-center justify-center border-2 border-white/90 backdrop-blur-sm">
                <FileText size={18} className="text-white drop-shadow-lg" />
                
                {/* Animated pulse ring */}
                <motion.div
                    className="absolute inset-0 rounded-full border-2 border-orange-300/50"
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.8, 0, 0.8]
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
            </div>
        </div>
    </motion.div>
);

const ResultsModal = ({ isOpen, onClose, data }: { isOpen: boolean; onClose: () => void; data: object }) => (
    <AnimatePresence>
        {isOpen && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-lg z-50 flex items-center justify-center p-8"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-gray-900/80 border border-white/20 rounded-3xl shadow-2xl w-full max-w-3xl h-full max-h-[85vh] flex flex-col overflow-hidden"
                >
                    <header className="flex items-center justify-between p-5 border-b border-white/20 flex-shrink-0">
                        <h3 className="font-bold text-xl text-white/90">Processing Complete: Final Output</h3>
                        <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-white/20 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </header>
                    <main className="flex-grow p-5 overflow-auto">
                        <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm">
                            <pre className="text-green-400 whitespace-pre-wrap">
                                {JSON.stringify(data, null, 2)}
                            </pre>
                        </div>
                    </main>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);


// --- Main App Component ---

export default function DocumentJourneyInteractive() {
    const [running, setRunning] = useState(false);
    const [finished, setFinished] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [completedNodes, setCompletedNodes] = useState<Set<string>>(new Set());
    const [visibleDocs, setVisibleDocs] = useState<TimedStep[]>([]);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const canvasRef = useRef<HTMLDivElement>(null);
    const timeoutIds = useRef<NodeJS.Timeout[]>([]);
    const finalArrivalsCounter = useRef(0);

    const nodes = useMemo<Node[]>(() => AGENTS, []);
    const positions = useMemo(() => generateCenteredPositions(dimensions.width, dimensions.height), [dimensions]);

    useEffect(() => {
        if (canvasRef.current) {
            // Set initial dimensions
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

    const startDemo = () => {
        timeoutIds.current.forEach(clearTimeout);
        timeoutIds.current = [];
        finalArrivalsCounter.current = 0;

        setRunning(true);
        setFinished(false);
        setIsModalOpen(false);
        setCompletedNodes(new Set(["input"]));
        setVisibleDocs([]);

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
            }, step.startTime));

            timeoutIds.current.push(setTimeout(() => {
                setCompletedNodes(prev => new Set(prev).add(step.to));
                setVisibleDocs(prev => prev.filter(d => d.id !== step.id));

                if (step.to === finalNodeId) {
                    finalArrivalsCounter.current++;
                    if (finalArrivalsCounter.current >= finalNodeInputs) {
                        setFinished(true);
                        setRunning(false);
                        setTimeout(() => setIsModalOpen(true), 500);
                    }
                }
            }, step.startTime + step.duration));
        });
    };

    useEffect(() => {
        return () => timeoutIds.current.forEach(clearTimeout);
    }, []);

    return (
        <div className="h-screen w-screen bg-gray-900 text-white flex flex-col font-sans overflow-hidden">
            <header className="flex items-center justify-between p-6 flex-shrink-0 z-10">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Agentic Framework </h2>
                    <p className="text-md text-gray-400 mt-1">Visualizing the intelligent document processing journey.</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 text-lg font-semibold">
                        {running && (<><Loader2 className="animate-spin text-orange-400" size={22}/> <span className="text-orange-400">Processing...</span></>)}
                        {finished && (<><CheckCircle className="text-green-400" size={22}/> <span className="text-green-400">Completed</span></>)}
                        {!running && !finished && (<span className="text-gray-500">Idle</span>)}
                    </div>
                    {finished && (
                        <button onClick={() => setIsModalOpen(true)} className="bg-white/10 border border-white/20 text-white px-5 py-2.5 rounded-full flex items-center gap-2 hover:bg-white/20 transition-all text-md font-semibold backdrop-blur-sm">
                            <Eye size={18} /> View Results
                        </button>
                    )}
                    <button onClick={startDemo} disabled={running} className="bg-gradient-to-br from-orange-500 to-amber-600 text-white px-6 py-3 rounded-full flex items-center gap-2 hover:from-orange-600 hover:to-amber-700 transition-all disabled:from-orange-400 disabled:to-amber-500 disabled:cursor-not-allowed text-md font-semibold shadow-lg shadow-orange-500/20">
                        {finished ? <RotateCcw size={18} /> : <Play size={18} />}
                        {finished ? "Run Again" : "Run"}
                    </button>
                </div>
            </header>

            <main className="flex-grow relative min-h-0">
                <div ref={canvasRef} className="absolute inset-0 w-full h-full p-4">
                    <div className="relative w-full h-full">
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="edge-gradient-primary" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" style={{stopColor: "rgba(59, 130, 246, 0.4)"}} />
                                    <stop offset="50%" style={{stopColor: "rgba(168, 85, 247, 0.6)"}} />
                                    <stop offset="100%" style={{stopColor: "rgba(236, 72, 153, 0.4)"}} />
                                </linearGradient>
                                <linearGradient id="edge-gradient-secondary" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" style={{stopColor: "rgba(34, 197, 94, 0.3)"}} />
                                    <stop offset="50%" style={{stopColor: "rgba(16, 185, 129, 0.5)"}} />
                                    <stop offset="100%" style={{stopColor: "rgba(6, 182, 212, 0.3)"}} />
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
                                return (
                                    <g key={`${from}-${to}`}>
                                        {/* Glow effect */}
                                        <path 
                                            d={pathBetween(posA, posB)} 
                                            fill="none" 
                                            stroke="url(#edge-gradient-primary)" 
                                            strokeWidth="6" 
                                            opacity="0.2"
                                            filter="url(#glow)"
                                        />
                                        {/* Main path */}
                                        <path 
                                            d={pathBetween(posA, posB)} 
                                            fill="none" 
                                            stroke={isActive ? "url(#edge-gradient-primary)" : "url(#edge-gradient-secondary)"} 
                                            strokeWidth="3" 
                                            opacity={isActive ? 1 : 0.6}
                                            className="transition-all duration-500"
                                        />
                                    </g>
                                );
                            })}
                        </svg>

                        {nodes.map(n => positions[n.id] && <NodeCard key={n.id} node={n} pos={positions[n.id]} isComplete={completedNodes.has(n.id)} />)}
                        
                        <AnimatePresence>
                            {visibleDocs.map(doc => positions[doc.from] && positions[doc.to] && <MovingDoc key={doc.id} start={positions[doc.from]} end={positions[doc.to]} duration={doc.duration} />)}
                        </AnimatePresence>
                    </div>
                </div>
            </main>

            <ResultsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} data={FINAL_AGGREGATED_OUTPUT} />
        </div>
    );
}