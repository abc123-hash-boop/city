export function graphOf(t){const nodes=[];for(let i=0;i<t.xs.length;i++)for(let j=0;j<t.zs.length;j++){nodes.push({id:i*t.zs.length+j,i,j,x:t.xs[i],z:t.zs[j],edges:[]})}for(let n of nodes){for(let [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){let i=n.i+di,j=n.j+dj;if(i<0||j<0||i>=t.xs.length||j>=t.zs.length)continue;let q=nodes[i*t.zs.length+j],ok=true;for(let f=0;f<=1;f+=.08){let x=n.x+(q.x-n.x)*f,z=n.z+(q.z-n.z)*f;if(!t.dry(x,z,.20)&&!(di===0&&t.bridgeIndices.includes(i))){ok=false;break}}if(ok)n.edges.push(q.id)}}return nodes}
export function shortest(graph,a,b){if(!a||!b)return [];let prev=new Map([[a.id,-1]]),queue=[a.id];for(let i=0;i<queue.length;i++){const id=queue[i];if(id===b.id)break;for(let next of graph[id].edges)if(!prev.has(next)){prev.set(next,id);queue.push(next)}}if(!prev.has(b.id))return [];let out=[];for(let i=b.id;i!==-1;i=prev.get(i))out.unshift(i);return out}

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function polyline(points){
 const p=[],lengths=[];let length=0;
 for(const v of points){if(!v)continue;let d=p.length?distance(p.at(-1),v):0;if(p.length&&d<.012)continue;length+=d;p.push({x:v.x,z:v.z});lengths.push(length)}
 return {points:p,lengths,length};
}
export function sampleLine(line,f){
 const p=line.points,n=p.length;if(n===0)return null;if(n===1)return {...p[0],rot:0};
 const m=Math.max(0,Math.min(1,f))*line.length;let lo=1,hi=n-1;
 while(lo<hi){let mid=(lo+hi)>>1;if(line.lengths[mid]<m)lo=mid+1;else hi=mid}
 let a=p[lo-1],b=p[lo],t=(m-line.lengths[lo-1])/Math.max(.001,line.lengths[lo]-line.lengths[lo-1]);
 return{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,rot:Math.atan2(b.x-a.x,b.z-a.z)};
}
// Four pavement corners at each junction. Crosswalks join corners, sidewalks join
// junctions. Paths are certified against the river; there are no straight-line
// fallbacks that allow a simulated commuter to walk across water.
export class Footways{
 constructor(t){this.t=t;this.nodes=[];this.lots=new Map(t.lots.map(l=>[l.id,l]));this.anchors=new Map();this.paths=new Map();this.trees=new Map();this.roads=graphOf(t);
  let nr=t.zs.length,nx=t.xs.length;const idx=(i,j,u,v)=>(i*nr+j)*4+u*2+v;const offset=2.14;
  for(let i=0;i<nx;i++)for(let j=0;j<nr;j++)for(let u=0;u<2;u++)for(let v=0;v<2;v++)this.nodes.push({id:idx(i,j,u,v),x:t.xs[i]+(u?1:-1)*offset,z:t.zs[j]+(v?1:-1)*offset,edges:[]});
  const join=(a,b)=>{let p=this.nodes[a],q=this.nodes[b];if(!this.safe(p,q))return;p.edges.push(b);q.edges.push(a)};
  for(let i=0;i<nx;i++)for(let j=0;j<nr;j++)for(let u=0;u<2;u++)for(let v=0;v<2;v++){
   let a=idx(i,j,u,v);if(!u)join(a,idx(i,j,1,v));if(!v)join(a,idx(i,j,u,1));if(u&&i<nx-1)join(a,idx(i+1,j,0,v));if(v&&j<nr-1)join(a,idx(i,j+1,u,0));
  }
  let seen=new Set(),largest=[];for(let n of this.nodes){if(seen.has(n.id))continue;let c=[n.id];seen.add(n.id);for(let i=0;i<c.length;i++)for(const e of this.nodes[c[i]].edges)if(!seen.has(e)){seen.add(e);c.push(e)}if(c.length>largest.length)largest=c}
  this.valid=new Set(largest);const candidates=largest.map(i=>this.nodes[i]);
  for(let l of t.lots){let near=this.nodes[idx(l.i+l.u,l.j+l.v,1-l.u,1-l.v)];let corners=[near,...candidates.filter(n=>n.id!==near.id&&distance(n,l)<38).sort((a,b)=>distance(a,l)-distance(b,l))];
   outer:for(const n of corners){if(!this.valid.has(n.id))continue;for(let side of ['z','x']){const sign=Math.sign(n[side]-l[side])||1;let e={x:l.x,z:l.z};e[side]+=sign*(side==='z'?l.d:l.w)*.48;let via=side==='z'?{x:e.x,z:n.z}:{x:n.x,z:e.z};if(!this.safe(e,via)||!this.safe(via,n))continue;
    this.anchors.set(l.id,{...e,node:n.id,exit:[e,via,n]});break outer}}
  }
 }
 safe(a,b){let steps=Math.max(1,Math.ceil(distance(a,b)/1.6));for(let j=0;j<=steps;j++){let f=j/steps,x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f;if(!this.t.dry(x,z,.05)&&!this.t.onBridge(x,z))return false}return true}
 path(a,b){let key=a+':'+b;if(this.paths.has(key))return this.paths.get(key);let p=this.anchors.get(a),q=this.anchors.get(b);if(!p||!q)return null;if(a===b)return polyline([p]);
  let tree=this.trees.get(p.node);if(!tree){tree=new Int16Array(this.nodes.length).fill(-1);tree[p.node]=p.node;let work=[p.node];for(let i=0;i<work.length;i++)for(let k of this.nodes[work[i]].edges)if(tree[k]===-1){tree[k]=work[i];work.push(k)}this.trees.set(p.node,tree)}
  if(tree[q.node]===-1)return null;let sequence=[];for(let n=q.node;;n=tree[n]){sequence.push(this.nodes[n]);if(n===p.node)break}let line=polyline([...p.exit,...sequence.reverse(),...q.exit.slice().reverse()]);this.paths.set(key,line);return line;
 }
 transit(stops){if(stops.length!==2||stops[0]===stops[1])return null;let [a,b]=stops.map(id=>this.anchors.get(id));if(!a||!b)return null;
  const nearest=p=>this.roads.filter(n=>n.edges.length).reduce((u,v)=>distance(p,u)<distance(p,v)?u:v);let na=nearest(a),nb=nearest(b);if(na.id===nb.id)return null;let ids=shortest(this.roads,na,nb);if(ids.length<2)return null;
  const path=polyline(ids.map(id=>this.roads[id]));let board=[];for(let [i,n] of [na,nb].entries()){let v=this.nodes.filter(k=>this.valid.has(k.id)).reduce((p,q)=>distance(n,p)<distance(n,q)?p:q);let id='@stop'+i;this.anchors.set(id,{x:v.x,z:v.z,node:v.id,exit:[v]});board.push(id)}
  const ride=Math.max(3,Math.ceil(path.length/4.9)),dwell=3;return{stops:[...stops],board,path,ride,dwell,period:2*(ride+dwell)};
 }
}
export function busAt(line,minute){const ph=((minute%line.period)+line.period)%line.period;let f=0,dir=1;
 if(ph<line.dwell)f=0;else if(ph<line.dwell+line.ride)f=(ph-line.dwell)/line.ride;else if(ph<line.dwell*2+line.ride){f=1;dir=-1}else{f=1-(ph-line.dwell*2-line.ride)/line.ride;dir=-1}
 const p=sampleLine(line.path,f);return {...p,x:p.x+Math.cos(p.rot)*dir*.77,z:p.z-Math.sin(p.rot)*dir*.77,rot:p.rot+(dir<0?Math.PI:0)};
}
