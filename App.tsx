import React, { useState, useEffect } from 'react';
import { Student, AssessmentResult, AssessmentType, DrawingPhase, WritingPhase } from './types';
import { generateStudentReport } from './services/geminiService';
import { DashboardChart } from './components/DashboardChart';
import { AssessmentForm } from './components/AssessmentForm';
import { StudentList } from './components/StudentList';
import { ConsolidatedStudentView } from './components/ConsolidatedStudentView';
import { LayoutGrid, Users, BookOpen, GraduationCap, FileText, Loader2, Palette, Pencil, Calculator, Calendar, Moon, Sun, Download, Wind, ScanText, Brain, Ear, Eye, Zap, MessageCircle, Layers, Mic, Menu, Printer, ChevronRight, X } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

type ViewState = 'dashboard' | 'students' | 'reports';

// --- Helper: Text Normalizer ---
const normalizeMarkdown = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/([^\n])\n([^\n])/g, '$1 $2') // Remove quebras simples dentro de frases
    .replace(/\n{3,}/g, '\n\n') // Limita quebras múltiplas a no máximo 2 (parágrafo)
    .replace(/  +/g, ' '); // Remove espaços duplos
};

// --- Helper Component: Report Renderer ---
// Layout compactado para impressão (Text-sm, Margens reduzidas)
const ReportRenderer: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  const cleanText = normalizeMarkdown(text);

  const parseBold = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="text-gray-900 dark:text-white font-extrabold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const blocks = cleanText.split(/\n\s*\n/);
  const renderedContent: React.ReactNode[] = [];

  blocks.forEach((block, idx) => {
    const trimmed = block.trim();
    if (!trimmed) return;

    // Headers
    if (trimmed.startsWith('#')) {
      const match = trimmed.match(/^#+/);
      const level = match ? match[0].length : 0;
      const content = trimmed.replace(/^#+\s*/, '');
      
      if (level === 1) {
         renderedContent.push(
            <div key={`h1-${idx}`} className="text-center mb-4 mt-6 pdf-item">
               <h1 className="text-xl font-extrabold text-gray-900 dark:text-white uppercase tracking-wider mb-1 border-b-2 border-indigo-600 pb-1 inline-block px-8">
                 {content}
               </h1>
            </div>
         );
      } else if (level === 2) {
         renderedContent.push(
            <div key={`h2-${idx}`} className="mt-4 mb-2 pdf-item">
               <h2 className="text-base font-bold text-indigo-900 dark:text-indigo-300 border-l-4 border-indigo-600 pl-3 bg-indigo-50 dark:bg-indigo-900/20 py-1 rounded-r w-full uppercase">
                 {content}
               </h2>
            </div>
         );
      } else {
         renderedContent.push(
           <h3 key={`h3-${idx}`} className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-3 mb-1 border-b border-gray-200 pb-1 pdf-item">
             {content}
           </h3>
         );
      }
      return;
    }

    // Lists
    if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
      const listItems = trimmed.split('\n');
      const items = listItems.map((item, i) => {
        const content = item.replace(/^[*|-]\s*/, '').trim();
        return <li key={i} className="pl-1 mb-1">{parseBold(content)}</li>;
      });
      
      renderedContent.push(
        <ul key={`ul-${idx}`} className="list-disc pl-6 mb-2 text-gray-800 dark:text-gray-200 text-sm leading-snug pdf-item text-justify">
          {items}
        </ul>
      );
      return;
    }

    // Standard Paragraph (Compactado: text-sm, leading-snug, indent-8)
    renderedContent.push(
      <p key={`p-${idx}`} className="mb-2 text-gray-800 dark:text-gray-300 leading-snug text-justify text-sm indent-8 pdf-item">
        {parseBold(trimmed)}
      </p>
    );
  });

  return <div className="report-content font-serif">{renderedContent}</div>;
};

