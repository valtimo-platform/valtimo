import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Tile,
  ClickableTile,
  Tag,
  Button,
  TextArea,
  TextInput,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  ProgressBar,
  InlineNotification,
  Loading,
  Modal,
  Select,
  SelectItem,
  Theme,
} from '@carbon/react';
import { TrashCan } from '@carbon/react/icons';
import { onInit, resizeIframe, GzacContext } from '../shared/bridge';
import {
  api,
  Plan,
  Goal,
  Action,
  Evaluation,
  InvolvedParty,
  PhaseConfig,
  PersonRecord,
  ObjectRecord,
  StamtabelEntry,
} from '../shared/api';
import { statusLabel, evalTypeLabel, roleLabel, subjectTypeLabel, formatDate } from '../shared/labels';
import '../shared/styles.css';

type SubjectData = PersonRecord | ObjectRecord | null;
type EditingField = 'mainGoal' | 'startSituation' | 'desiredSituation' | null;

const STATUS_TAG_TYPE: Record<string, string> = {
  DRAFT: 'gray',
  ACTIVE: 'blue',
  PAUSED: 'warm-gray',
  COMPLETED: 'green',
  CANCELLED: 'gray',
};

const EVAL_TAG_TYPE: Record<string, string> = {
  INTAKE: 'blue',
  PROGRESS: 'purple',
  EVALUATION: 'green',
  INSPECTION: 'warm-gray',
  CRISIS: 'red',
};

const KPI_COLORS = ['#24a148', '#0f62fe', '#ff832b', '#8a3ffc'];

const PHASE_LABELS: Record<string, string> = {
  PLAN: 'Plan',
  DO: 'Do',
  CHECK: 'Check',
  ACT: 'Act',
  INTAKE: 'Intake',
  VOORBEREIDING: 'Voorbereiding',
  UITVOERING: 'Uitvoering',
  AFRONDING: 'Afronding',
};

function phaseLabel(phase: string): string {
  return PHASE_LABELS[phase] || phase;
}

function formatAddress(adres: { straat: string; huisnummer?: string; postcode: string; woonplaats: string }): string {
  const street = adres.straat + (adres.huisnummer ? ' ' + adres.huisnummer : '');
  return `${street}, ${adres.postcode} ${adres.woonplaats}`;
}

