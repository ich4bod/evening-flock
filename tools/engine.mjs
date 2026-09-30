import assert from 'node:assert/strict';import {seed,step} from '../site/engine.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const birds=seed();assert.equal(birds.length,80);assert.deepEqual(birds,seed());assert.deepEqual(birds[0],{x:71,y:37,vx:2,vy:0});
const pair=[{x:100,y:100,vx:1,vy:0},{x:110,y:100,vx:1,vy:0}],copy=structuredClone(pair);const out=step(pair,{separation:18,alignment:.08,cohesion:.004});assert.deepEqual(pair,copy);close(out[0].vx,-.76);close(out[0].x,99.24);close(out[1].vx,2.76);close(out[1].x,112.76);
const wrapped=step([{x:999,y:599,vx:2,vy:2}],{separation:18,alignment:.08,cohesion:.004});close(wrapped[0].x,1);close(wrapped[0].y,1);
const stationary=step([{x:0,y:0,vx:0,vy:0},{x:0,y:0,vx:0,vy:0}],{separation:18,alignment:.08,cohesion:.004});assert.ok(stationary.every(b=>Object.values(b).every(Number.isFinite)));
let flock=birds;for(let i=0;i<1000;i++)flock=step(flock,{separation:18,alignment:.08,cohesion:.004});assert.ok(flock.every(b=>b.x>=0&&b.x<1000&&b.y>=0&&b.y<600&&Math.hypot(b.vx,b.vy)<=3+1e-9));
if(process.argv[2]==='predator'){const a=step([{x:100,y:100,vx:0,vy:0}],{separation:0,alignment:0,cohesion:0},{x:90,y:100});close(a[0].vx,.75);close(a[0].x,100.75);const b=step([{x:100,y:100,vx:0,vy:0}],{separation:0,alignment:0,cohesion:0},{x:100,y:100});close(b[0].vx,.8);console.log('a movable hawk pushes nearby birds away without killing them');}
else if(process.argv[2]==='rules'){const a=step(pair,{separation:0,alignment:0,cohesion:0});close(a[0].x,101);close(a[1].x,111);const b=step(pair,{separation:0,alignment:.08,cohesion:.004});close(b[0].vx,1.04);console.log('three independent steering weights change the actual flight');}
else console.log('eighty birds flock synchronously with finite wrapped positions');
