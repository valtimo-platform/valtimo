const API_BASE = 'http://localhost:8090';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  if (resp.status === 204) return undefined as T;
  return resp.json();
}

export const api = {
  plans: {
    list: () => request<Plan[]>('/api/v1/plans'),
    get: (id: string) => request<Plan>(`/api/v1/plans/${id}`),
    update: (id: string, data: Partial<Plan>) =>
      request<Plan>(`/api/v1/plans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  goals: {
    listByPlan: (planId: string) => request<Goal[]>(`/api/v1/plans/${planId}/goals`),
    create: (planId: string, data: Partial<Goal>) =>
      request<Goal>(`/api/v1/plans/${planId}/goals`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Goal>) =>
      request<Goal>(`/api/v1/goals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/api/v1/goals/${id}`, { method: 'DELETE' }),
  },
  actions: {
    listByPlan: (planId: string) => request<Action[]>(`/api/v1/plans/${planId}/actions`),
    create: (goalId: string, data: Partial<Action>) =>
      request<Action>(`/api/v1/goals/${goalId}/actions`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Action>) =>
      request<Action>(`/api/v1/actions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    approve: (id: string) =>
      request<Action>(`/api/v1/actions/${id}/approve`, { method: 'POST' }),
    reject: (id: string) =>
      request<Action>(`/api/v1/actions/${id}/reject`, { method: 'POST' }),
  },
  instruments: {
    listByPlan: (planId: string) => request<Instrument[]>(`/api/v1/plans/${planId}/instruments`),
    create: (goalId: string, data: Partial<Instrument>) =>
      request<Instrument>(`/api/v1/goals/${goalId}/instruments`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Instrument>) =>
      request<Instrument>(`/api/v1/instruments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  evaluations: {
    listByPlan: (planId: string) => request<Evaluation[]>(`/api/v1/plans/${planId}/evaluations`),
    create: (planId: string, data: Partial<Evaluation>) =>
      request<Evaluation>(`/api/v1/plans/${planId}/evaluations`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Evaluation>) =>
      request<Evaluation>(`/api/v1/evaluations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/api/v1/evaluations/${id}`, { method: 'DELETE' }),
  },
  parties: {
    listByPlan: (planId: string) => request<InvolvedParty[]>(`/api/v1/plans/${planId}/parties`),
    create: (planId: string, data: Partial<InvolvedParty>) =>
      request<InvolvedParty>(`/api/v1/plans/${planId}/parties`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/api/v1/parties/${id}`, { method: 'DELETE' }),
  },
  phaseConfigs: {
    get: (caseDefKey: string) => request<PhaseConfig>(`/api/v1/admin/phase-configs/${caseDefKey}`),
    list: () => request<PhaseConfig[]>('/api/v1/admin/phase-configs'),
    create: (data: Partial<PhaseConfig>) =>
      request<PhaseConfig>('/api/v1/admin/phase-configs', { method: 'POST', body: JSON.stringify(data) }),
    update: (key: string, data: Partial<PhaseConfig>) =>
      request<PhaseConfig>(`/api/v1/admin/phase-configs/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (key: string) =>
      request<void>(`/api/v1/admin/phase-configs/${key}`, { method: 'DELETE' }),
  },
  mock: {
    person: (bsn: string) => request<PersonRecord>(`/api/v1/mock/persons/${bsn}`),
    object: (id: string) => request<ObjectRecord>(`/api/v1/mock/objects/${id}`),
    products: () => request<ProductRecord[]>('/api/v1/mock/products'),
    goalTypes: () => request<StamtabelEntry[]>('/api/v1/mock/stamtabel/doeltypen'),
    roles: () => request<StamtabelEntry[]>('/api/v1/mock/stamtabel/rollen'),
  },
};

export interface Plan {
  id: string;
  subjectType: string;
  subjectId: string;
  title: string;
  mainGoal?: string;
  startSituation?: string;
  desiredSituation?: string;
  status: string;
  startDate?: string;
  targetEndDate?: string;
  actualEndDate?: string;
  caseId?: string;
  caseDefinitionKey?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface Goal {
  id: string;
  planId: string;
  title: string;
  description?: string;
  goalType?: string;
  status: string;
  phase: string;
  startDate?: string;
  targetEndDate?: string;
  progressScore?: number;
  progressExplanation?: string;
  sortOrder: number;
}

export interface Action {
  id: string;
  goalId: string;
  title: string;
  description?: string;
  status: string;
  assigneeType?: string;
  assigneeName?: string;
  priority: string;
  startDate?: string;
  dueDate?: string;
  completedDate?: string;
  result?: string;
  evaluationSourceId?: string;
}

export interface Instrument {
  id: string;
  goalId: string;
  externalProductId?: string;
  title: string;
  providerName?: string;
  category?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  result?: string;
}

export interface Evaluation {
  id: string;
  planId: string;
  evalType: string;
  status: string;
  scheduledDate?: string;
  actualDate?: string;
  summary?: string;
  participants?: string;
  goalProgress?: string;
  actionPoints?: string;
}

export interface InvolvedParty {
  id: string;
  planId: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  organization?: string;
  isPrimary: boolean;
}

export interface PhaseConfig {
  id: string;
  caseDefinitionKey: string;
  phases: string;
  evaluationTypes: string;
}

export interface PersonRecord {
  bsn: string;
  naam: string;
  geboortedatum: string;
  geslacht: string;
  nationaliteit: string;
  adres: { straat: string; huisnummer: string; postcode: string; woonplaats: string };
  burgerlijkeStaat: string;
  kinderen: { naam: string; geboortedatum: string }[];
}

export interface ObjectRecord {
  id: string;
  naam: string;
  type: string;
  monumentnummer?: string;
  bouwperiode?: string;
  adres: { straat: string; huisnummer?: string; postcode: string; woonplaats: string };
  eigenaar: string;
  beheerder: string;
  functie: string;
  status: string;
}

export interface ProductRecord {
  id: string;
  naam: string;
  categorie: string;
  omschrijving: string;
  aanbieder: string;
  duur?: string;
  doelgroep?: string[];
}

export interface StamtabelEntry {
  code: string;
  label: string;
  beschrijving: string;
}
