/* The authoritative household simulation. All arithmetic is in game minutes;
   render frames never generate income or settle an errand. Only small account
   balances, household history and the minute cursor are persisted. */
import {rand,clamp} from './math.js';
import {Footways,sampleLine,busAt} from './routes.js';
export const DAY=1440,minuteOf=seconds=>Math.floor(seconds*1.2+1e-7),round=v=>Math.round((v+Number.EPSILON)*100)/100;
export const hhmm=m=>{m=((Math.floor(m)%DAY)+DAY)%DAY;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`};
export const PHASE={sleep:'在家睡觉',home:'在家休息',prep:'整理行装',breakfast:'吃早餐',lunch:'吃午饭',dinner:'与家人吃晚饭',work:'在单位工作',study:'在社区学堂学习',toWork:'上班途中',toSchool:'去上课',return:'回家途中',toShop:'去超市买菜',shop:'在超市买菜',toPark:'去公园',walk:'在社区散步',ledger:'整理家庭账本',invest:'办理储蓄与投资',toBank:'去银行',bus:'乘坐公交',waitBus:'在站点候车',toStop:'步行去车站',care:'料理家务',reading:'在家阅读',snack:'吃点心',community:'社区活动',stranded:'等待道路连通'};
export const ACCOUNT_KINDS={open:'家庭建账',wage:'税后工资',pension:'退休金',groceries:'采买食材',meal:'用餐',packed:'打包便当',lunch:'午餐支出',short:'食材不足',deposit:'转入存款',withdraw:'取出存款',buyStock:'买入股票',sellStock:'卖出股票',interest:'存款利息',utility:'水电支出',fare:'公交票款',debt:'账单待缴',repay:'清偿欠款',review:'核对账本'};
export const TIERS=[{id:'lean',name:'相对拮据',short:'拮据',rule:'低于中位数的 0.5 倍'},{id:'steady',name:'收支平稳',short:'平稳',rule:'中位数的 0.5 至不足 1.25 倍'},{id:'well',name:'家境宽裕',short:'宽裕',rule:'中位数的 1.25 至不足 2.5 倍'},{id:'ample',name:'资产富足',short:'富足',rule:'不低于中位数的 2.5 倍'}];
export const STYLES={liquid:'现金优先',save:'稳健储蓄',balanced:'均衡配置'};
const rtCache=new WeakMap();
const eligible=r=>r.age>=18&&r.age<=65;
const sum=(a,fn)=>a.reduce((n,x)=>n+fn(x),0);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const working=r=>eligible(r);
function today(f,d){if(f.daily?.day===d)return;f.history??=[];if(f.daily)f.history.unshift({...f.daily});f.history.length=Math.min(f.history.length,7);f.daily={day:d,income:0,expense:0,meals:0,missed:0}}
function entry(f,m,k,r,amount=0,note=''){f.entries.unshift({m,k,r:r?.id||0,a:round(amount),note});if(f.entries.length>20)f.entries.pop()}
function funds(rt,f){const m=rt.members.get(f.id)||[];return {cash:round(sum(m,x=>x.cash)),deposit:round(sum(m,x=>x.deposit)),shares:sum(m,x=>x.shares)}}
function assignHouseholds(s,rt){const fresh=s.residents.filter(r=>!rt.fam.has(r.family)),allHomes=new Map();for(const r of fresh){const k=r.home||'unhoused';if(!allHomes.has(k))allHomes.set(k,[]);allHomes.get(k).push(r)}
 for(const [home,people] of allHomes){let groups=s.life.families.filter(f=>f.home===home),counts=new Map(groups.map(f=>[f.id,s.residents.filter(r=>r.family===f.id).length]));const addGroup=()=>{let id=++s.life.nextFamily;let f={id,home,name:'新居民家庭',style:['save','balanced','liquid'][id%3],pantry:0,debt:0,entries:[],history:[]};today(f,Math.floor(minuteOf(s.clock)/DAY));entry(f,minuteOf(s.clock),'open',null,0,'住房不计入金融资产');s.life.families.push(f);groups.push(f);rt.fam.set(id,f);counts.set(id,0);return f};
  const n=people.length+sum(groups,g=>counts.get(g.id)||0);while(groups.length<Math.ceil(n/4))addGroup();if(!groups.length)addGroup();
  // Distribute adults before children. Flats may contain several households.
  for(const r of people.sort((a,b)=>(b.age>=18)-(a.age>=18)||a.id-b.id)){let f=groups.reduce((a,b)=>counts.get(a.id)<=counts.get(b.id)?a:b);if(counts.get(f.id)===0)f.name=(r.name[0]||'新')+'家';counts.set(f.id,counts.get(f.id)+1);r.family=f.id;f.pantry+=4+(r.id%3);
   if(!Number.isFinite(r.deposit)){const old=Number.isFinite(r.cash)?Math.max(0,r.cash):0;r.deposit=round(old*(.32+(r.look%47)/100));r.cash=round(old-r.deposit)}r.shares=Math.max(0,Math.floor(r.shares||0));
  }
 }
}
const jobType=r=>r.job==='教师'?'gov':r.job==='公交司机'?'bus':['店员','药剂师','面包师','花艺师'].includes(r.job)?'shop':['工程师','园艺师'].includes(r.job)&&r.id%3===0?'water':'office';
function index(s,rt){rt.buildings=new Map(s.buildings.map(b=>[b.id,b]));let types={};for(const b of s.buildings)if(rt.network.anchors.has(b.id))(types[b.type]??=[]).push(b.id);rt.types=types;
 rt.fam=new Map(s.life.families.map(f=>[f.id,f]));assignHouseholds(s,rt);rt.members=new Map();rt.people=new Map();for(let r of s.residents){rt.people.set(r.id,r);if(!rt.members.has(r.family))rt.members.set(r.family,[]);rt.members.get(r.family).push(r)}
 s.life.families=s.life.families.filter(f=>rt.members.has(f.id));rt.fam=new Map(s.life.families.map(f=>[f.id,f]));
 const parks=rt.t.lots.filter(l=>rt.network.anchors.has(l.id)&&!rt.buildings.has(l.id)).map(l=>l.id);
 const choices=new Map();function nearest(home,list,tag){let key=home+'|'+tag;if(!choices.has(key)){let p=rt.lots.get(home)||{x:0,z:0};choices.set(key,[...list].sort((a,b)=>dist(rt.lots.get(a),p)-dist(rt.lots.get(b),p)))}return choices.get(key)}
 for(let f of s.life.families){let m=rt.members.get(f.id);f.lead=(m.find(p=>eligible(p))||m.find(p=>p.age>=18)||m[0]).id;f.buyer=(m.find(p=>p.age>65)||rt.people.get(f.lead)).id;if(!STYLES[f.style])f.style='save';f.entries??=[];f.history??=[];f.debt=Math.max(0,f.debt||0);f.pantry=Math.max(0,f.pantry||0);
  for(let r of m){const list=types[r.age<18?'gov':jobType(r)]||types.office||[];let opts=nearest(r.home,list,r.age<18?'school':jobType(r));if(!rt.buildings.has(r.workplace))r.workplace=r.age<=65&&opts.length?opts[r.id%Math.min(4,opts.length)]:null;
   r.payFactor??=round(.68+(r.look%89)/100+(['工程师','程序员','建筑师'].includes(r.job)?.25:0));r.deposit??=0;r.owed??=0;r.workMinutes??=0;r.shop=nearest(r.home,types.shop||[],'shops')[0]||null;r.park=nearest(r.home,parks,'park')[r.id%Math.min(3,parks.length||1)]||r.home;r.bank=nearest(r.home,types.bank||[],'bank')[0]||null;
  }
 }
 rt.network.paths.forEach((_,key)=>{if(key.includes('@stop'))rt.network.paths.delete(key)});rt.line=rt.network.transit(s.route);rt.day=-1;rt.n=s.residents.length;rt.b=s.buildings.length;rt.routeKey=s.route.join('|');rt.metrics=null;
}
export function setupLife(s,t,{fresh=false}={}){
 let rt=rtCache.get(s),isNew=!s.life||s.life.version!==1;if(isNew)s.life={version:1,minute:minuteOf(s.clock),nextFamily:0,families:[],accounts:{tax:0,utility:0,fare:0,cost:0}};
 if(!rt){if(!t)throw Error('城市生活需要道路网络');rt={s,t,lots:new Map(t.lots.map(l=>[l.id,l])),network:new Footways(t),plans:new Map(),day:-1};rtCache.set(s,rt)}index(s,rt);
 if(isNew){const now=minuteOf(s.clock);s.life.minute=fresh?Math.floor(now/DAY)*DAY-1:now;for(let r of s.residents)r.enrolledAt=s.life.minute;for(let f of s.life.families)if(f.entries[0]?.k==='open')f.entries[0].m=Math.max(0,s.life.minute);if(fresh)advanceHouseholds(s,now)}
 prepareDay(s,rt,Math.floor(minuteOf(s.clock)/DAY));return rt;
}
export function context(s){return rtCache.get(s)}
export function refreshLife(s,t){return setupLife(s,t)}
function routeTime(line,r){return Math.max(1,Math.ceil(line.length/(1.65+(r.id%9)*.048)*(r.age>70?1.18:1)))}
function planDay(s,r,day,rt){let f=rt.fam.get(r.family),home=r.home,at=home,m=0,items=[];const n=r.look,dayOfWeek=day%7,service=['shop','bus','water','power'].includes(rt.buildings.get(r.workplace)?.type);const duty=!!r.workplace&&(r.age<18?dayOfWeek<5:eligible(r)&&(service?(dayOfWeek+r.id)%7<5:dayOfWeek<5));
 const stay=(end,kind,extra={})=>{end=Math.min(DAY,Math.max(m,Math.round(end)));if(end>m)items.push({start:m,end,kind,site:at,...extra});m=end};
 const walk=(to,kind)=>{if(at===to)return true;let line=rt.network.path(at,to);if(!line)return false;stay(m+routeTime(line,r),kind,{from:at,to,line,outside:true});at=to;return true};
 const travel=(to,kind,bus=false)=>{if(!to)return false;if(at===to)return true;let direct=rt.network.path(at,to);if(!direct)return false;
  // Board only a real scheduled service, at its actual endpoint and departure.
  if(bus&&rt.line&&direct.length>50&&r.id%5!==0){let tl=rt.line,best=null;for(let i=0;i<2;i++){let foot1=rt.network.path(at,tl.board[i]),foot2=rt.network.path(tl.board[1-i],to);if(!foot1||!foot2)continue;let arr=m+routeTime(foot1,r),base=day*DAY+arr,phase=(i?tl.ride+2*tl.dwell:tl.dwell);let leave=arr+((phase-base%tl.period+tl.period)%tl.period);let total=leave-m+tl.ride+routeTime(foot2,r);if(total<routeTime(direct,r)*1.06&&(!best||total<best.total)&&m>=345&&leave+tl.ride<1320)best={i,leave,total}}
   if(best){let i=best.i;walk(tl.board[i],'toStop');stay(best.leave,'waitBus',{outside:true});stay(m+tl.ride,'bus',{from:at,to:tl.board[1-i],reverse:!!i,line:tl.path});at=tl.board[1-i];return walk(to,kind)}
  }return walk(to,kind)};
 const stroll=()=>{if(travel(r.park,'toPark'))stay(m+24+n%34,'walk',{outside:true})};
 const market=()=>{if(travel(r.shop,'toShop'))stay(m+12+n%9,'shop')};
 let workStart=(r.age<18?476:service?465+(r.id%3)*45:500+(r.id%3)*20)+(n%27)-13;
 let normalRoute=rt.network.path(home,r.workplace),journey=normalRoute?routeTime(normalRoute,r):0;let leave=Math.max(323,workStart-journey-2);
 let wake=duty?Math.max(282,Math.min(427,leave-31)):388+n%52;stay(wake,'sleep');stay(wake+19,'breakfast');
 if(duty){stay(Math.max(m,leave),'prep');const ok=travel(r.workplace,r.age<18?'toSchool':'toWork',true),lunch=710+n%52,finish=(r.age<18?965:workStart+535)+n%13;const action=ok?(r.age<18?'study':'work'):'stranded';stay(Math.max(m+5,lunch),action);stay(m+45,'lunch');stay(Math.max(m+12,finish),action,{clockout:true});
  if(r.id===f.buyer&&r.age>=16)market();travel(home,'return');
 }else{stay(Math.max(m,472+n%66),'care');if(r.id===f.buyer&&r.age>=16)market();stroll();if(r.id===f.lead&&r.age>=18&&r.bank&&(day+r.id)%3===0&&m<645){if(travel(r.bank,'toBank'))stay(m+12,'invest')}
  travel(home,'return');stay(Math.max(m,707+n%46),'home');stay(m+34,'lunch');stay(Math.max(m,825+n%39),'reading');stroll();travel(home,'return');}
 const dinner=Math.min(1255,Math.max(m,1094+n%49));stay(dinner,'home');stay(m+28,'dinner');
 // LLMs choose an actual free-time visit; they do not mint wages or move anyone
 // during the request. Changing a choice never rewrites an already settled slot.
 const flexStart=Math.max(m,1190+n%35);stay(flexStart,'home');const choice=r.decision?.planDay===day?r.decision.action:null;
 if(choice==='shop')market();else if(choice==='work'&&eligible(r)&&m<1260&&travel(r.workplace,'toWork',true))stay(m+28,'work',{clockout:true});else if(choice==='walk'||choice==='commute')stroll();else if(choice==='eat')stay(m+9,'snack');
 if(at!==home)travel(home,'return');if(r.id===f.lead&&r.age>=18&&r.bank&&choice!=='rest')stay(m+16,'invest');else stay(m+14,'ledger');stay(Math.max(m,1286+n%75),'home');stay(DAY,'sleep');return {items,flexStart,duty,weekday:dayOfWeek};
}
function prepareDay(s,rt,day){if(rt.day===day)return;rt.day=day;rt.plans=new Map();rt.indices=new Map();for(let r of s.residents){rt.plans.set(r.id,planDay(s,r,day,rt));rt.indices.set(r.id,0)}}
export function agenda(s,r){let rt=context(s);if(!rt)return {items:[],flexStart:1200};prepareDay(s,rt,Math.floor(minuteOf(s.clock)/DAY));return rt.plans.get(r.id)||{items:[],flexStart:1200}}
function lookup(plan,min){let a=plan.items,lo=0,hi=a.length-1;while(lo<hi){let m=(lo+hi)>>1;if(a[m].end<=min)lo=m+1;else hi=m}return a[lo]}
export function phase(s,r){let p=agenda(s,r);return p.items.length?lookup(p,minuteOf(s.clock)%DAY):{kind:'home',site:r.home,start:0,end:DAY}}
export function chooseIntent(s,r,out){const rt=context(s),abs=minuteOf(s.clock),day=Math.floor(abs/DAY),plan=agenda(s,r);let when=abs%DAY<plan.flexStart?day:day+1;r.decision={action:out.action,say:String(out.say).slice(0,180),at:s.clock,planDay:when};if(when===day){rt.plans.set(r.id,planDay(s,r,day,rt));rt.indices.set(r.id,0)}return when}
export function positionOf(s,r,seg=phase(s,r),clock=s.clock){let rt=context(s),m=(clock*1.2)%DAY,p;if(seg.line){let t=clamp((m-seg.start)/Math.max(1,seg.end-seg.start),0,1);p=sampleLine(seg.line,seg.reverse?1-t:t);if(seg.reverse&&p)p.rot+=Math.PI;return {...p,visible:!!seg.outside,bus:seg.kind==='bus'}}
 let l=rt.lots.get(seg.site)||rt.network.anchors.get(seg.site)||{x:0,z:0};if(seg.kind==='walk'){let a=(m-seg.start)*.105+r.id,rad=1+(r.id%8)*.13;return {x:l.x+Math.cos(a)*rad,z:l.z+Math.sin(a)*rad,rot:-a,visible:true}}
 return {x:l.x,z:l.z,rot:0,visible:!!seg.outside};}
export function siteName(s,id){let rt=context(s);if(!rt)return '城区';if(id?.startsWith('@stop'))return '公交站台';let b=rt.buildings.get(id),l=rt.lots.get(id);if(!l)return '社区';const names={house:'独栋住宅',villa:'花园洋房',office:'创意公司',shop:'社区超市',gov:'市民中心',bank:'商业银行',power:'发电厂',water:'净水中心',bus:'公交车站'};return l.district+' · '+(b?names[b.type]:'社区花园')}
function drain(rt,f,r,total){let m=rt.members.get(f.id),others=[r,...m.filter(x=>x!==r)],left=round(total);for(let key of ['cash','deposit'])for(let p of others){let x=Math.min(p[key],left);p[key]=round(p[key]-x);left=round(left-x);if(left<=0)return round(total)}return round(total-left)}
function cashIncome(f,r,m,k,value,note){const a=round(value);r.cash=round(r.cash+a);f.daily.income=round(f.daily.income+a);entry(f,m,k,r,a,note)}
function publicMoney(s,k,val){val=round(val);s.balance=round(s.balance+val);s.earned=round(s.earned+val);s.life.accounts[k]=round(s.life.accounts[k]+val)}
function bill(s,rt,f,r,m,k,price,publicKind,credit=false){let v=drain(rt,f,r,price);f.daily.expense=round(f.daily.expense+v);if(v>0){entry(f,m,k,r,-v);if(publicKind)publicMoney(s,publicKind,v)}let due=round(price-v);if(credit&&due>0){f.debt=round(f.debt+due);entry(f,m,'debt',r,-due,k==='utility'?'水电欠费':'交通欠费')}return v}
function grocery(s,rt,f,r,m){let n=rt.members.get(f.id).length,target=n*6,need=Math.max(0,target-f.pantry),unit=round(s.policy.basket/3),a=funds(rt,f);let qty=Math.min(need,Math.floor((a.cash+a.deposit+.001)/unit));if(qty>0){let cost=round(qty*unit);drain(rt,f,r,cost);f.pantry+=qty;f.daily.expense=round(f.daily.expense+cost);entry(f,m,'groceries',r,-cost,`${qty} 份食材 · ¥${unit}/份`)}else entry(f,m,'review',r,0,need?'余额不足，本次未采购':'库存充足，未重复采购')}
function meal(s,rt,f,r,m,k){let day=Math.floor(m/DAY),label=PHASE[k];if(k==='lunch'&&r.packed===day){r.packed=-1;f.daily.meals++;entry(f,m,'meal',r,0,'午餐 · 自带便当');return}
 if(k==='lunch'&&rt.currentSite!==r.home){const price=round(s.policy.basket*.43),a=funds(rt,f);if(a.cash+a.deposit>=price){bill(s,rt,f,r,m,'lunch',price,null);f.daily.meals++;return}}
 if(f.pantry>0){f.pantry--;f.daily.meals++;entry(f,m,'meal',r,0,label+' · 食材 −1 份');if(k==='breakfast'&&r.look%3!==0&&rt.plans.get(r.id).duty&&f.pantry>=rt.members.get(f.id).length){r.packed=day;f.pantry--;entry(f,m,'packed',r,0,'午餐便当 · 食材 −1 份')}}else{f.daily.missed++;entry(f,m,'short',r,0,label+' · 库存为零')}
}
function finance(s,rt,f,r,m){let day=Math.floor(m/DAY);if(f.invested===day)return;if(r.age<18||!rt.types.bank?.length)return;f.invested=day;let members=rt.members.get(f.id),daily=members.length*(s.policy.basket+s.policy.electric*.85+s.policy.water*.10),reserve=round(daily*({liquid:19,save:10,balanced:7}[f.style]||10));let a=funds(rt,f);
 if(f.debt>0&&a.cash+a.deposit>0){let paid=drain(rt,f,r,Math.min(f.debt,a.cash+a.deposit));f.debt=round(f.debt-paid);f.daily.expense=round(f.daily.expense+paid);publicMoney(s,'utility',paid);entry(f,m,'repay',r,-paid,'清偿公共账单');a=funds(rt,f)}
 if(a.cash<reserve*.7){let need=round(reserve-a.cash),draw=0;for(let p of members){let v=Math.min(p.deposit,need);p.deposit=round(p.deposit-v);p.cash=round(p.cash+v);draw+=v;need=round(need-v)}if(draw>0)entry(f,m,'withdraw',r,draw,'从存款补充日用现金');if(need>0){let sold=0;for(let p of members){let qty=Math.min(p.shares,Math.ceil(need/s.price));if(!qty)continue;p.shares-=qty;let val=round(qty*s.price);p.cash=round(p.cash+val);need=Math.max(0,round(need-val));sold+=qty;if(!need)break}if(sold)entry(f,m,'sellStock',r,sold*s.price,`卖出 ${sold} 股，补充备用金`)}return}
 let excess=round(a.cash-reserve);if(excess<=0){entry(f,m,'review',r,0,'保留家庭日常备用金');return}let dep=round(excess*({liquid:.12,save:.70,balanced:.40}[f.style])),eq=f.style==='balanced'&&s.policy.stock>-1.5?Math.floor(excess*.18/s.price):0;
 function takeCash(v){let left=v;for(let p of [r,...members.filter(x=>x!==r)]){let spend=Math.min(p.cash,left);p.cash=round(p.cash-spend);left=round(left-spend);if(left<=0)break}}
 if(dep>0){takeCash(dep);r.deposit=round(r.deposit+dep);entry(f,m,'deposit',r,-dep,'现金转为储蓄，不计生活支出')}if(eq>0){let val=round(eq*s.price);takeCash(val);r.shares+=eq;entry(f,m,'buyStock',r,-val,`买入 ${eq} 股 · ¥${s.price.toFixed(2)}/股`)}
}
function payout(s,rt,f,r,m){if(r.owed<.005)return;let gross=round(r.owed),tax=round(gross*s.policy.tax/100);r.owed=0;cashIncome(f,r,m,'wage',gross-tax,`${r.workMinutes} 分钟出勤 · 个税 ¥${tax.toFixed(2)}`);publicMoney(s,'tax',tax);r.lastShift=r.workMinutes;r.workMinutes=0}
function midnight(s,rt,m){let d=m/DAY;s.price=round(Math.max(.01,Math.min(1e8,s.price*(1+s.policy.stock/100))));for(let f of s.life.families){today(f,d);let mbr=rt.members.get(f.id),interest=0;for(let r of mbr){payout(s,rt,f,r,m);let v=round(r.deposit*s.policy.interest/36500);r.deposit=round(r.deposit+v);interest+=v}if(interest){f.daily.income=round(f.daily.income+interest);entry(f,m,'interest',null,interest,'按存款余额及年利率日结')}
  let fee=round(mbr.length*((rt.types.power?.length?s.policy.electric*.85:0)+(rt.types.water?.length?s.policy.water*.1:0)));if(fee)bill(s,rt,f,mbr[0],m,'utility',fee,'utility',true)}s.buildings.forEach(b=>b.condition=Math.max(45,b.condition-1));}
export function advanceHouseholds(s,to){let rt=context(s);if(!rt)return false;let first=s.life.minute+1;if(to<first)return false;let crossed=false;
 for(let m=first;m<=to;m++){let day=Math.floor(m/DAY),tod=m%DAY;prepareDay(s,rt,day);if(!tod&&m>0){midnight(s,rt,m);crossed=true}if(m>0&&m%60===0){publicMoney(s,'cost',-round((s.buildings.length*2.5+s.residents.length*.9)/24));s.days.push({value:s.balance,label:hhmm(m)});if(s.days.length>24)s.days.shift();crossed=true}
  for(let r of s.residents){const plan=rt.plans.get(r.id);if(!plan)continue;let i=rt.indices.get(r.id)||0;while(i+1<plan.items.length&&plan.items[i].end<=tod)i++;rt.indices.set(r.id,i);let p=plan.items[i],f=rt.fam.get(r.family);if(!p||!f)continue;today(f,day);
   if(p.kind==='work'&&r.workplace===p.site&&eligible(r)){r.workMinutes++;r.owed+=s.policy.wage*r.payFactor/(22*480);if(tod+1>=p.end&&p.clockout){payout(s,rt,f,r,m);crossed=true}}
   if(r.age>65&&tod===480)cashIncome(f,r,m,'pension',round(s.policy.wage*.30/30),'由养老账户发放');
   if(p.start!==tod)continue;rt.currentSite=p.site;if(['breakfast','lunch','dinner','snack'].includes(p.kind))meal(s,rt,f,r,m,p.kind);else if(p.kind==='shop'&&rt.buildings.get(p.site)?.type==='shop')grocery(s,rt,f,r,m);else if(p.kind==='invest')finance(s,rt,f,r,m);else if(p.kind==='bus'){bill(s,rt,f,r,m,'fare',s.policy.fare,'fare',true);crossed=true}
  }
 }s.life.minute=to;rt.metrics=null;return crossed;
}
export function householdView(s,id){let rt=context(s),f=rt?.fam.get(id);if(!f)return null;const members=rt.members.get(id),a=funds(rt,f),equity=round(a.shares*s.price),net=round(a.cash+a.deposit+equity-f.debt);return{f,members,...a,equity,net,per:round(net/members.length),district:rt.lots.get(f.home)?.district||'城区'}}
export function wealth(s){let rt=context(s);if(rt.metrics)return rt.metrics;let rows=s.life.families.map(f=>householdView(s,f.id)).sort((a,b)=>a.per-b.per),n=rows.length,median=n?Math.max(.01,n%2?rows[n>>1].per:(rows[n/2-1].per+rows[n/2].per)/2):0,counts=[0,0,0,0];for(let row of rows){row.ratio=row.per/median;row.tier=row.ratio<.5?0:row.ratio<1.25?1:row.ratio<2.5?2:3;counts[row.tier]++}return rt.metrics={rows,byId:new Map(rows.map(v=>[v.f.id,v])),median,counts}}
export function lifePulse(s){let rt=context(s),minute=minuteOf(s.clock);if(rt.pulse?.minute===minute&&rt.pulse.n===s.residents.length)return rt.pulse;let work=0,enRoute=0,shopping=0,home=0,outdoors=[];for(let r of s.residents){let p=phase(s,r);if(p.kind==='work'||p.kind==='study')work++;if(p.from)enRoute++;if(p.kind==='shop')shopping++;if(p.site===r.home&&!p.from)home++;if(p.outside)outdoors.push(r)}return rt.pulse={minute,n:s.residents.length,work,enRoute,shopping,home,outdoors}}
export function liveBus(s){const rt=context(s);return rt?.line?busAt(rt.line,s.clock*1.2):null}
