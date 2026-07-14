const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Concept', ACTIVE: 'Actief', PAUSED: 'Gepauzeerd',
  COMPLETED: 'Afgerond', CANCELLED: 'Geannuleerd',
  PLANNED: 'Gepland', ACHIEVED: 'Behaald', NOT_ACHIEVED: 'Niet behaald',
  IN_PROGRESS: 'In uitvoering', PENDING_REVIEW: 'Ter beoordeling',
  REJECTED: 'Afgekeurd',
};

const EVAL_TYPE_LABELS: Record<string, string> = {
  INTAKE: 'Intake', PROGRESS: 'Voortgang', EVALUATION: 'Evaluatie',
  INSPECTION: 'Inspectie', CRISIS: 'Crisis',
};

const GOAL_TYPE_LABELS: Record<string, string> = {
  INVENTARISATIE: 'Inventarisatie', ONTWIKKELING: 'Ontwikkeling',
  PRAKTISCH: 'Praktisch', VERKENNING: 'Verkenning',
  PLAATSING: 'Plaatsing', BORGING: 'Borging',
  ANALYSE: 'Analyse', HERSTEL: 'Herstel', CONTROLE: 'Controle',
};

const ROLE_LABELS: Record<string, string> = {
  REGIEBEHANDELAAR: 'Regiebehandelaar', ARBEIDSCOACH: 'Arbeidscoach',
  INWONER: 'Inwoner/Eigenaar', PROJECTLEIDER: 'Projectleider',
  BRANDVEILIGHEIDSADVISEUR: 'Brandveiligheidsadviseur',
  GEBOUWBEHEERDER: 'Gebouwbeheerder', COACH: 'Coach',
  INSPECTEUR: 'Inspecteur', SCHULDHULPVERLENER: 'Schuldhulpverlener',
  AANBIEDER: 'Aanbieder',
};

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: 'Hoog', NORMAL: 'Normaal', LOW: 'Laag',
};

const ASSIGNEE_TYPE_LABELS: Record<string, string> = {
  PROFESSIONAL: 'Behandelaar', SUBJECT: 'Inwoner/Eigenaar', PROVIDER: 'Aanbieder',
};

const SUBJECT_TYPE_LABELS: Record<string, string> = {
  PERSON: 'Persoon', OBJECT: 'Object', FAMILY: 'Gezin',
};

export function statusLabel(s: string): string { return STATUS_LABELS[s] || s; }
export function evalTypeLabel(s: string): string { return EVAL_TYPE_LABELS[s] || s; }
export function goalTypeLabel(s: string): string { return GOAL_TYPE_LABELS[s] || s; }
export function roleLabel(s: string): string { return ROLE_LABELS[s] || s; }
export function priorityLabel(s: string): string { return PRIORITY_LABELS[s] || s; }
export function assigneeTypeLabel(s: string): string { return ASSIGNEE_TYPE_LABELS[s] || s; }
export function subjectTypeLabel(s: string): string { return SUBJECT_TYPE_LABELS[s] || s; }

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
}
