import React, { useEffect, useState, useRef } from 'react';
import { AssessmentResult, AssessmentType, Student, DrawingPhase, WritingPhase } from '../types';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from 'recharts';
import { 
  BookOpen, Calculator, Brain, Palette, Pencil, MessageCircle, Layers, 
  Calendar, GraduationCap, AlertCircle, CheckCircle, ArrowLeft, Printer, Download, Loader2,
  TrendingUp, TrendingDown, Minus, Image as ImageIcon, ChevronRight
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
  student: Student;
  assessments: AssessmentResult[];
  onBack: () => void;
}

// Order Definitions for Trend Calculation
const DRAWING_ORDER = [
  DrawingPhase.GARATUJA_DESORDENADA,
  DrawingPhase.GARATUJA_ORDENADA,
  DrawingPhase.PRE_ESQUEMATISMO,
  DrawingPhase.ESQUEMATISMO,
  DrawingPhase.REALISMO,
  DrawingPhase.PSEUDO_NATURALISMO
];

const WRITING_ORDER = [
  WritingPhase.PRE_ALFABETICA,
  WritingPhase.ALFABETICA_PARCIAL,
  WritingPhase.ALFABETICA_COMPLETA,
  WritingPhase.ALFABETICA_CONSOLIDADA
];

export const ConsolidatedStudentView: React.FC<Props> = ({ student, assessments, onBack }) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Set document title for PDF filename
  useEffect(() => {
    const originalTitle = document.title;
    document.title = `Relatório Pedagógico - ${student.name} - ${new Date().toLocaleDateString('pt-BR')}`;
    return () => {
      document.title = originalTitle;
    };
  }, [student.name]);

  // Helper: Get latest assessment of a type
  const getHistory = (type: AssessmentType) => {
    return assessments
      .filter(a => a.studentId === student.id && a.type === type)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const drawingHistory = getHistory(AssessmentType.DRAWING);
  const writingHistory = getHistory(AssessmentType.WRITING);
  const mathHistory = getHistory(AssessmentType.MATH);
  const readingHistory = getHistory(AssessmentType.READING);

  const latestDrawing = drawingHistory[0];
  const latestWriting = writingHistory[0];
  const latestMath = mathHistory[0];
  const latestReading = readingHistory[0];
  const latestPhono = getHistory(AssessmentType.PHONOLOGICAL)[0];
  const latestMemory = getHistory(AssessmentType.MEMORY)[0];

  // Get last 3 drawings for the gallery
  const recentDrawings = assessments
    .filter(a => a.studentId === student.id && a.type === AssessmentType.DRAWING && a.imageUrl)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  // --- Trend Calculation Logic ---
  const calculateTrend = (type: AssessmentType) => {
    const history = getHistory(type);
    if (history.length < 2) return null; // Need at least 2 points to compare

    const current = history[0];
    const previous = history[1];

    // Drawing & Writing: Compare Phase Index
    if (type === AssessmentType.DRAWING) {
      const currIdx = DRAWING_ORDER.indexOf(current.phase as DrawingPhase);
      const prevIdx = DRAWING_ORDER.indexOf(previous.phase as DrawingPhase);
      if (currIdx > prevIdx) return { type: 'up', label: 'Evoluiu de Fase' };
      if (currIdx < prevIdx) return { type: 'down', label: 'Regressão' };
      return { type: 'flat', label: 'Estável' };
    }

    if (type === AssessmentType.WRITING) {
      const currIdx = WRITING_ORDER.indexOf(current.phase as WritingPhase);
      const prevIdx = WRITING_ORDER.indexOf(previous.phase as WritingPhase);
      if (currIdx > prevIdx) return { type: 'up', label: 'Avançou na Escrita' };
      if (currIdx < prevIdx) return { type: 'down', label: 'Regressão' };
      return { type: 'flat', label: 'Estável' };
    }

    // Math & Reading: Compare Score
    if (type === AssessmentType.MATH || type === AssessmentType.READING) {
      const currScore = current.score || 0;
      const prevScore = previous.score || 0;
      const diff = currScore - prevScore;

      if (diff > 0) return { type: 'up', label: `+${diff} pontos` };
      if (diff < 0) return { type: 'down', label: `${diff} pontos` };
      return { type: 'flat', label: 'Mantido' };
    }

    return null;
  };

  const drawingTrend = calculateTrend(AssessmentType.DRAWING);
  const writingTrend = calculateTrend(AssessmentType.WRITING);
  const mathTrend = calculateTrend(AssessmentType.MATH);
  const readingTrend = calculateTrend(AssessmentType.READING);

  // --- Visual Components for Progress ---

  const PhaseStepper = ({ currentPhase, allPhases, colorBase }: { currentPhase?: string, allPhases: string[], colorBase: string }) => {
    if (!currentPhase) return null;
    const currentIndex = allPhases.indexOf(currentPhase as any);
    
    // Fallback if phase not found
    if (currentIndex === -1) return null;

    return (
      <div className="mt-3">
        <div className="flex gap-1 h-1.5 w-full">
          {allPhases.map((_, idx) => (
            <div 
              key={idx}
              className={`flex-1 rounded-full transition-all duration-500 ${
                idx <= currentIndex 
                  ? `${colorBase} opacity-100` 
                  : 'bg-gray-200 dark:bg-gray-600 opacity-50'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between items-center mt-1">
          <p className="text-[10px] text-gray-400 font-medium">Início</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">
             Fase {currentIndex + 1} de {allPhases.length}
          </p>
        </div>
      </div>
    );
  };

  const ScoreProgress = ({ current, previous, max = 10, colorClass }: { current: number, previous?: number, max?: number, colorClass: string }) => {
    const currentPercent = (current / max) * 100;
    const previousPercent = previous !== undefined ? (previous / max) * 100 : 0;
    
    return (
      <div className="mt-3 w-full">
         <div className="relative h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            {/* Previous Score Marker (Ghost) */}
            {previous !== undefined && (
              <div 
                className="absolute top-0 bottom-0 bg-gray-300 dark:bg-gray-500 opacity-50 transition-all duration-500"
                style={{ width: `${previousPercent}%` }}
              />
            )}
            {/* Current Score Bar */}
            <div 
              className={`absolute top-0 bottom-0 ${colorClass} transition-all duration-700`}
              style={{ width: `${currentPercent}%` }}
            />
         </div>
         <div className="flex justify-between items-center mt-1 text-[10px]">
            <span className="text-gray-400">0</span>
            {previous !== undefined && (
              <span className="text-gray-400 hidden sm:inline">
                 Anterior: <span className="font-bold">{previous}</span>
              </span>
            )}
            <span className="text-gray-500 font-bold">{max}</span>
         </div>
      </div>
    );
  };

  // --- Render Trend Badge ---
  const TrendBadge = ({ trend }: { trend: { type: string, label: string } | null }) => {
    if (!trend) return null;

    let colorClass = "";
    let Icon = Minus;

    if (trend.type === 'up') {
      colorClass = "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
      Icon = TrendingUp;
    } else if (trend.type === 'down') {
      colorClass = "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
      Icon = TrendingDown;
    } else {
      colorClass = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
      Icon = Minus;
    }

    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ml-2 ${colorClass}`}>
        <Icon size={12} />
        {trend.label}
      </div>
    );
  };

  // --- Data Parsers ---

  // Parse Reading Scores from AI String
  const getReadingData = () => {
    if (!latestReading || !latestReading.aiAnalysis) return null;
    const fluency = latestReading.aiAnalysis.match(/Fluência:\s*(\d+)/)?.[1] || 0;
    const decoding = latestReading.aiAnalysis.match(/Decodificação:\s*(\d+)/)?.[1] || 0;
    const comprehension = latestReading.aiAnalysis.match(/Compreensão:\s*(\d+)/)?.[1] || 0;

    return [
      { subject: 'Fluência', A: parseInt(fluency as string), fullMark: 10 },
      { subject: 'Decodif.', A: parseInt(decoding as string), fullMark: 10 },
      { subject: 'Compreens.', A: parseInt(comprehension as string), fullMark: 10 },
    ];
  };

  // Parse Math Notes into Radar Data
  const getMathRadarData = () => {
    if (!latestMath || !latestMath.notes) return [];
    return latestMath.notes.split('; ').map(part => {
      const [label, val] = part.split(': ');
      return {
        subject: label,
        A: parseInt(val),
        fullMark: 10
      };
    });
  };

  // Parse Phono Notes
  const getPhonoData = () => {
    if (!latestPhono || !latestPhono.notes) return [];
    const levelToNum: Record<string, number> = { 'Não iniciou': 1, 'Em processo': 2, 'Consolidado': 3 };
    
    return latestPhono.notes.split('; ').map(part => {
      const [label, val] = part.split(': ');
      return {
        name: label,
        level: levelToNum[val] || 0,
        label: val
      };
    });
  };

  // Parse Memory Notes
  const getMemoryData = () => {
    if (!latestMemory || !latestMemory.notes) return [];
    const levelToLabel: Record<string, string> = { '1': 'Baixo', '2': 'Médio', '3': 'Alto' };
    
    return latestMemory.notes.split(', ').map(part => {
      const [label, val] = part.split(': ');
      return {
        name: label,
        level: parseInt(val),
        labelName: levelToLabel[val]
      };
    });
  };

  const mathData = getMathRadarData();
  const readingData = getReadingData();
  const phonoData = getPhonoData();
  const memoryData = getMemoryData();

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    
    const element = reportRef.current;
    if (!element) {
      setIsGeneratingPdf(false);
      return;
    }

    try {
      // 1. Create a dedicated container for capture to prevent layout shifts
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.top = '-10000px';
      container.style.left = '0';
      // Use a fixed width to ensure charts render with consistent dimensions
      container.style.width = '1200px'; 
      container.style.zIndex = '-1000';
      document.body.appendChild(container);

      // 2. Clone the report
      const clone = element.cloneNode(true) as HTMLElement;
      
      // 3. Clean up clone
      const noPrints = clone.querySelectorAll('.no-print');
      noPrints.forEach(el => el.remove());

      // 4. Force styles for the PDF view
      clone.style.width = '100%';
      clone.style.height = 'auto';
      clone.style.overflow = 'visible';
      clone.style.backgroundColor = '#ffffff';
      clone.classList.remove('min-h-screen'); // Remove screen height constraints
      clone.classList.remove('md:min-h-0');

      // 5. CRITICAL: Fix SVG (Recharts) dimensions in the clone
      // Recharts often collapses in a clone because it relies on parent flexbox dimensions.
      // We manually set fixed pixel width/height on all SVGs based on their original render.
      const originalSvgs = element.querySelectorAll('svg');
      const cloneSvgs = clone.querySelectorAll('svg');
      
      cloneSvgs.forEach((svg, index) => {
        if (originalSvgs[index]) {
          const rect = originalSvgs[index].getBoundingClientRect();
          svg.setAttribute('width', `${rect.width}`);
          svg.setAttribute('height', `${rect.height}`);
          svg.style.width = `${rect.width}px`;
          svg.style.height = `${rect.height}px`;
        }
      });

      // Expand all scrollable areas
      const scrollables = clone.querySelectorAll('.overflow-y-auto');
      scrollables.forEach(el => {
        (el as HTMLElement).style.overflow = 'visible';
        (el as HTMLElement).style.height = 'auto';
      });

      container.appendChild(clone);

      // 6. Wait for rendering stability
      await new Promise(resolve => setTimeout(resolve, 800));

      // 7. Capture with optimized settings
      const canvas = await html2canvas(clone, {
        scale: 2, // High DPI for crisp text/charts
        useCORS: true, // Handle external images
        logging: false,
        width: 1200, 
        windowWidth: 1200,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
           // Extra safety: ensure dark mode text is black for PDF
           const allText = clonedDoc.querySelectorAll('*');
           allText.forEach((el) => {
             const style = window.getComputedStyle(el as Element);
             if (style.color && style.color.includes('255, 255, 255')) { // If white text
                (el as HTMLElement).style.color = '#1f2937'; // Set to gray-800
             }
           });
        }
      });

      // 8. Cleanup DOM
      document.body.removeChild(container);

      // 9. Generate PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.90);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = 210; 
      const pdfHeight = 297; 
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add pages
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -(imgHeight - heightLeft), pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const safeName = student.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`Relatorio_${safeName}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);

    } catch (error) {
      console.error("PDF Generation failed", error);
      alert("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div 
      ref={reportRef}
      id="printable-report" 
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-screen md:min-h-0 flex flex-col animate-fade-in"
    >
      
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-orange-50/50 dark:bg-gray-900/50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-white dark:hover:bg-gray-700 text-gray-500 transition-colors no-print">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{student.name}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span className="flex items-center gap-1"><GraduationCap size={14} /> {student.grade}</span>
              <span className="flex items-center gap-1"><Calendar size={14} /> {student.age} anos</span>
            </div>
          </div>
        </div>
        <button 
          onClick={handleDownloadPDF}
          disabled={isGeneratingPdf}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white border border-transparent rounded-lg text-sm font-bold transition-colors shadow-md no-print"
        >
          {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          <span>{isGeneratingPdf ? "Gerando..." : "Baixar Relatório PDF"}</span>
        </button>
      </div>

      <div className="p-6 md:p-8 overflow-y-auto">
        
        {/* Row 1: Psychogenetic Phases (Visual) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Drawing */}
          <div className="bg-white dark:bg-gray-700 rounded-xl border border-orange-100 dark:border-gray-600 p-5 shadow-sm relative overflow-hidden group flex flex-col">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Palette size={64} className="text-orange-500" />
            </div>
            <div className="flex justify-between items-start relative z-10 w-full">
              <div className="flex-1 pr-4">
                <div className="flex items-center mb-1">
                   <h3 className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">Fase do Desenho</h3>
                   <TrendBadge trend={drawingTrend} />
                </div>
                <p className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white mb-2 leading-tight">
                  {latestDrawing?.phase || 'Não Avaliado'}
                </p>
                <p className="text-xs text-gray-400 mb-2">
                  {latestDrawing ? new Date(latestDrawing.date).toLocaleDateString('pt-BR') : '-'}
                </p>
                
                {/* Visual Progress Stepper */}
                <PhaseStepper 
                  currentPhase={latestDrawing?.phase} 
                  allPhases={DRAWING_ORDER} 
                  colorBase="bg-orange-500" 
                />

              </div>
              {latestDrawing?.imageUrl && (
                <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={latestDrawing.imageUrl} alt="Desenho" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            {latestDrawing?.aiAnalysis && (
              <div className="mt-4 pt-4 border-t border-orange-50 dark:border-gray-600 relative z-10">
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 italic">
                  "{latestDrawing.aiAnalysis}"
                </p>
              </div>
            )}
          </div>

          {/* Writing */}
          <div className="bg-white dark:bg-gray-700 rounded-xl border border-teal-100 dark:border-gray-600 p-5 shadow-sm relative overflow-hidden group flex flex-col">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Pencil size={64} className="text-teal-500" />
            </div>
            <div className="flex justify-between items-start relative z-10 w-full">
              <div className="flex-1 pr-4">
                <div className="flex items-center mb-1">
                  <h3 className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">Fase da Escrita</h3>
                  <TrendBadge trend={writingTrend} />
                </div>
                <p className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white mb-2 leading-tight">
                  {latestWriting?.phase || 'Não Avaliado'}
                </p>
                <p className="text-xs text-gray-400 mb-2">
                  {latestWriting ? new Date(latestWriting.date).toLocaleDateString('pt-BR') : '-'}
                </p>

                {/* Visual Progress Stepper */}
                <PhaseStepper 
                  currentPhase={latestWriting?.phase} 
                  allPhases={WRITING_ORDER} 
                  colorBase="bg-teal-500" 
                />

              </div>
              {latestWriting?.imageUrl && (
                <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 shrink-0">
                  <img src={latestWriting.imageUrl} alt="Escrita" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
             {latestWriting?.aiAnalysis && (
              <div className="mt-4 pt-4 border-t border-teal-50 dark:border-gray-600 relative z-10">
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 italic">
                  "{latestWriting.aiAnalysis}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Row 1.5: Drawing Gallery */}
        {recentDrawings.length > 0 && (
          <div className="mb-8">
            <h3 className="text-base font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <ImageIcon size={18} className="text-orange-500" />
              Evolução Gráfica (Últimos Registros)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {recentDrawings.map((drawing) => (
                <div key={drawing.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-600 flex flex-col">
                  <div className="aspect-square w-full rounded-lg overflow-hidden bg-white dark:bg-gray-800 mb-3 border border-gray-200 dark:border-gray-600">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img src={drawing.imageUrl} alt="Desenho Histórico" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="mt-auto">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {new Date(drawing.date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <span className="inline-block text-[10px] sm:text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40 px-2 py-1 rounded truncate w-full text-center">
                      {drawing.phase}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Row 2: Charts (Math & Reading) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
          {/* Math Radar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg text-orange-600 dark:text-orange-400">
                <Calculator size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 dark:text-white">Perfil Matemático</h3>
                <div className="flex items-center gap-2 mt-1">
                   <span className="text-2xl font-bold text-orange-600">{latestMath?.score || 0}<span className="text-sm text-gray-400 font-normal">/100</span></span>
                   <TrendBadge trend={mathTrend} />
                </div>
                {/* Math Score Progress (Global Score) */}
                <div className="max-w-[200px]">
                   <ScoreProgress 
                      current={latestMath?.score || 0} 
                      previous={mathHistory[1]?.score} 
                      max={100} 
                      colorClass="bg-orange-500" 
                    />
                </div>
              </div>
            </div>

            <div className="h-64 flex items-center justify-center mt-4">
              {mathData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={mathData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                    <Radar
                      name="Aluno"
                      dataKey="A"
                      stroke="#f97316"
                      fill="#f97316"
                      fillOpacity={0.4}
                      isAnimationActive={false} // Important for PDF generation
                    />
                    <Tooltip 
                       contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-gray-400 text-sm italic">Sem dados matemáticos.</div>
              )}
            </div>
          </div>

          {/* Reading Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm flex flex-col">
             <div className="flex items-center gap-2 mb-4">
              <div className="bg-cyan-100 dark:bg-cyan-900/30 p-2 rounded-lg text-cyan-600 dark:text-cyan-400">
                <BookOpen size={20} />
              </div>
              <div className="flex-1">
                 <h3 className="font-bold text-gray-800 dark:text-white">Nível de Leitura</h3>
                 <div className="flex items-center gap-2 mt-1">
                   <span className="text-2xl font-bold text-cyan-600">{latestReading?.score || 0}<span className="text-sm text-gray-400 font-normal">/10</span></span>
                   <TrendBadge trend={readingTrend} />
                 </div>
                 {/* Reading Score Progress */}
                 <div className="max-w-[200px]">
                   <ScoreProgress 
                      current={latestReading?.score || 0} 
                      previous={readingHistory[1]?.score} 
                      max={10} 
                      colorClass="bg-cyan-500" 
                    />
                 </div>
              </div>
            </div>
            
            {readingData ? (
              <div className="flex flex-col justify-center h-auto gap-4 mt-2">
                 {readingData.map((item) => (
                   <div key={item.subject}>
                     <div className="flex justify-between text-sm mb-1">
                       <span className="font-bold text-gray-700 dark:text-gray-300">{item.subject}</span>
                       <span className="text-cyan-600 dark:text-cyan-400 font-bold">{item.A}/10</span>
                     </div>
                     <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-cyan-500 rounded-full" 
                         style={{ width: `${item.A * 10}%` }}
                       ></div>
                     </div>
                   </div>
                 ))}
                 {latestReading?.aiAnalysis && (
                   <div className="mt-2 bg-cyan-50 dark:bg-gray-900/30 p-3 rounded-lg border border-cyan-100 dark:border-gray-700">
                     <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                       {latestReading.aiAnalysis}
                     </p>
                   </div>
                 )}
              </div>
            ) : (
               <div className="h-64 flex items-center justify-center text-center text-gray-400 text-sm italic">
                  Sem dados de leitura.
               </div>
            )}
          </div>
        </div>

        {/* Row 3: Neuro (Phono & Memory) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Phonological */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
             <div className="flex items-center gap-2 mb-6">
              <div className="bg-teal-100 dark:bg-teal-900/30 p-2 rounded-lg text-teal-600 dark:text-teal-400">
                <MessageCircle size={20} />
              </div>
              <h3 className="font-bold text-gray-800 dark:text-white">Consciência Fonológica</h3>
            </div>
            
            <div className="space-y-4">
              {phonoData.length > 0 ? phonoData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-24 text-xs font-bold text-gray-600 dark:text-gray-400 text-right">{item.name}</div>
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3].map(step => (
                      <div 
                        key={step} 
                        className={`h-2 flex-1 rounded-full ${
                          item.level >= step 
                            ? step === 3 ? 'bg-emerald-500' : step === 2 ? 'bg-amber-400' : 'bg-red-400'
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`} 
                      />
                    ))}
                  </div>
                  <div className="w-24 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                    {item.label}
                  </div>
                </div>
              )) : (
                <div className="text-center text-gray-400 text-sm italic py-8">Sem dados fonológicos.</div>
              )}
            </div>
          </div>

          {/* Memory */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
             <div className="flex items-center gap-2 mb-6">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600 dark:text-purple-400">
                <Layers size={20} />
              </div>
              <h3 className="font-bold text-gray-800 dark:text-white">Memória de Trabalho</h3>
            </div>

            <div className="flex justify-around items-end h-40">
              {memoryData.length > 0 ? memoryData.map((item, idx) => (
                 <div key={idx} className="flex flex-col items-center gap-2 w-1/3">
                    <div className="relative w-full px-4 group">
                      <div 
                        className={`w-full rounded-t-lg ${
                          item.level === 3 ? 'bg-purple-600' : item.level === 2 ? 'bg-purple-400' : 'bg-purple-300'
                        }`}
                        style={{ height: `${item.level * 40}px` }} // 1=40px, 2=80px, 3=120px
                      ></div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{item.name}</p>
                      <p className="text-[10px] text-gray-500 uppercase">{item.labelName}</p>
                    </div>
                 </div>
              )) : (
                 <div className="w-full text-center text-gray-400 text-sm italic self-center">Sem dados de memória.</div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
