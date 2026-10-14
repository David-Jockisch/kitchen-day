import {recipeCards,renderRecipeCard} from '../recipe-cards.mjs?v=0.1.0';
'use strict';

const $ = id => document.getElementById(id);
const meals = ['Breakfast', 'Lunch', 'Snack', 'Other'];
const categories = ['Main dish', 'Side dish', 'Bread / grain', 'Fruit / vegetable', 'Dessert', 'Sauce / seasoning', 'Beverage', 'Other'];
const STORE = 'kitchen-day-recipe-overrides-v1';
const PAGE_SIZE = 40;
let recipes = [], overrides = {}, selected = null, shown = PAGE_SIZE;
let favoritesOnly = false, ready = false, returnFocus = null, toastTimer;

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const effective = recipe => ({ ...recipe, ...(overrides[recipe.id] || {}) });
const isFavorite = id => overrides[id]?.favorite === true;

function sanitize(value) {
  const clean = {
    mealTypes: Array.isArray(value.mealTypes) ? value.mealTypes.filter(meal => meals.includes(meal)) : [],
    category: categories.includes(value.category) ? value.category : null,
    notes: String(value.notes || '').slice(0, 10000)
  };
  if (typeof value.favorite === 'boolean') clean.favorite = value.favorite;
  return clean;
}

try {
  const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    for (const [id, value] of Object.entries(saved)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) overrides[id] = sanitize(value);
    }
  }
} catch { /* Browsing still works if local storage is unavailable. */ }

function persist(next) {
  try {
    localStorage.setItem(STORE, JSON.stringify(next));
    overrides = next;
    return true;
  } catch {
    const message = 'Could not save on this device. Check browser storage and try again.';
    $('saveStatus').textContent = message;
    $('backupStatus').textContent = message;
    toast(message);
    return false;
  }
}

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3000);
}

function showDialog(dialog) {
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('modal-open');
}

for (const id of ['detail', 'filtersDialog', 'settingsDialog']) {
  $(id).addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
  });
}

function populate() {
  const collections = [...new Set(recipes.map(recipe => recipe.collection))].sort();
  $('collection').innerHTML = '<option value="">All collections</option>' + collections.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('');
  const options = categories.map(value => `<option>${escapeHTML(value)}</option>`).join('');
  $('category').innerHTML = '<option value="">All food types</option>' + options;
  $('editCategory').innerHTML = '<option value="">Uncategorized</option>' + options;
  $('total').textContent = `${recipes.length} recipes`;
}

