import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Theme, Button, Tag, Modal, TextInput, TextArea, Select, SelectItem,
  Loading, InlineNotification, ProgressBar, Tile,
} from '@carbon/react';
import { Add, Edit, TrashCan, ChevronRight, Checkmark, Close } from '@carbon/react/icons';
import { onInit, resizeIframe } from '../shared/bridge';
import { api, Plan, Goal, Action, Instrument, StamtabelEntry, ProductRecord } from '../shared/api';
import { statusLabel, goalTypeLabel, priorityLabel, assigneeTypeLabel, formatDate } from '../shared/labels';

export function PlanGoals() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [phases, setPhases] = useState<string[]>([]);
  const [goalTypes, setGoalTypes] = useState<StamtabelEntry[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [phaseFilter, setPhaseFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [goalModal, setGoalModal] = useState(false);
  const [actionModal, setActionModal] = useState<string | null>(null);
  const [instrumentModal, setInstrumentModal] = useState<string | null>(null);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const cdkRef = useRef<string | null>(null);

  useEffect(() => {
    onInit(ctx => {
      cdkRef.current = ctx.caseDefinitionKey || null;
      loadData();
    });
  }, []);

  useEffect(() => { resizeIframe(); }, [loading, goals, expanded]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let plans = await api.plans.list();
      if (cdkRef.current) plans = plans.filter(p => p.caseDefinitionKey === cdkRef.current);
      plans = plans.filter(p => p.status === 'ACTIVE' || p.status === 'DRAFT');
      if (plans.length === 0) { setError('Geen plan gevonden'); setLoading(false); return; }
      const p = plans[0];
      setPlan(p);

      const [g, a, i, gt, pr] = await Promise.all([
        api.goals.listByPlan(p.id),
        api.actions.listByPlan(p.id),
        api.instruments.listByPlan(p.id),
        api.mock.goalTypes().catch(() => []),
        api.mock.products().catch(() => []),
      ]);
      setGoals(g); setActions(a); setInstruments(i);
      setGoalTypes(gt); setProducts(pr);

      if (p.caseDefinitionKey) {
        try {
          const cfg = await api.phaseConfigs.get(p.caseDefinitionKey);
          setPhases(JSON.parse(cfg.phases));
        } catch { setPhases([]); }
      }
      setLoading(false);
    } catch (e: any) { setError(e.message); setLoading(false); }
  }, []);

  const reload = useCallback(async () => {
    if (!plan) return;
    const [g, a, i] = await Promise.all([
      api.goals.listByPlan(plan.id),
      api.actions.listByPlan(plan.id),
      api.instruments.listByPlan(plan.id),
    ]);
    setGoals(g); setActions(a); setInstruments(i);
  }, [plan]);

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const goalsByPhase = (goals: Goal[]) => {
    const filtered = phaseFilter ? goals.filter(g => g.phase === phaseFilter) : goals;
    const grouped: Record<string, Goal[]> = {};
    const order = phases.length ? phases : [...new Set(filtered.map(g => g.phase))];
    order.forEach(p => { grouped[p] = []; });
    filtered.forEach(g => {
      if (!grouped[g.phase]) grouped[g.phase] = [];
      grouped[g.phase].push(g);
    });
    return { grouped, order: order.filter(p => grouped[p]?.length > 0) };
  };

  const actionsFor = (goalId: string) => actions.filter(a => a.goalId === goalId);
  const instrumentsFor = (goalId: string) => instruments.filter(i => i.goalId === goalId);

  const handleSaveGoal = async (data: any) => {
    if (editGoal) {
      await api.goals.update(editGoal.id, data);
    } else if (plan) {
      await api.goals.create(plan.id, { ...data, status: 'PLANNED' });
    }
    setGoalModal(false); setEditGoal(null); await reload();
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Doel verwijderen?')) return;
    await api.goals.delete(id);
    await reload();
  };

  const handleGoalStatus = async (id: string, status: string) => {
    await api.goals.update(id, { status });
    await reload();
  };

  const handleSaveAction = async (goalId: string, data: any) => {
    await api.actions.create(goalId, { ...data, status: 'PLANNED' });
    setActionModal(null); await reload();
  };

  const handleActionStatus = async (id: string, action: string) => {
    if (action === 'approve') await api.actions.approve(id);
    else if (action === 'reject') await api.actions.reject(id);
    else await api.actions.update(id, { status: action });
    await reload();
  };

  const handleSaveInstrument = async (goalId: string, data: any) => {
    await api.instruments.create(goalId, { ...data, status: 'PLANNED' });
    setInstrumentModal(null); await reload();
  };

  const handleInstrumentStatus = async (id: string, status: string) => {
    await api.instruments.update(id, { status });
    await reload();
  };

  if (loading) return <Theme theme="g10"><div className="pdca-container"><Loading withOverlay={false} /></div></Theme>;
  if (error) return <Theme theme="g10"><div className="pdca-container"><InlineNotification kind="error" title={error} /></div></Theme>;
  if (!plan) return null;

  const { grouped, order } = goalsByPhase(goals);

  return (
    <Theme theme="g10">
      <div className="pdca-container">
        <div className="pdca-phase-bar">
          <span className="pdca-section-title" style={{margin: 0}}>Fase:</span>
          <Button size="sm" kind={!phaseFilter ? 'primary' : 'ghost'} onClick={() => setPhaseFilter(null)}>Alle</Button>
          {phases.map(p => (
            <Button key={p} size="sm" kind={phaseFilter === p ? 'primary' : 'ghost'} onClick={() => setPhaseFilter(p)}>{p}</Button>
          ))}
          <div style={{flex: 1}} />
          <Button size="sm" renderIcon={Add} onClick={() => { setEditGoal(null); setGoalModal(true); }}>Doel toevoegen</Button>
        </div>

        {order.length === 0 && <div className="pdca-empty"><p>Geen doelen gevonden</p></div>}

        {order.map(phase => (
          <div key={phase} className="pdca-phase-group">
            <div className="pdca-phase-group-header">
              <h3>{phase}</h3>
              <Tag size="sm" type="gray">{grouped[phase].length} doelen</Tag>
            </div>
            {grouped[phase].map(goal => {
              const ga = actionsFor(goal.id);
              const gi = instrumentsFor(goal.id);
              const isOpen = expanded.has(goal.id);
              const pct = goal.progressScore || 0;
              return (
                <div key={goal.id} className={`pdca-goal-card status-${goal.status}`}>
                  <div className="pdca-goal-header" onClick={() => toggle(goal.id)}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0}}>
                      <ChevronRight size={16} style={{transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0}} />
                      <span style={{fontWeight: 500}}>{goal.title}</span>
                      {goal.goalType && <Tag size="sm" type="purple">{goalTypeLabel(goal.goalType)}</Tag>}
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0}}>
                      <div className="pdca-progress-mini">
                        <div className={`pdca-progress-mini-fill ${pct >= 75 ? 'high' : pct >= 40 ? 'mid' : ''}`} style={{width: `${pct}%`}} />
                      </div>
                      <span style={{fontSize: 11, color: 'var(--cds-text-secondary)'}}>{pct}%</span>
                      <Tag size="sm" type={goal.status === 'ACHIEVED' ? 'green' : goal.status === 'NOT_ACHIEVED' ? 'red' : goal.status === 'ACTIVE' ? 'blue' : 'gray'}>
                        {statusLabel(goal.status)}
                      </Tag>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="pdca-goal-body" style={{ padding: '1rem 1.25rem 1.25rem 3.25rem' }}>
                      {goal.description && <p style={{color: 'var(--cds-text-secondary)', fontSize: 13, marginBottom: 16}}>{goal.description}</p>}

                      <div style={{display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center'}}>
                        {goal.status === 'PLANNED' && <Button size="sm" kind="primary" onClick={() => handleGoalStatus(goal.id, 'ACTIVE')}>Activeren</Button>}
                        {goal.status === 'ACTIVE' && <>
                          <Button size="sm" kind="primary" onClick={() => handleGoalStatus(goal.id, 'ACHIEVED')}>Behaald</Button>
                          <Button size="sm" kind="danger" onClick={() => handleGoalStatus(goal.id, 'NOT_ACHIEVED')}>Niet behaald</Button>
                        </>}
                        <Button size="sm" kind="ghost" renderIcon={Edit} onClick={() => { setEditGoal(goal); setGoalModal(true); }}>Bewerken</Button>
                        <Button size="sm" kind="danger--ghost" renderIcon={TrashCan} onClick={() => handleDeleteGoal(goal.id)}>Verwijderen</Button>
                      </div>

                      <div style={{marginBottom: 20}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4}}>
                          <span style={{fontSize: 12, fontWeight: 500, color: 'var(--cds-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Voortgang</span>
                          <span style={{fontSize: 13, fontWeight: 600, color: 'var(--cds-text-primary)'}}>{pct}%</span>
                        </div>
                        <ProgressBar value={pct} max={100} size="small" hideLabel />
                      </div>

                      <div className="pdca-section-block">
                        <div className="pdca-section-title">
                          <span>Acties ({ga.length})</span>
                          <Button size="sm" kind="ghost" renderIcon={Add} onClick={() => setActionModal(goal.id)}>Actie toevoegen</Button>
                        </div>
                        {ga.map(action => (
                          <div key={action.id} className="pdca-action-row">
                            <div style={{display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0}}>
                              <span>{action.title}</span>
                              {action.assigneeName && <span style={{fontSize: 11, color: 'var(--cds-text-secondary)'}}>— {action.assigneeName}</span>}
                            </div>
                            <div style={{display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0}}>
                              {action.priority && <Tag size="sm" type={action.priority === 'HIGH' ? 'red' : 'gray'}>{priorityLabel(action.priority)}</Tag>}
                              <Tag size="sm" type={action.status === 'COMPLETED' ? 'green' : action.status === 'PENDING_REVIEW' ? 'warm-gray' : action.status === 'IN_PROGRESS' ? 'blue' : 'gray'}>
                                {statusLabel(action.status)}
                              </Tag>
                              {action.status === 'PLANNED' && <Button size="sm" kind="ghost" onClick={() => handleActionStatus(action.id, 'IN_PROGRESS')}>Start</Button>}
                              {action.status === 'IN_PROGRESS' && <Button size="sm" kind="ghost" onClick={() => handleActionStatus(action.id, 'PENDING_REVIEW')}>Ter beoordeling</Button>}
                              {action.status === 'PENDING_REVIEW' && <>
                                <Button size="sm" kind="primary" renderIcon={Checkmark} onClick={() => handleActionStatus(action.id, 'approve')}>Goedkeuren</Button>
                                <Button size="sm" kind="danger" renderIcon={Close} onClick={() => handleActionStatus(action.id, 'reject')}>Afkeuren</Button>
                              </>}
                            </div>
                          </div>
                        ))}
                        {ga.length === 0 && <p style={{fontSize: 12, color: 'var(--cds-text-helper)', fontStyle: 'italic'}}>Geen acties</p>}
                      </div>

                      <div className="pdca-section-block">
                        <div className="pdca-section-title">
                          <span>Instrumenten ({gi.length})</span>
                          <Button size="sm" kind="ghost" renderIcon={Add} onClick={() => setInstrumentModal(goal.id)}>Instrument toevoegen</Button>
                        </div>
                        {gi.map(inst => (
                          <div key={inst.id} className="pdca-action-row">
                            <div style={{display: 'flex', alignItems: 'center', gap: 8, flex: 1}}>
                              <span>{inst.title}</span>
                              {inst.providerName && <span style={{fontSize: 11, color: 'var(--cds-text-secondary)'}}>— {inst.providerName}</span>}
                            </div>
                            <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                              <Tag size="sm" type={inst.status === 'COMPLETED' ? 'green' : inst.status === 'ACTIVE' ? 'blue' : 'gray'}>{statusLabel(inst.status)}</Tag>
                              {inst.status === 'PLANNED' && <Button size="sm" kind="ghost" onClick={() => handleInstrumentStatus(inst.id, 'ACTIVE')}>Activeren</Button>}
                              {inst.status === 'ACTIVE' && <Button size="sm" kind="ghost" onClick={() => handleInstrumentStatus(inst.id, 'COMPLETED')}>Afronden</Button>}
                            </div>
                          </div>
                        ))}
                        {gi.length === 0 && <p style={{fontSize: 12, color: 'var(--cds-text-helper)', fontStyle: 'italic'}}>Geen instrumenten</p>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <GoalModal open={goalModal} goal={editGoal} phases={phases} goalTypes={goalTypes}
          onClose={() => { setGoalModal(false); setEditGoal(null); }} onSave={handleSaveGoal} />
        <ActionModal open={!!actionModal} goalId={actionModal}
          onClose={() => setActionModal(null)} onSave={handleSaveAction} />
        <InstrumentModal open={!!instrumentModal} goalId={instrumentModal} products={products}
          onClose={() => setInstrumentModal(null)} onSave={handleSaveInstrument} />
      </div>
    </Theme>
  );
}

function GoalModal({ open, goal, phases, goalTypes, onClose, onSave }: {
  open: boolean; goal: Goal | null; phases: string[]; goalTypes: StamtabelEntry[];
  onClose: () => void; onSave: (data: any) => void;
}) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [phase, setPhase] = useState('');
  const [goalType, setGoalType] = useState('');
  useEffect(() => {
    if (open) {
      setTitle(goal?.title || ''); setDesc(goal?.description || '');
      setPhase(goal?.phase || phases[0] || ''); setGoalType(goal?.goalType || '');
    }
  }, [open, goal]);
  return (
    <Modal open={open} modalHeading={goal ? 'Doel bewerken' : 'Doel toevoegen'}
      primaryButtonText="Opslaan" secondaryButtonText="Annuleren"
      onRequestClose={onClose} onRequestSubmit={() => onSave({ title, description: desc, phase, goalType: goalType || undefined })}>
      <div className="pdca-modal-form">
        <Select id="goal-phase" labelText="Fase" value={phase} onChange={(e: any) => setPhase(e.target.value)}>
          {phases.map(p => <SelectItem key={p} value={p} text={p} />)}
        </Select>
        <TextInput id="goal-title" labelText="Titel" value={title} onChange={(e: any) => setTitle(e.target.value)} />
        <TextArea id="goal-desc" labelText="Beschrijving" value={desc} onChange={(e: any) => setDesc(e.target.value)} />
        <Select id="goal-type" labelText="Doeltype" value={goalType} onChange={(e: any) => setGoalType(e.target.value)}>
          <SelectItem value="" text="-- Kies type --" />
          {goalTypes.map(t => <SelectItem key={t.code} value={t.code} text={t.label} />)}
        </Select>
      </div>
    </Modal>
  );
}

function ActionModal({ open, goalId, onClose, onSave }: {
  open: boolean; goalId: string | null; onClose: () => void; onSave: (goalId: string, data: any) => void;
}) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [assigneeType, setAssigneeType] = useState('PROFESSIONAL');
  const [assigneeName, setAssigneeName] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [dueDate, setDueDate] = useState('');
  useEffect(() => { if (open) { setTitle(''); setDesc(''); setAssigneeName(''); setDueDate(''); } }, [open]);
  return (
    <Modal open={open} modalHeading="Actie toevoegen" primaryButtonText="Opslaan" secondaryButtonText="Annuleren"
      onRequestClose={onClose} onRequestSubmit={() => goalId && onSave(goalId, { title, description: desc, assigneeType, assigneeName, priority, dueDate: dueDate || undefined })}>
      <div className="pdca-modal-form">
        <TextInput id="action-title" labelText="Titel" value={title} onChange={(e: any) => setTitle(e.target.value)} />
        <TextArea id="action-desc" labelText="Beschrijving" value={desc} onChange={(e: any) => setDesc(e.target.value)} />
        <Select id="action-assignee-type" labelText="Uitvoerder type" value={assigneeType} onChange={(e: any) => setAssigneeType(e.target.value)}>
          <SelectItem value="PROFESSIONAL" text="Behandelaar" />
          <SelectItem value="SUBJECT" text="Inwoner / Eigenaar" />
          <SelectItem value="PROVIDER" text="Aanbieder" />
        </Select>
        <TextInput id="action-assignee" labelText="Naam uitvoerder" value={assigneeName} onChange={(e: any) => setAssigneeName(e.target.value)} />
        <Select id="action-priority" labelText="Prioriteit" value={priority} onChange={(e: any) => setPriority(e.target.value)}>
          <SelectItem value="NORMAL" text="Normaal" />
          <SelectItem value="HIGH" text="Hoog" />
          <SelectItem value="LOW" text="Laag" />
        </Select>
        <TextInput id="action-due" labelText="Deadline" type="date" value={dueDate} onChange={(e: any) => setDueDate(e.target.value)} />
      </div>
    </Modal>
  );
}

function InstrumentModal({ open, goalId, products, onClose, onSave }: {
  open: boolean; goalId: string | null; products: ProductRecord[]; onClose: () => void;
  onSave: (goalId: string, data: any) => void;
}) {
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState('');
  const [productId, setProductId] = useState('');
  useEffect(() => { if (open) { setTitle(''); setProvider(''); setCategory(''); setProductId(''); } }, [open]);
  const onProductSelect = (id: string) => {
    setProductId(id);
    const p = products.find(pr => pr.id === id);
    if (p) { setTitle(p.naam); setProvider(p.aanbieder); setCategory(p.categorie); }
  };
  return (
    <Modal open={open} modalHeading="Instrument toevoegen" primaryButtonText="Opslaan" secondaryButtonText="Annuleren"
      onRequestClose={onClose} onRequestSubmit={() => goalId && onSave(goalId, { title, providerName: provider, category, externalProductId: productId || undefined })}>
      <div className="pdca-modal-form">
        <Select id="inst-product" labelText="Uit catalogus" value={productId} onChange={(e: any) => onProductSelect(e.target.value)}>
          <SelectItem value="" text="-- Selecteer product (optioneel) --" />
          {products.map(p => <SelectItem key={p.id} value={p.id} text={`${p.naam} (${p.aanbieder})`} />)}
        </Select>
        <TextInput id="inst-title" labelText="Titel" value={title} onChange={(e: any) => setTitle(e.target.value)} />
        <TextInput id="inst-provider" labelText="Aanbieder" value={provider} onChange={(e: any) => setProvider(e.target.value)} />
        <TextInput id="inst-category" labelText="Categorie" value={category} onChange={(e: any) => setCategory(e.target.value)} />
      </div>
    </Modal>
  );
}
