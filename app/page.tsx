'use client';

import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, ClipboardCheck, HeartPulse, Pill, IdCard, Landmark,
  CopyCheck, Microscope, FileCheck, RotateCcw, Zap, CheckCircle2,
  Loader2, CheckCircle, X, Eye, Play, Clock, FileStack
} from "lucide-react";

// --- Configuration ---
const NODE_WIDTH = 180;
const NODE_HEIGHT = 90;

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

// --- Layout ---
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

// --- Node Component ---
const NodeCard = ({ node, pos, isComplete, isProcessing }: { node: Node; pos: Position; isComplete: boolean; isProcessing: boolean }) => {
    const typeStyles = {
        input: {
            bg: "bg-slate-800/90",
            border: "border-slate-600",
            text: "text-slate-100",
            iconBg: "bg-slate-700",
        },
        extractor: {
            bg: "bg-slate-800/90",
            border: "border-slate-600",
            text: "text-slate-100",
            iconBg: "bg-slate-700",
        },
        utility: {
            bg: "bg-slate-800/90",
            border: "border-slate-600",
            text: "text-slate-100",
            iconBg: "bg-slate-700",
        },
        analysis: {
            bg: "bg-slate-800/90",
            border: "border-slate-600",
            text: "text-slate-100",
            iconBg: "bg-slate-700",
        },
        aggregate: {
            bg: "bg-slate-800/90",
            border: "border-slate-600",
            text: "text-slate-100",
            iconBg: "bg-slate-700",
        },
        end: {
            bg: "bg-slate-800/90",
            border: "border-slate-600",
            text: "text-slate-100",
            iconBg: "bg-slate-700",
        }
    };

    const styles = typeStyles[node.type as keyof typeof typeStyles] || typeStyles.extractor;
    
    let statusClass = styles.border;
    if (isComplete) {
        statusClass = 'border-orange-500 shadow-lg shadow-orange-500/20';
    } else if (isProcessing) {
        statusClass = 'border-orange-400/60 shadow-md shadow-orange-400/10';
    }

    return (
        <motion.div
            layout
            id={`node-${node.id}`}
            style={{ left: pos.x, top: pos.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
            className={`absolute rounded-xl border-2 backdrop-blur-sm transition-all duration-500 ${styles.bg} ${statusClass}`}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
        >
            <div className="flex items-center gap-3 h-full p-4 relative">
                <div className={`p-2.5 rounded-lg ${styles.iconBg} flex-shrink-0`}>
                    <div className="text-slate-200">
                        {node.icon}
                    </div>
                </div>
                <div className={`text-sm font-medium ${styles.text} leading-tight flex-1`}>
                    {node.label}
                </div>
                
                {isComplete && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-lg"
                    >
                        <CheckCircle2 size={14} className="text-white" />
                    </motion.div>
                )}
                
                {isProcessing && !isComplete && (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-lg"
                    >
                        <Loader2 size={14} className="text-white" />
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};

// --- Moving Document ---
const MovingDoc = ({ start, end, duration }: { start: Position; end: Position; duration: number }) => (
    <motion.div
        className="absolute z-40"
        initial={{
            x: start.x + NODE_WIDTH - 16,
            y: start.y + NODE_HEIGHT / 2 - 16,
            opacity: 0,
            scale: 0.8,
        }}
        animate={{
            x: end.x - 16,
            y: end.y + NODE_HEIGHT / 2 - 16,
            opacity: 1,
            scale: 1,
        }}
        transition={{ 
            duration: duration / 1000, 
            ease: [0.4, 0, 0.2, 1],
        }}
    >
        <div className="relative">
            <div className="absolute inset-0 bg-orange-500 rounded-lg blur-md opacity-40" />
            <div className="relative bg-orange-500 rounded-lg p-2 shadow-xl flex items-center justify-center">
                <FileText size={16} className="text-white" />
            </div>
        </div>
    </motion.div>
);

// --- Results Modal ---
const ResultsModal = ({ isOpen, onClose, data }: { isOpen: boolean; onClose: () => void; data: object }) => (
    <AnimatePresence>
        {isOpen && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-8"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
                >
                    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
                        <div>
                            <h3 className="font-semibold text-lg text-slate-100">Processing Complete</h3>
                            <p className="text-sm text-slate-400 mt-0.5">Final aggregated output</p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
                            <X size={20} />
                        </button>
                    </header>
                    <main className="flex-grow p-6 overflow-auto">
                        <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs border border-slate-800">
                            <pre className="text-emerald-400 whitespace-pre-wrap">
                                {JSON.stringify(data, null, 2)}
                            </pre>
                        </div>
                    </main>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);

// --- Main Component ---
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

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col font-sans overflow-hidden">
            <header className="flex items-center justify-between px-8 py-3 flex-shrink-0 z-10 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-100">Agentic Document Processing</h2>
                    <p className="text-sm text-slate-400 mt-1">Intelligent workflow orchestration and analysis</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        {(running || finished) && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
                                <Clock size={16} className="text-slate-400" />
                                <span className="text-sm font-medium text-slate-300">{formatTime(elapsedTime)}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
                            {running && (
                                <>
                                    <Loader2 className="animate-spin text-orange-500" size={18}/>
                                    <span className="text-sm font-medium text-orange-500">Processing</span>
                                </>
                            )}
                            {finished && (
                                <>
                                    <CheckCircle className="text-emerald-500" size={18}/>
                                    <span className="text-sm font-medium text-emerald-500">Completed</span>
                                </>
                            )}
                            {!running && !finished && (
                                <span className="text-sm font-medium text-slate-400">Ready</span>
                            )}
                        </div>
                    </div>
                    {finished && (
                        <button 
                            onClick={() => setIsModalOpen(true)} 
                            className="bg-slate-800 border border-slate-700 text-slate-100 px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-slate-750 transition-all text-sm font-medium"
                        >
                            <Eye size={16} /> View Output
                        </button>
                    )}
                    <button 
                        onClick={startDemo} 
                        disabled={running} 
                        className="bg-orange-600 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 hover:bg-orange-700 transition-all disabled:bg-orange-600/50 disabled:cursor-not-allowed text-sm font-medium shadow-lg shadow-orange-600/20"
                    >
                        {finished ? <RotateCcw size={16} /> : <Play size={16} />}
                        {finished ? "Run Again" : "Start Processing"}
                    </button>
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
                                    <stop offset="0%" style={{stopColor: "rgba(249, 115, 22, 0.6)"}} />
                                    <stop offset="50%" style={{stopColor: "rgba(251, 146, 60, 0.4)"}} />
                                    <stop offset="100%" style={{stopColor: "rgba(249, 115, 22, 0.2)"}} />
                                </linearGradient>
                            </defs>
                            {EDGES.map(([from, to]) => {
                                const posA = positions[from];
                                const posB = positions[to];
                                if (!posA || !posB) return null;
                                const isActive = completedNodes.has(from) && completedNodes.has(to);
                                return (
                                    <path 
                                        key={`${from}-${to}`}
                                        d={pathBetween(posA, posB)} 
                                        fill="none" 
                                        stroke={isActive ? "url(#edge-gradient-active)" : "url(#edge-gradient-inactive)"} 
                                        strokeWidth="2" 
                                        className="transition-all duration-700"
                                    />
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
            </main>

            <ResultsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} data={FINAL_AGGREGATED_OUTPUT} />
        </div>
    );
}