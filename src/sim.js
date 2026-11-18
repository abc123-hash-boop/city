import {setupLife,context,advanceHouseholds,minuteOf,phase,PHASE} from './life.js';
import {clamp,rand,noise,fbm} from './math.js';
export {clamp,rand,noise,fbm};
export const ITEMS=[
 {id:'house',name:'独栋住宅',en:'COTTAGE',cat:'住宅',cost:3200,desc:'带独立庭院的坡顶住宅，可容纳 5 位居民。',cap:5},
 {id:'villa',name:'花园洋房',en:'RESIDENCE',cat:'住宅',cost:8600,desc:'设有阳台和共享花园的多层住宅，可容纳 18 位居民。',cap:18},
 {id:'bank',name:'商业银行',en:'BANK',cat:'商业',cost:24000,desc:'管理居民的储蓄利率与股票市场的每日涨跌。'},
 {id:'shop',name:'社区超市',en:'MARKET',cat:'商业',cost:6400,desc:'供应生活必需品，购物篮定价会影响生活成本。'},
 {id:'power',name:'发电厂',en:'ENERGY',cat:'市政',cost:32500,desc:'向城区供电，调整每度电价以平衡收入和负担。'},
 {id:'water',name:'自来水厂',en:'WATERWORKS',cat:'市政',cost:21800,desc:'净化河水并输送至住户，按立方米收取水费。'},
 {id:'gov',name:'政府大楼',en:'CITY HALL',cat:'市政',cost:42000,desc:'城市公共服务中心，负责制定全市所得税率。'},
 {id:'office',name:'创意公司',en:'OFFICE',cat:'商业',cost:18500,desc:'提供工作岗位，月薪会影响消费能力和税收。'},
 {id:'bus',name:'公交车站',en:'BUS STOP',cat:'交通',cost:1800,desc:'连接城市站点，自定义公交线路的起终点和票价。'}
];
export const DEF=Object.fromEntries(ITEMS.map(it=>[it.id,it]));
export const POLICY={interest:{name:'储蓄年利率',unit:'%',min:0,max:12,step:.1,base:2.5},stock:{name:'股票日涨跌',unit:'%',min:-8,max:8,step:.1,base:.4},basket:{name:'基础购物篮',unit:'元 / 份',min:6,max:80,step:1,base:24},electric:{name:'居民电价',unit:'元 / 度',min:.1,max:3,step:.05,base:.65},water:{name:'生活水费',unit:'元 / m³',min:.5,max:12,step:.1,base:2.6},tax:{name:'所得税率',unit:'%',min:0,max:35,step:.5,base:8},wage:{name:'平均月薪',unit:'元 / 月',min:1800,max:18000,step:100,base:5600},fare:{name:'单程票价',unit:'元 / 次',min:0,max:12,step:.5,base:2}};
export const PF={bank:['interest','stock'],shop:['basket'],power:['electric'],water:['water'],gov:['tax'],office:['wage'],bus:['fare']};
const surn='沈林江陈许温周陆季宋叶程顾杜何余苏吴徐唐';const given=['知夏','予安','明远','书宁','嘉禾','南星','沐阳','雨桐','亦然','景行','以宁','小满','晨曦','栀子','星野','思齐','语竹','晓川','清和','向晚','念青','若溪','颂宜','谨言','安澜','卓然','清扬','知衡','望舒','泽宇','新雨','一帆'];
const jobs=['建筑师','花艺师','工程师','面包师','教师','程序员','设计师','公交司机','药剂师','园艺师','店员','会计'];
export function resident(s,rr,home){let age=Math.floor(8+rr()*74);return {id:++s.lastResident,name:surn[Math.floor(rr()*surn.length)]+given[Math.floor(rr()*given.length)],age,job:age<18?'学生':age>65?'退休居民':jobs[Math.floor(rr()*jobs.length)],home:home?.id||null,cash:Math.round(320+Math.pow(rr(),2.55)*74000),shares:Math.round(2+rr()*28),look:Math.floor(rr()*65535),ai:false,decision:null}}
export function district(x,z,river){return z>river(x)?(x>0?'南岸花园':'青树街区'):(x>10?'湾心商区':'北岸街区')}
export function makeTerrain(seed){let s=(seed%4294967296)|0;let r=rand(s+981),phase=r()*Math.PI*2;
 const river=x=>10+x*.10+12*Math.sin(x/36+phase)+3.2*Math.sin(x/21+phase*.5)+6*(fbm(x/41,13,s)-.5);
 const width=x=>7.8+2.7*noise(x/42,41,s);
 const xs=[],zs=[];for(let i=-6;i<=6;i++){xs.push(i*23+(noise(i*.78,10,s)-.5)*6);zs.push(i*23+(noise(5,i*.84,s+23)-.5)*5.5)}
 const bridgeIndices=[0,3,7,10,12];const bridges=bridgeIndices.map(i=>xs[i]);
 const dry=(x,z,pad=0)=>Math.abs(z-river(x))>width(x)+pad;
 const onBridge=(x,z)=>bridges.some(b=>Math.abs(x-b)<2.55)&&Math.abs(z-river(x))<width(x)+2;
 const lots=[];for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
  const x0=xs[i]+2.8,x1=xs[i+1]-2.8,z0=zs[j]+2.8,z1=zs[j+1]-2.8;
  for(let u=0;u<2;u++)for(let v=0;v<2;v++){let w=(x1-x0)/2,d=(z1-z0)/2,x=x0+(u+.5)*w,z=z0+(v+.5)*d;
   if(!dry(x,z,d/2+3.15))continue;
   lots.push({id:`${i}-${j}-${u}${v}`,x,z,w,d,i,j,u,v,dir:v===0?Math.PI:0,zone:fbm(x/58,z/58,s),district:district(x,z,river)});
  }
 }
 return {seed:s,river,width,xs,zs,dry,onBridge,bridges,bridgeIndices,lots,half:166};
}
export function makeCity(t){const seed=t.fullSeed||t.seed,rr=rand(t.seed+19);const s={v:3,seed,name:'汀湾市',clock:(9*60+42)/1440*1200,balance:286400,price:100,logs:[],buildings:[],residents:[],lastResident:0,policy:Object.fromEntries(Object.entries(POLICY).map(([k,p])=>[k,p.base])),route:[],plants:[],marks:[],days:[],saved:0,earned:0};
 for(const l of t.lots){let dist=Math.hypot((l.x-8)*.92,(l.z-(t.river(l.x)-33))*1.2);let r=rr();let near=dist<40;let dens=.58+l.zone*.29+(near?.08:0);if(rr()>dens)continue;
 let type=near?(r<.48?'office':r<.82?'villa':r<.9?'shop':'house'):(r<.58?'house':r<.83?'villa':r<.9?'shop':r<.96?'office':'house');
 let floors=type==='office'?(near?4+Math.floor(rr()*7):2+Math.floor(rr()*3)):type==='villa'?2+Math.floor(rr()*(near?4:2)):1;
 s.buildings.push({id:l.id,type,variant:Math.floor(rr()*65535),floors,rot:l.dir,condition:90+Math.floor(rr()*10)});
 }
 const reserved=new Set();function fixed(type,x,z,floors=1,style=0){let l=t.lots.filter(l=>!reserved.has(l.id)).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];let b=s.buildings.find(b=>b.id===l.id);if(!b){b={id:l.id};s.buildings.push(b)}Object.assign(b,{type,variant:style||Math.floor(rr()*65535),floors,rot:['gov','bank','shop'].includes(type)?0:l.dir,condition:97,landmark:true});reserved.add(l.id);return l.id}
 fixed('gov',-13,t.river(-13)-25);fixed('bank',22,t.river(22)-23);fixed('office',9,t.river(9)-39,11,241);fixed('water',66,t.river(66)+22);fixed('power',-72,t.river(-72)-19);fixed('shop',-23,t.river(-23)+29);
 let st1=fixed('bus',-28,t.river(-28)-27),st2=fixed('bus',40,t.river(40)+23);fixed('bus',-70,48);fixed('bus',54,-60);s.route=[st1,st2];
 // Reserve a few buildable plots even in the central, high-density blocks.
 let empties=0;s.buildings=s.buildings.filter(b=>{let l=t.lots.find(l=>l.id===b.id);if(!b.landmark&&empties<7&&Math.abs(l.x)<53&&Math.abs(l.z)<42&&rr()<.32){empties++;return false}return true});
 const civic=s.buildings.find(b=>b.type==='gov'&&b.landmark),cl=t.lots.find(l=>l.id===civic.id),pl=t.lots.filter(l=>l.id!==cl.id&&!reserved.has(l.id)).sort((a,b)=>Math.hypot(a.x-cl.x,a.z-cl.z)-Math.hypot(b.x-cl.x,b.z-cl.z))[0];if(pl){s.parkLot=pl.id;s.buildings=s.buildings.filter(b=>b.id!==pl.id)}
 const homes=s.buildings.filter(b=>DEF[b.type].cap);for(const h of homes){let n=Math.floor((.18+rr()*.38)*DEF[h.type].cap)+1;for(let i=0;i<n;i++)s.residents.push(resident(s,rr,h))}
 s.days=[{value:s.balance,label:'建城'}];s.logs=[{title:'城市基础设施已就绪',text:'道路、水电与滨河公交线已投入运营。',time:clockText(s.clock)},{title:'汀湾市正式开埠',text:'首批居民已经入住，新的城市故事从这里开始。',time:clockText(s.clock)}];setupLife(s,t,{fresh:true});return s;
}
export function clockText(clock){const m=Math.floor((clock%1200)/1200*1440);return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}
export const dayNum=clock=>Math.floor(clock/1200)+1;
export function log(s,title,text){s.logs.unshift({title,text,time:clockText(s.clock)});s.logs=s.logs.slice(0,35)}
export function stats(s){const p=s.policy,h=s.residents.length,workers=s.residents.reduce((n,r)=>n+(r.age>=18&&r.age<=65?1:0),0);let counts={};s.buildings.forEach(b=>counts[b.type]=(counts[b.type]||0)+1);
 const housing=(counts.house||0)*5+(counts.villa||0)*18;let payroll=s.residents.reduce((v,r)=>v+(r.age>=18&&r.age<=65?(r.payFactor||1)*p.wage*5/(7*22):0),0);let tax=payroll*p.tax/100,utility=h*((counts.power?p.electric*.85:0)+(counts.water?p.water*.1:0));let transit=s.route?.length===2?h*.20*p.fare:0;let costs=s.buildings.length*2.5+h*.9;let income=tax+utility+transit-costs;let satisfaction=clamp(Math.round(88+(p.wage-5600)/650-(p.basket-24)*.42-(p.tax-8)*.75-(p.electric-.65)*4-(p.water-2.6)*1.2-(p.fare-2)*1.3+Math.min(3,(p.interest-2.5)*.5)-Math.max(0,h-housing)/10),15,99);
 return {h,workers,housing,counts,tax,utility,transit,costs,income,satisfaction};}
export function advance(s,dt,stat){if(!Number.isFinite(dt)||dt<=0)return false;if(!context(s))setupLife(s,makeTerrain(s.seed));const old=s.clock;s.clock+=dt;const changed=advanceHouseholds(s,minuteOf(s.clock));if(dayNum(s.clock)!==dayNum(old))log(s,'新一日家庭结算',`水电账单、存款利息和证券估值已更新。股票净值 ¥${s.price.toFixed(2)}。`);return changed}
export const ACTIONS={work:'加班工作',shop:'补购食材',rest:'在家休息',commute:'外出散步',walk:'社区散步',eat:'吃点心',invest:'整理投资',home:'回家休息'};
export function activity(r,s){return PHASE[phase(s,r).kind]||'在家休息'}
