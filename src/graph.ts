export type Kind = 'start'|'action'|'condition'|'end'|'note';
export type Node = {id:string;type:Kind;x:number;y:number;title:string;content:string};
export type Edge = {id:string;source:string;sourcePort:string;target:string;targetPort:'in'};
export type Group = {id:string;title:string;nodeIds:string[]};
export type Graph = {schemaVersion:1;nodes:Node[];edges:Edge[];groups:Group[]};
export const ports = (type:Kind):string[] => type==='condition'?['yes','no']:type==='start'||type==='action'?['out']:[];
export const uid = (prefix:string) => `${prefix}-${crypto.randomUUID()}`;
export const sample:Graph={schemaVersion:1,nodes:[
{id:'start-1',type:'start',x:100,y:210,title:'開始',content:''},
{id:'action-1',type:'action',x:380,y:210,title:'要件確認',content:'目的と要件を整理する'},
{id:'action-2',type:'action',x:660,y:210,title:'実装',content:'要件に沿って実装する'},
{id:'condition-1',type:'condition',x:940,y:210,title:'テスト結果の確認',content:'テストは成功しましたか？'},
{id:'end-1',type:'end',x:1240,y:120,title:'完了',content:''},
{id:'action-3',type:'action',x:1240,y:330,title:'修正指示',content:'失敗した箇所を確認し、修正を指示する'},
{id:'end-2',type:'end',x:1520,y:330,title:'修正待ち',content:''},
{id:'note-1',type:'note',x:380,y:440,title:'使い方のヒント',content:'ポートをドラッグしてノードを接続。空白をドラッグすると範囲選択できます。'}],edges:[
{id:'e1',source:'start-1',sourcePort:'out',target:'action-1',targetPort:'in'}, {id:'e2',source:'action-1',sourcePort:'out',target:'action-2',targetPort:'in'}, {id:'e3',source:'action-2',sourcePort:'out',target:'condition-1',targetPort:'in'}, {id:'e4',source:'condition-1',sourcePort:'yes',target:'end-1',targetPort:'in'}, {id:'e5',source:'condition-1',sourcePort:'no',target:'action-3',targetPort:'in'}, {id:'e6',source:'action-3',sourcePort:'out',target:'end-2',targetPort:'in'}],groups:[]};
export function canConnect(g:Graph,source:string,sourcePort:string,target:string):string|null {
 const a=g.nodes.find(n=>n.id===source), b=g.nodes.find(n=>n.id===target);
 if(!a||!b) return '接続先のノードが見つかりません。';
 if(!ports(a.type).includes(sourcePort)||!['action','condition','end'].includes(b.type)) return 'このポートには接続できません。';
 if(source===target) return '同じノードには接続できません。';
 if(g.edges.some(e=>e.source===source&&e.sourcePort===sourcePort)) return 'この出力ポートは接続済みです。';
 const visited=new Set<string>(), stack=[target]; while(stack.length){const id=stack.pop()!;if(id===source)return '循環する接続は作成できません。';if(visited.has(id))continue;visited.add(id);g.edges.filter(e=>e.source===id).forEach(e=>stack.push(e.target));}
 return null;
}
export function validateImport(data:unknown):Graph {
 const fail=(s:string):never=>{throw new Error(s)};
 if(!data||typeof data!=='object')return fail('JSON がオブジェクトではありません。');
 const g=data as Graph;if(g.schemaVersion!==1||!Array.isArray(g.nodes)||!Array.isArray(g.edges)||!Array.isArray(g.groups))return fail('スキーマの形式またはバージョンが不正です。');
 const ids=new Set<string>(); const take=(id:unknown)=>{if(typeof id!=='string'||!id||ids.has(id))fail('ID が空または重複しています。');ids.add(id as string)};
 for(const n of g.nodes){if(!n||typeof n!=='object')fail('ノードが不正です。');take(n.id);if(!['start','action','condition','end','note'].includes(n.type)||!Number.isFinite(n.x)||!Number.isFinite(n.y)||typeof n.title!=='string'||typeof n.content!=='string')fail('ノードの内容が不正です。');}
 if(g.nodes.filter(n=>n.type==='start').length!==1)fail('開始ノードはちょうど1個必要です。');
 const clean:Graph={schemaVersion:1,nodes:g.nodes.map(({id,type,x,y,title,content})=>({id,type,x,y,title,content})),edges:[],groups:[]};
 for(const e of g.edges){if(!e||typeof e!=='object')fail('接続が不正です。');take(e.id);if(e.targetPort!=='in'||typeof e.source!=='string'||typeof e.sourcePort!=='string'||typeof e.target!=='string')fail('接続ポートが不正です。');const error=canConnect(clean,e.source,e.sourcePort,e.target);if(error)fail(error);clean.edges.push({id:e.id,source:e.source,sourcePort:e.sourcePort,target:e.target,targetPort:'in'});}
 const grouped=new Set<string>();for(const group of g.groups){if(!group||typeof group!=='object')fail('グループが不正です。');take(group.id);if(typeof group.title!=='string'||!Array.isArray(group.nodeIds)||group.nodeIds.length<2)fail('グループには2個以上のノードが必要です。');for(const id of group.nodeIds){if(!clean.nodes.some(n=>n.id===id)||grouped.has(id))fail('グループのノードが存在しないか重複しています。');grouped.add(id)}clean.groups.push({id:group.id,title:group.title,nodeIds:[...group.nodeIds]});}return clean;
}
export function reachable(g:Graph):Set<string>{const seen=new Set<string>(),stack=g.nodes.filter(n=>n.type==='start').map(n=>n.id);while(stack.length){const id=stack.pop()!;if(seen.has(id))continue;seen.add(id);g.edges.filter(e=>e.source===id).forEach(e=>stack.push(e.target));}return seen;}
export function issues(g:Graph):string[]{const seen=reachable(g), out:string[]=[];for(const n of g.nodes){if(n.type!=='note'&&!seen.has(n.id))out.push(`「${n.title}」は開始地点から到達できません`);for(const p of ports(n.type))if(!g.edges.some(e=>e.source===n.id&&e.sourcePort===p))out.push(`「${n.title}」の${p==='yes'?'Yes':p==='no'?'No':'出力'}が未接続です`);}if(!g.nodes.some(n=>n.type==='end'&&seen.has(n.id)))out.push('到達可能な終了ノードがありません');return out;}
const escapeMd=(s:string)=>s.replace(/([\\`*_{}\[\]<>#|])/g,'\\$1').replace(/\r?\n/g,' ');
export function markdown(g:Graph):string {const seen=reachable(g), problems=issues(g), byId=new Map(g.nodes.map(n=>[n.id,n]));const lines=['# ワークフロー','','## 検証結果','',...(problems.length?problems.map(x=>`- ${escapeMd(x)}`):['- 問題はありません。']),'','## フロー',''];const visited=new Set<string>();function visit(id:string){const n=byId.get(id);if(!n)return;if(visited.has(id)){lines.push(`- 合流先: **${escapeMd(n.title)}**（既出）`,'');return;}visited.add(id);lines.push(`### ${escapeMd(n.title)}（${n.type==='start'?'開始':n.type==='end'?'終了':n.type==='condition'?'条件':'アクション'}）`,'');if(n.content)lines.push(escapeMd(n.content),'');for(const p of ports(n.type)){const e=g.edges.find(e=>e.source===id&&e.sourcePort===p);lines.push(`- ${p==='yes'?'Yes':p==='no'?'No':'次'}: ${e?escapeMd(byId.get(e.target)?.title||''):'未接続'}`);}if(ports(n.type).length)lines.push('');for(const p of ports(n.type)){const e=g.edges.find(e=>e.source===id&&e.sourcePort===p);if(e)visit(e.target);}}const start=g.nodes.find(n=>n.type==='start');if(start)visit(start.id);const unconnected=g.nodes.filter(n=>n.type!=='note'&&!seen.has(n.id));if(unconnected.length){lines.push('## 未接続ノード','');unconnected.forEach(n=>lines.push(`### ${escapeMd(n.title)}（${n.type}）`,'',escapeMd(n.content),''));}const notes=g.nodes.filter(n=>n.type==='note');if(notes.length){lines.push('## メモ','');notes.forEach(n=>lines.push(`### ${escapeMd(n.title)}`,'',escapeMd(n.content),''));}return lines.join('\n').trim()+'\n';}
