import React, { useState, useRef, useEffect } from 'react';
import { AssessmentType, AssessmentResult, Student, DrawingPhase, WritingPhase } from '../types';
import { analyzeDrawing, analyzeWriting, analyzeReading, blobToBase64 } from '../services/geminiService';
import { Camera, CheckCircle, Loader2, Save, FileText, BookOpen, Wind, ScanText, Brain, Trash2, Calculator, Layers, MessageCircle, Pencil, AlertCircle, Mic, Square, Play, Search, Eye, Palette, Trees, Paperclip, Plus, HelpCircle, Image as ImageIcon } from 'lucide-react';

interface Props {
  student: Student;
  onSave: (result: AssessmentResult) => void;
  onCancel: () => void;
}

// Initial state structures
const INITIAL_DRAWING_STATE = {
  file: null as File | null,
  referenceFiles: [] as File[], // Changed to array for multiple files
  preview: null as string | null,
  analysis: null as { 
    phase: DrawingPhase; 
    reasoning: string;
    colorAnalysis?: string;
    anatomicalDetails?: string;
    contextualElements?: string;
  } | null,
  observation: ""
};

const INITIAL_WRITING_STATE = {
  file: null as File | null,
  preview: null as string | null,
  analysis: null as { phase: WritingPhase; reasoning: string } | null,
  observation: "",
  dictatedWords: ""
};

const INITIAL_READING_STATE = {
  targetText: "O pato nada no lago.",
  readingRecord: "",
  audioBlob: null as Blob | null,
  audioUrl: null as string | null,
  analysis: null as { fluencyScore: number; decodingScore: number; comprehensionScore: number; reasoning: string } | null,
  observation: ""
};

const INITIAL_MATH_STATE = {
  scores: {
    counting: 0,
    numberRec: 0,
    size: 0,
    shapes: 0,
    patterns: 0,
    correspondence: 0,
    quantity: 0,
    classification: 0,
    spatial: 0,
    math: 0
  } as Record<string, number>
};

const INITIAL_MEMORY_STATE = {
  scores: { auditory: 1, visual: 1, functional: 1 } as Record<string, number>
};

const INITIAL_PHONOLOGICAL_STATE = {
  scores: { rhyme: 1, alliteration: 1, syllables: 1, phonemes: 1 } as Record<string, number>
};

