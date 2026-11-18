import * as T from 'three';
import {lifePulse,phase,positionOf,minuteOf} from './life.js';
const dummy=new T.Object3D(),col=new T.Color();
const outfits=['#687f79','#977456','#546f82','#b58672','#82835f','#566b61','#b0a187','#72758b'];
// A renderer, not a second pedestrian simulation. Walking figures come from
// the same itineraries and clock that pay wages and update the family ledger.
export class People{
 constructor(w){this.w=w;this.cap=112;this.selected=[];this.visible=[];this.key='';const cloth=new T.MeshStandardMaterial({roughness:.86}),skin=new T.MeshStandardMaterial({roughness:.75}),cyl=new T.CylinderGeometry(.47,.43,1,9),ball=new T.SphereGeometry(.5,9,6),box=new T.BoxGeometry();this.parts=[];
  const mesh=(geo,mat,n)=>{let m=new T.InstancedMesh(geo,mat,n);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.castShadow=m.receiveShadow=true;m.frustumCulled=false;w.scene.add(m);this.parts.push(m);return m};this.head=mesh(ball,skin,this.cap);this.hair=mesh(ball,cloth,this.cap);this.body=mesh(cyl,cloth,this.cap);this.arms=mesh(cyl,cloth,this.cap*2);this.legs=mesh(cyl,cloth,this.cap*2);this.shoes=mesh(box,cloth,this.cap*2);this.bag=mesh(box,cloth,this.cap);
 }
 update(){const w=this.w,s=w.s,eye=w.explore?w.fp.position:w.target;const key=[minuteOf(s.clock),Math.floor(eye.x/7),Math.floor(eye.z/7),w.explore,s.residents.length].join('|');if(key!==this.key){this.key=key;this.selected=lifePulse(s).outdoors.map(r=>{let seg=phase(s,r),p=positionOf(s,r,seg);return {r,seg,dist:(p.x-eye.x)**2+(p.z-eye.z)**2}}).sort((a,b)=>a.dist-b.dist).slice(0,this.cap)}
  this.visible=[];let i=0,bagN=0;for(let {r,seg} of this.selected){let p=positionOf(s,r,seg);if(!p.visible)continue;const h=r.age<18?.78:r.age>70?.94:1.0,theta=p.rot,co=Math.cos(theta),si=Math.sin(theta),y=w.t.onBridge(p.x,p.z)?.50:.02;let gait=seg.kind==='waitBus'?0:Math.sin(s.clock*(seg.kind==='walk'?3.2:5.9)+r.look),bob=Math.abs(gait)*.017,coat=outfits[r.look%8],skinColor=['#d2ab8e','#e3bea4','#ba9277','#d9ae8a'][r.id%4];
   const put=(part,id,x,z,yy,sx,sy,sz,color,tilt=0)=>{dummy.position.set(p.x+(x*co+z*si)*h,y+(yy+bob)*h,p.z+(-x*si+z*co)*h);dummy.rotation.set(tilt,theta,0,'YXZ');dummy.scale.set(sx*h,sy*h,sz*h);dummy.updateMatrix();part.setMatrixAt(id,dummy.matrix);part.setColorAt(id,col.set(color))};
   put(this.head,i,0,0,1.38,.255,.30,.245,skinColor);put(this.hair,i,0,-.022,1.46,.269,.17,.25,r.age>65?'#a4a39a':['#4c423a','#615143','#453f38'][r.look%3]);put(this.body,i,0,0,.99,.45,.57,.29,coat);
   for(let j=0;j<2;j++){let side=j?1:-1,swing=gait*side;put(this.arms,i*2+j,side*.24,swing*.072,.99,.11,.45,.13,coat,swing*.28);put(this.legs,i*2+j,side*.102,-swing*.075,.45,.147,.62,.16,'#454f50',-swing*.27);put(this.shoes,i*2+j,side*.102,.045-swing*.14,.099,.164,.115,.25,'#544e42')}
   if((seg.kind==='return'&&seg.from===r.shop)||(seg.kind==='toWork'&&r.id%4===0)){put(this.bag,bagN++,.296,.04,.65,.18,.29,.27,seg.from===r.shop?'#c6a778':'#666c5e')}
   this.visible.push({id:r.id,r,x:p.x,z:p.z,y:y+1.35*h});i++;
  }for(let m of [this.head,this.hair,this.body])m.count=i;for(let m of [this.arms,this.legs,this.shoes])m.count=i*2;this.bag.count=bagN;for(let m of this.parts){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}
 }
}
