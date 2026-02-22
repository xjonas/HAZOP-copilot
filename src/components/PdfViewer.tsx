'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, RotateCw, Maximize, Move, ChevronDown } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface PdfFile {
    name: string;
    url: string | File;
}

export interface NodeOverlay {
    label: string;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface PdfViewerProps {
    files: PdfFile[];
    activeFileIndex?: number;
    onFileChange?: (index: number) => void;
    showPredictions?: boolean;
    nodeOverlays?: NodeOverlay[];
    className?: string;
    locked?: boolean;
}

const PdfViewer: React.FC<PdfViewerProps> = ({
    files,
    activeFileIndex = 0,
    onFileChange,
    showPredictions = false,
    nodeOverlays,
    className,
    locked = false
}) => {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);
    const [rotation, setRotation] = useState<number>(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
    const [isMoveMode, setIsMoveMode] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.pdf-file-dropdown-container')) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const containerRef = useRef<HTMLDivElement>(null);
    const activeFile = files[activeFileIndex];

    const isPdf = activeFile?.name.toLowerCase().endsWith('.pdf');

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setPageNumber(1);
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isMoveMode || !containerRef.current) return;
        setIsDragging(true);
        setStartPos({ x: e.clientX, y: e.clientY });
        setScrollPos({
            x: containerRef.current.scrollLeft,
            y: containerRef.current.scrollTop
        });
        containerRef.current.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !isMoveMode || !containerRef.current) return;
        const dx = e.clientX - startPos.x;
        const dy = e.clientY - startPos.y;
        containerRef.current.scrollLeft = scrollPos.x - dx;
        containerRef.current.scrollTop = scrollPos.y - dy;
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        if (containerRef.current) {
            containerRef.current.style.cursor = isMoveMode ? 'grab' : 'default';
        }
    };

    // Reset state on file change
    useEffect(() => {
        setPageNumber(1);
        setScale(1.0);
        setRotation(0);
    }, [activeFileIndex]);


    return (
        <div className={`flex flex-col h-full bg-[var(--color-slate-100)] border-r border-[var(--color-slate-200)] ${className}`}>
            {/* Toolbar */}
            <div className="h-12 bg-white border-b border-[var(--color-slate-200)] flex items-center justify-between px-4 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="relative pdf-file-dropdown-container">
                        <button
                            onClick={() => !locked && setIsDropdownOpen(!isDropdownOpen)}
                            className={`flex items-center gap-2 text-sm font-medium ${locked ? 'text-[var(--color-slate-500)] cursor-default' : 'text-[var(--color-slate-700)] hover:text-[var(--color-primary-600)]'}`}
                        >
                            {activeFile ? activeFile.name : 'No File Selected'}
                            {!locked && <ChevronDown size={14} />}
                        </button>

                        {/* File Dropdown */}
                        {isDropdownOpen && !locked && (
                            <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-[var(--color-slate-200)] py-1 z-20 animate-in fade-in zoom-in-95 duration-200">
                                {files.length > 0 ? files.map((file, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            onFileChange?.(idx);
                                            // Keep open as requested
                                        }}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-slate-50)] ${idx === activeFileIndex ? 'text-[var(--color-primary-600)] font-medium' : 'text-[var(--color-slate-600)]'
                                            }`}
                                    >
                                        {file.name}
                                    </button>
                                )) : (
                                    <div className="px-4 py-2 text-sm text-[var(--color-slate-400)]">No files available</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Pagination (only for PDFs) */}
                {isPdf && numPages > 0 && (
                    <div className="flex items-center gap-2 text-sm text-[var(--color-slate-600)]">
                        <button
                            disabled={pageNumber <= 1}
                            onClick={() => setPageNumber(p => p - 1)}
                            className="disabled:opacity-30 hover:text-[var(--color-primary-600)]"
                        >
                            Prev
                        </button>
                        <span>{pageNumber} / {numPages}</span>
                        <button
                            disabled={pageNumber >= numPages}
                            onClick={() => setPageNumber(p => p + 1)}
                            className="disabled:opacity-30 hover:text-[var(--color-primary-600)]"
                        >
                            Next
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                        className="p-1.5 text-[var(--color-slate-500)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-slate-100)] rounded"
                        title="Zoom Out"
                    >
                        <ZoomOut size={18} />
                    </button>
                    <span className="text-xs font-medium w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button
                        onClick={() => setScale(s => Math.min(2.5, s + 0.1))}
                        className="p-1.5 text-[var(--color-slate-500)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-slate-100)] rounded"
                        title="Zoom In"
                    >
                        <ZoomIn size={18} />
                    </button>
                    <div className="w-px h-4 bg-[var(--color-slate-300)] mx-2"></div>
                    <button
                        onClick={() => setRotation(r => (r + 90) % 360)}
                        className="p-1.5 text-[var(--color-slate-500)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-slate-100)] rounded"
                        title="Rotate"
                    >
                        <RotateCw size={18} />
                    </button>
                    <button
                        onClick={() => setIsMoveMode(!isMoveMode)}
                        className={`p-1.5 rounded ${isMoveMode ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-600)]' : 'text-[var(--color-slate-500)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-slate-100)]'}`}
                        title="Move Tool"
                    >
                        <Move size={18} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div
                ref={containerRef}
                className={`flex-1 overflow-auto flex items-start justify-center p-8 relative ${isMoveMode ? 'cursor-grab' : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {activeFile ? (
                    <div className="relative shadow-lg inline-block">
                        {isPdf ? (
                            <Document
                                file={activeFile.url}
                                onLoadSuccess={onDocumentLoadSuccess}
                            >
                                <Page
                                    pageNumber={pageNumber}
                                    scale={scale}
                                    rotate={rotation}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    className="bg-white"
                                />
                            </Document>
                        ) : (
                            /* Image Viewer */
                            <div
                                style={{
                                    transform: `scale(${scale}) rotate(${rotation}deg)`,
                                    transformOrigin: 'top center',
                                    transition: 'transform 0.2s ease-out'
                                }}
                                className="bg-white"
                            >
                                <img
                                    // Handle File object (for upload preview) or URL string
                                    src={activeFile.url instanceof File ? URL.createObjectURL(activeFile.url) : activeFile.url}
                                    alt={activeFile.name}
                                    className="max-w-none"
                                    style={{ display: 'block' }}
                                    draggable={false}
                                />
                            </div>
                        )}

                        {/* Node Overlays (Predictions) */}
                        {(showPredictions || (nodeOverlays && nodeOverlays.length > 0)) && (
                            <div className="absolute inset-0 pointer-events-none" style={{ transform: !isPdf ? `scale(${scale}) rotate(${rotation}deg)` : 'none', transformOrigin: 'top center' }}>
                                {/* Note: Overlay positioning on images vs PDF pages might differ in scale origin */}
                                {nodeOverlays?.map((node, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            left: node.x * scale,
                                            top: node.y * scale,
                                            width: node.width * scale,
                                            height: node.height * scale,
                                            borderColor: node.color,
                                            backgroundColor: `${node.color}15`,
                                        }}
                                        className="absolute border-2 rounded-lg"
                                    >
                                        <span
                                            className="text-white text-[10px] px-1.5 py-0.5 font-bold rounded-br-lg"
                                            style={{ backgroundColor: node.color }}
                                        >
                                            {node.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-[var(--color-slate-400)]">
                        <div className="w-24 h-24 border-4 border-dashed border-[var(--color-slate-300)] rounded-xl mx-auto mb-4 flex items-center justify-center">
                            <Maximize size={32} className="opacity-50" />
                        </div>
                        <p>No File Selected</p>
                        <p className="text-sm">Select a file from the dropdown</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PdfViewer;