export function PlanOverview() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [parties, setParties] = useState<InvolvedParty[]>([]);
  const [subjectData, setSubjectData] = useState<SubjectData>(null);
  const [phaseConfig, setPhaseConfig] = useState<string[]>([]);
  const [roleOptions, setRoleOptions] = useState<StamtabelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [partyForm, setPartyForm] = useState({ name: '', role: '', email: '', phone: '' });

  // Resize on every render
  useEffect(() => { resizeIframe(); });

  // Initialize via bridge and load data
  useEffect(() => {
    onInit(async (ctx: GzacContext) => {
      try {
        const allPlans = await api.plans.list();
        let filtered = allPlans;
        if (ctx.caseDefinitionKey) {
          filtered = filtered.filter(p => p.caseDefinitionKey === ctx.caseDefinitionKey);
        }
        filtered = filtered.filter(p => p.status === 'ACTIVE' || p.status === 'DRAFT');

        if (filtered.length === 0) {
          setError('Geen plannen gevonden voor deze zaak.');
          setLoading(false);
          return;
        }

        const selected = filtered[0];
        await loadPlanData(selected, ctx.caseDefinitionKey);
      } catch (err: any) {
        setError('Kan geen verbinding maken met de PDCA service: ' + err.message);
        setLoading(false);
      }
    });
  }, []);

  async function loadPlanData(selected: Plan, caseDefKey?: string) {
    try {
      const [goalsRes, actionsRes, evalsRes, partiesRes, rolesRes] = await Promise.all([
        api.goals.listByPlan(selected.id).catch(() => [] as Goal[]),
        api.actions.listByPlan(selected.id).catch(() => [] as Action[]),
        api.evaluations.listByPlan(selected.id).catch(() => [] as Evaluation[]),
        api.parties.listByPlan(selected.id).catch(() => [] as InvolvedParty[]),
        api.mock.roles().catch(() => [] as StamtabelEntry[]),
      ]);

      // Load subject data
      let subject: SubjectData = null;
      if (selected.subjectId && selected.subjectType === 'PERSON') {
        subject = await api.mock.person(selected.subjectId).catch(() => null);
      } else if (selected.subjectId && selected.subjectType === 'OBJECT') {
        subject = await api.mock.object(selected.subjectId).catch(() => null);
      }

      // Load phase config
      let phases: string[] = [];
      const defKey = caseDefKey || selected.caseDefinitionKey;
      if (defKey) {
        try {
          const cfg = await api.phaseConfigs.get(defKey);
          phases = JSON.parse(cfg.phases || '[]');
        } catch { /* no config */ }
      }

      setPlan(selected);
      setGoals(goalsRes);
      setActions(actionsRes);
      setEvaluations(evalsRes);
      setParties(partiesRes);
      setSubjectData(subject);
      setPhaseConfig(phases);
      setRoleOptions(rolesRes);
      setLoading(false);
    } catch (err: any) {
      setError('Fout bij laden van plangegevens: ' + err.message);
      setLoading(false);
    }
  }

  // KPI calculations
  const kpi = useMemo(() => {
    const goalsWithScore = goals.filter(g => typeof g.progressScore === 'number' && g.progressScore > 0);
    const progressPct = goalsWithScore.length > 0
      ? Math.round(goalsWithScore.reduce((sum, g) => sum + g.progressScore!, 0) / goalsWithScore.length)
      : 0;
    const activeGoals = goals.filter(g => g.status === 'ACTIVE').length;
    const openActions = actions.filter(a =>
      a.status === 'PLANNED' || a.status === 'IN_PROGRESS' || a.status === 'PENDING_REVIEW'
    ).length;
    const completedEvals = evaluations.filter(e => e.status === 'COMPLETED').length;
    return { progressPct, activeGoals, totalGoals: goals.length, openActions, completedEvals };
  }, [goals, actions, evaluations]);

  // Phase progress data
  const phaseProgress = useMemo(() => {
    if (goals.length === 0) return [];

    const grouped: Record<string, Goal[]> = {};
    goals.forEach(g => {
      const phase = g.phase || 'Overig';
      if (!grouped[phase]) grouped[phase] = [];
      grouped[phase].push(g);
    });

    // Order by config, then any remaining
    const ordered = phaseConfig.length > 0
      ? [...phaseConfig.filter(p => grouped[p]), ...Object.keys(grouped).filter(p => !phaseConfig.includes(p))]
      : Object.keys(grouped);

    return ordered.map(phase => {
      const phaseGoals = grouped[phase];
      const scored = phaseGoals.filter(g => typeof g.progressScore === 'number' && g.progressScore > 0);
      const pct = scored.length > 0
        ? Math.round(scored.reduce((s, g) => s + g.progressScore!, 0) / scored.length)
        : 0;
      return { phase, pct };
    });
  }, [goals, phaseConfig]);

  // Recent evaluations (last 3)
  const recentEvals = useMemo(() => {
    return [...evaluations]
      .sort((a, b) => {
        const da = a.actualDate || a.scheduledDate || '';
        const db = b.actualDate || b.scheduledDate || '';
        return db.localeCompare(da);
      })
      .slice(0, 3);
  }, [evaluations]);

  // -- Handlers --

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }, []);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!plan) return;
    try {
      const updated = await api.plans.update(plan.id, { status: newStatus });
      setPlan(updated);
      showSuccess('Status gewijzigd naar ' + statusLabel(newStatus));
    } catch (err: any) {
      setError('Status wijzigen mislukt: ' + err.message);
    }
  }, [plan, showSuccess]);

  const startEditing = useCallback((field: EditingField) => {
    if (!plan || !field) return;
    setEditingField(field);
    setEditValue((plan as any)[field] || '');
  }, [plan]);

  const saveField = useCallback(async () => {
    if (!plan || !editingField) return;
    try {
      const updated = await api.plans.update(plan.id, { [editingField]: editValue.trim() || null });
      setPlan(updated);
      setEditingField(null);
      showSuccess('Wijziging opgeslagen');
    } catch (err: any) {
      setError('Opslaan mislukt: ' + err.message);
    }
  }, [plan, editingField, editValue, showSuccess]);

  const handleAddParty = useCallback(async () => {
    if (!plan) return;
    if (!partyForm.name.trim() || !partyForm.role) {
      setError('Naam en rol zijn verplicht');
      return;
    }
    try {
      await api.parties.create(plan.id, {
        name: partyForm.name.trim(),
        role: partyForm.role,
        email: partyForm.email.trim() || undefined,
        phone: partyForm.phone.trim() || undefined,
        isPrimary: false,
      });
      const updated = await api.parties.listByPlan(plan.id);
      setParties(updated);
      setModalOpen(false);
      setPartyForm({ name: '', role: '', email: '', phone: '' });
      showSuccess('Betrokkene toegevoegd');
    } catch (err: any) {
      setError('Toevoegen mislukt: ' + err.message);
    }
  }, [plan, partyForm, showSuccess]);

  const handleDeleteParty = useCallback(async (partyId: string) => {
    try {
      await api.parties.delete(partyId);
      setParties(prev => prev.filter(p => p.id !== partyId));
      showSuccess('Betrokkene verwijderd');
    } catch (err: any) {
      setError('Verwijderen mislukt: ' + err.message);
    }
  }, [showSuccess]);

  function rolLabel(code: string): string {
    const match = roleOptions.find(r => r.code === code);
    return match ? match.label : roleLabel(code);
  }

  // -- Render --

  if (loading) {
    return <Loading description="Plan laden..." withOverlay={false} />;
  }

  if (error && !plan) {
    return (
      <InlineNotification
        kind="error"
        title="Fout"
        subtitle={error}
        lowContrast
        hideCloseButton
      />
    );
  }

  if (!plan) return null;

  const kpiItems = [
    { label: 'Voortgang', value: `${kpi.progressPct}%`, sub: 'Gemiddelde score van doelen', color: KPI_COLORS[0] },
    { label: 'Actieve doelen', value: String(kpi.activeGoals), sub: `van ${kpi.totalGoals} totaal`, color: KPI_COLORS[1] },
    { label: 'Open acties', value: String(kpi.openActions), sub: 'openstaand', color: KPI_COLORS[2] },
    { label: 'Evaluaties', value: String(evaluations.length), sub: `${kpi.completedEvals} afgerond`, color: KPI_COLORS[3] },
  ];

  const editableFields: { key: EditingField; label: string; emptyText: string }[] = [
    { key: 'mainGoal', label: 'Hoofddoel', emptyText: 'Geen hoofddoel ingesteld' },
    { key: 'startSituation', label: 'Startsituatie', emptyText: 'Niet ingevuld' },
    { key: 'desiredSituation', label: 'Gewenste situatie', emptyText: 'Niet ingevuld' },
  ];

  const partyHeaders = [
    { key: 'name', header: 'Naam' },
    { key: 'role', header: 'Rol' },
    { key: 'contact', header: 'Contact' },
    { key: 'actions', header: '' },
  ];

  const partyRows = parties.map(p => ({
    id: p.id,
    name: p.name + (p.isPrimary ? ' (Primair)' : ''),
    role: rolLabel(p.role),
    contact: [p.email, p.phone].filter(Boolean).join(' / '),
    actions: p.id,
  }));

  return (
    <Theme theme="g10">
      <div className="pdca-container">
        {/* Notifications */}
        {error && (
          <InlineNotification
            className="pdca-notification"
            kind="error"
            title="Fout"
            subtitle={error}
            lowContrast
            onCloseButtonClick={() => setError(null)}
          />
        )}
        {successMsg && (
          <InlineNotification
            className="pdca-notification"
            kind="success"
            title="Gelukt"
            subtitle={successMsg}
            lowContrast
            onCloseButtonClick={() => setSuccessMsg(null)}
          />
        )}

        {/* Plan header */}
        <div className="pdca-page-header">
          <h1>{plan.title}</h1>
          <div className="pdca-meta">
            <div className="pdca-status-control">
              <Tag type={STATUS_TAG_TYPE[plan.status] as any || 'gray'}>{statusLabel(plan.status)}</Tag>
              {(plan.status === 'DRAFT' || plan.status === 'PAUSED') && (
                <Button size="sm" kind="tertiary" onClick={() => handleStatusChange('ACTIVE')}>Activeren</Button>
              )}
              {plan.status === 'ACTIVE' && (
                <Button size="sm" kind="tertiary" onClick={() => handleStatusChange('PAUSED')}>Pauzeren</Button>
              )}
              {(plan.status === 'ACTIVE' || plan.status === 'PAUSED') && (
                <Button size="sm" kind="tertiary" onClick={() => handleStatusChange('COMPLETED')}>Afronden</Button>
              )}
              {plan.status === 'DRAFT' && (
                <Button size="sm" kind="danger--tertiary" onClick={() => handleStatusChange('CANCELLED')}>Annuleren</Button>
              )}
            </div>
            {plan.startDate && (
              <span>Start: {formatDate(plan.startDate)}</span>
            )}
            {plan.targetEndDate && (
              <span>Streefdatum: {formatDate(plan.targetEndDate)}</span>
            )}
          </div>
        </div>

        {/* Subject info card */}
        {plan.subjectId && (
          <div className="pdca-subject-card">
            {subjectData && plan.subjectType === 'PERSON' ? (
              <>
                <h4>{(subjectData as PersonRecord).naam}</h4>
                <div className="pdca-subject-detail">
                  <div className="detail-label">BSN</div>
                  <div className="detail-value">{(subjectData as PersonRecord).bsn}</div>
                </div>
                {(subjectData as PersonRecord).geboortedatum && (
                  <div className="pdca-subject-detail">
                    <div className="detail-label">Geboortedatum</div>
                    <div className="detail-value">{formatDate((subjectData as PersonRecord).geboortedatum)}</div>
                  </div>
                )}
                {(subjectData as PersonRecord).adres && (
                  <div className="pdca-subject-detail">
                    <div className="detail-label">Adres</div>
                    <div className="detail-value">{formatAddress((subjectData as PersonRecord).adres)}</div>
                  </div>
                )}
              </>
            ) : subjectData && plan.subjectType === 'OBJECT' ? (
              <>
                <h4>{(subjectData as ObjectRecord).naam}</h4>
                <div className="pdca-subject-detail">
                  <div className="detail-label">Object-ID</div>
                  <div className="detail-value">{(subjectData as ObjectRecord).id}</div>
                </div>
                {(subjectData as ObjectRecord).type && (
                  <div className="pdca-subject-detail">
                    <div className="detail-label">Type</div>
                    <div className="detail-value">{(subjectData as ObjectRecord).type}</div>
                  </div>
                )}
                {(subjectData as ObjectRecord).eigenaar && (
                  <div className="pdca-subject-detail">
                    <div className="detail-label">Eigenaar</div>
                    <div className="detail-value">{(subjectData as ObjectRecord).eigenaar}</div>
                  </div>
                )}
                {(subjectData as ObjectRecord).adres && (
                  <div className="pdca-subject-detail">
                    <div className="detail-label">Adres</div>
                    <div className="detail-value">{formatAddress((subjectData as ObjectRecord).adres)}</div>
                  </div>
                )}
              </>
            ) : (
              <>
                <h4>{subjectTypeLabel(plan.subjectType)}</h4>
                <div className="pdca-subject-detail">
                  <div className="detail-label">{plan.subjectType === 'PERSON' ? 'BSN' : 'ID'}</div>
                  <div className="detail-value">{plan.subjectId}</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* KPI tiles */}
        <div className="pdca-kpi-grid">
          {kpiItems.map((item, i) => (
            <ClickableTile key={i} className="pdca-kpi-card" style={{ borderTopColor: item.color }}>
              <div className="pdca-kpi-label">{item.label}</div>
              <div className="pdca-kpi-value">{item.value}</div>
              <div className="pdca-kpi-sub">{item.sub}</div>
            </ClickableTile>
          ))}
        </div>

        {/* Content grid */}
        <div className="pdca-content-grid">
          {/* Left column */}
          <div>
            {/* Plan details */}
            <Tile className="pdca-card">
              <div className="pdca-card-header">
                <h4>Plangegevens</h4>
              </div>
              <div className="pdca-card-body">
                {editableFields.map(({ key, label, emptyText }) => (
                  <div key={key} className="pdca-info-block">
                    <div className="pdca-info-label">
                      <span>{label}</span>
                      {editingField !== key && (
                        <Button size="sm" kind="ghost" onClick={() => startEditing(key)}>Bewerken</Button>
                      )}
                    </div>
                    {editingField === key ? (
                      <div>
                        <TextArea
                          id={`edit-${key}`}
                          labelText=""
                          hideLabel
                          value={editValue}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditValue(e.target.value)}
                          rows={3}
                        />
                        <div className="pdca-edit-actions">
                          <Button size="sm" kind="secondary" onClick={() => setEditingField(null)}>Annuleren</Button>
                          <Button size="sm" kind="primary" onClick={saveField}>Opslaan</Button>
                        </div>
                      </div>
                    ) : (
                      <p className={`pdca-info-value${(plan as any)[key!] ? '' : ' empty'}`}>
                        {(plan as any)[key!] || emptyText}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Tile>

            {/* Phase progress */}
            {phaseProgress.length > 0 && (
              <Tile className="pdca-card">
                <div className="pdca-card-header">
                  <h4>Voortgang per fase</h4>
                </div>
                <div className="pdca-card-body">
                  {phaseProgress.map(({ phase, pct }) => (
                    <div key={phase} className="pdca-phase-item">
                      <div className="pdca-phase-label">
                        <span className="pdca-phase-name">{phaseLabel(phase)}</span>
                        <span className="pdca-phase-pct">{pct}%</span>
                      </div>
                      <ProgressBar
                        label=""
                        hideLabel
                        value={pct}
                        max={100}
                        size="small"
                      />
                    </div>
                  ))}
                </div>
              </Tile>
            )}

            {/* Recent evaluations */}
            <Tile className="pdca-card">
              <div className="pdca-card-header">
                <h4>Recente evaluaties</h4>
              </div>
              <div className="pdca-card-body">
                {recentEvals.length === 0 ? (
                  <p className="pdca-empty">Nog geen evaluaties</p>
                ) : (
                  recentEvals.map(ev => {
                    const date = ev.actualDate || ev.scheduledDate;
                    return (
                      <div key={ev.id} className="pdca-eval-item">
                        <Tag type={EVAL_TAG_TYPE[ev.evalType] as any || 'gray'} size="sm">
                          {evalTypeLabel(ev.evalType)}
                        </Tag>
                        <div className="pdca-eval-info">
                          <div className="pdca-eval-date">
                            {date ? formatDate(date) : 'Geen datum'}
                          </div>
                          <div className={`pdca-eval-summary${ev.summary ? '' : ' empty'}`}>
                            {ev.summary || 'Geen samenvatting'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Tile>
          </div>

          {/* Right column: Betrokkenen */}
          <div>
            <Tile className="pdca-card">
              <div className="pdca-card-header">
                <h4>Betrokkenen</h4>
                <Button size="sm" kind="ghost" onClick={() => setModalOpen(true)}>Toevoegen</Button>
              </div>
              <div className="pdca-card-body">
                {parties.length === 0 ? (
                  <p className="pdca-empty">Geen betrokkenen</p>
                ) : (
                  <DataTable rows={partyRows} headers={partyHeaders}>
                    {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
                      <Table {...getTableProps()} size="sm">
                        <TableHead>
                          <TableRow>
                            {headers.map((header: any) => (
                              <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                {header.header}
                              </TableHeader>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.map((row: any) => (
                            <TableRow {...getRowProps({ row })} key={row.id}>
                              {row.cells.map((cell: any) => (
                                <TableCell key={cell.id}>
                                  {cell.info.header === 'actions' ? (
                                    <Button
                                      size="sm"
                                      kind="danger--ghost"
                                      hasIconOnly
                                      renderIcon={TrashCan}
                                      iconDescription="Verwijderen"
                                      onClick={() => handleDeleteParty(cell.value)}
                                    />
                                  ) : (
                                    cell.value
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </DataTable>
                )}
              </div>
            </Tile>
          </div>
        </div>

        {/* Add party modal */}
        <Modal
          open={modalOpen}
          modalHeading="Betrokkene toevoegen"
          primaryButtonText="Toevoegen"
          secondaryButtonText="Annuleren"
          onRequestClose={() => setModalOpen(false)}
          onRequestSubmit={handleAddParty}
          onSecondarySubmit={() => setModalOpen(false)}
          size="sm"
        >
          <div className="pdca-modal-form">
            <TextInput
              id="party-name"
              labelText="Naam *"
              placeholder="Volledige naam"
              value={partyForm.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPartyForm(prev => ({ ...prev, name: e.target.value }))}
            />
            <Select
              id="party-role"
              labelText="Rol *"
              value={partyForm.role}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPartyForm(prev => ({ ...prev, role: e.target.value }))}
            >
              <SelectItem value="" text="Selecteer een rol..." />
              {roleOptions.map(r => (
                <SelectItem key={r.code} value={r.code} text={r.label} />
              ))}
            </Select>
            <TextInput
              id="party-email"
              labelText="E-mail"
              placeholder="email@voorbeeld.nl"
              value={partyForm.email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPartyForm(prev => ({ ...prev, email: e.target.value }))}
            />
            <TextInput
              id="party-phone"
              labelText="Telefoon"
              placeholder="06-12345678"
              value={partyForm.phone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPartyForm(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>
        </Modal>
      </div>
    </Theme>
  );
}
