import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts';
import { AssessmentResult, AssessmentType, DrawingPhase, WritingPhase, Student } from '../types';
import { Palette, Pencil, MessageCircle, Layers, BookOpen, CheckCircle, AlertCircle, XCircle, BarChart3, TrendingUp, User, Activity, PieChart, FileX } from 'lucide-react';

interface Props {
  assessments: AssessmentResult[];
  students: Student[];
}

// Ordem cronológica do desenvolvimento para ordenar o gráfico
const PHASE_ORDER = [
  // Desenho
  DrawingPhase.GARATUJA_DESORDENADA,
  DrawingPhase.GARATUJA_ORDENADA,
  DrawingPhase.PRE_ESQUEMATISMO,
  DrawingPhase.ESQUEMATISMO,
  DrawingPhase.REALISMO,
  DrawingPhase.PSEUDO_NATURALISMO,
  // Escrita
  WritingPhase.PRE_ALFABETICA,
  WritingPhase.ALFABETICA_PARCIAL,
  WritingPhase.ALFABETICA_COMPLETA,
  WritingPhase.ALFABETICA_CONSOLIDADA
];

// Paleta de cores semântica
const PHASE_COLORS: Record<string, string> = {
  [DrawingPhase.GARATUJA_DESORDENADA]: '#FCD34D', // Amber 300
  [DrawingPhase.GARATUJA_ORDENADA]: '#F59E0B',    // Amber 500
  [DrawingPhase.PRE_ESQUEMATISMO]: '#F97316',     // Orange 500
  [DrawingPhase.ESQUEMATISMO]: '#EF4444',         // Red 500
  [DrawingPhase.REALISMO]: '#DB2777',             // Pink 600
  [DrawingPhase.PSEUDO_NATURALISMO]: '#7C3AED',   // Violet 600
  
  [WritingPhase.PRE_ALFABETICA]: '#2DD4BF',       // Teal 400
  [WritingPhase.ALFABETICA_PARCIAL]: '#34D399',   // Emerald 400
  [WritingPhase.ALFABETICA_COMPLETA]: '#10B981',  // Emerald 500
  [WritingPhase.ALFABETICA_CONSOLIDADA]: '#3B82F6' // Blue 500
};

