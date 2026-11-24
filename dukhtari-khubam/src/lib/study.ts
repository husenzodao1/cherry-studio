/**
 * The student Workspace's chat (Premium): what she asks Mahliyo to do with her studies, and in which subject.
 * Mahliyo answers from her own materials (the Workspace) and as the task asks: an essay, a problem solved as it
 * is written in a notebook, a school composition, a language lesson, her homework, a topic explained, exam practice.
 */

export const STUDY_TASKS = ['homework', 'problem', 'essay', 'composition', 'languages', 'explain', 'exam'] as const
export type StudyTask = (typeof STUDY_TASKS)[number]

export const SUBJECTS = [
  { id: 'math', emoji: '➗', en: 'mathematics' }, { id: 'algebra', emoji: '🔢', en: 'algebra' }, { id: 'geometry', emoji: '📐', en: 'geometry' },
  { id: 'physics', emoji: '⚛️', en: 'physics' }, { id: 'chemistry', emoji: '🧪', en: 'chemistry' }, { id: 'biology', emoji: '🧬', en: 'biology' },
  { id: 'anatomy', emoji: '🫀', en: 'human anatomy' }, { id: 'medicine', emoji: '🩺', en: 'medicine' }, { id: 'history', emoji: '🏛️', en: 'history' },
  { id: 'literature', emoji: '📚', en: 'literature' }, { id: 'tajik', emoji: '🇹🇯', en: 'Tajik language' }, { id: 'russian', emoji: '🇷🇺', en: 'Russian language' },
  { id: 'english', emoji: '🇬🇧', en: 'English language' }, { id: 'geography', emoji: '🌍', en: 'geography' }, { id: 'informatics', emoji: '💻', en: 'computer science' },
  { id: 'economics', emoji: '📈', en: 'economics' }, { id: 'law', emoji: '⚖️', en: 'law' }, { id: 'philosophy', emoji: '🤔', en: 'philosophy' }
] as const
export type SubjectId = (typeof SUBJECTS)[number]['id']
export const SUBJECT_IDS = SUBJECTS.map((s) => s.id) as [SubjectId, ...SubjectId[]]

export interface Study { task: StudyTask; subject?: SubjectId }

const TASK_NOTE: Record<StudyTask, string> = {
  homework: 'HOMEWORK: understand her task first, explain the method, then work it through with her; give the full solution when she asks for it, and a short check of her understanding at the end.',
  problem: 'A PROBLEM FOR HER NOTEBOOK: solve it the way it is written in a school notebook — «Дода шудааст» (given, with units), «Ёфтан лозим» (to find), «Ҳал» (the solution: each step on its own line, the formula first, then the numbers put in, LaTeX for formulas, the calc block for the arithmetic), «Ҷавоб» (the answer). Use these headings in her language (Дано / Найти / Решение / Ответ in Russian, Given / Find / Solution / Answer in English).',
  essay: 'AN ESSAY: a title, an introduction with her thesis, body paragraphs each with an argument and an example, a conclusion; 400–600 words unless she asks otherwise; offer it as a Word document (the file block) when it is long.',
  composition: 'A SCHOOL COMPOSITION (иншо / сочинение): a short plan first, then the composition in a student\'s clear, warm language, at a school level; quotes from the literature she studies where they fit.',
  languages: 'A LANGUAGE LESSON: teach the language she studies — grammar explained simply with examples and their translations, new words with pronunciation, then a few short exercises; correct her mistakes kindly, explaining each.',
  explain: 'A TOPIC EXPLAINED like a good tutor: the definition, the key ideas in order, examples, a picture described in words (or a diagram), common mistakes, and three short questions at the end to check herself.',
  exam: 'EXAM PRACTICE: a few exam-style questions on the topic one at a time (the quiz block when it fits), then her answers checked with explanations, and what to revise.'
}

/** what the student chat asks of Mahliyo (for her instructions) */
export function studyNote(s: Study): string {
  const subject = s.subject ? SUBJECTS.find((x) => x.id === s.subject)?.en : null
  return [
    'STUDENT WORKSPACE: she is studying. Answer as her personal tutor, at her level (school or university, as her words show), from her own materials when they have the answer (say so), and from what is true otherwise.',
    ...(subject ? [`SUBJECT: ${subject}.`] : []),
    `TASK — ${TASK_NOTE[s.task]}`
  ].join('\n')
}