const App: React.FC = () => {
  // Mock Data Students
  const [students, setStudents] = useState<Student[]>([
    { id: '1', name: 'Alice Silva', age: 4, grade: 'Infantil 4' },
    { id: '2', name: 'Bernardo Souza', age: 5, grade: 'Infantil 5' },
    { id: '3', name: 'Carla Dias', age: 4, grade: 'Infantil 4' },
    { id: '4', name: 'Davi Oliveira', age: 5, grade: 'Infantil 5' },
    { id: '5', name: 'Enzo Gabriel', age: 5, grade: 'Infantil 5' },
    { id: '6', name: 'Fernanda Lima', age: 4, grade: 'Infantil 4' },
  ]);

  // Mock Data Assessments
  const [assessments, setAssessments] = useState<AssessmentResult[]>([
    // ... mantendo dados existentes ...
    { id: '101', studentId: '1', date: '2023-03-10', type: AssessmentType.DRAWING, phase: DrawingPhase.GARATUJA_ORDENADA },
    { id: '102', studentId: '2', date: '2023-03-12', type: AssessmentType.DRAWING, phase: DrawingPhase.PRE_ESQUEMATISMO },
    { id: '103', studentId: '3', date: '2023-03-15', type: AssessmentType.DRAWING, phase: DrawingPhase.GARATUJA_DESORDENADA },
    { id: '104', studentId: '4', date: '2023-03-20', type: AssessmentType.DRAWING, phase: DrawingPhase.ESQUEMATISMO }, 
    { id: '105', studentId: '5', date: '2023-03-22', type: AssessmentType.DRAWING, phase: DrawingPhase.PRE_ESQUEMATISMO },
    { id: '106', studentId: '6', date: '2023-03-25', type: AssessmentType.DRAWING, phase: DrawingPhase.GARATUJA_ORDENADA },
    { id: '201', studentId: '1', date: '2023-04-05', type: AssessmentType.WRITING, phase: WritingPhase.PRE_ALFABETICA },
    { id: '202', studentId: '2', date: '2023-04-06', type: AssessmentType.WRITING, phase: WritingPhase.ALFABETICA_PARCIAL },
    { id: '203', studentId: '3', date: '2023-04-07', type: AssessmentType.WRITING, phase: WritingPhase.PRE_ALFABETICA },
    { id: '204', studentId: '4', date: '2023-04-08', type: AssessmentType.WRITING, phase: WritingPhase.ALFABETICA_COMPLETA },
    { id: '205', studentId: '5', date: '2023-04-09', type: AssessmentType.WRITING, phase: WritingPhase.ALFABETICA_PARCIAL },
    { id: '301', studentId: '1', date: '2023-02-10', type: AssessmentType.MATH, score: 3, maxScore: 10, notes: "Contagem: 3; Números: 2; Tamanho: 4; Formas: 2; Padrões: 1; Corresp.: 3; Quant.: 3; Classif.: 4; Espacial: 5; Cálculo: 1" },
    { id: '302', studentId: '1', date: '2023-03-10', type: AssessmentType.MATH, score: 5, maxScore: 10, notes: "Contagem: 5; Números: 4; Tamanho: 6; Formas: 4; Padrões: 3; Corresp.: 5; Quant.: 5; Classif.: 5; Espacial: 6; Cálculo: 2" },
    { id: '303', studentId: '1', date: '2023-04-10', type: AssessmentType.MATH, score: 7, maxScore: 10, notes: "Contagem: 7; Números: 6; Tamanho: 8; Formas: 7; Padrões: 5; Corresp.: 7; Quant.: 7; Classif.: 8; Espacial: 8; Cálculo: 4" },
    { id: '304', studentId: '2', date: '2023-03-15', type: AssessmentType.MATH, score: 8, maxScore: 10, notes: "Contagem: 8; Números: 8; Tamanho: 9; Formas: 8; Padrões: 7; Corresp.: 8; Quant.: 8; Classif.: 9; Espacial: 9; Cálculo: 6" },
    { id: '305', studentId: '4', date: '2023-03-18', type: AssessmentType.MATH, score: 9, maxScore: 10, notes: "Contagem: 9; Números: 9; Tamanho: 10; Formas: 9; Padrões: 9; Corresp.: 9; Quant.: 10; Classif.: 10; Espacial: 10; Cálculo: 8" },
    { 
      id: '401', studentId: '1', date: '2023-05-01', type: AssessmentType.PHONOLOGICAL, 
      notes: "Rimas: Em processo; Aliterações: Não iniciou; Seg. Silábica: Em processo; Seg. Fonêmica: Não iniciou" 
    },
    { 
      id: '402', studentId: '2', date: '2023-05-02', type: AssessmentType.PHONOLOGICAL, 
      notes: "Rimas: Consolidado; Aliterações: Em processo; Seg. Silábica: Consolidado; Seg. Fonêmica: Em processo" 
    },
    { 
      id: '403', studentId: '4', date: '2023-05-03', type: AssessmentType.PHONOLOGICAL, 
      notes: "Rimas: Consolidado; Aliterações: Consolidado; Seg. Silábica: Consolidado; Seg. Fonêmica: Consolidado" 
    },
     { 
      id: '404', studentId: '5', date: '2023-05-03', type: AssessmentType.PHONOLOGICAL, 
      notes: "Rimas: Em processo; Aliterações: Em processo; Seg. Silábica: Consolidado; Seg. Fonêmica: Não iniciou" 
    },
    { id: '501', studentId: '1', date: '2023-04-20', type: AssessmentType.MEMORY, notes: "Auditiva: 1, Visual: 2, Funcional: 1" },
    { id: '502', studentId: '2', date: '2023-04-21', type: AssessmentType.MEMORY, notes: "Auditiva: 2, Visual: 3, Funcional: 2" },
    { id: '503', studentId: '4', date: '2023-04-22', type: AssessmentType.MEMORY, notes: "Auditiva: 3, Visual: 3, Funcional: 3" },
    { id: '504', studentId: '5', date: '2023-04-23', type: AssessmentType.MEMORY, notes: "Auditiva: 2, Visual: 2, Funcional: 2" },
    { 
      id: '601', studentId: '4', date: '2023-06-01', type: AssessmentType.READING, 
      aiAnalysis: "Análise da leitura... Fluência: 8/10. Decodificação: 9/10. Compreensão: 8/10. Leitura muito boa." 
    },
    { 
      id: '602', studentId: '2', date: '2023-06-02', type: AssessmentType.READING, 
      aiAnalysis: "Leitura silabada. Fluência: 4/10. Decodificação: 6/10. Compreensão: 5/10." 
    },
    { 
      id: '603', studentId: '1', date: '2023-06-03', type: AssessmentType.READING, 
      aiAnalysis: "Iniciando processo. Fluência: 2/10. Decodificação: 3/10. Compreensão: 2/10." 
    }
  ]);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [viewingStudentReport, setViewingStudentReport] = useState<Student | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<{text: string, student: Student} | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleSaveAssessment = (result: AssessmentResult) => {
    setAssessments(prev => [...prev, result]);
    setShowForm(false);
    setSelectedStudent(null);
  };

  const handleGenerateReport = async (student: Student) => {
    const studentAssessments = assessments.filter(a => a.studentId === student.id);
    if (studentAssessments.length === 0) {
      alert("É necessário realizar sondagens antes de gerar o relatório.");
      return;
    }
    setReportLoading(true);
    try {
      const reportText = await generateStudentReport(student.name, studentAssessments);
      setReportData({ text: reportText, student: student });
    } catch (e) {
      alert("Erro ao gerar relatório.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleDownloadReportPDF = async () => {
    if (!reportData) return;
    setIsGeneratingPdf(true);

    try {
      const element = document.getElementById('printable-report');
      if (!element) return;

      // 1. Container Temporário (Fora da tela)
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.top = '-10000px';
      container.style.left = '0';
      // Definir largura A4 exata para renderização consistente
      container.style.width = '794px'; 
      container.style.zIndex = '-9999';
      document.body.appendChild(container);

      // 2. Clone do Elemento
      const clone = element.cloneNode(true) as HTMLElement;
      
      // 3. Limpeza de Classes de Tela
      clone.classList.remove('fixed', 'inset-0', 'z-50', 'bg-black/60', 'overflow-y-auto', 'backdrop-blur-sm', 'md:p-4', 'flex', 'items-center', 'justify-center');
      clone.classList.remove('md:max-h-[90vh]', 'shadow-2xl', 'rounded-2xl', 'rounded-none');
      clone.style.height = 'auto';
      clone.style.overflow = 'visible';
      clone.style.width = '100%';
      clone.style.backgroundColor = '#ffffff';

      const noPrints = clone.querySelectorAll('.no-print');
      noPrints.forEach(el => el.remove());

      // Fix de Cores (Texto Preto)
      const allElements = clone.querySelectorAll('*');
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.color === 'rgb(255, 255, 255)' || style.color === '#ffffff') {
           (el as HTMLElement).style.color = '#111827'; 
        }
      });
      
      const scrollables = clone.querySelectorAll('.overflow-y-auto');
      scrollables.forEach(el => {
        (el as HTMLElement).style.overflow = 'visible';
        (el as HTMLElement).style.height = 'auto';
      });

      container.appendChild(clone);
      
      // 4. ALGORITMO DE PAGINAÇÃO "TETRIS"
      // Calcula onde a página A4 corta (1123px) e empurra o bloco inteiro para a próxima.
      
      const A4_HEIGHT_PX = 1123; // Altura padrão A4 a 96 DPI
      const HEADER_HEIGHT = 120; // Espaço reservado para cabeçalho
      const PADDING_BOTTOM = 60; // Margem de segurança inferior
      
      // Altura útil da página (onde o conteúdo pode ficar)
      const PAGE_CONTENT_HEIGHT = A4_HEIGHT_PX - PADDING_BOTTOM; 

      const items = clone.querySelectorAll('.pdf-item');
      let currentY = 0; // Posição Y atual acumulada
      
      // Considera cabeçalho inicial
      const header = clone.querySelector('.p-6.border-b');
      if (header) {
         currentY += (header as HTMLElement).offsetHeight;
      }

      // Itera sobre cada parágrafo/título
      items.forEach((item) => {
         const el = item as HTMLElement;
         const elHeight = el.offsetHeight;
         const styles = window.getComputedStyle(el);
         const marginTop = parseFloat(styles.marginTop) || 0;
         const marginBottom = parseFloat(styles.marginBottom) || 0;
         
         const totalItemHeight = elHeight + marginTop + marginBottom;

         // Verifica onde este elemento terminaria na "página infinita"
         const endPosition = currentY + totalItemHeight;
         
         // Calcula em qual página estamos atualmente (0-indexada)
         const currentPageIndex = Math.floor(currentY / PAGE_CONTENT_HEIGHT);
         
         // Calcula em qual página o elemento terminaria
         const endPageIndex = Math.floor(endPosition / PAGE_CONTENT_HEIGHT);

         // SE o elemento começa numa página e termina na outra (ou seja, cruza a linha de corte)
         if (currentPageIndex !== endPageIndex) {
            // Calcula quanto falta para acabar a página atual
            const remainingSpaceOnPage = ((currentPageIndex + 1) * PAGE_CONTENT_HEIGHT) - currentY;
            
            // Adiciona margem superior ao elemento para empurrá-lo para o início da próxima página
            // +20px de respiro no topo da nova página
            const pushDownAmount = remainingSpaceOnPage + 40; 
            
            el.style.marginTop = `${marginTop + pushDownAmount}px`;
            
            // Atualiza o cursor Y para o novo topo (início da próx página) + altura do elemento
            currentY += pushDownAmount + totalItemHeight;
         } else {
            // Cabe na página, apenas soma altura
            currentY += totalItemHeight;
         }
      });

      // Aguarda reflow do navegador
      await new Promise(resolve => setTimeout(resolve, 500));

      const fullHeight = clone.scrollHeight;
      
      // 5. Gera Imagem do HTML Longo
      const canvas = await html2canvas(clone, {
        scale: 2, // 2x para nitidez
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
        height: fullHeight,
        windowHeight: fullHeight,
        scrollY: -window.scrollY 
      });

      document.body.removeChild(container);

      // 6. Fatiar Imagem em Páginas PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      
      // Altura da imagem redimensionada para largura do PDF
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Página 1
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Páginas seguintes
      while (heightLeft > 0) {
        position = heightLeft - imgHeight; // Sobe a imagem para mostrar a próxima parte
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -(imgHeight - heightLeft), pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const safeName = reportData.student.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`Relatorio_${safeName}.pdf`);

    } catch (error) {
      console.error(error);
      alert("Erro ao gerar PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getLatestAssessmentObj = (studentId: string, type: AssessmentType) => {
    const sorted = assessments
      .filter(a => a.studentId === studentId && a.type === type)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted.length > 0 ? sorted[0] : null;
  };

  const getLatestPhase = (studentId: string, type: AssessmentType) => {
    const latest = getLatestAssessmentObj(studentId, type);
    return latest?.phase || "Não avaliado";
  };

  // Views Components
  const DashboardView = () => (
    <div className="animate-fade-in">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">Visão Geral</h2>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">Acompanhamento do desenvolvimento da turma.</p>
        </div>
        <div className="hidden md:block bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm border border-gray-100 dark:border-gray-700">
          <span className="font-bold text-orange-600 dark:text-orange-400">{students.length}</span> Alunos Matriculados
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
          <DashboardChart assessments={assessments} students={students} />
        </div>
        <div className="bg-gradient-to-br from-orange-400 to-pink-500 rounded-xl p-6 text-white shadow-lg h-fit">
          <h3 className="text-xl font-bold mb-2">Dica Pedagógica</h3>
          <p className="opacity-90 mb-4 text-sm">
            "A sondagem é como um farol que ilumina o caminho para o sucesso educacional."
          </p>
          <div className="bg-white/20 p-4 rounded-lg backdrop-blur-sm">
            <h4 className="font-bold text-sm mb-1">Foco do Bimestre:</h4>
            <p className="text-xs md:text-sm">Trabalhar consciência fonológica e coordenação motora fina com jogos de alinhavo.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const StudentsView = () => (
    <div className="animate-fade-in">
      <header className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">Alunos</h2>
        <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">Gerencie a lista de alunos e realize novas sondagens.</p>
      </header>
      <StudentList 
        students={students} 
        assessments={assessments}
        onSelectStudent={(s) => { setSelectedStudent(s); setShowForm(true); }}
        onGenerateReport={handleGenerateReport}
      />
    </div>
  );

  const ReportsView = () => {
    if (viewingStudentReport) {
      return (
        <ConsolidatedStudentView 
          student={viewingStudentReport}
          assessments={assessments}
          onBack={() => setViewingStudentReport(null)}
        />
      );
    }

    return (
      <div className="animate-fade-in">
        <header className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">Central de Relatórios</h2>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">Selecione um aluno para visualizar o perfil detalhado.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map(student => {
            const studentAssessments = assessments.filter(a => a.studentId === student.id);
            const hasData = studentAssessments.length > 0;
            
            return (
              <div 
                key={student.id} 
                onClick={() => setViewingStudentReport(student)}
                className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg hover:border-orange-200 dark:hover:border-orange-900 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-full text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 transition-colors">
                    <GraduationCap size={24} />
                  </div>
                  {!hasData && (
                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs px-2 py-1 rounded">Sem dados</span>
                  )}
                  {hasData && (
                    <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs px-2 py-1 rounded font-bold">{studentAssessments.length} Sondagens</span>
                  )}
                </div>
                
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{student.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{student.grade} • {student.age} anos</p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Desenho:</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{getLatestPhase(student.id, AssessmentType.DRAWING)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Escrita:</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{getLatestPhase(student.id, AssessmentType.WRITING)}</span>
                  </div>
                </div>

                <div className="flex items-center text-sm font-bold text-indigo-600 dark:text-indigo-400 gap-1 group-hover:gap-2 transition-all">
                  Ver Relatório Consolidado <ChevronRight size={16} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div className="min-h-screen flex bg-[#fdfbf7] dark:bg-gray-900 transition-colors duration-300 relative">
        
        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 p-4 border-b border-gray-100 dark:border-gray-700 z-30 flex justify-between items-center no-print">
           <h1 className="text-lg font-extrabold text-orange-600 dark:text-orange-500 flex items-center gap-2">
              <BookOpen className="text-orange-500" size={20} />
              PedagogIA
            </h1>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="text-gray-600 dark:text-gray-300"
            >
              <Menu size={24} />
            </button>
        </div>

        {/* Sidebar Overlay (Mobile) */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          w-64 bg-white dark:bg-gray-800 border-r border-orange-100 dark:border-gray-700 flex flex-col fixed h-full z-40 transition-transform duration-300 no-print
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="p-6 border-b border-orange-50 dark:border-gray-700 hidden md:block">
            <h1 className="text-2xl font-extrabold text-orange-600 dark:text-orange-500 flex items-center gap-2">
              <BookOpen className="text-orange-500" />
              PedagogIA
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Sondagem Inteligente</p>
          </div>
          
          <nav className="p-4 space-y-2 flex-1 mt-14 md:mt-0">
            <button 
              onClick={() => { setActiveView('dashboard'); setIsSidebarOpen(false); setViewingStudentReport(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeView === 'dashboard' 
                  ? 'bg-orange-50 dark:bg-gray-700 text-orange-700 dark:text-orange-400 font-bold' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium'
              }`}
            >
              <LayoutGrid size={20} /> Dashboard
            </button>
            
            <div className="pt-4 pb-2">
               <p className="text-xs font-bold text-gray-400 uppercase px-4">Ferramentas</p>
            </div>
            
            <button 
              onClick={() => { setActiveView('students'); setIsSidebarOpen(false); setViewingStudentReport(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeView === 'students' 
                  ? 'bg-orange-50 dark:bg-gray-700 text-orange-700 dark:text-orange-400 font-bold' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium'
              }`}
            >
              <Users size={20} /> Alunos
            </button>
            
            <button 
              onClick={() => { setActiveView('reports'); setIsSidebarOpen(false); setViewingStudentReport(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeView === 'reports' 
                  ? 'bg-orange-50 dark:bg-gray-700 text-orange-700 dark:text-orange-400 font-bold' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium'
              }`}
            >
              <GraduationCap size={20} /> Relatórios
            </button>
          </nav>

          <div className="p-4 border-t border-gray-100 dark:border-gray-700">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              {isDarkMode ? "Modo Claro" : "Modo Escuro"}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-64 p-4 md:p-8 text-gray-800 dark:text-gray-100 no-print mt-16 md:mt-0">
          <div key={activeView}>
             {activeView === 'dashboard' && <DashboardView />}
             {activeView === 'students' && <StudentsView />}
             {activeView === 'reports' && <ReportsView />}
          </div>
        </main>

        {/* Assessment Modal */}
        {showForm && selectedStudent && (
          <AssessmentForm 
            student={selectedStudent} 
            onSave={handleSaveAssessment} 
            onCancel={() => setShowForm(false)} 
          />
        )}

        {/* AI Report Modal */}
        {reportData && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-0 md:p-4 z-50 overflow-y-auto backdrop-blur-sm">
            <div id="printable-report" className="bg-white dark:bg-gray-800 w-full md:max-w-3xl rounded-none md:rounded-2xl shadow-2xl flex flex-col min-h-screen md:min-h-0 md:max-h-[90vh] transition-colors duration-300">
              
              {/* Report Header */}
              <div className="p-6 border-b bg-indigo-50 dark:bg-indigo-900/30 dark:border-gray-700 rounded-t-none md:rounded-t-2xl flex justify-between items-start no-print-padding">
                <div>
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                    <FileText size={20} />
                    <span className="font-bold uppercase tracking-wider text-xs">Relatório Gerado por IA</span>
                  </div>
                  <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white">{reportData.student.name}</h3>
                  <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                    <Calendar size={14} /> {new Date().toLocaleDateString('pt-BR')} • {reportData.student.grade}
                  </p>
                </div>
                <button 
                  onClick={() => setReportData(null)} 
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-700 p-2 rounded-full transition-all no-print"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/50 flex-1">
                <div className="bg-white dark:bg-gray-700 p-8 md:p-12 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 min-h-[500px]">
                   <ReportRenderer text={reportData.text} />
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-none md:rounded-b-2xl flex justify-end no-print">
                <button 
                  onClick={handleDownloadReportPDF}
                  disabled={isGeneratingPdf}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                >
                  {isGeneratingPdf ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
                  {isGeneratingPdf ? "Gerando PDF..." : "Imprimir / Salvar PDF"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {reportLoading && (
          <div className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center z-50">
            <Loader2 size={48} className="text-orange-500 animate-spin mb-4" />
            <p className="text-xl font-bold text-gray-800 dark:text-white">Analisando dados...</p>
            <p className="text-gray-500 dark:text-gray-400">A IA está escrevendo o relatório pedagógico.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
