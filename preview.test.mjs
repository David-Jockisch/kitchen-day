import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecipeLinker} from './recipe-picker.mjs';
import {readFileSync} from 'node:fs';
const recipe={id:'R-1',name:'Meatballs',pdfPath:'pdfs/R-1.pdf'};
function setup(fetcher=async()=>({ok:true,json:async()=>[recipe]}),oldPage=false){
 const nodes={};
 function node(){return {open:false,hidden:false,textContent:'',children:[],events:{},isConnected:true,src:'',
  append(...children){this.children.push(...children)},before(other){nodes[other.id]=other},replaceChildren(){this.children=[]},setAttribute(){},
  addEventListener(event,fn){this.events[event]=fn},focus(){this.focused=true},showModal(){this.open=true},close(){this.open=false},
  getBoundingClientRect(){return {left:20,right:300,top:50,bottom:600}}};}
 const focus=node();
 globalThis.document={getElementById:id=>oldPage&&/^(menuRecipe|closeMenuRecipe)/.test(id)?nodes[id]||null:nodes[id]??=node(),createElement:()=>node(),activeElement:focus,
 body:{append(dialog){nodes[dialog.id]=dialog;for(const [,id] of dialog.innerHTML.matchAll(/id="([^"]+)"/g))nodes[id]=node();}}};
 globalThis.location={href:'https://example.test/kitchen-day/',origin:'https://example.test'};
 globalThis.fetch=fetcher;
 const linker=createRecipeLinker({getState:()=>({recipeLinks:{meatballs:{recipeId:'R-1',recipeName:'Meatballs'}}}),change:async()=>true});
 const li=linker.renderItem('Meatballs');
 return {nodes,focus,open:()=>li.children[0].onclick()};
}

test('menu recipe opens embedded PDF and outside click closes and unloads it',async()=>{
 const {nodes,open,focus}=setup();await open();
 assert.equal(nodes.menuRecipePreview.open,true);
 assert.equal(nodes.menuRecipeFrame.src,'https://example.test/kitchen-day/recipes/pdfs/R-1.pdf');
 const inside={target:nodes.menuRecipePreview,clientX:100,clientY:100};
 nodes.menuRecipePreview.events.pointerdown(inside);nodes.menuRecipePreview.events.click(inside);
 assert.equal(nodes.menuRecipePreview.open,true);
 const outside={target:nodes.menuRecipePreview,clientX:5,clientY:100};
 nodes.menuRecipePreview.events.pointerdown(outside);nodes.menuRecipePreview.events.click(outside);
 assert.equal(nodes.menuRecipePreview.open,false);assert.equal(nodes.menuRecipeFrame.src,'about:blank');assert.equal(focus.focused,true);
});
test('Escape closes preview and restores previous focus',async()=>{
 const {nodes,open,focus}=setup();await open();let prevented=false;
 nodes.menuRecipePreview.events.cancel({preventDefault(){prevented=true}});
 assert.equal(prevented,true);assert.equal(nodes.menuRecipePreview.open,false);assert.equal(focus.focused,true);
});
test('closing before catalog finishes prevents late PDF load',async()=>{
 let resolve;const {nodes,open}=setup(()=>new Promise(r=>{resolve=r}));
 const pending=open();nodes.closeMenuRecipePreview.onclick();resolve({ok:true,json:async()=>[recipe]});await pending;
 assert.equal(nodes.menuRecipePreview.open,false);assert.equal(nodes.menuRecipeFrame.src,'about:blank');
});
test('unavailable recipe shows error without opening external page',async()=>{
 const {nodes,open}=setup(async()=>({ok:true,json:async()=>[]}));await open();
 assert.match(nodes.menuRecipePreviewStatus.textContent,/no longer in the library/);assert.equal(nodes.menuRecipeFrame.hidden,true);
});
test('new preview controls and versioned assets exist',()=>{
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8'),ui=readFileSync(new URL('./recipe-picker.mjs',import.meta.url),'utf8');
 for(const [,id]of ui.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes('id="'+id+'"'),id);
 const sw=readFileSync(new URL('./sw.js',import.meta.url),'utf8');
 for(const [,asset]of sw.matchAll(/'\.\/([^']+)'/g))if(asset)assert.doesNotThrow(()=>readFileSync(new URL('./'+asset.split('?')[0],import.meta.url)),asset);
});

test('older cached page without preview markup still starts and opens a recipe',async()=>{
 const {nodes,open}=setup(undefined,true);await open();
 assert.equal(nodes.menuRecipePreview.open,true);
 assert.equal(nodes.menuRecipeFrame.src,'https://example.test/kitchen-day/recipes/pdfs/R-1.pdf');
});

test('sample opens readable amounts first and can switch to PDF and back',async()=>{
 const sample={id:'KS-2009-0003',name:'Chicken & Noodles',pdfPath:'pdfs/KS-2009-0003.pdf'};
 const {nodes}=setup(async()=>({ok:true,json:async()=>[sample]}));
 const linker=createRecipeLinker({getState:()=>({recipeLinks:{noodles:{recipeId:sample.id,recipeName:sample.name}}}),change:async()=>true});
 await linker.renderItem('Noodles').children[0].onclick();
 assert.equal(nodes.menuRecipeReadable.hidden,false);assert.equal(nodes.menuRecipeFrame.hidden,true);
 assert.equal(nodes.menuRecipeViewToggle.hidden,false);
 nodes.menuRecipeViewToggle.onclick();assert.equal(nodes.menuRecipeFrame.hidden,false);assert.equal(nodes.menuRecipeReadable.hidden,true);
 nodes.menuRecipeViewToggle.onclick();assert.equal(nodes.menuRecipeFrame.hidden,true);assert.equal(nodes.menuRecipeReadable.hidden,false);
 nodes.closeMenuRecipePreview.onclick();assert.equal(nodes.menuRecipePreview.open,false);assert.equal(nodes.menuRecipeFrame.src,'about:blank');
});
