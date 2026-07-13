<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Evaluatie vastleggen</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'IBM Plex Sans',sans-serif;color:#161616;background:#fff;font-size:14px;line-height:1.5;padding:24px}
  h2{font-size:20px;font-weight:600;margin-bottom:8px}
  h3{font-size:16px;font-weight:600;margin:20px 0 12px}
  .subtitle{color:#525252;font-size:13px;margin-bottom:20px}
  .form-group{margin-bottom:14px}
  label{display:block;font-size:12px;font-weight:500;color:#525252;margin-bottom:4px;letter-spacing:.32px}
  input[type=text],input[type=date],textarea,select{
    width:100%;padding:10px 14px;border:1px solid #8d8d8d;border-radius:0;background:#fff;
    font-family:inherit;font-size:14px;color:#161616;outline:none;
  }
  input:focus,textarea:focus,select:focus{border-color:#0f62fe;box-shadow:inset 0 0 0 1px #0f62fe}
  textarea{min-height:60px;resize:vertical}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .btn{padding:10px 24px;font-family:inherit;font-size:14px;font-weight:500;border:none;cursor:pointer}
  .btn-primary{background:#0f62fe;color:#fff}.btn-primary:hover{background:#0353e9}
  .actions{display:flex;gap:12px;margin-top:24px;justify-content:flex-end}
  .goal-progress{background:#f4f4f4;padding:14px;margin-bottom:10px;border-left:3px solid #0f62fe}
  .goal-progress .goal-name{font-weight:500;margin-bottom:8px}
  .score-group{display:flex;gap:4px;align-items:center;margin-bottom:6px}
  .score-group label{display:flex;align-items:center;gap:3px;font-size:13px;font-weight:400;color:#161616;cursor:pointer;padding:4px 10px;border:1px solid #e0e0e0;background:#fff;margin-bottom:0}
  .score-group input[type=radio]{display:none}
  .score-group input[type=radio]:checked+span{background:#0f62fe;color:#fff}
  .score-label{display:inline-block;padding:4px 10px;border:1px solid #e0e0e0;font-size:13px;cursor:pointer;transition:all .15s}
  .score-label:hover{border-color:#0f62fe}
  .score-label.selected{background:#0f62fe;color:#fff;border-color:#0f62fe}
  .score-legend{display:flex;gap:16px;font-size:11px;color:#a8a8a8;margin-bottom:6px}
  .goal-explanation input{margin-top:4px}
  .section-divider{border-top:1px solid #e0e0e0;margin:20px 0}
  .msg{padding:12px;margin-bottom:12px;background:#defbe6;border-left:3px solid #24a148;display:none}
  .loading{text-align:center;padding:40px;color:#525252}
</style>
</head>
<body>
<div class="msg" id="successMsg">Evaluatie succesvol opgeslagen!</div>
<h2>Evaluatie vastleggen</h2>
<p class="subtitle" id="planTitle">Laden...</p>

<div class="row">
  <div class="form-group">
    <label>Type evaluatie</label>
    <select id="evalType">
      <option value="INTAKE">Intake</option>
      <option value="PROGRESS" selected>Voortgangsgesprek</option>
      <option value="EVALUATION">Evaluatie</option>
      <option value="INSPECTION">Inspectie</option>
      <option value="CRISIS">Crisisconsult</option>
    </select>
  </div>
  <div class="form-group">
    <label>Datum</label>
    <input type="date" id="evalDate">
  </div>
</div>

<div class="form-group">
  <label>Deelnemers</label>
  <input type="text" id="participants" placeholder="Bijv. Sophie Jansen, Erika de Goede">
</div>

<div class="form-group">
  <label>Samenvatting</label>
  <textarea id="summary" placeholder="Beschrijf de uitkomsten van het gesprek"></textarea>
</div>

<div class="section-divider"></div>
<h3>Voortgang per doel</h3>
<div class="score-legend"><span>1 = Niet gehaald</span><span>3 = Deels gehaald</span><span>5 = Volledig gehaald</span></div>
<div id="goalProgressList"><div class="loading">Doelen laden...</div></div>

<div class="section-divider"></div>
<div class="form-group">
  <label>Actiepunten (een per regel)</label>
  <textarea id="actionPoints" placeholder="- Afspraak inplannen met arbeidscoach&#10;- CV bijwerken&#10;- Sollicitatietraining starten" style="min-height:100px"></textarea>
</div>

<div class="actions">
  <button class="btn btn-primary" onclick="submitEval()">Evaluatie opslaan</button>
</div>

<script>
var API='http://localhost:8090';
var planId=null;
var goals=[];

window.addEventListener('message',function(e){
  if(e.data&&e.data.type==='init'){init()}
});
window.parent.postMessage({type:'ready'},'*');

function init(){
  fetch(API+'/api/v1/plans/11111111-1111-1111-1111-111111111111').then(function(r){return r.json()}).then(function(plan){
    planId=plan.id;
    document.getElementById('planTitle').textContent=plan.title;
    return fetch(API+'/api/v1/plans/'+planId+'/goals');
  }).then(function(r){return r.json()}).then(function(data){
    goals=data.filter(function(g){return g.status!=='CANCELLED'});
    renderGoalProgress();
  }).catch(function(err){document.getElementById('goalProgressList').innerHTML='<div style="color:#da1e28">Fout bij laden: '+err.message+'</div>'});
}

function renderGoalProgress(){
  var el=document.getElementById('goalProgressList');
  if(goals.length===0){el.innerHTML='<div style="color:#a8a8a8;font-style:italic">Geen doelen om te evalueren</div>';return}
  var html='';
  goals.forEach(function(g,i){
    html+='<div class="goal-progress">';
    html+='<div class="goal-name">'+esc(g.title)+'</div>';
    html+='<div class="score-group">';
    for(var s=1;s<=5;s++){
      var scoreId='score_'+i+'_'+s;
      var checked=g.progressScore===s?' selected':'';
      html+='<span class="score-label'+checked+'" onclick="selectScore('+i+','+s+',this)">'+s+'</span>';
    }
    html+='</div>';
    html+='<div class="goal-explanation"><input type="text" id="explanation_'+i+'" placeholder="Toelichting" value="'+(g.progressExplanation?esc(g.progressExplanation):'')+'"></div>';
    html+='</div>';
  });
  el.innerHTML=html;
}

function selectScore(goalIdx,score,el){
  var siblings=el.parentNode.querySelectorAll('.score-label');
  siblings.forEach(function(s){s.classList.remove('selected')});
  el.classList.add('selected');
  goals[goalIdx]._selectedScore=score;
}

function submitEval(){
  var goalProgress=[];
  goals.forEach(function(g,i){
    var score=g._selectedScore||null;
    var explanation=document.getElementById('explanation_'+i).value.trim();
    if(score||explanation){
      goalProgress.push({goalId:g.id,score:score,explanation:explanation});
    }
  });

  var ap=document.getElementById('actionPoints').value.trim();
  var actionPointsList=ap?ap.split('\n').filter(function(l){return l.trim()}).map(function(l){return l.replace(/^[-*]\s*/,'')}):[];

  var body={
    evalType:document.getElementById('evalType').value,
    scheduledDate:document.getElementById('evalDate').value||null,
    actualDate:document.getElementById('evalDate').value||null,
    status:'COMPLETED',
    summary:document.getElementById('summary').value.trim()||null,
    participants:document.getElementById('participants').value.trim()||null,
    goalProgress:JSON.stringify(goalProgress),
    actionPoints:JSON.stringify(actionPointsList)
  };

  fetch(API+'/api/v1/plans/'+planId+'/evaluations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  .then(function(r){if(!r.ok)throw new Error('Server error');return r.json()})
  .then(function(ev){
    goalProgress.forEach(function(gp){
      if(gp.score){
        fetch(API+'/api/v1/goals/'+gp.goalId,{
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({progressScore:gp.score,progressExplanation:gp.explanation})
        });
      }
    });
    document.getElementById('successMsg').style.display='block';
    setTimeout(function(){
      window.parent.postMessage({type:'submitTask',data:{evaluationId:ev.id}},'*');
    },1000);
  }).catch(function(err){alert('Fout bij opslaan: '+err.message)});
}

function esc(s){if(!s)return'';return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

document.getElementById('evalDate').value=new Date().toISOString().split('T')[0];
setTimeout(init,100);
</script>
</body>
</html>
