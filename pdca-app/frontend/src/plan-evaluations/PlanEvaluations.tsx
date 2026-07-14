import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Theme, Button, Tag, Modal, TextInput, TextArea, Select, SelectItem,
  Loading, InlineNotification, Slider, Tile,
} from '@carbon/react';
import { Add, ChevronRight, TrashCan, ArrowRight } from '@carbon/react/icons';
import { onInit, resizeIframe } from '../shared/bridge';
import { api, Plan, Goal, Evaluation } from '../shared/api';
import { statusLabel, evalTypeLabel, formatDate } from '../shared/labels';

export function PlanEvaluations() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [evalTypes, setEvalTypes] = useState<string[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createModal, setCreateModal] = useState(false);
  const cdkRef = useRef<string | null>(null);

  useEffect(() => { onInit(ctx => { cdkRef.current = ctx.caseDefinitionKey || null; loadData(); }); }, []);
  useEffect(() => { resizeIframe(); }, [loading, evaluations, expanded]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let plans = await api.plans.list();
      if (cdkRef.current) plans = plans.filter(p => p.caseDefinitionKey === cdkRef.current);
      plans = plans.filter(p => p.status === 'ACTIVE' || p.status === 'DRAFT');
      if (plans.length === 0) { setError('Geen plan gevonden'); setLoading(false); return; }
      const p = plans[0]; setPlan(p);
      const [g, e] = await Promise.all([api.goals.listByPlan(p.id), api.evaluations.listByPlan(p.id)]);
      setGoals(g); setEvaluations(e);
      if (p.caseDefinitionKey) {
        try {
          const cfg = await api.phaseConfigs.get(p.caseDefinitionKey);
          setEvalTypes(JSON.parse(cfg.evaluationTypes));
        } catch { setEvalTypes(['INTAKE', 'PROGRESS', 'EVALUATION']); }
      }
      setLoading(false);
    } catch (e: any) { setError(e.message); setLoading(false); }
  }, []);

  const reload = useCallback(async () => {
    if (!plan) return;
    const [g, e] = await Promise.all([api.goals.listByPlan(plan.id), api.evaluations.listByPlan(plan.id)]);
    setGoals(g); setEvaluations(e);
  }, [plan]);

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Evaluatie verwijderen?')) return;
    await api.evaluations.delete(id); await reload();
  };

  const handleCreateAction = async (evalId: string, text: string, goalId: string) => {
    await api.actions.create(goalId, { title: text, evaluationSourceId: evalId, status: 'PLANNED' });
    alert('Actie aangemaakt');
  };

  const filtered = filter ? evaluations.filter(e => e.evalType === filter) : evaluations;
  const sorted = [...filtered].sort((a, b) => (b.actualDate || b.scheduledDate || '').localeCompare(a.actualDate || a.scheduledDate || ''));
  const completed = evaluations.filter(e => e.status === 'COMPLETED').length;
  const planned = evaluations.filter(e => e.status === 'PLANNED').length;

  if (loading) return <Theme theme="g10"><div className="pdca-container"><Loading withOverlay={false} /></div></Theme>;
  if (error) return <Theme theme="g10"><div className="pdca-container"><InlineNotification kind="error" title={error} /></div></Theme>;
  if (!plan) return null;

  return (
    <Theme theme="g10">
      <div className="pdca-container">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24}}>
          <div>
            <h1 style={{fontSize: '1.75rem', fontWeight: 600, marginBottom: 8}}>Evaluaties</h1>
            <div style={{display: 'flex', gap: 16}}>
              <Tag size="sm" type="gray">Totaal: {evaluations.length}</Tag>
              <Tag size="sm" type="green">Afgerond: {completed}</Tag>
              <Tag size="sm" type="warm-gray">Gepland: {planned}</Tag>
            </div>
          </div>
          <Button renderIcon={Add} onClick={() => setCreateModal(true)}>Nieuwe evaluatie</Button>
        </div>

        <div className="pdca-phase-bar">
          <span style={{fontSize: 12, fontWeight: 600, color: 'var(--cds-text-secondary)'}}>Filter:</span>
          <Button size="sm" kind={!filter ? 'primary' : 'ghost'} onClick={() => setFilter(null)}>Alle</Button>
          {evalTypes.map(t => (
            <Button key={t} size="sm" kind={filter === t ? 'primary' : 'ghost'} onClick={() => setFilter(t)}>{evalTypeLabel(t)}</Button>
          ))}
        </div>

        {sorted.length === 0 && <div className="pdca-empty"><p>Geen evaluaties gevonden</p></div>}

        {sorted.map((ev, i) => {
          const isOpen = expanded.has(ev.id);
          const date = ev.actualDate || ev.scheduledDate;
          const goalProgress = tryParse(ev.goalProgress);
          const actionPoints = tryParse(ev.actionPoints);
          return (
            <div key={ev.id} className={`pdca-eval-card type-${ev.evalType}`} style={{marginBottom: 8}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', cursor: 'pointer'}} onClick={() => toggle(ev.id)}>
                <div style={{display: 'flex', alignItems: 'center', gap: 10, flex: 1}}>
                  <ChevronRight size={16} style={{transform: isOpen ? 'rotate(90deg)' : 'none', transition: '0.2s', flexShrink: 0}} />
                  <Tag size="sm" type={ev.evalType === 'INTAKE' ? 'purple' : ev.evalType === 'CRISIS' ? 'red' : ev.evalType === 'INSPECTION' ? 'warm-gray' : ev.evalType === 'EVALUATION' ? 'green' : 'blue'}>
                    {evalTypeLabel(ev.evalType)}
                  </Tag>
                  <Tag size="sm" type={ev.status === 'COMPLETED' ? 'green' : ev.status === 'PLANNED' ? 'warm-gray' : 'gray'}>{statusLabel(ev.status)}</Tag>
                  <span style={{fontSize: 13, color: 'var(--cds-text-secondary)'}}>{date ? formatDate(date) : 'Geen datum'}</span>
                  {ev.summary && <span style={{fontSize: 13, color: 'var(--cds-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300}}>{ev.summary}</span>}
                </div>
                <Button size="sm" kind="danger--ghost" renderIcon={TrashCan} iconDescription="Verwijderen" hasIconOnly onClick={(e: any) => { e.stopPropagation(); handleDelete(ev.id); }} />
              </div>
              {isOpen && (
                <div style={{padding: '0 20px 20px 46px', borderTop: '1px solid var(--cds-border-subtle)'}}>
                  {ev.participants && <p style={{fontSize: 12, color: 'var(--cds-text-secondary)', marginTop: 12}}>Deelnemers: {ev.participants}</p>}
                  {ev.summary && <div className="pdca-info-block" style={{marginTop: 12}}>
                    <div className="pdca-info-label">Samenvatting</div>
                    <div className="pdca-info-value">{ev.summary}</div>
                  </div>}
                  {goalProgress.length > 0 && (
                    <div className="pdca-section-block">
                      <div className="pdca-section-title">Doelvoortgang</div>
                      {goalProgress.map((gp: any, j: number) => {
                        const goal = goals.find(g => g.id === gp.goalId);
                        return (
                          <div key={j} style={{marginBottom: 8, padding: '8px 12px', background: 'var(--cds-layer-02)'}}>
                            <div style={{fontWeight: 500, fontSize: 13}}>{goal?.title || gp.goalId}</div>
                            {gp.score != null && <Tag size="sm" type="blue">{gp.score}%</Tag>}
                            {gp.explanation && <p style={{fontSize: 12, color: 'var(--cds-text-secondary)', marginTop: 4}}>{gp.explanation}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {actionPoints.length > 0 && (
                    <div className="pdca-section-block">
                      <div className="pdca-section-title">Actiepunten</div>
                      {actionPoints.map((ap: string, j: number) => (
                        <div key={j} className="pdca-action-row">
                          <span>{ap}</span>
                          <Select id={`ap-goal-${ev.id}-${j}`} size="sm" labelText="" hideLabel style={{minWidth: 180}}>
                            <SelectItem value="" text="Maak actie onder doel..." />
                            {goals.filter(g => g.status !== 'CANCELLED').map(g => (
                              <SelectItem key={g.id} value={g.id} text={g.title} />
                            ))}
                          </Select>
                          <Button size="sm" kind="ghost" renderIcon={ArrowRight}
                            onClick={() => {
                              const sel = (document.getElementById(`ap-goal-${ev.id}-${j}`) as HTMLSelectElement)?.value;
                              if (sel) handleCreateAction(ev.id, ap, sel);
                              else alert('Selecteer eerst een doel');
                            }}>Maak actie</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <CreateEvalModal open={createModal} plan={plan} goals={goals} evalTypes={evalTypes}
          onClose={() => setCreateModal(false)} onSave={async () => { setCreateModal(false); await reload(); }} />
      </div>
    </Theme>
  );
}

function tryParse(json: string | null | undefined): any[] {
  if (!json) return [];
  try { const r = JSON.parse(json); return Array.isArray(r) ? r : []; } catch { return []; }
}

function CreateEvalModal({ open, plan, goals, evalTypes, onClose, onSave }: {
  open: boolean; plan: Plan; goals: Goal[]; evalTypes: string[];
  onClose: () => void; onSave: () => void;
}) {
  const [evalType, setEvalType] = useState('PROGRESS');
  const [date, setDate] = useState('');
  const [summary, setSummary] = useState('');
  const [participants, setParticipants] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [actionPoints, setActionPoints] = useState('');

  useEffect(() => {
    if (open) {
      setEvalType('PROGRESS'); setDate(new Date().toISOString().split('T')[0]);
      setSummary(''); setParticipants(''); setScores({}); setExplanations({}); setActionPoints('');
    }
  }, [open]);

  const handleSubmit = async () => {
    const goalProgress = goals.filter(g => g.status !== 'CANCELLED').map(g => ({
      goalId: g.id, score: scores[g.id] || 0, explanation: explanations[g.id] || '',
    })).filter(gp => gp.score > 0 || gp.explanation);
    const ap = actionPoints.split('\n').map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
    await api.evaluations.create(plan.id, {
      evalType, scheduledDate: date || undefined, actualDate: date || undefined,
      status: 'COMPLETED', summary: summary || undefined, participants: participants || undefined,
      goalProgress: JSON.stringify(goalProgress), actionPoints: JSON.stringify(ap),
    });
    goalProgress.forEach(gp => {
      if (gp.score > 0) api.goals.update(gp.goalId, { progressScore: gp.score, progressExplanation: gp.explanation });
    });
    onSave();
  };

  return (
    <Modal open={open} modalHeading="Nieuwe evaluatie" size="lg"
      primaryButtonText="Opslaan" secondaryButtonText="Annuleren"
      onRequestClose={onClose} onRequestSubmit={handleSubmit}>
      <div className="pdca-modal-form">
        <Select id="eval-type" labelText="Type" value={evalType} onChange={(e: any) => setEvalType(e.target.value)}>
          {evalTypes.map(t => <SelectItem key={t} value={t} text={evalTypeLabel(t)} />)}
        </Select>
        <TextInput id="eval-date" labelText="Datum" type="date" value={date} onChange={(e: any) => setDate(e.target.value)} />
        <TextInput id="eval-participants" labelText="Deelnemers" value={participants} onChange={(e: any) => setParticipants(e.target.value)} placeholder="Komma-gescheiden" />
        <TextArea id="eval-summary" labelText="Samenvatting" value={summary} onChange={(e: any) => setSummary(e.target.value)} />
        <h4 style={{marginTop: 16, marginBottom: 8}}>Voortgang per doel (0-100%)</h4>
        {goals.filter(g => g.status !== 'CANCELLED').map(g => (
          <div key={g.id} style={{marginBottom: 16, padding: 12, background: 'var(--cds-layer-02)'}}>
            <p style={{fontWeight: 500, marginBottom: 8}}>{g.title}</p>
            <Slider id={`score-${g.id}`} labelText="Score" min={0} max={100} step={5} value={scores[g.id] || g.progressScore || 0}
              onChange={({ value }: any) => setScores(prev => ({ ...prev, [g.id]: value }))} />
            <TextInput id={`expl-${g.id}`} labelText="Toelichting" size="sm" value={explanations[g.id] || ''}
              onChange={(e: any) => setExplanations(prev => ({ ...prev, [g.id]: e.target.value }))} />
          </div>
        ))}
        <TextArea id="eval-ap" labelText="Actiepunten (een per regel)" value={actionPoints}
          onChange={(e: any) => setActionPoints(e.target.value)} placeholder="- Afspraak inplannen&#10;- CV bijwerken" />
      </div>
    </Modal>
  );
}
