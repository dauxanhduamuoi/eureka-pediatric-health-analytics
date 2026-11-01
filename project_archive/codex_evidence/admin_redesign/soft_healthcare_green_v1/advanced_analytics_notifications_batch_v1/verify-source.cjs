const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=process.cwd(),ev=__dirname;
const ts=require(path.join(root,'Frontend/node_modules/typescript'));
const postcss=require(path.join(root,'Frontend/node_modules/postcss'));
const parse=(name,content)=>ts.createSourceFile(name,content,ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
const load=(file,before=false)=>parse(file,fs.readFileSync(path.join(before?path.join(ev,'source_before'):root,file),'utf8'));
const old=load('Frontend/src/app/components/AdvancedAnalytics.tsx',true);
const now=load('Frontend/src/app/components/advanced-analytics/useAdvancedAnalytics.ts');
const oldN=load('Frontend/src/app/components/NotificationsPanel.tsx',true),newN=load('Frontend/src/app/components/NotificationsPanel.tsx');
const printer=ts.createPrinter({removeComments:true});
const text=(n,s)=>printer.printNode(ts.EmitHint.Unspecified,n,s);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const main=(s,name)=>s.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
const vars=(s,name)=>main(s,name).body.statements.filter(ts.isVariableStatement).flatMap(n=>[...n.declarationList.declarations]);
const oldVars=vars(old,'AdvancedAnalytics'),newVars=vars(now,'useAdvancedAnalytics');
const state=(list,s)=>list.filter(n=>n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(s)==='useState').map(n=>text(n,s));
const derived=oldVars.filter(n=>ts.isIdentifier(n.name)&&n.name.text!=='loadAnalysis');
const deriveSame=derived.every(n=>{const match=newVars.find(v=>v.name.getText(now)===n.name.text);return match&&text(n,old)===text(match,now);});
const calls=(s,predicate)=>{const values=[];const walk=n=>{if(ts.isCallExpression(n)&&predicate(n.expression.getText(s)))values.push(text(n,s));ts.forEachChild(n,walk);};walk(s);return values;};
const helperSame=text(old.statements.find(n=>n.name?.text==='filterPeriodOptions'),old)===text(now.statements.find(n=>n.name?.text==='filterPeriodOptions'),now);
const oldNF=main(oldN,'NotificationsPanel'),newNF=main(newN,'NotificationsPanel');
const handlers=['reload','handleMarkAll','handleClear','handleRead','handleRemove'];
const handlerSame=handlers.every(name=>{
 const find=(s,m)=>m.body.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name)||vars(s,'NotificationsPanel').find(n=>n.name.getText(s)===name);
 return text(find(oldN,oldNF),oldN)===text(find(newN,newNF),newN);
});
const derivedNotif=['filtered','unread'].every(name=>text(vars(oldN,'NotificationsPanel').find(n=>n.name.getText(oldN)===name),oldN)===text(vars(newN,'NotificationsPanel').find(n=>n.name.getText(newN)===name),newN));
const baseline=JSON.parse(fs.readFileSync(path.join(ev,'baseline.json'),'utf8'));
const allowed=['Frontend/src/app/components/AdvancedAnalytics.tsx','Frontend/src/app/components/NotificationsPanel.tsx'];
const changed=[],missing=[];
for(const [file,hash] of Object.entries(baseline.files)){
 const target=path.join(root,file);if(!fs.existsSync(target)){missing.push(file);continue;}
 if(crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==hash)changed.push(file);
}
const css=[];
for(const file of ['advanced-analytics/analytics.css','notifications/notifications.css']){
 const scope=file.startsWith('advanced')?'.analytics-workspace':'.notification-workspace';let rules=0,scoped=true;
 const sheet=postcss.parse(fs.readFileSync(path.join(root,'Frontend/src/app/components',file),'utf8'));
 sheet.walkRules(rule=>{rules++;if(rule.selectors.some(s=>!s.includes(scope)))scoped=false;});css.push({file,rules,scoped});
}
const result={protectedFiles:Object.keys(baseline.files).length,changedExistingFiles:changed,missingBaselineFiles:missing,outsideAllowedChanges:changed.filter(f=>!allowed.includes(f)),
 stateInitializersUnchanged:same(state(oldVars,old),state(newVars,now)),nonRequestDerivedStatementsUnchanged:deriveSame,comparedDerivedDeclarations:derived.length,
 apiCallExpressionsUnchanged:same(calls(old,n=>n.startsWith('api.')),calls(now,n=>n.startsWith('api.'))),
 cacheCallsAndObjectsUnchanged:same(calls(old,n=>/^(load|save)ChartDataCache$/.test(n)),calls(now,n=>/^(load|save)ChartDataCache$/.test(n))),
 periodFilterHelperUnchanged:helperSame,notificationMutationsAndReloadUnchanged:handlerSame,notificationFilteringAndUnreadUnchanged:derivedNotif,
 notificationStoreCallsUnchanged:same(calls(oldN,n=>['loadNotifications','markRead','markAllRead','clearAll','removeNotification','refreshRiskNotifications'].includes(n)),calls(newN,n=>['loadNotifications','markRead','markAllRead','clearAll','removeNotification','refreshRiskNotifications'].includes(n))),
 css,documentedCorrections:['Latest-response version guards for analysis requests','Catch propagated notification sync exceptions; shared helper silent-provider-failure contract unchanged','Safe presentation of missing numeric fields'],
 realDatabaseInInventory:false};
fs.writeFileSync(path.join(ev,'source-preservation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
if(missing.length||result.outsideAllowedChanges.length||!result.stateInitializersUnchanged||!deriveSame||!result.apiCallExpressionsUnchanged||!result.cacheCallsAndObjectsUnchanged||!helperSame||!handlerSame||!derivedNotif||!result.notificationStoreCallsUnchanged||css.some(c=>!c.scoped))process.exitCode=1;
