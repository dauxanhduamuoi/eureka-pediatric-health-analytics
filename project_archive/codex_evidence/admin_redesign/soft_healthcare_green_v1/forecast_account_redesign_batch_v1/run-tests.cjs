// Keep runtime-only synthetic credentials out of captured test output, including failure DOM dumps.
const {spawnSync}=require('child_process');
const fs=require('fs'),path=require('path');
const root=process.cwd(),[log,...args]=process.argv.slice(2);
if(!log||!args.length||args.some(a=>!/^[a-zA-Z0-9_./=-]+$/.test(a)))throw new Error('Expected local test paths/options.');
const result=spawnSync('cmd.exe',['/d','/s','/c',`npm.cmd run test -- ${args.join(' ')}`],{cwd:path.join(root,'Frontend'),encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
const safe=((result.stdout||'')+'\n'+(result.stderr||''))
 .replace(/\x1b\[[0-9;]*m/g,'')
 .replace(/runtimeSecret_[a-zA-Z0-9_-]+/g,'[REDACTED]')
 .replace(/(\bvalue=)["'][^"']*["']/g,'$1"[REDACTED]"');
fs.writeFileSync(path.join(__dirname,log),safe);
console.log(safe.split(/\r?\n/).filter(l=>/Test Files|Tests\s|passed|failed|FAIL|Error:|Duration/.test(l)).slice(-16).join('\n'));
process.exitCode=result.status??1;