export const DashboardChart: React.FC<Props> = ({ assessments, students }) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [filterPeriod, setFilterPeriod] = useState<string>('all'); // all, month, semester
  const [filterGrade, setFilterGrade] = useState<string>('all');

  // --- Filtering Logic ---
  const getFilteredAssessments = () => {
    let filtered = assessments;
    const now = new Date();

    // Filter by Student Grade
    if (filterGrade !== 'all') {
      const studentIdsInGrade = students.filter(s => s.grade === filterGrade).map(s => s.id);
      filtered = filtered.filter(a => studentIdsInGrade.includes(a.studentId));
    }

    // Filter by Date Period
    if (filterPeriod === 'month') {
      const lastMonth = new Date();
      lastMonth.setMonth(now.getMonth() - 1);
      filtered = filtered.filter(a => new Date(a.date) >= lastMonth);
    } else if (filterPeriod === 'semester') {
      const lastSemester = new Date();
      lastSemester.setMonth(now.getMonth() - 6);
      filtered = filtered.filter(a => new Date(a.date) >= lastSemester);
    }

    return filtered;
  };

  const filteredAssessments = getFilteredAssessments();

  // Helper: Get only the latest assessment for each student for a specific type
  const getLatestAssessments = (types: AssessmentType[]) => {
    const latestMap = new Map<string, AssessmentResult>();
    
    filteredAssessments.forEach(a => {
      if (types.includes(a.type)) {
        const key = `${a.studentId}-${a.type}`;
        const existing = latestMap.get(key);
        if (!existing || new Date(a.date) > new Date(existing.date)) {
          latestMap.set(key, a);
        }
      }
    });

    return Array.from(latestMap.values());
  };

  const processPhaseData = () => {
    const latestData = getLatestAssessments([AssessmentType.DRAWING, AssessmentType.WRITING]);

    const counts = latestData.reduce((acc, curr) => {
      if (curr.phase) {
        acc[curr.phase] = (acc[curr.phase] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const data = PHASE_ORDER.map(phase => {
      const count = counts[phase] || 0;
      if (count === 0) return null;

      const isDrawing = Object.values(DrawingPhase).includes(phase as DrawingPhase);
      
      return {
        name: phase,
        Quantidade: count,
        category: isDrawing ? 'Desenho' : 'Escrita',
        fill: PHASE_COLORS[phase] || '#9CA3AF'
      };
    }).filter(Boolean);

    return data;
  };

  const processPhonologicalData = () => {
    const latestData = getLatestAssessments([AssessmentType.PHONOLOGICAL]);
    const totalStudents = latestData.length;

    if (totalStudents === 0) return [];

    const stats = {
      'Rimas': { 'Não iniciou': 0, 'Em processo': 0, 'Consolidado': 0 },
      'Aliterações': { 'Não iniciou': 0, 'Em processo': 0, 'Consolidado': 0 },
      'Seg. Silábica': { 'Não iniciou': 0, 'Em processo': 0, 'Consolidado': 0 },
      'Seg. Fonêmica': { 'Não iniciou': 0, 'Em processo': 0, 'Consolidado': 0 },
    };

    const mapping: Record<string, string> = {
      'Rimas': 'Rimas',
      'Aliterações': 'Aliterações',
      'Seg. Silábica': 'Seg. Silábica',
      'Seg. Fonêmica': 'Seg. Fonêmica'
    };

    latestData
      .filter(a => a.notes)
      .forEach(a => {
        const parts = a.notes!.split('; ');
        parts.forEach(part => {
          const [skill, level] = part.split(': ');
          if (skill && level && mapping[skill] && (stats as any)[mapping[skill]][level] !== undefined) {
             (stats as any)[mapping[skill]][level]++;
          }
        });
      });

    return Object.keys(stats).map(skill => {
      const s = (stats as any)[skill];
      return {
        name: skill,
        naoIniciou: s['Não iniciou'],
        emProcesso: s['Em processo'],
        consolidado: s['Consolidado'],
        total: totalStudents
      };
    });
  };

  const processMemoryData = () => {
    const latestData = getLatestAssessments([AssessmentType.MEMORY]);
    
    if (latestData.length === 0) return [];

    const stats = {
      'Auditiva': { 'Baixo': 0, 'Médio': 0, 'Alto': 0 },
      'Visual': { 'Baixo': 0, 'Médio': 0, 'Alto': 0 },
      'Funcional': { 'Baixo': 0, 'Médio': 0, 'Alto': 0 }
    };

    const levelMap: Record<number, string> = { 1: 'Baixo', 2: 'Médio', 3: 'Alto' };

    latestData
      .filter(a => a.notes)
      .forEach(a => {
        const parts = a.notes!.split(', ');
        parts.forEach(part => {
          const [type, valStr] = part.split(': ');
          const val = parseInt(valStr);
          const levelLabel = levelMap[val];
          
          if (type && levelLabel && (stats as any)[type]) {
            (stats as any)[type][levelLabel]++;
          }
        });
      });

    return Object.keys(stats).map(type => ({
      name: type,
      'Baixo': (stats as any)[type]['Baixo'],
      'Médio': (stats as any)[type]['Médio'],
      'Alto': (stats as any)[type]['Alto'],
    }));
  };

  const processReadingData = () => {
    const latestData = getLatestAssessments([AssessmentType.READING]);
    
    if (latestData.length === 0) return [];

    let totalFluency = 0;
    let totalDecoding = 0;
    let totalComprehension = 0;
    let count = 0;

    latestData.forEach(a => {
      if (a.aiAnalysis) {
        const fluencyMatch = a.aiAnalysis.match(/Fluência:\s*(\d+)/);
        const decodingMatch = a.aiAnalysis.match(/Decodificação:\s*(\d+)/);
        const comprehensionMatch = a.aiAnalysis.match(/Compreensão:\s*(\d+)/);

        if (fluencyMatch && decodingMatch && comprehensionMatch) {
          totalFluency += parseInt(fluencyMatch[1]);
          totalDecoding += parseInt(decodingMatch[1]);
          totalComprehension += parseInt(comprehensionMatch[1]);
          count++;
        }
      }
    });

    if (count === 0) return [];

    return [
      { name: 'Fluência', value: Number((totalFluency / count).toFixed(1)), fill: '#0891b2' },
      { name: 'Decodificação', value: Number((totalDecoding / count).toFixed(1)), fill: '#06b6d4' },
      { name: 'Compreensão', value: Number((totalComprehension / count).toFixed(1)), fill: '#22d3ee' }
    ];
  };

  // --- Individual Evolution Helpers ---

  const getMathTrend = (studentId: string) => {
    return assessments
      .filter(a => a.studentId === studentId && a.type === AssessmentType.MATH)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(a => ({
        date: new Date(a.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        score: a.score || 0
      }));
  };

  const getReadingTrend = (studentId: string) => {
    return assessments
      .filter(a => a.studentId === studentId && a.type === AssessmentType.READING && a.aiAnalysis)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(a => {
        const f = a.aiAnalysis?.match(/Fluência:\s*(\d+)/)?.[1] || '0';
        const d = a.aiAnalysis?.match(/Decodificação:\s*(\d+)/)?.[1] || '0';
        const c = a.aiAnalysis?.match(/Compreensão:\s*(\d+)/)?.[1] || '0';
        return {
          date: new Date(a.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          fluencia: parseInt(f),
          decodificacao: parseInt(d),
          compreensao: parseInt(c)
        };
      });
  };

  const phaseData = processPhaseData();
  const phonologicalData = processPhonologicalData();
  const memoryData = processMemoryData();
  const readingData = processReadingData();
  
  // Individual Data (Not filtered by period/grade, usually specific student focus)
  const mathTrendData = selectedStudentId ? getMathTrend(selectedStudentId) : [];
  const readingTrendData = selectedStudentId ? getReadingTrend(selectedStudentId) : [];
  
  // Unique Grades for Filter
  const grades = Array.from(new Set(students.map(s => s.grade)));

  // --- Tooltips & Legends ---
  
  const CustomPhaseTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 min-w-[200px]">
          <div className={`text-xs font-bold uppercase tracking-wider mb-2 px-2 py-1 rounded inline-block ${
            data.category === 'Desenho' 
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' 
              : 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
          }`}>
            {data.category}
          </div>
          <p className="font-bold text-gray-800 dark:text-white text-base mb-3 leading-tight border-b pb-2 border-gray-100 dark:border-gray-700">
            {label}
          </p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">Total de Alunos:</span>
            <span className="text-2xl font-extrabold" style={{color: payload[0].fill}}>
              {payload[0].value}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomStackedTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <p className="font-bold text-gray-800 dark:text-white mb-2">{label}</p>
          {payload.map((p: any, idx: number) => (
             <p key={idx} className="text-sm flex justify-between gap-4" style={{color: p.fill}}>
              <span>{p.name}:</span>
              <span className="font-bold">{p.value} alunos</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PhaseLegend = () => (
    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6 text-sm">
      <div className="flex items-center gap-3 bg-orange-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg border border-orange-100 dark:border-gray-600">
        <Palette size={16} className="text-orange-500 dark:text-orange-400" />
        <span className="font-bold text-gray-700 dark:text-gray-200">Desenho</span>
        <div className="flex items-center gap-1">
          <div className="w-16 h-2 bg-gradient-to-r from-amber-300 via-orange-500 to-pink-600 rounded-full"></div>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-teal-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg border border-teal-100 dark:border-gray-600">
        <Pencil size={16} className="text-teal-500 dark:text-teal-400" />
        <span className="font-bold text-gray-700 dark:text-gray-200">Escrita</span>
        <div className="flex items-center gap-1">
          <div className="w-16 h-2 bg-gradient-to-r from-teal-400 via-emerald-500 to-blue-500 rounded-full"></div>
        </div>
      </div>
    </div>
  );

  const PhonoLegend = () => (
    <div className="flex gap-3 mt-4 justify-center text-[10px] md:text-xs">
      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
        <XCircle size={14} className="text-red-400" /> Não Iniciou
      </div>
      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
        <AlertCircle size={14} className="text-amber-400" /> Em Processo
      </div>
      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
        <CheckCircle size={14} className="text-emerald-500" /> Consolidado
      </div>
    </div>
  );

  const MemoryLegend = () => (
    <div className="flex gap-3 mt-4 justify-center text-[10px] md:text-xs">
      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
        <div className="w-3 h-3 bg-purple-200 dark:bg-purple-300 rounded-sm"></div> Baixo
      </div>
      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
        <div className="w-3 h-3 bg-purple-400 rounded-sm"></div> Médio
      </div>
      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
        <div className="w-3 h-3 bg-purple-600 rounded-sm"></div> Alto
      </div>
    </div>
  );

  // --- Empty State Component ---
  const EmptyChartState = ({ message, icon: Icon }: { message: string, icon: any }) => (
    <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 bg-gray-50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-3">
         <Icon size={32} className="text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-gray-500 dark:text-gray-400 font-medium text-sm max-w-[200px]">
        {message}
      </p>
    </div>
  );

  // --- Main Render ---

  if (assessments.length === 0) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center animate-fade-in">
        <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-full mb-6">
          <BarChart3 size={64} className="text-orange-400 dark:text-orange-500 opacity-80" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Aguardando Dados</h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          O Dashboard está vazio. Realize as primeiras sondagens com os alunos para que os gráficos de desempenho e desenvolvimento comecem a aparecer aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
           <Activity size={18} />
           <span className="font-bold">Filtros:</span>
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
           <select 
             value={filterGrade} 
             onChange={(e) => setFilterGrade(e.target.value)}
             className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5"
           >
             <option value="all">Todas as Turmas</option>
             {grades.map(g => <option key={g} value={g}>{g}</option>)}
           </select>

           <select 
             value={filterPeriod} 
             onChange={(e) => setFilterPeriod(e.target.value)}
             className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5"
           >
             <option value="all">Todo o Período</option>
             <option value="month">Último Mês</option>
             <option value="semester">Último Semestre</option>
           </select>
        </div>
      </div>

      {/* Gráfico de Fases */}
      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-sm border border-orange-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base md:text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <TrendingUp className="text-orange-500" size={20} />
            Distribuição das Fases
          </h3>
          <span className="text-[10px] md:text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">
            Última Sondagem
          </span>
        </div>
        
        {phaseData.length > 0 ? (
          <>
            <div className="h-64 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={phaseData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#374151" strokeOpacity={0.1} />
                  <XAxis type="number" allowDecimals={false} tick={{fill: '#9CA3AF'}} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={100} 
                    tick={{fontSize: 10, fill: '#6B7280', fontWeight: 600}} 
                    interval={0}
                  />
                  <Tooltip content={<CustomPhaseTooltip />} cursor={{fill: 'transparent'}} />
                  <Bar dataKey="Quantidade" radius={[0, 4, 4, 0]} barSize={20}>
                    {phaseData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <PhaseLegend />
          </>
        ) : (
          <EmptyChartState 
            icon={FileX} 
            message="Sem dados de Desenho ou Escrita no período selecionado." 
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Gráfico de Fonologia (HTML Bars) */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-teal-100 dark:border-gray-700 transition-colors duration-300 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <MessageCircle className="text-teal-500" size={20} />
              Consciência Fonológica
            </h3>
          </div>
          
          {phonologicalData.length > 0 ? (
            <>
              <div className="space-y-5 flex-1">
                {phonologicalData.map((item) => (
                  <div key={item.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                    </div>
                    <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                      {item.naoIniciou > 0 && (
                        <div style={{ width: `${(item.naoIniciou / item.total) * 100}%` }} className="bg-red-400 h-full" />
                      )}
                      {item.emProcesso > 0 && (
                        <div style={{ width: `${(item.emProcesso / item.total) * 100}%` }} className="bg-amber-400 h-full" />
                      )}
                      {item.consolidado > 0 && (
                        <div style={{ width: `${(item.consolidado / item.total) * 100}%` }} className="bg-emerald-500 h-full" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <PhonoLegend />
            </>
          ) : (
            <EmptyChartState 
              icon={PieChart} 
              message="Nenhuma sondagem fonológica registrada neste período." 
            />
          )}
        </div>

        {/* Gráfico de Memória (Stacked Bar) */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-purple-100 dark:border-gray-700 transition-colors duration-300 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Layers className="text-purple-500" size={20} />
              Memória de Trabalho
            </h3>
          </div>

          <div className="h-56 flex-1">
            {memoryData.some(d => d.Baixo > 0 || d.Médio > 0 || d.Alto > 0) ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={memoryData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.1} />
                    <XAxis dataKey="name" tick={{fontSize: 12, fill: '#9CA3AF'}} />
                    <YAxis allowDecimals={false} tick={{fontSize: 12, fill: '#9CA3AF'}} />
                    <Tooltip content={<CustomStackedTooltip />} cursor={{fill: 'transparent'}} />
                    <Bar dataKey="Baixo" stackId="a" fill="#E9D5FF" name="Baixo" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="Médio" stackId="a" fill="#A78BFA" name="Médio" />
                    <Bar dataKey="Alto" stackId="a" fill="#7C3AED" name="Alto" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <MemoryLegend />
              </>
            ) : (
               <EmptyChartState 
                 icon={Layers} 
                 message="Sem dados de Memória." 
               />
            )}
          </div>
        </div>

        {/* Gráfico de Leitura (Média da Turma) */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-cyan-100 dark:border-gray-700 transition-colors duration-300 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <BookOpen className="text-cyan-500" size={20} />
              Leitura (Média 0-10)
            </h3>
          </div>

          <div className="h-56 flex-1">
             {readingData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={readingData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.1} />
                      <XAxis dataKey="name" tick={{fontSize: 12, fill: '#9CA3AF'}} />
                      <YAxis domain={[0, 10]} tick={{fontSize: 12, fill: '#9CA3AF'}} />
                      <Tooltip 
                        cursor={{fill: 'transparent'}}
                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                        {readingData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 text-center text-xs text-gray-400">
                    Escala de pontuação: 0 a 10
                  </div>
                </>
             ) : (
               <EmptyChartState 
                 icon={BookOpen} 
                 message="Sem dados de Leitura." 
               />
             )}
          </div>
        </div>
      </div>

      {/* --- SEÇÃO DE EVOLUÇÃO INDIVIDUAL --- */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-indigo-100 dark:border-gray-700 mt-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Activity className="text-indigo-500" size={24} />
            Evolução Individual
          </h3>
          <div className="flex items-center gap-2 w-full md:w-auto">
             <User size={18} className="text-gray-500" />
             <select 
               className="p-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 w-full md:w-64"
               value={selectedStudentId}
               onChange={(e) => setSelectedStudentId(e.target.value)}
             >
               <option value="">Selecione um aluno...</option>
               {students.map(s => (
                 <option key={s.id} value={s.id}>{s.name}</option>
               ))}
             </select>
          </div>
        </div>

        {selectedStudentId ? (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* Evolução Matemática */}
             <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
               <h4 className="font-bold text-gray-700 dark:text-gray-200 mb-4 text-sm flex items-center gap-2">
                 <TrendingUp size={16} /> Histórico de Matemática
               </h4>
               <div className="h-60">
                 {mathTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mathTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.1} />
                        <XAxis dataKey="date" tick={{fontSize: 10}} stroke="#9CA3AF" />
                        <YAxis domain={[0, 10]} tick={{fontSize: 10}} stroke="#9CA3AF" />
                        <Tooltip 
                          contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}
                          itemStyle={{fontSize: '12px'}}
                        />
                        <Line type="monotone" dataKey="score" stroke="#F97316" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} name="Nota" />
                      </LineChart>
                    </ResponsiveContainer>
                 ) : (
                    <EmptyChartState 
                      icon={TrendingUp} 
                      message="Sem dados históricos para este aluno." 
                    />
                 )}
               </div>
             </div>

             {/* Evolução Leitura */}
             <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
               <h4 className="font-bold text-gray-700 dark:text-gray-200 mb-4 text-sm flex items-center gap-2">
                 <BookOpen size={16} /> Evolução de Leitura
               </h4>
               <div className="h-60">
                  {readingTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={readingTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.1} />
                        <XAxis dataKey="date" tick={{fontSize: 10}} stroke="#9CA3AF" />
                        <YAxis domain={[0, 10]} tick={{fontSize: 10}} stroke="#9CA3AF" />
                        <Tooltip 
                          contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}
                          itemStyle={{fontSize: '12px'}}
                        />
                        <Legend wrapperStyle={{fontSize: '10px'}} />
                        <Line type="monotone" dataKey="fluencia" stroke="#0891b2" strokeWidth={2} dot={false} name="Fluência" />
                        <Line type="monotone" dataKey="decodificacao" stroke="#06b6d4" strokeWidth={2} dot={false} name="Decodif." />
                        <Line type="monotone" dataKey="compreensao" stroke="#22d3ee" strokeWidth={2} dot={false} name="Compr." />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChartState 
                      icon={BookOpen} 
                      message="Sem dados históricos de leitura." 
                    />
                  )}
               </div>
             </div>
           </div>
        ) : (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/30 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
             <User size={48} className="mx-auto mb-2 opacity-50" />
             <p>Selecione um aluno acima para visualizar a evolução individual.</p>
          </div>
        )}
      </div>
    </div>
  );
};