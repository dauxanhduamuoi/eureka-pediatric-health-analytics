const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=process.cwd(),ev=__dirname;
const ts=require(path.join(root,'Frontend/node_modules/typescript'));
const postcss=require(path.join(root,'Frontend/node_modules/postcss'));
const parse=(file,before=false)=>ts.createSourceFile(file,fs.readFileSync(path.join(before?path.join(ev,'source_before'):root,file),'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
const printer=ts.createPrinter({removeComments:true});
const text=(node,s)=>printer.printNode(ts.EmitHint.Unspecified,node,s);
const main=(s,name)=>s.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
const body=(s,name)=>main(s,name).body.statements.filter(n=>!ts.isReturnStatement(n));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const beforeF=parse('Frontend/src/app/components/Forecast.tsx',true),afterF=parse('Frontend/src/app/components/forecast-workspace/useForecastWorkspace.ts');
const forecastCoreUnchanged=equal(body(beforeF,'Forecast').map(n=>text(n,beforeF)),body(afterF,'useForecastWorkspace').map(n=>text(n,afterF)));
const beforeA=parse('Frontend/src/app/components/Account.tsx',true),afterA=parse('Frontend/src/app/components/Account.tsx');
const named=(n,s,name)=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(s)===name||d.name.getText(s).includes('['+name+','));
const accountCore=(s)=>body(s,'Account').filter(n=>!named(n,s,'confirmLogout')&&!named(n,s,'logoutError')).map(n=>text(n,s));
const accountCoreUnchanged=equal(accountCore(beforeA),accountCore(afterA));
const accountHelpers=['initialsOf','maskToken','formatDateTime','summarizeUserAgent'].every(name=>text(main(beforeA,name),beforeA)===text(main(afterA,name),afterA));
const calls=(s,match)=>{const out=[];const walk=n=>{if(ts.isCallExpression(n)&&match(n.expression.getText(s)))out.push(text(n,s));ts.forEachChild(n,walk);};walk(s);return out;};
const baseline=JSON.parse(fs.readFileSync(path.join(ev,'baseline.json'),'utf8'));const allowed=['Frontend/src/app/components/Forecast.tsx','Frontend/src/app/components/Account.tsx'];
const changed=[],missing=[];
for(const [file,expected] of Object.entries(baseline.files)){
 const target=path.join(root,file);if(!fs.existsSync(target)){missing.push(file);continue;}
 if(crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==expected)changed.push(file);
}
const css=[];
for(const file of ['forecast-workspace/forecast.css','account-workspace/account.css']){
 const scope=file.startsWith('forecast')?'.forecast-workspace':'.account-workspace';let rules=0,scoped=true;
 postcss.parse(fs.readFileSync(path.join(root,'Frontend/src/app/components',file),'utf8')).walkRules(n=>{rules++;if(n.selectors.some(v=>!v.includes(scope)))scoped=false;});css.push({file,rules,scoped});
}
const result={protectedFiles:Object.keys(baseline.files).length,changedExistingFiles:changed,missingBaselineFiles:missing,outsideAllowedChanges:changed.filter(f=>!allowed.includes(f)),
 forecastControllerStatementsUnchanged:forecastCoreUnchanged,forecastControllerStatementCount:body(beforeF,'Forecast').length,
 forecastApiCallsUnchanged:equal(calls(beforeF,n=>n.startsWith('api.')),calls(afterF,n=>n.startsWith('api.'))),
 forecastCacheAndNotificationCallsUnchanged:equal(calls(beforeF,n=>/^(loadChartDataCache|saveChartDataCache|addNotification|downloadReport)$/.test(n)),calls(afterF,n=>/^(loadChartDataCache|saveChartDataCache|addNotification|downloadReport)$/.test(n))),
 accountCoreExceptLogoutFeedbackUnchanged:accountCoreUnchanged,accountHelpersUnchanged:accountHelpers,
 accountApiCallsUnchanged:equal(calls(beforeA,n=>n.startsWith('api.')),calls(afterA,n=>n.startsWith('api.'))),
 accountClipboardCallUnchanged:equal(calls(beforeA,n=>n==='navigator.clipboard.writeText'),calls(afterA,n=>n==='navigator.clipboard.writeText')),
 documentedExceptions:['Forecast empty banner requires a successful read; error-first empty presentation is not confirmed empty data','Account catches synchronous logout exceptions for local feedback; auth implementation unchanged'],
 css,realDatabaseIncludedInInventory:false};
fs.writeFileSync(path.join(ev,'source-preservation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
if(missing.length||result.outsideAllowedChanges.length||!forecastCoreUnchanged||!accountCoreUnchanged||!accountHelpers||!result.forecastApiCallsUnchanged||!result.forecastCacheAndNotificationCallsUnchanged||!result.accountApiCallsUnchanged||!result.accountClipboardCallUnchanged||css.some(v=>!v.scoped))process.exitCode=1;
