import { linkedRecipe, menuItemKey, recipeHref, removeRecipeLink, searchRecipes, setRecipeLink } from './recipe-links.mjs?v=1.7.0';

export function createRecipeLinker({ getState, change }) {
  const $ = id => document.getElementById(id);
  let catalog = null, loading = null, menuLabel = '', picked = null, request = 0;
  let shown = 30, saving = false, returnFocus = null;

  // Older cached planner pages do not contain the preview dialog yet.
  // Create it before binding handlers so an update cannot stop startup.
  if (!$('menuRecipePreview')) {
    const dialog = document.createElement('dialog');
    dialog.id = 'menuRecipePreview';
    dialog.setAttribute('aria-labelledby', 'menuRecipePreviewTitle');
    dialog.innerHTML = `<div class="menu-preview-layout">
      <div class="menu-preview-header"><h2 id="menuRecipePreviewTitle">Recipe preview</h2><button id="closeMenuRecipePreview">Close ×</button></div>
      <p id="menuRecipePreviewStatus" role="status"></p>
      <iframe id="menuRecipeFrame" title="Recipe PDF preview" hidden></iframe>
      <div class="menu-preview-footer"><span>PDFs need an internet connection.</span><a id="menuRecipeFallback" target="_blank" rel="noopener" hidden>Open PDF separately ↗</a></div>
    </div>`;
    document.body.append(dialog);
  }
  let previewRequest = 0, previewFocus = null;

  function recipeAnchor(id, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recipe-preview-button';
    button.textContent = label;
    button.onclick = () => openPreview(id);
    return button;
  }

  async function openPreview(id) {
    const token = ++previewRequest;
    previewFocus = document.activeElement;
    const dialog = $('menuRecipePreview');
    $('menuRecipePreviewTitle').textContent = 'Recipe preview';
    $('menuRecipePreviewStatus').textContent = 'Loading recipe…';
    $('menuRecipeFrame').hidden = true;
    $('menuRecipeFrame').src = 'about:blank';
    $('menuRecipeFallback').hidden = true;
    if (!dialog.open) dialog.showModal();
    $('closeMenuRecipePreview').focus({ preventScroll: true });
    try {
      const recipes = await loadCatalog();
      if (token !== previewRequest || !dialog.open) return;
      const recipe = recipes.find(value => value.id === id);
      if (!recipe) throw Error('This recipe is no longer in the library. Change the menu link to choose another.');
      const url = new URL('recipes/' + recipe.pdfPath, location.href);
      if (url.origin !== location.origin || !url.pathname.endsWith('.pdf')) throw Error('This recipe does not have a valid PDF.');
      $('menuRecipePreviewTitle').textContent = recipe.name;
      $('menuRecipePreviewStatus').textContent = 'Tap outside this window or use Close to return.';
      $('menuRecipeFallback').href = url.href;
      $('menuRecipeFallback').hidden = false;
      $('menuRecipeFrame').hidden = false;
      $('menuRecipeFrame').src = url.href;
    } catch (error) {
      if (token === previewRequest && dialog.open) $('menuRecipePreviewStatus').textContent = error.message || 'Unable to load this recipe. Check your internet connection and try again.';
    }
  }

  function closePreview() {
    previewRequest++;
    $('menuRecipePreview').close();
    $('menuRecipeFrame').src = 'about:blank';
    $('menuRecipeFrame').hidden = true;
    if (previewFocus?.isConnected) previewFocus.focus({ preventScroll: true });
  }

  $('closeMenuRecipePreview').onclick = closePreview;
  $('menuRecipePreview').addEventListener('cancel', event => { event.preventDefault(); closePreview(); });
  // The dialog itself also receives backdrop clicks. Check its rectangle so
  // clicks on whitespace inside the preview do not accidentally dismiss it.
  const outside = event => {
    const rect = $('menuRecipePreview').getBoundingClientRect();
    return event.target === $('menuRecipePreview') &&
      (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
  };
  let pressedOutside = false;
  $('menuRecipePreview').addEventListener('pointerdown', event => { pressedOutside = outside(event); });
  $('menuRecipePreview').addEventListener('click', event => {
    if (pressedOutside && outside(event)) closePreview();
    pressedOutside = false;
  });

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
      panel.append(title, source, recipeAnchor(picked.id, 'Preview recipe'));
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
      const anchor = recipeAnchor(current.recipeId, label + ' ▣');
      anchor.className = 'menu-recipe-link';
      anchor.setAttribute('aria-label', `${label}: open ${current.recipeName} in a preview`);
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
