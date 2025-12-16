import React from 'react';
import { Student, AssessmentResult, AssessmentType } from '../types';
import { Plus, FileText } from 'lucide-react';

interface Props {
  students: Student[];
  assessments: AssessmentResult[];
  onSelectStudent: (student: Student) => void;
  onGenerateReport: (student: Student) => void;
}

export const StudentList: React.FC<Props> = ({ students, assessments, onSelectStudent, onGenerateReport }) => {
  const getLatestPhase = (studentId: string, type: AssessmentType) => {
    const studentAssessments = assessments
      .filter(a => a.studentId === studentId && a.type === type)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return studentAssessments[0]?.phase || '-';
  };

  const getScore = (studentId: string, type: AssessmentType) => {
    const studentAssessments = assessments
      .filter(a => a.studentId === studentId && a.type === type)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (!studentAssessments[0]) return '-';
    return `${studentAssessments[0].score}/${studentAssessments[0].maxScore}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-orange-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-orange-50 dark:bg-gray-700 text-orange-900 dark:text-orange-300">
            <tr>
              <th className="p-4 font-bold">Nome</th>
              <th className="p-4 font-bold">Idade</th>
              <th className="p-4 font-bold">Fase Desenho</th>
              <th className="p-4 font-bold">Fase Escrita</th>
              <th className="p-4 font-bold">Matemática</th>
              <th className="p-4 font-bold text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {students.map(student => {
              const hasAssessments = assessments.some(a => a.studentId === student.id);
              return (
                <tr key={student.id} className="hover:bg-orange-50/30 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="p-4 font-bold text-gray-800 dark:text-gray-100">{student.name}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-400">{student.age} anos</td>
                  <td className="p-4">
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full font-bold">
                      {getLatestPhase(student.id, AssessmentType.DRAWING)}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-1 rounded-full font-bold">
                      {getLatestPhase(student.id, AssessmentType.WRITING)}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600 dark:text-gray-400 font-mono">
                    {getScore(student.id, AssessmentType.MATH)}
                  </td>
                  <td className="p-4 flex justify-center gap-2">
                    <button 
                      onClick={() => onSelectStudent(student)}
                      className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-gray-600 rounded-lg tooltip"
                      title="Nova Sondagem"
                    >
                      <Plus size={20} />
                    </button>
                    <button 
                      onClick={() => onGenerateReport(student)}
                      disabled={!hasAssessments}
                      className={`p-2 rounded-lg tooltip ${
                        hasAssessments 
                          ? "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-gray-600" 
                          : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                      }`}
                      title={hasAssessments ? "Gerar Relatório IA" : "Sem dados para relatório"}
                    >
                      <FileText size={20} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};