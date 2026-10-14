import { linkedRecipe, menuItemKey, recipeHref, removeRecipeLink, searchRecipes, setRecipeLink } from './recipe-links.mjs?v=1.7.0';

export function createRecipeLinker({ getState, change }) {
  const $ = id => document.getElementById(id);
  let catalog = null, loading = null, menuLabel = '', picked = null, request = 0;
  let shown = 30, saving = false, returnFocus = null;

  function recipeAnchor(id, label) {
    const anchor = document.createElement('a');
    anchor.href = recipeHref(id);
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.textContent = label;
    return anchor;
  }

  async function loadCatalog() {
    if (catalog) return catalog;
    if (!loading) loading = fetch('./recipes/recipes.json').then(response => {
      if (!response.ok) throw Error('Could not load recipe library.');
      return response.json();
    }).then(data => {
      if (!Array.isArray(data)) throw Error('Invalid recipe library.');
      catalog = data.filter(recipe => recipe && typeof recipe.id === 'string' && typeof recipe.name === 'string')
        .map(recipe => ({ ...recipe, _search: menuItemKey([recipe.name, recipe.id, recipe.originalRecipeId, recipe.searchText].join(' ')) }));
      return catalog;
    }).finally(() => { loading = null; });
    return loading;
  }

  function renderSelection() {
    const panel = $('recipeChoice');
    panel.replaceChildren();
    if (picked) {
      const title = document.createElement('strong');
      title.textContent = picked.name;
      const source = document.createElement('small');
      source.textContent = `${picked.collection || ''} · ${picked.id}`;
      panel.append(title, source, recipeAnchor(picked.id, 'View recipe before linking ↗'));
    } else panel.textContent = 'Choose a recipe from the results below.';
    $('saveRecipeLink').disabled = !picked || saving;
    $('saveRecipeLink').textContent = saving ? 'Saving…' : 'Link recipe';
  }

  function renderResults() {
    const list = $('recipeMatches');
    list.replaceChildren();
    if (!catalog) return;
    const result = searchRecipes(catalog, $('recipeSearch').value);
    $('recipeSearchStatus').textContent = result.length
      ? `${result.length} recipes found${result.length > shown ? ` · showing ${shown}` : ''}. Select one to link.`
      : 'No matches. Try a shorter name, an ingredient, or a recipe ID.';
    for (const recipe of result.slice(0, shown)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'recipe-match';
      button.setAttribute('aria-pressed', String(picked?.id === recipe.id));
      const title = document.createElement('strong');
      title.textContent = recipe.name;
      const source = document.createElement('small');
      source.textContent = `${recipe.collection || ''} · ${recipe.id}`;
      button.append(title, source);
      button.onclick = () => {
        if (saving) return;
        picked = recipe;
        renderSelection();
        // Keep the results in place so keyboard focus and scroll do not jump.
        for (const other of list.children) other.setAttribute('aria-pressed', String(other === button));
      };
      list.append(button);
    }
    $('moreRecipeMatches').hidden = result.length <= shown;
  }

  async function openPicker(label) {
    menuLabel = label;
    returnFocus = document.activeElement;
    const current = linkedRecipe(getState(), label);
    const token = ++request;
    picked = current ? { id: current.recipeId, name: current.recipeName } : null;
    shown = 30;
    $('recipeMenuLabel').textContent = label;
    $('recipeSearch').value = label;
    $('recipePickerStatus').textContent = '';
    $('unlinkRecipe').hidden = !current;
    $('recipeSearchStatus').textContent = 'Loading recipe library…';
    $('recipeMatches').replaceChildren();
    $('moreRecipeMatches').hidden = true;
    $('retryRecipes').hidden = true;
    renderSelection();
    $('recipePicker').showModal();
    $('recipePicker').scrollTop = 0;
    $('closeRecipePicker').focus({ preventScroll: true });
    try {
      await loadCatalog();
      if (token !== request || !$('recipePicker').open) return;
      if (current) picked = catalog.find(recipe => recipe.id === current.recipeId) || null;
      renderSelection();
      renderResults();
    } catch {
      if (token !== request) return;
      $('recipeSearchStatus').textContent = 'The recipe library could not be loaded. Connect to the internet and retry.';
      $('retryRecipes').hidden = false;
      picked = null;
      renderSelection();
    }
  }

  function closePicker() {
    if (saving) return;
    request++;
    $('recipePicker').close();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }

  function renderItem(label) {
    const li = document.createElement('li');
    li.className = 'menu-recipe-item';
    const current = linkedRecipe(getState(), label);
    if (current) {
      const anchor = recipeAnchor(current.recipeId, label + ' ↗');
      anchor.className = 'menu-recipe-link';
      anchor.setAttribute('aria-label', `${label}: open ${current.recipeName} in a new tab`);
      const edit = document.createElement('button');
      edit.className = 'menu-change-link';
      edit.textContent = 'Change';
      edit.setAttribute('aria-label', `Change recipe linked to ${label}`);
      edit.onclick = () => openPicker(label);
      li.append(anchor, edit);
    } else {
      const button = document.createElement('button');
      button.className = 'menu-link-food';
      button.textContent = label;
      button.setAttribute('aria-label', `Link a recipe to ${label}`);
      button.onclick = () => openPicker(label);
      li.append(button);
    }
    return li;
  }

  $('closeRecipePicker').onclick = closePicker;
  $('recipePicker').addEventListener('cancel', event => { event.preventDefault(); closePicker(); });
  $('recipeSearch').oninput = () => { shown = 30; renderResults(); };
  $('clearRecipeSearch').onclick = () => { $('recipeSearch').value = ''; shown = 30; renderResults(); $('recipeSearch').focus(); };
  $('moreRecipeMatches').onclick = () => { shown += 30; renderResults(); };
  $('retryRecipes').onclick = async () => {
    $('retryRecipes').hidden = true;
    $('recipeSearchStatus').textContent = 'Loading recipe library…';
    const token = request;
    try { await loadCatalog(); if (token === request && $('recipePicker').open) renderResults(); }
    catch { $('recipeSearchStatus').textContent = 'Still unable to load recipes. Check your connection and retry.'; $('retryRecipes').hidden = false; }
  };

  async function saveLink(remove = false) {
    if (saving || (!remove && !picked)) return;
    const label = menuLabel, recipe = picked;
    saving = true;
    $('unlinkRecipe').disabled = true;
    renderSelection();
    const success = await change(state => {
      if (remove) removeRecipeLink(state, label);
      else setRecipeLink(state, label, recipe);
    });
    saving = false;
    $('unlinkRecipe').disabled = false;
    renderSelection();
    if (success) closePicker();
    else $('recipePickerStatus').textContent = 'Could not save this link. Try again after the current save finishes, or check device storage.';
  }
  $('saveRecipeLink').onclick = () => saveLink();
  $('unlinkRecipe').onclick = () => saveLink(true);
  return { renderItem };
}
