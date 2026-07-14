import React, { useState, useEffect, useCallback } from 'react';
import {
  Theme, Button, Tag, Modal, TextInput, Checkbox, Loading, InlineNotification, Tile,
  DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell,
} from '@carbon/react';
import { Add, Edit, TrashCan } from '@carbon/react/icons';
import { onInit, resizeIframe } from '../shared/bridge';
import { api, PhaseConfig } from '../shared/api';
import { evalTypeLabel } from '../shared/labels';

const ALL_EVAL_TYPES = ['INTAKE', 'PROGRESS', 'EVALUATION', 'INSPECTION', 'CRISIS'];

export function PdcaAdmin() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configs, setConfigs] = useState<PhaseConfig[]>([]);
  const [modal, setModal] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formPhases, setFormPhases] = useState('');
  const [formEvalTypes, setFormEvalTypes] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { onInit(() => loadData()); }, []);
  useEffect(() => { resizeIframe(); }, [loading, configs, modal]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.phaseConfigs.list();
      setConfigs(data);
      setLoading(false);
    } catch (e: any) { setError(e.message); setLoading(false); }
  }, []);

  const openCreate = () => {
    setEditKey(null); setFormKey(''); setFormPhases('');
    setFormEvalTypes(new Set(['INTAKE', 'PROGRESS', 'EVALUATION']));
    setModal(true);
  };

  const openEdit = (cfg: PhaseConfig) => {
    setEditKey(cfg.caseDefinitionKey);
    setFormKey(cfg.caseDefinitionKey);
    setFormPhases(JSON.parse(cfg.phases).join(', '));
    setFormEvalTypes(new Set(JSON.parse(cfg.evaluationTypes)));
    setModal(true);
  };

  const handleSave = async () => {
    const phases = formPhases.split(',').map(s => s.trim()).filter(Boolean);
    const evalTypes = Array.from(formEvalTypes);
    if (!formKey || phases.length === 0) { alert('Vul dossiertype en fasen in'); return; }
    try {
      if (editKey) {
        await api.phaseConfigs.update(editKey, {
          caseDefinitionKey: formKey,
          phases: JSON.stringify(phases),
          evaluationTypes: JSON.stringify(evalTypes),
        });
      } else {
        await api.phaseConfigs.create({
          caseDefinitionKey: formKey,
          phases: JSON.stringify(phases),
          evaluationTypes: JSON.stringify(evalTypes),
        });
      }
      setModal(false); showToast('Configuratie opgeslagen'); await loadData();
    } catch (e: any) { alert('Fout: ' + e.message); }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Configuratie voor "${key}" verwijderen?`)) return;
    try { await api.phaseConfigs.delete(key); showToast('Configuratie verwijderd'); await loadData(); }
    catch (e: any) { alert('Fout: ' + e.message); }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const toggleEvalType = (type: string) => {
    setFormEvalTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  if (loading) return <Theme theme="g10"><div className="pdca-container"><Loading withOverlay={false} /></div></Theme>;
  if (error) return <Theme theme="g10"><div className="pdca-container"><InlineNotification kind="error" title={error} /></div></Theme>;

  const headers = [
    { key: 'caseDefinitionKey', header: 'Dossiertype' },
    { key: 'phases', header: 'Fasen' },
    { key: 'evaluationTypes', header: 'Evaluatietypen' },
    { key: 'actions', header: 'Acties' },
  ];

  const rows = configs.map(cfg => ({
    id: cfg.caseDefinitionKey,
    caseDefinitionKey: cfg.caseDefinitionKey,
    phases: cfg.phases,
    evaluationTypes: cfg.evaluationTypes,
    actions: cfg,
  }));

  return (
    <Theme theme="g10">
      <div className="pdca-container">
        {toast && <InlineNotification kind="success" title={toast} style={{marginBottom: 16}} onClose={() => setToast(null)} />}

        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24}}>
          <h1 style={{fontSize: '1.75rem', fontWeight: 600}}>PDCA Beheer — Faseconfiguratie</h1>
          <Button renderIcon={Add} onClick={openCreate}>Nieuwe configuratie</Button>
        </div>

        {configs.length === 0 ? (
          <div className="pdca-empty">
            <p>Geen configuraties gevonden. Maak een nieuwe aan.</p>
          </div>
        ) : (
          <Tile>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead>
                <tr>
                  <th style={{textAlign: 'left', padding: '12px 16px', borderBottom: '2px solid var(--cds-border-subtle)', fontSize: 12, fontWeight: 600, color: 'var(--cds-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5}}>Dossiertype</th>
                  <th style={{textAlign: 'left', padding: '12px 16px', borderBottom: '2px solid var(--cds-border-subtle)', fontSize: 12, fontWeight: 600, color: 'var(--cds-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5}}>Fasen</th>
                  <th style={{textAlign: 'left', padding: '12px 16px', borderBottom: '2px solid var(--cds-border-subtle)', fontSize: 12, fontWeight: 600, color: 'var(--cds-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5}}>Evaluatietypen</th>
                  <th style={{textAlign: 'right', padding: '12px 16px', borderBottom: '2px solid var(--cds-border-subtle)', fontSize: 12, fontWeight: 600, color: 'var(--cds-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5}}>Acties</th>
                </tr>
              </thead>
              <tbody>
                {configs.map(cfg => {
                  const ph = JSON.parse(cfg.phases) as string[];
                  const et = JSON.parse(cfg.evaluationTypes) as string[];
                  return (
                    <tr key={cfg.caseDefinitionKey} style={{borderBottom: '1px solid var(--cds-border-subtle)'}}>
                      <td style={{padding: '12px 16px', fontWeight: 500}}>{cfg.caseDefinitionKey}</td>
                      <td style={{padding: '12px 16px'}}>
                        <div style={{display: 'flex', gap: 4, flexWrap: 'wrap'}}>
                          {ph.map(p => <Tag key={p} size="sm" type="blue">{p}</Tag>)}
                        </div>
                      </td>
                      <td style={{padding: '12px 16px'}}>
                        <div style={{display: 'flex', gap: 4, flexWrap: 'wrap'}}>
                          {et.map(t => <Tag key={t} size="sm" type="purple">{evalTypeLabel(t)}</Tag>)}
                        </div>
                      </td>
                      <td style={{padding: '12px 16px', textAlign: 'right'}}>
                        <Button size="sm" kind="ghost" renderIcon={Edit} iconDescription="Bewerken" hasIconOnly onClick={() => openEdit(cfg)} />
                        <Button size="sm" kind="danger--ghost" renderIcon={TrashCan} iconDescription="Verwijderen" hasIconOnly onClick={() => handleDelete(cfg.caseDefinitionKey)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Tile>
        )}

        <Modal open={modal} modalHeading={editKey ? 'Configuratie bewerken' : 'Nieuwe configuratie'}
          primaryButtonText="Opslaan" secondaryButtonText="Annuleren"
          onRequestClose={() => setModal(false)} onRequestSubmit={handleSave}>
          <div className="pdca-modal-form">
            <TextInput id="cfg-key" labelText="Dossiertype (case definition key)"
              value={formKey} onChange={(e: any) => setFormKey(e.target.value)}
              disabled={!!editKey} placeholder="bijv. jeugdzorg-traject" />
            <TextInput id="cfg-phases" labelText="Fasen (komma-gescheiden)"
              value={formPhases} onChange={(e: any) => setFormPhases(e.target.value)}
              placeholder="Analyse, Uitvoering, Evaluatie" helperText="Volgorde bepaalt weergave" />
            {formPhases && (
              <div style={{display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16}}>
                {formPhases.split(',').map(s => s.trim()).filter(Boolean).map((p, i) => (
                  <Tag key={i} size="sm" type="blue">{p}</Tag>
                ))}
              </div>
            )}
            <p style={{fontSize: 12, fontWeight: 600, color: 'var(--cds-text-secondary)', marginBottom: 8}}>Evaluatietypen</p>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 16}}>
              {ALL_EVAL_TYPES.map(t => (
                <Checkbox key={t} id={`et-${t}`} labelText={evalTypeLabel(t)}
                  checked={formEvalTypes.has(t)} onChange={() => toggleEvalType(t)} />
              ))}
            </div>
          </div>
        </Modal>
      </div>
    </Theme>
  );
}
