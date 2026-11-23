(async()=>{const g=window.game;const sl=ms=>new Promise(r=>setTimeout(r,ms));
const P=window.__pad;
const press=async(i)=>{P.buttons[i]={pressed:true,value:1};P.timestamp++;await sl(90);P.buttons[i]={pressed:false,value:0};P.timestamp++;await sl(160)};
const M=async(n)=>import('inn:'+n+'.js');
const menu=await M('ui/menu');const desk=await M('ui/desk');const cook=await M('ui/cook');const crafting=await M('crafting');const larder=await M('ui/larder');
const sup=await M('ui/supplies');const del=await M('ui/deliveries');const sk=await M('ui/skills');const cal=await M('ui/calendar');const wd=await M('ui/wardrobe');
const stove=await M('ui/stove');const trays=await M('ui/trays');const data=await M('data');
g.xp=900;g.purse=20000;
const cardsNow=()=>[...document.querySelectorAll('.menu-view .cards .icard:not(.zoomed)')];
const pos=(c)=>{let x=0,y=0;const v=document.querySelector('.menu-view');for(let e=c;e&&e!==v;e=e.offsetParent){x+=e.offsetLeft;y+=e.offsetTop;}return {x:x+c.offsetWidth/2,y:y+c.offsetHeight/2}};
const focus=()=>cardsNow().findIndex(c=>c.classList.contains('focus'));
const out=[];const bad=[];
const test=async(label,open)=>{
  menu.closeAll();await sl(120);
  try{open();}catch(e){bad.push(label+' OPEN ERROR '+e.message);return}
  await sl(250);
  const t=(document.querySelector('.menu-title')?.textContent||'').trim().slice(0,26);
  const btns=[...document.querySelectorAll('.menu .menu-btn')];const glyphless=btns.filter(b=>!b.querySelector('.pad-glyph')).length;
  const n=cardsNow().length;
  const errs=[];
  if(btns.length>3&&document.querySelector('.menu.wide'))errs.push('BUTTONS '+btns.length);
  if(glyphless&&document.querySelector('.menu.wide'))errs.push('NOGLYPH '+glyphless);
  // Down from the first card: each step lands lower, until it stays put
  if(n){let f=focus();if(f<0)f=0;let steps=0,last=pos(cardsNow()[f]??cardsNow()[0]);
    for(let i=0;i<30;i++){await press(13);const f2=focus();if(f2<0){errs.push('LOST FOCUS');break}const p=pos(cardsNow()[f2]);if(f2===f)break;if(p.y<=last.y+5)errs.push(`DOWN ${f}->${f2} not lower`);f=f2;last=p;steps++;}
    // every card below the focus is reachable? check: is there a card lower than last that we didn't reach
    const lower=cardsNow().filter(c=>pos(c).y>last.y+20).length; if(lower)errs.push('STUCK above '+lower+' cards');
    let ups=0;for(let i=0;i<30;i++){const a=focus();await press(12);const b=focus();if(a===b)break;if(pos(cardsNow()[b]).y>=pos(cardsNow()[a]).y-5)errs.push(`UP ${a}->${b} not higher`);ups++;}
    out.push(`${label} [${t}] cards=${n} btns=${btns.length} down=${steps} up=${ups}${errs.length?' !! '+errs.join('; '):''}`);
  } else out.push(`${label} [${t}] cards=0 btns=${btns.length}${errs.length?' !! '+errs.join('; '):''}`);
  if(errs.length)bad.push(label+': '+errs.join('; '));
};
await test('desk',()=>desk.openDeskScreen(g,()=>{}));
await test('bill',()=>desk.openBillOfFare(g));
await test('shop',()=>desk.openShop(g));
await test('supplies',()=>sup.openSupplies(g));
await test('deliveries',()=>del.openDeliveries(g));
await test('calendar',()=>cal.openCalendar(g));
await test('wardrobe',()=>wd.openWardrobe(g));
await test('pantry',()=>larder.openPantryScreen(g));
await test('piesafe',()=>larder.openPieSafeScreen(g));
for(let t=0;t<5;t++){await test('skills tab'+t,()=>{sk.openSkills(g,()=>{});});await press(5);}
for(const id of ['stew','soup','porridge','pie','bread','roast','eggs','fishcakes','salad']) g.known.add(id);
for(const f of g.world.furniture){ if((f.equip?.hotSlots??0)>0) await test('manage '+f.name,()=>stove.openManageStove(g,f.id));
  for(const s of f.slots??[]){
    await test('recipes '+s.id,()=>cook.openRecipeScreen(g,s));
    for(const r of crafting.recipesFor(g,s)) await test('  cook '+r.id,()=>cook.openCookScreen(g,s,r));
  }}
menu.closeAll();
return (bad.length?'PROBLEMS:\n'+bad.join('\n'):'NO PROBLEMS')+'\n---\n'+out.join('\n')})()
