import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {recipeCards,renderRecipeCard} from './recipe-cards.mjs';
const doc={createElement(tag){return {tag,textContent:'',children:[],append(...children){this.children.push(...children)}}}};
const text=node=>[node.textContent,...node.children.map(text)].join(' ');

test('pilot covers two recipes per collection with real source PDFs and original portions',()=>{
 const catalog=JSON.parse(readFileSync(new URL('./recipes/recipes.json',import.meta.url)));
 assert.equal(Object.keys(recipeCards).length,6);
 for(const prefix of ['KOH','KS','IA'])assert.equal(Object.keys(recipeCards).filter(id=>id.startsWith(prefix+'-')).length,2);
 for(const recipe of Object.values(recipeCards)){
  const source=catalog.find(x=>x.id===recipe.id);assert.ok(source);assert.equal(recipe.name,source.name);
  assert.ok(existsSync(new URL('./recipes/'+recipe.pdfPath,import.meta.url)));
  assert.ok(recipe.servings>0);assert.ok(recipe.ingredients.length);assert.ok(recipe.steps.length);
  const output=text(renderRecipeCard(recipe.id,doc));
  for(const ingredient of recipe.ingredients){assert.ok(output.includes(ingredient.name));assert.ok(output.includes(ingredient.amount));}
  assert.ok(output.includes(recipe.portion));assert.ok(output.includes('Quantities have not been scaled'));
 }
 assert.equal(renderRecipeCard('not-a-sample',doc),null);
});
test('source ambiguity and mixed weight/measure quantities are retained',()=>{
 assert.equal(recipeCards['KOH-1617-0003'].servings,50);
 assert.match(recipeCards['KOH-1617-0003'].ingredients[0].amount,/UNKNOWN/);
 assert.match(recipeCards['IA-2013-0001'].ingredients[0].amount,/18¾ lb.*2⅓ bags/);
 assert.equal(recipeCards['KS-2009-0003'].ingredients.find(x=>x.name==='Dehydrated onion flakes').amount,'⅓ cup');
 assert.match(recipeCards['IA-2013-0002'].steps.at(-1),/160°F/);
});