export const AssessmentForm: React.FC<Props> = ({ student, onSave, onCancel }) => {
  const [activeTab, setActiveTab] = useState<AssessmentType>(AssessmentType.DRAWING);
  const [loading, setLoading] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false); // State for image compression
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Unified State
  const [formsData, setFormsData] = useState({
    [AssessmentType.DRAWING]: { ...INITIAL_DRAWING_STATE },
    [AssessmentType.WRITING]: { ...INITIAL_WRITING_STATE },
    [AssessmentType.READING]: { ...INITIAL_READING_STATE },
    [AssessmentType.MATH]: { ...INITIAL_MATH_STATE },
    [AssessmentType.MEMORY]: { ...INITIAL_MEMORY_STATE },
    [AssessmentType.PHONOLOGICAL]: { ...INITIAL_PHONOLOGICAL_STATE }
  });

  const STORAGE_KEY = `assessment_draft_${student.id}`;

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setFormsData(prev => ({
          ...prev,
          ...parsedData,
          [AssessmentType.READING]: {
             ...prev[AssessmentType.READING],
             ...parsedData[AssessmentType.READING],
             audioBlob: null,
             audioUrl: null
          },
          [AssessmentType.DRAWING]: {
            ...prev[AssessmentType.DRAWING],
            ...parsedData[AssessmentType.DRAWING],
            referenceFiles: [] // Do not restore files
          }
        }));
      } catch (e) {
        console.error("Failed to parse saved draft", e);
      }
    }
  }, [student.id]);

  // Save to LocalStorage whenever formsData changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const dataToSave = {
        ...formsData,
        [AssessmentType.READING]: {
          ...formsData[AssessmentType.READING],
          audioBlob: null,
          audioUrl: null
        },
        [AssessmentType.DRAWING]: {
          ...formsData[AssessmentType.DRAWING],
          referenceFiles: []
        }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formsData, STORAGE_KEY]);

  useEffect(() => {
    setErrorMessage(null);
  }, [activeTab]);

  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleCancel = () => {
    clearDraft();
    onCancel();
  };

  const updateFormData = (type: AssessmentType, data: any) => {
    setErrorMessage(null);
    setFormsData(prev => ({
      ...prev,
      [type]: { ...prev[type], ...data }
    }));
  };

  // --- Image Optimization Logic ---
  const compressAndResizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const MAX_WIDTH = 1024;
      const MAX_HEIGHT = 1024;
      const QUALITY = 0.7; // 70% JPEG quality

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Resize logic maintaining aspect ratio
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Canvas context not available"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG
          const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
          resolve(dataUrl);
        };
        
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: AssessmentType.DRAWING | AssessmentType.WRITING) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    try {
      // Otimiza a imagem antes de salvar no estado
      const optimizedBase64 = await compressAndResizeImage(file);
      
      updateFormData(type, {
        file, // Mantém a referência do arquivo original (opcional)
        preview: optimizedBase64, // Usa a versão otimizada para visualização e envio
        analysis: null
      });
    } catch (error) {
      console.error("Erro ao otimizar imagem:", error);
      setErrorMessage("Erro ao processar imagem. Tente um arquivo diferente.");
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      const currentFiles = formsData[AssessmentType.DRAWING].referenceFiles;
      updateFormData(AssessmentType.DRAWING, { referenceFiles: [...currentFiles, ...newFiles] });
    }
  };

  const removeReferenceFile = (index: number) => {
    const currentFiles = [...formsData[AssessmentType.DRAWING].referenceFiles];
    currentFiles.splice(index, 1);
    updateFormData(AssessmentType.DRAWING, { referenceFiles: currentFiles });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        updateFormData(AssessmentType.READING, { audioBlob, audioUrl });
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setErrorMessage("Erro ao acessar microfone. Verifique as permissões.");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const deleteAudio = () => {
    updateFormData(AssessmentType.READING, { audioBlob: null, audioUrl: null });
  };

  const runAnalysis = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      if (activeTab === AssessmentType.DRAWING) {
        const data = formsData[AssessmentType.DRAWING];
        if (!data.preview) throw new Error("Por favor, faça o upload da imagem do desenho.");
        
        const base64 = data.preview.split(',')[1];
        
        // Handle Reference Files (Multiple)
        const referenceFilesData: { mimeType: string, data: string }[] = [];
        if (data.referenceFiles && data.referenceFiles.length > 0) {
          for (const file of data.referenceFiles) {
            const base64Data = await blobToBase64(file);
            referenceFilesData.push({ mimeType: file.type, data: base64Data });
          }
        }

        const result = await analyzeDrawing(base64, referenceFilesData);
        updateFormData(AssessmentType.DRAWING, { analysis: result });

      } else if (activeTab === AssessmentType.WRITING) {
        const data = formsData[AssessmentType.WRITING];
        if (!data.preview) throw new Error("Por favor, faça o upload da imagem da escrita.");
        if (!data.dictatedWords.trim()) throw new Error("Por favor, informe as palavras ditadas para auxiliar a análise.");
        const base64 = data.preview.split(',')[1];
        const result = await analyzeWriting(base64, data.dictatedWords);
        updateFormData(AssessmentType.WRITING, { analysis: result });
      } else if (activeTab === AssessmentType.READING) {
        const data = formsData[AssessmentType.READING];
        if (!data.readingRecord.trim() && !data.audioBlob) throw new Error("Por favor, preencha o registro de leitura ou grave um áudio.");
        
        let audioBase64 = undefined;
        if (data.audioBlob) {
          audioBase64 = await blobToBase64(data.audioBlob);
        }

        const result = await analyzeReading(data.targetText, data.readingRecord, audioBase64);
        updateFormData(AssessmentType.READING, { analysis: result });
      }
    } catch (e) {
      setErrorMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const data = formsData[activeTab];

    if (activeTab === AssessmentType.DRAWING) {
      const d = data as typeof INITIAL_DRAWING_STATE;
      if (!d.preview) {
        setErrorMessage("É obrigatório fazer o upload da foto do desenho.");
        return false;
      }
      if (!d.analysis) {
        setErrorMessage("É necessário realizar a análise com IA antes de salvar.");
        return false;
      }
    } else if (activeTab === AssessmentType.WRITING) {
      const w = data as typeof INITIAL_WRITING_STATE;
      if (!w.preview) {
        setErrorMessage("É obrigatório fazer o upload da foto da escrita.");
        return false;
      }
      if (!w.dictatedWords.trim()) {
        setErrorMessage("O campo de palavras ditadas não pode estar vazio.");
        return false;
      }
      if (!w.analysis) {
        setErrorMessage("É necessário realizar a análise com IA antes de salvar.");
        return false;
      }
    } else if (activeTab === AssessmentType.READING) {
      const r = data as typeof INITIAL_READING_STATE;
      if (!r.targetText.trim()) {
        setErrorMessage("O texto alvo é obrigatório.");
        return false;
      }
      if (!r.readingRecord.trim() && !r.audioBlob) {
        setErrorMessage("É necessário registrar a leitura (texto ou áudio).");
        return false;
      }
      if (!r.analysis) {
        setErrorMessage("É necessário realizar a avaliação de leitura com IA antes de salvar.");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const baseResult: Partial<AssessmentResult> = {
      id: Date.now().toString(),
      studentId: student.id,
      date: new Date().toISOString(),
      type: activeTab,
    };

    if (activeTab === AssessmentType.DRAWING) {
      const data = formsData[AssessmentType.DRAWING];
      baseResult.phase = data.analysis!.phase;
      
      let fullAnalysis = data.analysis!.reasoning;
      if (data.analysis!.colorAnalysis) fullAnalysis += `\n\n[Cores]: ${data.analysis!.colorAnalysis}`;
      if (data.analysis!.anatomicalDetails) fullAnalysis += `\n\n[Anatomia]: ${data.analysis!.anatomicalDetails}`;
      if (data.analysis!.contextualElements) fullAnalysis += `\n\n[Contexto]: ${data.analysis!.contextualElements}`;
      
      baseResult.aiAnalysis = fullAnalysis;
      baseResult.imageUrl = data.preview || undefined;
      baseResult.notes = data.observation;
    } else if (activeTab === AssessmentType.WRITING) {
      const data = formsData[AssessmentType.WRITING];
      baseResult.phase = data.analysis!.phase;
      baseResult.aiAnalysis = data.analysis!.reasoning;
      baseResult.imageUrl = data.preview || undefined;
      baseResult.notes = `${data.dictatedWords ? `Ditado: ${data.dictatedWords}. ` : ''}${data.observation}`;
    } else if (activeTab === AssessmentType.READING) {
      const data = formsData[AssessmentType.READING];
      baseResult.score = Math.round((data.analysis!.fluencyScore + data.analysis!.decodingScore + data.analysis!.comprehensionScore) / 3);
      baseResult.maxScore = 10;
      baseResult.aiAnalysis = `Fluência: ${data.analysis!.fluencyScore}/10. Decodificação: ${data.analysis!.decodingScore}/10. Compreensão: ${data.analysis!.comprehensionScore}/10. ${data.analysis!.reasoning}`;
      baseResult.notes = `Texto Alvo: ${data.targetText}. Registro: ${data.readingRecord}. ${data.observation}`;
    } else if (activeTab === AssessmentType.MATH) {
      const scores = formsData[AssessmentType.MATH].scores as Record<string, number>;
      const total = Object.values(scores).reduce((a, b) => a + b, 0);
      baseResult.score = total;
      baseResult.maxScore = 100; 
      
      const notesList = Object.keys(scores).map(k => {
         const labels: Record<string, string> = {
            counting: 'Contagem', numberRec: 'Números', size: 'Tamanho',
            shapes: 'Formas', patterns: 'Padrões', correspondence: 'Corresp.',
            quantity: 'Quant.', classification: 'Classif.', spatial: 'Espacial', math: 'Cálculo'
         };
         return `${labels[k]}: ${scores[k]}`;
      });
      baseResult.notes = notesList.join("; ");
    } else if (activeTab === AssessmentType.MEMORY) {
      const scores = formsData[AssessmentType.MEMORY].scores;
      baseResult.notes = `Auditiva: ${scores.auditory}, Visual: ${scores.visual}, Funcional: ${scores.functional}`;
    } else if (activeTab === AssessmentType.PHONOLOGICAL) {
      const scores = formsData[AssessmentType.PHONOLOGICAL].scores;
      const map: Record<number, string> = { 1: 'Não iniciou', 2: 'Em processo', 3: 'Consolidado' };
      baseResult.notes = `Rimas: ${map[scores.rhyme]}; Aliterações: ${map[scores.alliteration]}; Seg. Silábica: ${map[scores.syllables]}; Seg. Fonêmica: ${map[scores.phonemes]}`;
    }

    clearDraft();
    onSave(baseResult as AssessmentResult);
  };

  const tabs = [
    { id: AssessmentType.DRAWING, label: 'Desenho', icon: FileText },
    { id: AssessmentType.WRITING, label: 'Escrita', icon: Pencil },
    { id: AssessmentType.READING, label: 'Leitura', icon: BookOpen },
    { id: AssessmentType.MATH, label: 'Matemática', icon: Calculator },
    { id: AssessmentType.PHONOLOGICAL, label: 'Fonologia', icon: MessageCircle },
    { id: AssessmentType.MEMORY, label: 'Memória', icon: Layers },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-0 md:p-4 z-50 backdrop-blur-sm overflow-hidden">
      <div className="bg-white dark:bg-gray-800 w-full md:max-w-5xl rounded-none md:rounded-2xl shadow-2xl flex flex-col h-full md:h-auto md:max-h-[95vh] transition-all duration-300">
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Nova Sondagem</h2>
            <p className="text-sm text-gray-500">{student.name}</p>
          </div>
          <button onClick={handleCancel} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto no-scrollbar shrink-0 bg-gray-50/50 dark:bg-gray-800">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 md:px-6 py-4 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'text-orange-600 border-orange-600 bg-orange-50/50 dark:bg-gray-700 dark:text-orange-400 dark:border-orange-400'
                  : 'text-gray-500 border-transparent hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/30 dark:bg-gray-900/30 custom-scrollbar">
          
          {/* DRAWING & WRITING */}
          {(activeTab === AssessmentType.DRAWING || activeTab === AssessmentType.WRITING) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start h-full">
              <div className="space-y-4 flex flex-col">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer relative group flex items-center justify-center min-h-[250px] overflow-hidden">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    onChange={(e) => handleImageUpload(e, activeTab)}
                    disabled={isProcessingImage}
                  />
                  
                  {isProcessingImage ? (
                    <div className="flex flex-col items-center text-orange-600 dark:text-orange-400 animate-pulse">
                      <Loader2 size={48} className="animate-spin mb-2" />
                      <p className="font-bold">Otimizando imagem...</p>
                      <p className="text-xs opacity-75">Redimensionando para análise rápida</p>
                    </div>
                  ) : formsData[activeTab].preview ? (
                    <img src={formsData[activeTab].preview!} alt="Preview" className="max-h-60 max-w-full rounded-lg shadow-sm object-contain" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <Camera size={48} className="mb-2" />
                      <p>Clique ou arraste a foto aqui</p>
                    </div>
                  )}
                </div>

                {/* PDF Reference Upload (Drawing Only - Multiple Files) */}
                {activeTab === AssessmentType.DRAWING && (
                  <div className="bg-blue-50 dark:bg-gray-900/50 p-4 rounded-xl border border-blue-100 dark:border-gray-700">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                       <Paperclip size={16} />
                       Material de Referência (File Search)
                    </label>
                    <div className="flex flex-col gap-3">
                       <div className="flex items-center gap-2">
                         <label className="cursor-pointer bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
                           <Plus size={16} /> Adicionar Arquivos
                           <input 
                             type="file" 
                             accept=".pdf,image/*"
                             multiple
                             onChange={handleReferenceUpload}
                             className="hidden"
                           />
                         </label>
                         <span className="text-xs text-gray-500">PDFs ou Imagens</span>
                       </div>

                       {/* Reference File List */}
                       {formsData[AssessmentType.DRAWING].referenceFiles.length > 0 && (
                         <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                           {formsData[AssessmentType.DRAWING].referenceFiles.map((file, index) => (
                             <div key={index} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600 text-xs">
                               <span className="truncate max-w-[80%] text-gray-700 dark:text-gray-300">{file.name}</span>
                               <button 
                                 onClick={() => removeReferenceFile(index)}
                                 className="text-red-500 hover:bg-red-50 p-1 rounded"
                               >
                                 <Trash2 size={14} />
                               </button>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Anexe livros, BNCC ou exemplos de fases. A IA usará esses arquivos para enriquecer a análise.
                    </p>
                  </div>
                )}

                {activeTab === AssessmentType.WRITING && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Palavras Ditadas</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="Ex: CASA, BOLA, GATO..."
                      value={(formsData[AssessmentType.WRITING]).dictatedWords}
                      onChange={(e) => updateFormData(AssessmentType.WRITING, { dictatedWords: e.target.value })}
                    />
                  </div>
                )}
                <button 
                  onClick={runAnalysis}
                  disabled={loading || isProcessingImage || !formsData[activeTab].preview}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-md mt-auto"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <ScanText />}
                  Analisar com IA
                </button>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full min-h-[400px]">
                <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                   {activeTab === AssessmentType.DRAWING ? <FileText className="text-orange-500" size={20} /> : <Search className="text-teal-500" size={20} />}
                   {activeTab === AssessmentType.DRAWING ? 'Parecer Pedagógico Detalhado' : 'Diagnóstico Clínico'}
                </h3>
                
                {formsData[activeTab].analysis ? (
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-4">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg mb-4">
                      <p className="text-xs font-bold text-green-800 dark:text-green-300 uppercase tracking-wider mb-1">Fase Identificada</p>
                      <p className="text-xl font-bold text-green-900 dark:text-green-100">{formsData[activeTab].analysis!.phase}</p>
                    </div>
                    
                    {/* General Reasoning */}
                    <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                      <p className="whitespace-pre-wrap text-gray-600 dark:text-gray-300 leading-relaxed font-medium text-sm">
                        {formsData[activeTab].analysis!.reasoning}
                      </p>
                    </div>

                    {/* Rich Details for Drawing Only */}
                    {activeTab === AssessmentType.DRAWING && (
                      <div className="grid grid-cols-1 gap-3 mb-2">
                        {/* Colors */}
                        {formsData[AssessmentType.DRAWING].analysis?.colorAnalysis && (
                           <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                             <h4 className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300 uppercase mb-1">
                               <Palette size={14} /> Uso de Cores
                             </h4>
                             <p className="text-sm text-gray-700 dark:text-gray-300">
                               {formsData[AssessmentType.DRAWING].analysis?.colorAnalysis}
                             </p>
                           </div>
                        )}
                        
                        {/* Anatomy */}
                        {formsData[AssessmentType.DRAWING].analysis?.anatomicalDetails && (
                           <div className="bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg border border-purple-100 dark:border-purple-800">
                             <h4 className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300 uppercase mb-1">
                               <Eye size={14} /> Detalhes / Anatomia
                             </h4>
                             <p className="text-sm text-gray-700 dark:text-gray-300">
                               {formsData[AssessmentType.DRAWING].analysis?.anatomicalDetails}
                             </p>
                           </div>
                        )}

                        {/* Context */}
                        {formsData[AssessmentType.DRAWING].analysis?.contextualElements && (
                           <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-800">
                             <h4 className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300 uppercase mb-1">
                               <Trees size={14} /> Contexto e Cenário
                             </h4>
                             <p className="text-sm text-gray-700 dark:text-gray-300">
                               {formsData[AssessmentType.DRAWING].analysis?.contextualElements}
                             </p>
                           </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 italic text-sm bg-gray-50 dark:bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-100 dark:border-gray-700 mb-4 p-8">
                    <ScanText size={32} className="mb-2 opacity-50" />
                    <p>O resultado da análise aparecerá aqui...</p>
                  </div>
                )}
                
                 <div className="mt-auto">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                  <textarea 
                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                    rows={2}
                    placeholder="Anotações extras do professor..."
                    value={formsData[activeTab].observation}
                    onChange={(e) => updateFormData(activeTab, { observation: e.target.value })}
                  />
                 </div>
              </div>
            </div>
          )}

          {/* READING */}
          {activeTab === AssessmentType.READING && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              <div className="space-y-4 flex flex-col">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Texto Alvo</label>
                  <input
                    type="text"
                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    value={formsData[AssessmentType.READING].targetText}
                    onChange={(e) => updateFormData(AssessmentType.READING, { targetText: e.target.value })}
                  />
                </div>
                
                <div className="bg-orange-50 dark:bg-gray-800 p-4 rounded-xl border border-orange-100 dark:border-gray-700">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Gravação (Opcional)
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    {!isRecording ? (
                      <button 
                        onClick={startRecording}
                        className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold transition-colors text-sm"
                      >
                        <Mic size={16} /> Gravar
                      </button>
                    ) : (
                      <button 
                        onClick={stopRecording}
                        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold transition-colors animate-pulse text-sm"
                      >
                        <Square size={16} /> Parar
                      </button>
                    )}
                    
                    {formsData[AssessmentType.READING].audioUrl && !isRecording && (
                       <div className="flex items-center gap-2 bg-white dark:bg-gray-700 px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 max-w-full overflow-hidden">
                          <audio controls src={formsData[AssessmentType.READING].audioUrl!} className="h-8 w-32 sm:w-40" />
                          <button onClick={deleteAudio} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16} /></button>
                       </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Registro da Leitura
                  </label>
                  <textarea
                    className="w-full p-4 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white flex-1 min-h-[120px]"
                    placeholder="Transcrição manual ou anotações..."
                    value={formsData[AssessmentType.READING].readingRecord}
                    onChange={(e) => updateFormData(AssessmentType.READING, { readingRecord: e.target.value })}
                  />
                </div>
                <button
                  onClick={runAnalysis}
                  disabled={loading || (!formsData[AssessmentType.READING].readingRecord && !formsData[AssessmentType.READING].audioBlob)}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-md mt-4"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Wind />}
                  Avaliar Leitura
                </button>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 h-full flex flex-col min-h-[400px]">
                 <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                  <Brain className="text-cyan-500" size={20} /> Análise de Fluência
                </h3>
                {formsData[AssessmentType.READING].analysis ? (
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-cyan-50 dark:bg-gray-700/50 p-3 rounded-lg text-center border border-cyan-100 dark:border-gray-600">
                        <Wind className="mx-auto text-cyan-500 mb-1" size={20} />
                        <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Fluência</p>
                        <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{formsData[AssessmentType.READING].analysis!.fluencyScore}</p>
                      </div>
                      <div className="bg-cyan-50 dark:bg-gray-700/50 p-3 rounded-lg text-center border border-cyan-100 dark:border-gray-600">
                        <ScanText className="mx-auto text-cyan-500 mb-1" size={20} />
                        <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Decodif.</p>
                        <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{formsData[AssessmentType.READING].analysis!.decodingScore}</p>
                      </div>
                      <div className="bg-cyan-50 dark:bg-gray-700/50 p-3 rounded-lg text-center border border-cyan-100 dark:border-gray-600">
                        <Brain className="mx-auto text-cyan-500 mb-1" size={20} />
                        <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Compr.</p>
                        <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{formsData[AssessmentType.READING].analysis!.comprehensionScore}</p>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                      <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {formsData[AssessmentType.READING].analysis!.reasoning}
                      </p>
                    </div>
                  </div>
                ) : (
                   <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 italic text-sm border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50 p-8">
                    <BookOpen size={32} className="mb-2 opacity-50" />
                    <p>O resultado da análise aparecerá aqui...</p>
                  </div>
                )}
                
                <div className="mt-4">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                  <textarea 
                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                    rows={2}
                    placeholder="Anotações extras..."
                    value={formsData[AssessmentType.READING].observation}
                    onChange={(e) => updateFormData(AssessmentType.READING, { observation: e.target.value })}
                  />
                 </div>
              </div>
            </div>
          )}

          {/* MATH */}
          {activeTab === AssessmentType.MATH && (
            <div className="space-y-6">
              <p className="text-gray-500 dark:text-gray-400 bg-orange-50 dark:bg-gray-900/50 p-3 rounded-lg text-sm border border-orange-100 dark:border-gray-700">
                Avalie as habilidades matemáticas atribuindo uma pontuação de 0 a 10 para cada competência.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'counting', label: 'Contagem de Objetos', tip: 'Mostre 5 blocos. "Quantos blocos você vê? Pode contar?"' },
                  { key: 'numberRec', label: 'Reconhecimento de Números', tip: 'Mostre cartões 1 a 4. "Onde está o número 3?"' },
                  { key: 'size', label: 'Comparação de Tamanhos', tip: 'Dê dois objetos. "Qual é maior? Qual é menor?"' },
                  { key: 'shapes', label: 'Formas Geométricas', tip: 'Mostre círculo, quadrado, triângulo. "Qual é o círculo?"' },
                  { key: 'patterns', label: 'Padrões e Sequências', tip: 'Sequência cores (Vermelho, Azul...). "Qual vem depois?"' },
                  { key: 'correspondence', label: 'Correspondência Um a Um', tip: '4 blocos e 4 números. "Coloque o número no bloco."' },
                  { key: 'quantity', label: 'Noções de Quantidade', tip: 'Grupos de 3 e 5 blocos. "Qual tem mais? Qual tem menos?"' },
                  { key: 'classification', label: 'Classificação', tip: 'Vários objetos. "Agrupe por cor ou forma."' },
                  { key: 'spatial', label: 'Noção Espacial (Desenho)', tip: 'Peça para desenhar uma casa (organização no papel).' },
                  { key: 'math', label: 'Problemas Simples', tip: '"Você tem 2 maçãs e ganha mais 1. Quantas tem agora?"' }
                ].map((item) => (
                  <div key={item.key} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between gap-3">
                    <div className="flex justify-between items-start">
                        <label className="font-bold text-gray-800 dark:text-gray-200 text-sm">{item.label}</label>
                        <div className="group relative">
                           <HelpCircle size={16} className="text-gray-400 cursor-help" />
                           <div className="absolute right-0 bottom-full mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                             {item.tip}
                           </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-end w-full">
                       <input 
                          type="number" 
                          min="0" 
                          max="10"
                          value={formsData[AssessmentType.MATH].scores[item.key]}
                          onChange={(e) => {
                            const val = Math.min(10, Math.max(0, parseInt(e.target.value) || 0));
                            const currentScores = formsData[AssessmentType.MATH].scores;
                            updateFormData(AssessmentType.MATH, { scores: { ...currentScores, [item.key]: val } });
                          }}
                          className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-center font-bold"
                        />
                        <span className="text-gray-400 text-xs font-bold whitespace-nowrap">/ 10</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PHONOLOGICAL */}
          {activeTab === AssessmentType.PHONOLOGICAL && (
            <div className="space-y-6">
               <p className="text-gray-500 dark:text-gray-400 bg-teal-50 dark:bg-gray-900/50 p-3 rounded-lg text-sm border border-teal-100 dark:border-gray-700">
                Avalie a consciência fonológica. Rimas, aliterações e capacidade de segmentar palavras e sons.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'rhyme', label: 'Rimas', desc: 'Identifica e cria rimas simples.' },
                  { key: 'alliteration', label: 'Aliterações', desc: 'Percebe sons iniciais iguais.' },
                  { key: 'syllables', label: 'Segmentação Silábica', desc: 'Separa palavras em sílabas.' },
                  { key: 'phonemes', label: 'Segmentação Fonêmica', desc: 'Isola sons individuais.' }
                ].map((item) => (
                  <div key={item.key} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <h4 className="font-bold text-gray-800 dark:text-gray-200">{item.label}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{item.desc}</p>
                    <div className="flex flex-wrap gap-2">
                       {[1, 2, 3].map((level) => (
                        <button
                          key={level}
                          onClick={() => {
                            const currentScores = formsData[AssessmentType.PHONOLOGICAL].scores;
                            updateFormData(AssessmentType.PHONOLOGICAL, { scores: { ...currentScores, [item.key]: level } });
                          }}
                          className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all min-w-[80px] ${
                            formsData[AssessmentType.PHONOLOGICAL].scores[item.key] === level
                              ? level === 3
                                ? 'bg-teal-500 text-white shadow-teal-200/50 shadow-md' 
                                : level === 2 
                                  ? 'bg-amber-400 text-white shadow-amber-200/50 shadow-md'
                                  : 'bg-red-400 text-white shadow-red-200/50 shadow-md'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {level === 1 ? 'Não iniciou' : level === 2 ? 'Em processo' : 'Consolidado'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MEMORY */}
          {activeTab === AssessmentType.MEMORY && (
             <div className="space-y-6">
              <p className="text-gray-500 dark:text-gray-400 bg-purple-50 dark:bg-gray-900/50 p-3 rounded-lg text-sm border border-purple-100 dark:border-gray-700">
                Avalie a memória de trabalho com base na capacidade de retenção e manipulação de informações.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { key: 'auditory', label: 'Memória Auditiva', desc: 'Repetição de dígitos/palavras.', tip: 'Diga "2 - 5 - 9". Peça para repetir.' },
                  { key: 'visual', label: 'Memória Visual', desc: 'Recordação de imagens/objetos.', tip: 'Mostre 3 figuras. Esconda. "Quais eram?"' },
                  { key: 'functional', label: 'Memória Funcional', desc: 'Instruções de múltiplos passos.', tip: '"Pegue o lápis e desenhe um círculo" (2 passos).' }
                ].map((item) => (
                  <div key={item.key} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative group">
                    <div className="absolute top-2 right-2">
                        <HelpCircle size={14} className="text-gray-300 cursor-help" />
                        <div className="absolute right-0 bottom-full mb-2 w-40 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                             {item.tip}
                        </div>
                    </div>
                    <h4 className="font-bold text-gray-800 dark:text-gray-200 pr-4">{item.label}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{item.desc}</p>
                    <div className="flex flex-col gap-2">
                       {[1, 2, 3].map((level) => (
                        <button
                          key={level}
                          onClick={() => {
                            const currentScores = formsData[AssessmentType.MEMORY].scores;
                            updateFormData(AssessmentType.MEMORY, { scores: { ...currentScores, [item.key]: level } });
                          }}
                          className={`w-full py-3 rounded-lg text-xs font-bold transition-all flex items-center justify-between px-4 ${
                            formsData[AssessmentType.MEMORY].scores[item.key] === level
                              ? 'bg-purple-600 text-white shadow-purple-200/50 shadow-md'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          <span>{level === 1 ? 'Baixo' : level === 2 ? 'Médio' : 'Alto'}</span>
                          {formsData[AssessmentType.MEMORY].scores[item.key] === level && <CheckCircle size={14} />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 md:p-6 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col md:flex-row justify-between items-center shrink-0 rounded-b-none md:rounded-b-2xl gap-4">
          {errorMessage ? (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg text-sm font-bold animate-pulse w-full md:w-auto text-center md:text-left justify-center md:justify-start">
              <AlertCircle size={18} />
              {errorMessage}
            </div>
          ) : (
            <div className="text-sm text-gray-400 w-full md:w-auto text-center md:text-left hidden md:block">
               Salvo automaticamente como rascunho.
            </div>
          )}
          
          <div className="flex gap-3 w-full md:w-auto">
             <button 
              onClick={handleCancel}
              className="flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit}
              className="flex-1 md:flex-none px-8 py-3 rounded-xl font-bold bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