function filtered() {
  const terms = normalize($('search').value.trim()).split(/\s+/).filter(Boolean);
  const meal = $('meal').value, category = $('category').value, collection = $('collection').value;
  const result = recipes.filter(recipe => {
    const value = effective(recipe);
    if (favoritesOnly && !isFavorite(recipe.id)) return false;
    if (meal === 'Uncategorized' && (value.mealTypes || []).length) return false;
    if (!['All', 'Uncategorized'].includes(meal) && !(value.mealTypes || []).includes(meal)) return false;
    if (category && value.category !== category) return false;
    if (collection && value.collection !== collection) return false;
    const text = recipe._search + ' ' + normalize(value.notes);
    return terms.every(term => text.includes(term));
  });
  const sort = $('sort').value;
  result.sort((a, b) => {
    if (sort === 'id') return a.id.localeCompare(b.id);
    if (sort === 'year') return String(a.sourceYear).localeCompare(String(b.sourceYear)) || a.name.localeCompare(b.name);
    if (terms.length) {
      const titleMatch = recipe => terms.every(term => normalize(recipe.name).includes(term));
      const rank = Number(titleMatch(b)) - Number(titleMatch(a));
      if (rank) return rank;
    }
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
  return result;
}

function filterValues() {
  return [$('meal').value !== 'All' ? $('meal').value : '', $('category').value, $('collection').value].filter(Boolean);
}

function render() {
  if (!ready) return;
  const result = filtered(), visible = result.slice(0, shown), filters = filterValues();
  $('results').textContent = `${result.length} ${favoritesOnly ? 'favorite ' : ''}${result.length === 1 ? 'recipe' : 'recipes'}${result.length > shown ? ` · showing ${visible.length}` : ''}`;
  $('clear').hidden = !$('search').value;
  $('reset').hidden = !filters.length && !$('search').value;
  $('filterCount').hidden = !filters.length;
  $('filterCount').textContent = filters.length;
  $('activeFilters').innerHTML = filters.map(value => `<span>${escapeHTML(value)}</span>`).join('');
  $('allTab').classList.toggle('selected', !favoritesOnly);
  $('allTab').setAttribute('aria-pressed', String(!favoritesOnly));
  $('favoritesTab').classList.toggle('selected', favoritesOnly);
  $('favoritesTab').setAttribute('aria-pressed', String(favoritesOnly));
  $('list').innerHTML = visible.map(recipe => {
    const value = effective(recipe);
    const tags = [...(value.mealTypes || []), ...(value.category ? [value.category] : []), ...(value.notes ? ['Has notes'] : [])];
    return `<article class="recipe-card"><button class="recipe" data-id="${escapeHTML(recipe.id)}"><strong>${escapeHTML(recipe.name)}</strong><span class="sub">${escapeHTML(recipe.collection)}</span>${tags.length ? `<span class="tags">${tags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}</span>` : ''}</button><button class="star-button" data-favorite="${escapeHTML(recipe.id)}" aria-label="${isFavorite(recipe.id) ? 'Remove' : 'Add'} ${escapeHTML(recipe.name)} ${isFavorite(recipe.id) ? 'from' : 'to'} favorites" aria-pressed="${isFavorite(recipe.id)}">${isFavorite(recipe.id) ? '★' : '☆'}</button></article>`;
  }).join('');
  $('empty').hidden = result.length > 0;
  $('empty').querySelector('h2').textContent = favoritesOnly && !filters.length && !$('search').value ? 'Your favorites go here' : 'No recipes found';
  $('empty').querySelector('p').textContent = favoritesOnly && !filters.length && !$('search').value ? 'Tap the star beside a recipe to keep it handy.' : 'Try a shorter search or remove a filter.';
  $('more').hidden = shown >= result.length;
  $('more').textContent = `Show ${Math.min(PAGE_SIZE, result.length - shown)} more recipes`;
}

function updateFavoriteButton(id) {
  $('favorite').textContent = isFavorite(id) ? '★ Favorited' : '☆ Favorite';
  $('favorite').setAttribute('aria-pressed', String(isFavorite(id)));
}

function toggleFavorite(id) {
  if (!recipes.some(recipe => recipe.id === id)) return;
  const next = { ...overrides, [id]: { ...(overrides[id] || {}), favorite: !isFavorite(id) } };
  if (!persist(next)) return;
  if (selected?.id === id) updateFavoriteButton(id);
  render();
}

function openRecipe(id, changeURL = true) {
  const recipe = recipes.find(value => value.id === id);
  if (!recipe) { toast('That recipe was not found in this collection.'); return; }
  if (selected?.id === id && $('detail').open) return;
  returnFocus = document.activeElement;
  selected = recipe;
  const value = effective(recipe), pages = recipe.sourcePages || {};
  $('detailId').textContent = recipe.id;
  $('detailTitle').textContent = recipe.name;
  $('detailSource').textContent = recipe.collection;
  const readable=renderRecipeCard(id);
  $('readableRecipe').replaceChildren(...(readable?[readable]:[]));
  $('readableRecipe').hidden=!readable;
  $('info').innerHTML = `<b>Publisher:</b> ${escapeHTML(recipe.provider)}<br><b>Year:</b> ${escapeHTML(recipe.sourceYear)}<br><b>Original recipe ID:</b> ${escapeHTML(recipe.originalRecipeId || 'Not provided')}<br><b>Source:</b> ${escapeHTML(recipe.sourceDocument)}<br><b>Pages:</b> ${escapeHTML(pages.start ?? '?')}${pages.end && pages.end !== pages.start ? '–' + escapeHTML(pages.end) : ''}`;
  $('editMeals').innerHTML = meals.map(meal => `<label><input type="checkbox" value="${meal}" ${(value.mealTypes || []).includes(meal) ? 'checked' : ''}>${meal}</label>`).join('');
  $('editCategory').value = value.category || '';
  $('notes').value = value.notes || '';
  $('notesIndicator').textContent = value.notes ? '· Saved notes' : '';
  $('saveStatus').textContent = '';
  for (const section of $('detail').querySelectorAll('details')) section.open = false;
  $('pdf').src = 'about:blank';
  $('preview').hidden = true;
  $('togglePreview').textContent = 'Preview here';
  $('togglePreview').setAttribute('aria-expanded', 'false');
  $('openPdf').href = new URL(recipe.pdfPath, location.href).href;
  updateFavoriteButton(id);
  showDialog($('detail'));
  $('detail').scrollTop = 0;
  $('close').focus({ preventScroll: true });
  if (changeURL) history.pushState(null, '', '#recipe=' + encodeURIComponent(id));
}

function clearRecipe() {
  $('detail').close();
  $('pdf').src = 'about:blank';
  selected = null;
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}

function closeRecipe() {
  clearRecipe();
  history.replaceState(null, '', location.pathname + location.search);
}

function route() {
  const id = new URLSearchParams(location.hash.slice(1)).get('recipe');
  if (id && ready) openRecipe(id, false);
  else if ($('detail').open) clearRecipe();
}

$('list').addEventListener('click', event => {
  const star = event.target.closest('[data-favorite]');
  if (star) { toggleFavorite(star.dataset.favorite); return; }
  const button = event.target.closest('[data-id]');
  if (button) openRecipe(button.dataset.id);
});
$('favorite').onclick = () => { if (selected) toggleFavorite(selected.id); };
$('close').onclick = closeRecipe;
$('detail').addEventListener('cancel', event => { event.preventDefault(); closeRecipe(); });
$('togglePreview').onclick = () => {
  const show = $('preview').hidden;
  $('preview').hidden = !show;
  $('togglePreview').textContent = show ? 'Hide preview' : 'Preview here';
  $('togglePreview').setAttribute('aria-expanded', String(show));
  $('pdf').src = show ? $('openPdf').href : 'about:blank';
};
$('save').onclick = () => {
  if (!selected) return;
  const next = { ...overrides, [selected.id]: {
    ...(overrides[selected.id] || {}),
    mealTypes: [...$('editMeals').querySelectorAll('input:checked')].map(input => input.value),
    category: $('editCategory').value || null,
    notes: $('notes').value
  } };
  if (persist(next)) {
    $('saveStatus').textContent = 'Saved on this device.';
    $('notesIndicator').textContent = $('notes').value ? '· Saved notes' : '';
    render();
  }
};

$('search').addEventListener('input', () => { shown = PAGE_SIZE; render(); });
$('clear').onclick = () => { $('search').value = ''; shown = PAGE_SIZE; render(); $('search').focus(); };
function resetFilters() {
  $('meal').value = 'All';
  $('category').value = '';
  $('collection').value = '';
  $('sort').value = 'name';
  shown = PAGE_SIZE;
  render();
}
$('resetFilters').onclick = resetFilters;
$('reset').onclick = () => { $('search').value = ''; resetFilters(); };
$('resetEmpty').onclick = () => { favoritesOnly = false; $('search').value = ''; resetFilters(); };
$('allTab').onclick = () => { favoritesOnly = false; shown = PAGE_SIZE; render(); };
$('favoritesTab').onclick = () => { favoritesOnly = true; shown = PAGE_SIZE; render(); };
$('more').onclick = () => { shown += PAGE_SIZE; render(); };
$('filtersButton').onclick = () => {
  $('applyFilters').textContent = ready ? `Show ${filtered().length} recipes` : 'Show recipes';
  showDialog($('filtersDialog'));
};
$('closeFilters').onclick = () => $('filtersDialog').close();
$('applyFilters').onclick = () => { shown = PAGE_SIZE; render(); $('filtersDialog').close(); };
for (const id of ['meal', 'category', 'collection', 'sort']) {
  $(id).addEventListener('change', () => {
    if (ready) {
      shown = PAGE_SIZE;
      render();
      $('applyFilters').textContent = `Show ${filtered().length} recipes`;
    }
  });
}
$('settingsButton').onclick = () => showDialog($('settingsDialog'));
$('closeSettings').onclick = () => $('settingsDialog').close();

$('export').onclick = () => {
  const payload = { format: 'kitchen-day-recipe-classifications', version: 1, exportedAt: new Date().toISOString(), overrides };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'kitchen-recipe-library-backup.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('backupStatus').textContent = 'Backup download requested. Keep the file somewhere safe.';
};
$('import').onchange = async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload.format !== 'kitchen-day-recipe-classifications' || payload.version !== 1 || !payload.overrides || typeof payload.overrides !== 'object' || Array.isArray(payload.overrides)) throw Error('This is not a recipe library backup.');
    const valid = new Set(recipes.map(recipe => recipe.id)), next = { ...overrides };
    let count = 0;
    for (const [id, value] of Object.entries(payload.overrides)) {
      if (valid.has(id) && value && typeof value === 'object' && !Array.isArray(value)) {
        next[id] = { ...(next[id] || {}), ...sanitize(value) };
        count++;
      }
    }
    if (persist(next)) {
      render();
      $('backupStatus').textContent = `Imported saved entries for ${count} recipes.`;
    }
  } catch (error) { $('backupStatus').textContent = 'Import failed: ' + error.message; }
  event.target.value = '';
};

