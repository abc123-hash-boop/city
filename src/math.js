export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const money=v=>Math.round(v).toLocaleString('en-US');
export function rand(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296}}
function hash(x,y,s){let h=Math.imul(x,374761393)+Math.imul(y,668265263)+(s|0);h=Math.imul(h^(h>>>13),1274126177);return ((h^h>>>16)>>>0)/4294967296}
export function noise(x,y,s){let i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j;u=u*u*(3-2*u);v=v*v*(3-2*v);let a=hash(i,j,s),b=hash(i+1,j,s),c=hash(i,j+1,s),d=hash(i+1,j+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
export const fbm=(x,y,s)=>noise(x,y,s)*.58+noise(x*2.13+7,y*2.13,s+11)*.28+noise(x*4.31,y*4.31+12,s+33)*.14;
