// A menu label has one remembered recipe, reused wherever that label appears.
export function menuItemKey(label) {
  return String(label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function validRecipeLinks(links) {
  if (links === undefined) return true; // Backups from before recipe linking.
  if (!links || typeof links !== 'object' || Array.isArray(links)) return false;
  const entries = Object.entries(links);
  return entries.length <= 10000 && entries.every(([key, value]) =>
    key.length > 0 && key.length <= 500 && key === menuItemKey(key) &&
    value && typeof value === 'object' && !Array.isArray(value) &&
    typeof value.recipeId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(value.recipeId) &&
    typeof value.recipeName === 'string' && value.recipeName.trim().length > 0 && value.recipeName.length <= 500
  );
}

export function linkedRecipe(state, label) {
  const key = menuItemKey(label);
  return Object.hasOwn(state.recipeLinks || {}, key) ? state.recipeLinks[key] : null;
}

export function setRecipeLink(state, label, recipe) {
  const key = menuItemKey(label);
  if (!key) throw Error('Enter a menu item name.');
  const link = { recipeId: recipe?.id, recipeName: recipe?.name };
  if (!validRecipeLinks({ [key]: link })) throw Error('Choose a valid recipe.');
  state.recipeLinks = { ...(state.recipeLinks || {}), [key]: link };
}

export function removeRecipeLink(state, label) {
  state.recipeLinks = { ...(state.recipeLinks || {}) };
  delete state.recipeLinks[menuItemKey(label)];
}

export function recipeHref(id) {
  return 'recipes/#recipe=' + encodeURIComponent(id);
}

const words = value => menuItemKey(value).split(' ').filter(Boolean);
export function searchRecipes(recipes, query) {
  const terms = words(query);
  return recipes.filter(recipe => {
    const text = recipe._search ?? menuItemKey([recipe.name, recipe.id, recipe.originalRecipeId, recipe.searchText].join(' '));
    return terms.every(term => text.includes(term));
  }).sort((a, b) => {
    const score = recipe => {
      const name = menuItemKey(recipe.name);
      return (name === menuItemKey(query) ? 100 : 0) + terms.filter(term => name.includes(term)).length;
    };
    return score(b) - score(a) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}