window.addEventListener('hashchange', route);
fetch('recipes.json').then(response => {
  if (!response.ok) throw Error('HTTP ' + response.status);
  return response.json();
}).then(data => {
  if (!Array.isArray(data)) throw Error('Invalid recipe database');
  recipes = data.map(recipe => ({ ...recipe, _search: normalize([recipe.name, recipe.id, recipe.originalRecipeId, recipe.collection, recipe.provider, recipe.sourceYear, recipe.searchText].join(' ')) }));
  ready = true;
  populate();
  render();
  route();
}).catch(() => {
  $('results').textContent = 'Could not load recipes. Check your connection and reload this page.';
  $('total').textContent = 'Unavailable';
});

const sampleLinks=document.createElement('div');sampleLinks.className='readable-samples';
const sampleTitle=document.createElement('summary');sampleTitle.textContent='Try 6 readable recipes · Preview 0.1';
const samplePanel=document.createElement('details');samplePanel.className='readable-sample-panel';samplePanel.append(sampleTitle,sampleLinks);
for(const recipe of Object.values(recipeCards)){const button=document.createElement('button');button.type='button';button.textContent=recipe.name+' · '+recipe.collection;button.onclick=()=>openRecipe(recipe.id);sampleLinks.append(button);}
document.querySelector('main').prepend(samplePanel);
