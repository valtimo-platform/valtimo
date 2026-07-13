<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PDCA Beheer - Faseconfiguratie</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #161616; background: #f4f4f4; font-size: 14px; line-height: 1.5; padding: 0;
  }

  .container { max-width: 1200px; margin: 0 auto; padding: 24px; }

  .loading {
    display: flex; align-items: center; justify-content: center;
    height: 200px; color: #525252;
  }
  .loading .spinner {
    width: 32px; height: 32px; border: 3px solid #e0e0e0;
    border-top-color: #0f62fe; border-radius: 50%;
    animation: spin 0.8s linear infinite; margin-right: 12px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-banner {
    background: #fff1f1; border-left: 3px solid #da1e28;
    padding: 16px; margin-bottom: 24px; color: #161616;
  }

  .success-banner {
    background: #defbe6; border-left: 3px solid #24a148;
    padding: 16px; margin-bottom: 24px; color: #161616;
    display: none;
  }

  /* Header */
  .page-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 24px;
  }
  .page-header h1 {
    font-size: 28px; font-weight: 600; color: #161616;
  }

  /* Buttons */
  .btn {
    padding: 8px 20px; border: none; font-family: inherit;
    font-size: 13px; font-weight: 500; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    transition: background 0.15s;
  }
  .btn-primary { background: #0f62fe; color: #fff; }
  .btn-primary:hover { background: #0353e9; }
  .btn-secondary { background: #e0e0e0; color: #161616; }
  .btn-secondary:hover { background: #c6c6c6; }
  .btn-ghost { background: transparent; color: #0f62fe; padding: 6px 12px; }
  .btn-ghost:hover { background: #e8e8e8; }
  .btn-danger { background: #da1e28; color: #fff; }
  .btn-danger:hover { background: #ba1b23; }
  .btn-sm { padding: 4px 12px; font-size: 12px; }

  /* Table */
  .config-table {
    width: 100%; border-collapse: collapse; background: #fff; margin-bottom: 24px;
  }
  .config-table thead th {
    text-align: left; font-size: 12px; font-weight: 600;
    color: #525252; text-transform: uppercase; letter-spacing: 0.5px;
    padding: 12px 16px; border-bottom: 2px solid #e0e0e0;
    background: #fff;
  }
  .config-table tbody td {
    padding: 12px 16px; border-bottom: 1px solid #e0e0e0;
    font-size: 13px; vertical-align: middle;
  }
  .config-table tbody tr:hover { background: #f4f4f4; }
  .config-table tbody tr:last-child td { border-bottom: none; }

  .actions-cell {
    display: flex; gap: 6px; align-items: center;
  }

  /* Badges */
  .badge {
    display: inline-flex; align-items: center; padding: 2px 10px;
    border-radius: 24px; font-size: 11px; font-weight: 500;
    margin: 2px 4px 2px 0; white-space: nowrap;
  }
  .badge-phase {
    background: #d0e2ff; color: #0043ce;
  }
  .badge-eval {
    background: #e8daff; color: #6929c4;
  }

  .badge-container {
    display: flex; flex-wrap: wrap; gap: 2px;
  }

  /* Inline form */
  .inline-form {
    background: #fff; padding: 24px; margin-bottom: 24px;
    border-top: 3px solid #0f62fe;
    display: none;
  }
  .inline-form.open { display: block; }
  .inline-form h3 {
    font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #161616;
  }

  .form-group { margin-bottom: 16px; }
  .form-group label {
    display: block; font-size: 12px; font-weight: 500;
    color: #525252; margin-bottom: 4px;
  }
  .form-group .helper-text {
    font-size: 11px; color: #6f6f6f; margin-top: 2px;
  }
  .form-group input[type="text"] {
    width: 100%; padding: 8px 12px; border: 1px solid #8d8d8d;
    background: #fff; font-family: inherit; font-size: 14px; color: #161616;
  }
  .form-group input[type="text"]:focus {
    outline: 2px solid #0f62fe; outline-offset: -2px; border-color: #0f62fe;
  }

  /* Checkboxes */
  .checkbox-group {
    display: flex; flex-wrap: wrap; gap: 12px; margin-top: 4px;
  }
  .checkbox-item {
    display: flex; align-items: center; gap: 6px; cursor: pointer;
  }
  .checkbox-item input[type="checkbox"] {
    width: 16px; height: 16px; accent-color: #0f62fe; cursor: pointer;
  }
  .checkbox-item label {
    font-size: 13px; color: #161616; cursor: pointer; margin-bottom: 0;
  }

  /* Phase preview */
  .phase-preview {
    margin-top: 8px; min-height: 24px;
  }

  /* Form footer */
  .form-footer {
    display: flex; justify-content: flex-end; gap: 8px;
    padding-top: 16px; border-top: 1px solid #e0e0e0;
    margin-top: 20px;
  }

  /* Empty state */
  .empty-state {
    text-align: center; padding: 40px; color: #6f6f6f; background: #fff;
  }
  .empty-state p { font-size: 13px; }

  /* Confirm dialog */
  .confirm-overlay {
    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); z-index: 1000;
    justify-content: center; align-items: flex-start; padding-top: 120px;
  }
  .confirm-overlay.open { display: flex; }
  .confirm-dialog {
    background: #fff; width: 420px; max-width: 90vw;
  }
  .confirm-header {
    padding: 16px 20px; border-bottom: 1px solid #e0e0e0;
  }
  .confirm-header h3 { font-size: 16px; font-weight: 600; }
  .confirm-body { padding: 20px; font-size: 14px; color: #525252; }
  .confirm-footer {
    padding: 16px 20px; border-top: 1px solid #e0e0e0;
    display: flex; justify-content: flex-end; gap: 8px;
  }
</style>
</head>
<body>
<div class="container" id="app">
  <div class="loading" id="loading">
    <div class="spinner"></div>
    <span>Configuraties laden...</span>
  </div>
</div>

<!-- Delete confirmation dialog -->
<div class="confirm-overlay" id="confirmDialog">
  <div class="confirm-dialog">
    <div class="confirm-header">
      <h3>Configuratie verwijderen</h3>
    </div>
    <div class="confirm-body" id="confirmBody">
      Weet u zeker dat u deze configuratie wilt verwijderen?
    </div>
    <div class="confirm-footer">
      <button class="btn btn-secondary" onclick="window._closeConfirm()">Annuleren</button>
      <button class="btn btn-danger" id="confirmDeleteBtn" onclick="window._confirmDelete()">Verwijderen</button>
    </div>
  </div>
</div>

<script>
(function() {
  var API_BASE = 'http://localhost:8090';
  var configs = [];
  var editingKey = null;
  var deletingKey = null;
  var showForm = false;

  var EVAL_TYPES = ['INTAKE', 'PROGRESS', 'EVALUATION', 'INSPECTION', 'CRISIS'];

  // --- Iframe Bridge ---
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'init') {
      loadConfigs();
    }
  });
  window.parent.postMessage({ type: 'ready' }, '*');

  function resizeIframe() {
    requestAnimationFrame(function() {
      window.parent.postMessage({ type: 'resize', height: document.documentElement.scrollHeight }, '*');
    });
  }

  // --- Data Loading ---
  async function loadConfigs() {
    try {
      var resp = await fetch(API_BASE + '/api/v1/admin/phase-configs');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      configs = await resp.json();
      render();
    } catch (err) {
      showError('Kan configuraties niet laden: ' + err.message);
    }
  }

  function showError(message) {
    document.getElementById('loading').style.display = 'none';
    var app = document.getElementById('app');
    app.innerHTML = '<div class="error-banner">' + escapeHtml(message) + '</div>'
      + '<div style="text-align:center;margin-top:16px;">'
      + '<button class="btn btn-primary" onclick="location.reload()">Opnieuw proberen</button>'
      + '</div>';
    resizeIframe();
  }

  function showNotification(message, type) {
    var existing = document.getElementById('notification');
    if (existing) existing.remove();

    var div = document.createElement('div');
    div.id = 'notification';
    div.style.cssText = 'padding:16px;margin-bottom:24px;color:#161616;'
      + (type === 'error'
        ? 'background:#fff1f1;border-left:3px solid #da1e28;'
        : 'background:#defbe6;border-left:3px solid #24a148;');
    div.textContent = message;

    var app = document.getElementById('app');
    app.insertBefore(div, app.firstChild);

    setTimeout(function() {
      var el = document.getElementById('notification');
      if (el) el.remove();
    }, 4000);
  }

  // --- Rendering ---
  function render() {
    document.getElementById('loading').style.display = 'none';
    var app = document.getElementById('app');
    var html = '';

    // Header
    html += '<div class="page-header">';
    html += '<h1>PDCA Beheer - Faseconfiguratie</h1>';
    if (!showForm) {
      html += '<button class="btn btn-primary" onclick="window._showCreateForm()">+ Nieuwe configuratie</button>';
    }
    html += '</div>';

    // Inline form (create or edit)
    html += renderForm();

    // Table
    if (configs.length === 0 && !showForm) {
      html += '<div class="empty-state"><p>Geen faseconfiguraties gevonden. Maak een nieuwe configuratie aan.</p></div>';
    } else if (configs.length > 0) {
      html += '<table class="config-table">';
      html += '<thead><tr>';
      html += '<th>Zaaktype</th>';
      html += '<th>Fasen</th>';
      html += '<th>Evaluatietypen</th>';
      html += '<th>Acties</th>';
      html += '</tr></thead>';
      html += '<tbody>';

      configs.forEach(function(config) {
        // If this row is being edited, show inline edit form instead
        if (editingKey === config.caseDefinitionKey) {
          html += '<tr><td colspan="4" style="padding:0;">';
          html += renderInlineEditForm(config);
          html += '</td></tr>';
        } else {
          html += renderRow(config);
        }
      });

      html += '</tbody></table>';
    }

    app.innerHTML = html;

    // Update phase preview if form is visible
    if (showForm || editingKey) {
      updatePhasePreview();
    }

    resizeIframe();
  }

  function renderRow(config) {
    var phases = parseJsonArray(config.phases);
    var evalTypes = parseJsonArray(config.evaluationTypes);

    var html = '<tr>';

    // Zaaktype
    html += '<td><strong>' + escapeHtml(config.caseDefinitionKey) + '</strong></td>';

    // Fasen
    html += '<td><div class="badge-container">';
    if (phases.length > 0) {
      phases.forEach(function(phase) {
        html += '<span class="badge badge-phase">' + escapeHtml(phase) + '</span>';
      });
    } else {
      html += '<span style="color:#6f6f6f;font-size:12px;">Geen fasen</span>';
    }
    html += '</div></td>';

    // Evaluatietypen
    html += '<td><div class="badge-container">';
    if (evalTypes.length > 0) {
      evalTypes.forEach(function(et) {
        html += '<span class="badge badge-eval">' + escapeHtml(et) + '</span>';
      });
    } else {
      html += '<span style="color:#6f6f6f;font-size:12px;">Geen evaluatietypen</span>';
    }
    html += '</div></td>';

    // Acties
    html += '<td><div class="actions-cell">';
    html += '<button class="btn btn-ghost btn-sm" onclick="window._editConfig(\'' + escapeAttr(config.caseDefinitionKey) + '\')">Bewerken</button>';
    html += '<button class="btn btn-danger btn-sm" onclick="window._deleteConfig(\'' + escapeAttr(config.caseDefinitionKey) + '\')">Verwijderen</button>';
    html += '</div></td>';

    html += '</tr>';
    return html;
  }

  function renderForm() {
    if (!showForm) return '';

    var html = '<div class="inline-form open">';
    html += '<h3>Nieuwe configuratie</h3>';

    html += '<div class="form-group">';
    html += '<label>Zaaktype (Case Definition Key) *</label>';
    html += '<input type="text" id="formKey" placeholder="bijv. jeugdzorg-traject">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>Fasen</label>';
    html += '<input type="text" id="formPhases" placeholder="Analyse, Uitvoering, Evaluatie" oninput="window._updatePhasePreview()">';
    html += '<div class="helper-text">Voer fasenamen in, gescheiden door komma\'s</div>';
    html += '<div class="phase-preview" id="phasePreview"></div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>Evaluatietypen</label>';
    html += '<div class="checkbox-group">';
    EVAL_TYPES.forEach(function(et) {
      html += '<div class="checkbox-item">';
      html += '<input type="checkbox" id="eval_' + et + '" value="' + et + '">';
      html += '<label for="eval_' + et + '">' + evalTypeLabel(et) + '</label>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    html += '<div class="form-footer">';
    html += '<button class="btn btn-secondary" onclick="window._cancelForm()">Annuleren</button>';
    html += '<button class="btn btn-primary" onclick="window._saveNewConfig()">Opslaan</button>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderInlineEditForm(config) {
    var phases = parseJsonArray(config.phases);
    var evalTypes = parseJsonArray(config.evaluationTypes);

    var html = '<div class="inline-form open" style="margin:0;">';
    html += '<h3>Configuratie bewerken: ' + escapeHtml(config.caseDefinitionKey) + '</h3>';

    html += '<div class="form-group">';
    html += '<label>Zaaktype (Case Definition Key)</label>';
    html += '<input type="text" id="editFormKey" value="' + escapeAttr(config.caseDefinitionKey) + '" disabled style="background:#e0e0e0;color:#525252;">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>Fasen</label>';
    html += '<input type="text" id="editFormPhases" value="' + escapeAttr(phases.join(', ')) + '" oninput="window._updateEditPhasePreview()">';
    html += '<div class="helper-text">Voer fasenamen in, gescheiden door komma\'s</div>';
    html += '<div class="phase-preview" id="editPhasePreview"></div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>Evaluatietypen</label>';
    html += '<div class="checkbox-group">';
    EVAL_TYPES.forEach(function(et) {
      var checked = evalTypes.indexOf(et) !== -1 ? ' checked' : '';
      html += '<div class="checkbox-item">';
      html += '<input type="checkbox" id="editEval_' + et + '" value="' + et + '"' + checked + '>';
      html += '<label for="editEval_' + et + '">' + evalTypeLabel(et) + '</label>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    html += '<div class="form-footer">';
    html += '<button class="btn btn-secondary" onclick="window._cancelEdit()">Annuleren</button>';
    html += '<button class="btn btn-primary" onclick="window._saveEditConfig()">Opslaan</button>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  // --- Phase Preview ---
  function updatePhasePreview() {
    var input = document.getElementById('formPhases');
    var preview = document.getElementById('phasePreview');
    if (!input || !preview) return;
    var phases = parseCsv(input.value);
    renderPreviewBadges(preview, phases);
  }

  function updateEditPhasePreview() {
    var input = document.getElementById('editFormPhases');
    var preview = document.getElementById('editPhasePreview');
    if (!input || !preview) return;
    var phases = parseCsv(input.value);
    renderPreviewBadges(preview, phases);
  }

  function renderPreviewBadges(container, phases) {
    if (phases.length === 0) {
      container.innerHTML = '';
      return;
    }
    var html = '';
    phases.forEach(function(p) {
      html += '<span class="badge badge-phase">' + escapeHtml(p) + '</span>';
    });
    container.innerHTML = html;
    resizeIframe();
  }

  // --- Event Handlers ---
  window._showCreateForm = function() {
    showForm = true;
    editingKey = null;
    render();
  };

  window._cancelForm = function() {
    showForm = false;
    render();
  };

  window._updatePhasePreview = function() {
    updatePhasePreview();
  };

  window._updateEditPhasePreview = function() {
    updateEditPhasePreview();
  };

  window._saveNewConfig = async function() {
    var key = document.getElementById('formKey').value.trim();
    if (!key) { alert('Zaaktype is verplicht'); return; }

    var phases = parseCsv(document.getElementById('formPhases').value);
    var evalTypes = getCheckedEvalTypes('eval_');

    var body = {
      caseDefinitionKey: key,
      phases: JSON.stringify(phases),
      evaluationTypes: JSON.stringify(evalTypes)
    };

    try {
      var resp = await fetch(API_BASE + '/api/v1/admin/phase-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        var errText = await resp.text();
        throw new Error(errText || 'HTTP ' + resp.status);
      }
      showForm = false;
      await loadConfigs();
      showNotification('Configuratie aangemaakt voor "' + key + '"', 'success');
    } catch (e) {
      showNotification('Fout bij aanmaken: ' + e.message, 'error');
    }
  };

  window._editConfig = function(key) {
    editingKey = key;
    showForm = false;
    render();
    // After render, update the edit phase preview
    setTimeout(function() { updateEditPhasePreview(); }, 0);
  };

  window._cancelEdit = function() {
    editingKey = null;
    render();
  };

  window._saveEditConfig = async function() {
    var key = editingKey;
    if (!key) return;

    var phases = parseCsv(document.getElementById('editFormPhases').value);
    var evalTypes = getCheckedEvalTypes('editEval_');

    var body = {
      caseDefinitionKey: key,
      phases: JSON.stringify(phases),
      evaluationTypes: JSON.stringify(evalTypes)
    };

    try {
      var resp = await fetch(API_BASE + '/api/v1/admin/phase-configs/' + encodeURIComponent(key), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        var errText = await resp.text();
        throw new Error(errText || 'HTTP ' + resp.status);
      }
      editingKey = null;
      await loadConfigs();
      showNotification('Configuratie bijgewerkt voor "' + key + '"', 'success');
    } catch (e) {
      showNotification('Fout bij bijwerken: ' + e.message, 'error');
    }
  };

  window._deleteConfig = function(key) {
    deletingKey = key;
    document.getElementById('confirmBody').textContent =
      'Weet u zeker dat u de configuratie voor "' + key + '" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.';
    document.getElementById('confirmDialog').classList.add('open');
  };

  window._closeConfirm = function() {
    deletingKey = null;
    document.getElementById('confirmDialog').classList.remove('open');
  };

  window._confirmDelete = async function() {
    var key = deletingKey;
    if (!key) return;

    document.getElementById('confirmDialog').classList.remove('open');

    try {
      var resp = await fetch(API_BASE + '/api/v1/admin/phase-configs/' + encodeURIComponent(key), {
        method: 'DELETE'
      });
      if (!resp.ok && resp.status !== 204) {
        var errText = await resp.text();
        throw new Error(errText || 'HTTP ' + resp.status);
      }
      deletingKey = null;
      await loadConfigs();
      showNotification('Configuratie verwijderd voor "' + key + '"', 'success');
    } catch (e) {
      showNotification('Fout bij verwijderen: ' + e.message, 'error');
    }
  };

  // --- Helpers ---
  function escapeHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function parseJsonArray(str) {
    if (!str) return [];
    try {
      var parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function parseCsv(str) {
    if (!str || !str.trim()) return [];
    return str.split(',')
      .map(function(s) { return s.trim(); })
      .filter(function(s) { return s.length > 0; });
  }

  function getCheckedEvalTypes(prefix) {
    var checked = [];
    EVAL_TYPES.forEach(function(et) {
      var cb = document.getElementById(prefix + et);
      if (cb && cb.checked) checked.push(et);
    });
    return checked;
  }

  function evalTypeLabel(type) {
    var labels = {
      INTAKE: 'Intake',
      PROGRESS: 'Voortgang',
      EVALUATION: 'Evaluatie',
      INSPECTION: 'Inspectie',
      CRISIS: 'Crisis'
    };
    return labels[type] || type;
  }
})();
</script>
</body>
</html>
