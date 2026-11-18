import test from 'node:test';
import assert from 'node:assert/strict';
import {StreetMouse} from '../src/street-mouse.js';
function fixture({activation=true, request}={}) {
  const doc=new EventTarget(),win=new EventTarget();doc.defaultView=win;win.navigator={userActivation:{isActive:activation}};
  let calls=0,exits=0,uses=0,look=0;const canvas={ownerDocument:doc,focus(){},requestPointerLock(){calls++;return request?.()}};
  doc.pointerLockElement=null;doc.exitPointerLock=()=>{exits++;doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'))};
  const m=new StreetMouse(canvas,{allowed:()=>true,reset(){},state(){},use(){uses++},scope(){},turn(dx){look+=dx}});
  const grant=()=>{doc.pointerLockElement=canvas;doc.dispatchEvent(new Event('pointerlockchange'))};
  return {m,doc,win,grant,get calls(){return calls},get exits(){return exits},get uses(){return uses},get look(){return look}};
}
test('gesture, native lock confirmation, relative look, release and explicit recapture',()=>{
 const f=fixture({activation:false});f.m.enter();assert.equal(f.m.mode,'ready');assert.equal(f.calls,0);
 f.m.request();assert.equal(f.m.mode,'requesting');f.grant();assert.equal(f.m.mode,'locked');assert.equal(f.uses,0);
 const move=Object.assign(new Event('mousemove'),{movementX:18,movementY:0});f.doc.dispatchEvent(move);assert.equal(f.look,18);
 f.doc.dispatchEvent(Object.assign(new Event('mousedown'),{button:0}));assert.equal(f.uses,1);
 f.doc.exitPointerLock();assert.equal(f.m.mode,'ready');assert(f.m.active);f.doc.dispatchEvent(move);assert.equal(f.look,18);assert.equal(f.calls,1);
 f.m.request();f.grant();f.win.dispatchEvent(new Event('blur'));assert.equal(f.doc.pointerLockElement,null);assert.equal(f.m.mode,'ready');
});
test('rejected or unsupported requests leave a usable drag mode',async()=>{
 const f=fixture({request:()=>Promise.reject(new Error('not permitted'))});f.m.enter();await Promise.resolve();assert.equal(f.m.mode,'drag');assert.equal(f.m.reason,'denied');
 const old=fixture();old.m.enter();old.doc.dispatchEvent(new Event('pointerlockerror'));assert.equal(old.m.mode,'drag');
 const noAPI=fixture();delete noAPI.m.canvas.requestPointerLock;noAPI.m.enter();assert.equal(noAPI.m.reason,'unsupported');
});
test('touch never requests a lock; a late grant after exit is immediately released',()=>{
 const f=fixture();f.m.enter(true);assert.equal(f.calls,0);assert.equal(f.m.reason,'touch');f.m.leave();f.m.enter(false);assert.equal(f.calls,1);f.m.leave();f.grant();assert.equal(f.exits,1);assert.equal(f.doc.pointerLockElement,null);assert.equal(f.m.mode,'idle');
});
