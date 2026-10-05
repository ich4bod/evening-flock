const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const rows=require('./planner-control-families.json');
const mode=process.argv[2],url=process.argv[3];
async function check(p,row){
 const drawer=p.locator('#bird-edits');assert.equal(await drawer.locator('summary').count(),1);assert.equal(await drawer.locator('summary').textContent(),'Change one bird');assert(await drawer.evaluate(e=>!e.open));
 for(const c of row.controls)assert(await p.locator('#'+c.id).isDisabled());
 await p.locator('#sky-crowded').click();if(await p.locator('#pause').textContent()==='Pause')await p.locator('#pause').click();if(await p.locator('#neighbors').getAttribute('aria-pressed')!=='true')await p.locator('#neighbors').click();await p.locator('#flock').focus();await p.keyboard.press('Home');
 const state=()=>p.evaluate(()=>__flock.state()),before=await state();assert(before.paused);
 await drawer.locator('summary').click();const group=p.locator('#family-'+row.id);assert.equal(await group.count(),1);assert.equal(await group.evaluate(e=>e.tagName),'FIELDSET');assert(await group.evaluate(e=>!!e.closest('#bird-edits .bird-edit-row')));assert.equal(await group.locator(':scope > legend').textContent(),row.legend);assert.deepEqual(await group.locator('button').evaluateAll(es=>es.map(e=>e.id)),row.controls.map(c=>c.id));assert.equal(await group.locator('details,summary').count(),0);
 let enabled=null;
 for(const c of row.controls){const btn=p.locator('#'+c.id);assert.equal(await btn.count(),1);assert.equal(await btn.textContent(),c.label);await btn.scrollIntoViewIfNeeded();const box=await btn.boundingBox();assert(box.height>=43.9);assert(box.width>0);assert(await btn.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}));if(!enabled&&await btn.isEnabled())enabled=btn;}
 assert.deepEqual(await state(),before);assert(enabled,'at least one edit changes the crowded sky');await enabled.click();assert.notDeepEqual((await state()).birds,before.birds);await p.locator('#step-back').click();assert.deepEqual((await state()).birds,before.birds);
 const afterUndo=await state();await drawer.locator('summary').click();assert.deepEqual(await state(),afterUndo);assert(await group.evaluate(e=>!e.checkVisibility()));await drawer.locator('summary').click();assert.deepEqual(await state(),afterUndo);assert.equal(await p.locator('#bird-edit-guide').locator('summary').count(),1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
}
async function main(){assert.equal(rows.length,3);const ids=rows.flatMap(r=>r.controls.map(c=>c.id));assert.equal(ids.length,40);assert.equal(new Set(ids).size,40);if(mode==='facts'){console.log('three bird-edit families name 40 unique controls');return;}const row=rows.find(r=>r.id===mode);assert(row);const b=await chromium.launch();try{for(const width of [390,1280]){const p=await b.newPage({viewport:{width,height:900},reducedMotion:'reduce'});assert.equal((await p.goto(url)).status(),200);await check(p,row);await p.close();}console.log(mode+' separates places from flights without changing the sky');}finally{await b.close();}}
module.exports={check,rows};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
