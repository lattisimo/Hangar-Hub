// Global State
let itemsDb = [];
let selectedCraftItem = null;
let expandedNodes = new Set();
let strategySearchQuery = "";
let dbSearchQuery = "";

// Known Quest / Hideout Upgrade Items (Critical in Early Game)
const CRITICAL_UPGRADE_ITEMS = new Set([
  // Workshop Upgrades
  'rusted_tools',
  'rusted_gear',
  'sentinel_firing_core',
  'wasp_driver',
  'hornet_driver',
  'rocketeer_driver',
  'power_cable',
  'industrial_battery',
  'bastion_cell',
  'cracked_bioscanner',
  'durable_cloth',
  'rusted_shut_medical_kit',
  'antiseptic',
  'surveyor_vault',
  'damaged_heat_sink',
  'snitch_scanner',
  'fried_motherboard',
  'leaper_pulse_unit',
  'synthesized_fuel',
  'pop_trigger',
  'laboratory_reagents',
  'crude_explosives',
  'explosive_compound',
  // Expedition Projects
  'wires',
  'battery',
  'cooling_fan',
  'cooling_coil',
  'light_bulb',
  'shredder_gyro',
  'exodus_modules',
  'humidifier',
  // Other upgrades / Quest items
  'dog_collar',
  'cat_bed',
  'apricot',
  'mushroom',
  'water_filter',
  'microscope',
  'assessor_matrix'
]);

// Helper classification functions
function isWeaponItem(item) {
  return item.isWeapon === true || [
    'Pistol', 'SMG', 'LMG', 'Assault Rifle', 'Sniper Rifle', 'Shotgun', 'Hand Cannon', 'Battle Rifle', 'Special'
  ].includes(item.type);
}

function isGadgetItem(item) {
  return ['Shield', 'Augment'].includes(item.type);
}

function matchesVirtualKeywords(item, query) {
  if (!query) return false;
  
  // 1. Healing & Medical
  if (['heal', 'heals', 'healing', 'meds', 'medical'].includes(query)) {
    return [
      'adrenaline_shot', 'bandage', 'defibrillator', 'herbal_bandage', 'sterilized_bandage', 'vita_shot', 'vita_spray'
    ].includes(item.id);
  }
  
  // 2. Weapon Modifications
  if (['mod', 'mods', 'attachment', 'attachments'].includes(query)) {
    return item.type === 'Modification';
  }
  
  // 3. Loot, Trash & Scrap
  if (['scrap', 'junk', 'loot', 'trash'].includes(query)) {
    return item.type === 'Recyclable' || item.type === 'Trinket';
  }
  
  // 4. Keys & Access Cards
  if (['card', 'cards', 'pass', 'passes', 'security'].includes(query)) {
    return item.type === 'Key';
  }
  
  // 5. Shield & Augments (Gadgets)
  if (['gadget', 'gadgets', 'gear'].includes(query)) {
    return ['Shield', 'Augment'].includes(item.type);
  }
  
  // 6. Weapons/Guns
  if (['weapon', 'weapons', 'gun', 'guns'].includes(query)) {
    return isWeaponItem(item);
  }
  
  // 7. Traps & Mines
  if (['trap', 'traps', 'mine', 'mines'].includes(query)) {
    return [
      'blaze_grenade_trap', 'deadline', 'door_blocker', 'explosive_mine', 'gas_grenade_trap', 'gas_mine', 'jolt_mine', 'lure_grenade_trap', 'pulse_mine', 'smoke_grenade_trap'
    ].includes(item.id);
  }
  
  return false;
}

// Get effective recipe (including upgrades)
function getItemRecipe(item) {
  if (!item) return null;
  if (item.recipe && Object.keys(item.recipe).length > 0) {
    return item.recipe;
  }
  if (item.upgradeCost && Object.keys(item.upgradeCost).length > 0) {
    const predecessor = itemsDb.find(i => i.upgradesTo === item.id);
    const recipe = { ...item.upgradeCost };
    if (predecessor) {
      recipe[predecessor.id] = 1;
    }
    return recipe;
  }
  return null;
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  try {
    if (typeof itemsData === "undefined") {
      throw new Error("itemsData is undefined. Ensure items.js is loaded successfully.");
    }
    itemsDb = itemsData;
    initApp();
  } catch (error) {
    console.error("Initialization error:", error);
    document.getElementById('items-grid').innerHTML = `
      <div class="no-results" style="grid-column: 1/-1;">
        <i class="fa-solid fa-circle-exclamation" style="color: #ef4444;"></i>
        <h3>Database Load Error</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
});

window.filterCraftingOptions = function() {
  const query = (document.getElementById('crafting-search-filter')?.value || "").toLowerCase();
  const listContainer = document.getElementById('crafting-select-list');
  if (!listContainer) return;
  
  listContainer.innerHTML = '';
  
  const craftableItems = itemsDb.filter(item => {
    const recipe = getItemRecipe(item);
    return recipe && Object.keys(recipe).length > 0;
  });
  
  const filtered = craftableItems.filter(item => {
    const name = (item.name?.en || item.id).toLowerCase();
    const type = (item.type || "").toLowerCase();
    return name.includes(query) || type.includes(query) || matchesVirtualKeywords(item, query);
  });
  
  if (filtered.length === 0) {
    const noResults = document.createElement('div');
    noResults.style.color = 'var(--text-muted)';
    noResults.style.textAlign = 'center';
    noResults.style.padding = '1.5rem 0.5rem';
    noResults.style.fontSize = '0.85rem';
    noResults.textContent = 'No matching blueprints';
    listContainer.appendChild(noResults);
    return;
  }
  
  filtered
    .sort((a, b) => (a.name.en || a.id).localeCompare(b.name.en || b.id))
    .forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'crafting-list-item';
      if (selectedCraftItem && selectedCraftItem.id === item.id) {
        itemEl.classList.add('selected');
      }
      
      const rarityColor = `var(--rarity-${item.rarity.toLowerCase()})`;
      
      itemEl.innerHTML = `
        <span class="item-name">${item.name.en || item.id}</span>
        <span class="item-rarity-badge" style="color: ${rarityColor}">${item.rarity}</span>
      `;
      
      itemEl.onclick = () => {
        const currentSelected = listContainer.querySelector('.crafting-list-item.selected');
        if (currentSelected) {
          currentSelected.classList.remove('selected');
        }
        itemEl.classList.add('selected');
        onSelectCraftItem(item.id);
      };
      
      listContainer.appendChild(itemEl);
    });
};

function initApp() {
  // Update overall stats
  document.getElementById('stat-total-items').textContent = itemsDb.length;
  
  const craftableItems = itemsDb.filter(item => {
    const recipe = getItemRecipe(item);
    return recipe && Object.keys(recipe).length > 0;
  });
  document.getElementById('stat-craftable-items').textContent = craftableItems.length;
  
  const recyclables = itemsDb.filter(item => item.type === 'Recyclable' || item.type === 'Trinket');
  document.getElementById('stat-recyclable-items').textContent = recyclables.length;

  // Populate blueprint selector in Crafting Tab
  filterCraftingOptions();

  // Populate weapon selects in Backpack Tab
  const primarySelect = document.getElementById('primary-weapon-select');
  const secondarySelect = document.getElementById('secondary-weapon-select');
  if (primarySelect && secondarySelect) {
    primarySelect.innerHTML = '<option value="0">-- None / Unequipped (0.00 kg) --</option>';
    secondarySelect.innerHTML = '<option value="0">-- None / Unequipped (0.00 kg) --</option>';
    
    // Group weapons by base name
    const weaponFamilies = {};
    const weapons = itemsDb.filter(isWeaponItem);
    
    weapons.forEach(w => {
      const name = w.name.en || w.id;
      const baseName = name.replace(/\s+(IV|III|II|I|V|VI)$/i, '').trim();
      
      // If we haven't seen this family, or if this is the Tier I version, store it
      if (!weaponFamilies[baseName] || name.endsWith(' I')) {
        weaponFamilies[baseName] = w;
      }
    });

    const uniqueWeapons = Object.values(weaponFamilies)
      .sort((a, b) => {
        const nameA = (a.name.en || a.id).replace(/\s+(IV|III|II|I|V|VI)$/i, '').trim();
        const nameB = (b.name.en || b.id).replace(/\s+(IV|III|II|I|V|VI)$/i, '').trim();
        return nameA.localeCompare(nameB);
      });
      
    uniqueWeapons.forEach(w => {
      const baseName = (w.name.en || w.id).replace(/\s+(IV|III|II|I|V|VI)$/i, '').trim();
      const opt1 = document.createElement('option');
      opt1.value = w.id;
      opt1.textContent = `${baseName} (${(w.weightKg || 0).toFixed(2)} kg)`;
      
      const opt2 = opt1.cloneNode(true);
      primarySelect.appendChild(opt1);
      secondarySelect.appendChild(opt2);
    });
  }

  // Render initial items grid
  filterItems();
  
  // Render strategy tab contents
  runStrategyAudit();

  // Render initial backpack contents
  initBackpackStrategist();

  // Render initial skill planner contents
  initSkillPlanner();
}

// Tab Switching Logic
window.switchTab = function(tabId, btn) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Deactivate all tab buttons
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
  });

  // Show selected tab content and active button
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');

  // Trigger appropriate actions based on tab
  if (tabId === 'strategy-tab') {
    runStrategyAudit();
  } else if (tabId === 'backpack-tab') {
    initBackpackStrategist();
  } else if (tabId === 'skills-tab') {
    initSkillPlanner();
  }
};

// Database Tab - Search and Filters
window.filterItems = function() {
  const searchVal = document.getElementById('search-box').value.toLowerCase();
  const typeFilter = document.getElementById('type-filter').value;
  const rarityFilter = document.getElementById('rarity-filter').value;
  const craftableFilter = document.getElementById('craftable-filter').value;

  const filtered = itemsDb.filter(item => {
    // Search match
    const nameEn = (item.name?.en || "").toLowerCase();
    const descEn = (item.description?.en || "").toLowerCase();
    const id = item.id.toLowerCase();
    
    const matchesSearch = nameEn.includes(searchVal) || descEn.includes(searchVal) || id.includes(searchVal) || matchesVirtualKeywords(item, searchVal);

    // Category match
    let matchesType = false;
    if (typeFilter === 'all') {
      matchesType = true;
    } else if (typeFilter === 'Weapon') {
      matchesType = isWeaponItem(item);
    } else if (typeFilter === 'Gadget') {
      matchesType = isGadgetItem(item);
    } else if (typeFilter === 'Recyclable') {
      matchesType = ['Recyclable', 'Trinket'].includes(item.type);
    } else if (typeFilter === 'Basic Material') {
      matchesType = ['Basic Material', 'Nature'].includes(item.type);
    } else {
      matchesType = (item.type === typeFilter);
    }

    // Rarity match
    const matchesRarity = (rarityFilter === 'all') || (item.rarity === rarityFilter);

    // Craftability match
    const isCraftable = getItemRecipe(item) !== null;
    const matchesCraft = (craftableFilter === 'all') || 
                         (craftableFilter === 'yes' && isCraftable) || 
                         (craftableFilter === 'no' && !isCraftable);

    return matchesSearch && matchesType && matchesRarity && matchesCraft;
  });

  renderItemsGrid(filtered);
};

function renderItemsGrid(items) {
  const grid = document.getElementById('items-grid');
  grid.innerHTML = '';

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="no-results">
        <i class="fa-solid fa-hourglass-empty"></i>
        <h3>No Items Found</h3>
        <p>Try adjusting your search query or filters.</p>
      </div>
    `;
    return;
  }

  items.forEach(item => {
    const isCraftable = getItemRecipe(item) !== null;
    const card = document.createElement('div');
    card.className = `item-card ${item.rarity.toLowerCase()}`;
    card.onclick = () => openDetailDrawer(item.id);

    const imgUrl = item.icon || item.imageFilename || '';

    card.innerHTML = `
      ${isCraftable ? '<div class="craftable-indicator" title="Craftable Item"></div>' : ''}
      <div class="card-header">
        <span class="rarity-badge">${item.rarity}</span>
        <span class="card-item-type" style="font-size: 0.7rem; color: var(--text-secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.type || 'Unknown'}</span>
      </div>
      <div class="card-image-wrapper">
        <img class="card-icon" src="${imgUrl}" alt="${item.name.en || item.id}" onerror="this.src='https://placehold.co/100x100/101624/66FCF1?text=?';">
      </div>
      <div class="card-info">
        <h3 class="item-name" title="${item.name.en || item.id}">${item.name.en || item.id}</h3>
        <div class="card-stats">
          <div>Val: <span class="stat-value">${item.value || 0}c</span></div>
          <div>Wt: <span class="stat-value">${item.weightKg || '0.00'}kg</span></div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Detail Drawer Logic
window.openDetailDrawer = function(itemId) {
  const item = itemsDb.find(i => i.id === itemId);
  if (!item) return;

  const drawer = document.getElementById('detail-drawer');
  const backdrop = document.getElementById('drawer-backdrop');

  // Fill details
  document.getElementById('detail-item-name').textContent = item.name.en || item.id;
  document.getElementById('detail-item-type').textContent = item.type || 'Unknown Type';
  document.getElementById('detail-rarity').textContent = item.rarity;
  document.getElementById('detail-rarity').className = `rarity-badge`; // Reset class
  document.getElementById('detail-rarity').style.backgroundColor = `var(--rarity-${item.rarity.toLowerCase()})`;
  document.getElementById('detail-rarity').style.color = '#fff';
  
  // Display Large Image
  const imgContainer = document.getElementById('detail-image-container');
  const imgEl = document.getElementById('detail-image');
  const imgUrl = item.icon || item.imageFilename || '';
  if (imgUrl) {
    imgContainer.style.display = 'flex';
    imgEl.src = imgUrl;
    imgEl.alt = item.name.en || item.id;
  } else {
    imgContainer.style.display = 'none';
  }

  document.getElementById('detail-desc').textContent = item.description?.en || 'No description available for this item.';
  document.getElementById('detail-val').textContent = `${item.value || 0} c`;
  document.getElementById('detail-weight').textContent = `${item.weightKg || 0} kg`;
  document.getElementById('detail-stack').textContent = item.stackSize || 1;
  document.getElementById('detail-added').textContent = item.addedIn || 'Base';

  // Recipe Section
  const recipeSection = document.getElementById('detail-crafting-section');
  const recipeList = document.getElementById('detail-recipe-list');
  const resolveBtn = document.getElementById('resolve-tree-btn');
  
  const recipe = getItemRecipe(item);
  const isCraftable = recipe !== null;
  if (isCraftable) {
    recipeSection.style.display = 'block';
    recipeList.innerHTML = '';
    
    Object.entries(recipe).forEach(([ingId, qty]) => {
      const ingItem = itemsDb.find(i => i.id === ingId);
      const row = document.createElement('div');
      row.className = 'material-item';
      row.style.cursor = 'pointer';
      row.onclick = (e) => {
        e.stopPropagation();
        openDetailDrawer(ingId);
      };
      
      const ingIcon = ingItem ? (ingItem.icon || ingItem.imageFilename || '') : '';
      
      row.innerHTML = `
        <div class="material-name-wrapper">
          ${ingIcon ? `<img class="material-icon" src="${ingIcon}" alt="" onerror="this.style.display='none';">` : `<div class="material-color-indicator" style="background-color: var(--rarity-${ingItem ? ingItem.rarity.toLowerCase() : 'common'})"></div>`}
          <span>${ingItem ? ingItem.name.en : ingId}</span>
        </div>
        <span class="qty-val">x${qty}</span>
      `;
      recipeList.appendChild(row);
    });

    resolveBtn.onclick = () => {
      closeDetailDrawer();
      switchTab('crafting-tab', document.querySelector(".tab-btn[onclick*='crafting-tab']"));
      
      const searchFilterInput = document.getElementById('crafting-search-filter');
      if (searchFilterInput) {
        searchFilterInput.value = '';
      }
      
      onSelectCraftItem(item.id);
      filterCraftingOptions();
      
      setTimeout(() => {
        const listContainer = document.getElementById('crafting-select-list');
        const selectedEl = listContainer?.querySelector('.crafting-list-item.selected');
        if (selectedEl) {
          selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 50);
    };
  } else {
    recipeSection.style.display = 'none';
  }

  // Recycle Section
  const recycleSection = document.getElementById('detail-recycle-section');
  const recycleList = document.getElementById('detail-recycle-list');
  
  const hasRecycle = item.recyclesInto && Object.keys(item.recyclesInto).length > 0;
  if (hasRecycle) {
    recipeSection.style.display = 'block'; // Make sure container holds if needed, wait, it's recycleSection
    recycleSection.style.display = 'block';
    recycleList.innerHTML = '';
    
    Object.entries(item.recyclesInto).forEach(([yieldId, qty]) => {
      const yieldItem = itemsDb.find(i => i.id === yieldId);
      const row = document.createElement('div');
      row.className = 'material-item';
      row.style.cursor = 'pointer';
      row.onclick = (e) => {
        e.stopPropagation();
        openDetailDrawer(yieldId);
      };
      
      const yieldIcon = yieldItem ? (yieldItem.icon || yieldItem.imageFilename || '') : '';
      
      row.innerHTML = `
        <div class="material-name-wrapper">
          ${yieldIcon ? `<img class="material-icon" src="${yieldIcon}" alt="" onerror="this.style.display='none';">` : `<div class="material-color-indicator" style="background-color: var(--rarity-${yieldItem ? yieldItem.rarity.toLowerCase() : 'common'})"></div>`}
          <span>${yieldItem ? yieldItem.name.en : yieldId}</span>
        </div>
        <span class="qty-val" style="color: #6366F1;">x${qty}</span>
      `;
      recycleList.appendChild(row);
    });
  } else {
    recycleSection.style.display = 'none';
  }

  // Vendors Section
  const vendorSection = document.getElementById('detail-vendor-section');
  const vendorList = document.getElementById('detail-vendor-list');
  const hasVendors = item.vendors && item.vendors.length > 0;
  if (hasVendors) {
    vendorSection.style.display = 'block';
    vendorList.innerHTML = '';
    
    item.vendors.forEach(v => {
      const row = document.createElement('div');
      row.className = 'material-item';
      
      let costText = "";
      if (v.cost.coins) {
        costText = `${v.cost.coins} Coins`;
      } else if (v.cost.creds) {
        costText = `${v.cost.creds} Credits`;
      } else {
        const costItems = Object.entries(v.cost).map(([cId, cQty]) => {
          const costItem = itemsDb.find(i => i.id === cId);
          return `${cQty}x ${costItem ? costItem.name.en : cId}`;
        }).join(', ');
        costText = costItems;
      }
      
      row.innerHTML = `
        <div class="material-name-wrapper">
          <i class="fa-solid fa-user-shield" style="color: var(--accent-color);"></i>
          <span>${v.trader || 'Unknown Merchant'}</span>
        </div>
        <span class="qty-val" style="color:#F59E0B;">${costText}</span>
      `;
      vendorList.appendChild(row);
    });
  } else {
    vendorSection.style.display = 'none';
  }

  // Show drawer
  backdrop.style.display = 'block';
  setTimeout(() => {
    backdrop.style.opacity = '1';
    drawer.classList.add('open');
  }, 10);
};

window.closeDetailDrawer = function() {
  const drawer = document.getElementById('detail-drawer');
  const backdrop = document.getElementById('drawer-backdrop');

  drawer.classList.remove('open');
  backdrop.style.opacity = '0';
  setTimeout(() => {
    backdrop.style.display = 'none';
  }, 300);
};

// Crafting Resolver Tab Logics
window.onSelectCraftItem = function(itemId) {
  if (!itemId) {
    selectedCraftItem = null;
    document.getElementById('recipe-quick-info').style.display = 'none';
    document.getElementById('crafting-tree').innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 2rem;">Select an item from the sidebar to solve its crafting tree.</div>';
    document.getElementById('raw-materials-list').innerHTML = '';
    document.getElementById('base-count').textContent = '0';
    document.getElementById('base-weight').textContent = '0.00 kg';
    return;
  }

  const item = itemsDb.find(i => i.id === itemId);
  selectedCraftItem = item;

  // Update quick info
  document.getElementById('recipe-quick-info').style.display = 'flex';
  document.getElementById('recipe-cat').textContent = item.type;
  document.getElementById('recipe-val').textContent = `${item.value || 0} c`;
  document.getElementById('recipe-weight').textContent = `${item.weightKg || 0} kg`;

  // Render tree & flat materials
  renderCraftingBreakdown();
};

window.adjustQty = function(amount) {
  const input = document.getElementById('craft-qty');
  let val = parseInt(input.value) || 1;
  val = Math.max(1, val + amount);
  input.value = val;
  renderCraftingBreakdown();
};

window.onQtyChange = function(value) {
  let val = parseInt(value) || 1;
  val = Math.max(1, val);
  document.getElementById('craft-qty').value = val;
  renderCraftingBreakdown();
};

function renderCraftingBreakdown() {
  if (!selectedCraftItem) return;
  const qty = parseInt(document.getElementById('craft-qty').value) || 1;

  // 1. Recursive Tree Build
  expandedNodes.clear(); // Expand all by default
  const rootNode = buildCraftingNode(selectedCraftItem.id, qty, 0);

  // 2. Render Tree UI
  const treeContainer = document.getElementById('crafting-tree');
  treeContainer.innerHTML = '';
  renderTreeNodeUI(rootNode, treeContainer);

  // 3. Compute Aggregated Base Materials
  const baseMaterialsMap = {};
  aggregateBaseMaterials(rootNode, baseMaterialsMap);

  // 4. Render Raw Materials Flat List
  const rawList = document.getElementById('raw-materials-list');
  rawList.innerHTML = '';
  
  let uniqueCount = 0;
  let totalWeight = 0;

  Object.entries(baseMaterialsMap).forEach(([mId, mQty]) => {
    uniqueCount++;
    const matItem = itemsDb.find(i => i.id === mId);
    const weight = (matItem ? matItem.weightKg : 0) * mQty;
    totalWeight += weight;

    const row = document.createElement('div');
    row.className = 'material-item';
    row.style.cursor = 'pointer';
    row.onclick = () => openDetailDrawer(mId);

    const matIcon = matItem ? (matItem.icon || matItem.imageFilename || '') : '';

    row.innerHTML = `
      <div class="material-name-wrapper">
        ${matIcon ? `<img class="material-icon" src="${matIcon}" alt="" onerror="this.style.display='none';">` : `<div class="material-color-indicator" style="background-color: var(--rarity-${matItem ? matItem.rarity.toLowerCase() : 'common'})"></div>`}
        <span>${matItem ? matItem.name.en : mId}</span>
      </div>
      <div style="text-align: right;">
        <div class="qty-val">x${mQty}</div>
        <div style="font-size: 0.65rem; color: var(--text-muted); font-family: var(--font-mono);">${weight.toFixed(2)} kg</div>
      </div>
    `;
    rawList.appendChild(row);
  });

  document.getElementById('base-count').textContent = uniqueCount;
  document.getElementById('base-weight').textContent = `${totalWeight.toFixed(2)} kg`;
}

// Tree Node structure generator
function buildCraftingNode(itemId, qty, indentLevel) {
  const item = itemsDb.find(i => i.id === itemId);
  const node = {
    id: itemId,
    name: item ? item.name.en : itemId,
    qty: qty,
    indent: indentLevel,
    rarity: item ? item.rarity : 'Common',
    isCraftable: item && getItemRecipe(item) !== null,
    children: []
  };

  if (node.isCraftable) {
    const recipe = getItemRecipe(item);
    Object.entries(recipe).forEach(([subId, subQty]) => {
      node.children.push(buildCraftingNode(subId, subQty * qty, indentLevel + 1));
    });
  }

  return node;
}

// Recursive rendering of tree rows
function renderTreeNodeUI(node, container) {
  const row = document.createElement('div');
  row.className = 'tree-row highlight';
  row.style.setProperty('--indent', `${node.indent * 1.5}rem`);
  
  const hasChildren = node.children.length > 0;
  const toggleId = `toggle-${node.id}-${node.indent}`;
  
  const item = itemsDb.find(i => i.id === node.id);
  const iconUrl = item ? (item.icon || item.imageFilename || '') : '';

  row.innerHTML = `
    <button class="tree-toggle ${hasChildren ? '' : 'empty'}" id="${toggleId}">
      <i class="fa-solid fa-chevron-down"></i>
    </button>
    ${iconUrl ? `<img class="tree-icon" src="${iconUrl}" alt="" onerror="this.style.display='none';">` : ''}
    <span class="tree-item-name" style="color: var(--rarity-${node.rarity.toLowerCase()});" onclick="openDetailDrawer('${node.id}')">
      ${node.name}
    </span>
    <div class="tree-qty">Required: <span>${node.qty}</span></div>
  `;
  container.appendChild(row);

  if (hasChildren) {
    const childrenContainer = document.createElement('div');
    childrenContainer.style.display = 'block'; // open by default
    container.appendChild(childrenContainer);
    
    const toggleBtn = row.querySelector('.tree-toggle');
    toggleBtn.onclick = () => {
      if (childrenContainer.style.display === 'none') {
        childrenContainer.style.display = 'block';
        toggleBtn.classList.remove('collapsed');
      } else {
        childrenContainer.style.display = 'none';
        toggleBtn.classList.add('collapsed');
      }
    };

    node.children.forEach(child => {
      renderTreeNodeUI(child, childrenContainer);
    });
  }
}

// Aggregation solver (sums leaves recursively)
function aggregateBaseMaterials(node, totalsMap) {
  if (!node.isCraftable) {
    totalsMap[node.id] = (totalsMap[node.id] || 0) + node.qty;
    return;
  }
  node.children.forEach(child => {
    aggregateBaseMaterials(child, totalsMap);
  });
}

// Inventory Strategy Tab Logics
window.runStrategyAudit = function() {
  const stage = document.getElementById('progression-mode').value;
  const tableBody = document.getElementById('strategy-table-body');
  tableBody.innerHTML = '';

  let safeToRecycleCount = 0;
  let highSellCount = 0;

  // Generate strategy for all items
  const auditedItems = itemsDb.map(item => {
    let action = 'KEEP';
    let reason = 'Core material used in crafting multiple items.';
    let score = 'High';
    let scoreClass = 'score-high';
    let badgeClass = 'rec-keep';

    // 1. Calculate recycle value
    let recycleValue = 0;
    if (item.recyclesInto) {
      Object.entries(item.recyclesInto).forEach(([yieldId, qty]) => {
        const yieldItem = itemsDb.find(i => i.id === yieldId);
        recycleValue += (yieldItem ? yieldItem.value : 0) * qty;
      });
    }

    const isCraftable = getItemRecipe(item) !== null;

    // Rules logic
    if (item.type === 'Recyclable' || item.type === 'Trinket') {
      // Junk item
      if (CRITICAL_UPGRADE_ITEMS.has(item.id) && stage === 'early') {
        action = 'KEEP';
        reason = 'Required for hideout upgrades/projects or early-game quests.';
        score = 'High';
        scoreClass = 'score-high';
        badgeClass = 'rec-keep';
      } else if (recycleValue === 0) {
        action = 'SELL';
        reason = `Has no recycling yield. Sell to vendors for maximum credit value (${item.value}c).`;
        score = 'High';
        scoreClass = 'score-high';
        badgeClass = 'rec-sell';
        highSellCount++;
      } else if (item.value > recycleValue * 1.2) {
        action = 'SELL';
        reason = `Selling yields a credit premium (${item.value}c) compared to component value (${recycleValue}c).`;
        score = 'High';
        scoreClass = 'score-high';
        badgeClass = 'rec-sell';
        highSellCount++;
      } else {
        action = 'RECYCLE';
        reason = `Recycling yields high-value components (${recycleValue}c value) relative to sell price (${item.value}c).`;
        score = 'Medium';
        scoreClass = 'score-med';
        badgeClass = 'rec-recycle';
        safeToRecycleCount++;
      }
    } else if (isWeaponItem(item) || isGadgetItem(item) || item.type === 'Armor' || item.type === 'Modification') {
      action = 'KEEP';
      reason = item.type === 'Modification'
        ? 'Functional weapon modification. Keep optimal variations; sell duplicates.'
        : 'Functional loadout equipment. Keep optimal roll, sell duplicates.';
      score = 'High';
      scoreClass = 'score-high';
      badgeClass = 'rec-keep';
    } else if (item.type === 'Basic Material' || item.type === 'Topside Material' || item.type === 'Refined Material' || item.type === 'Nature') {
      action = 'KEEP';
      reason = 'Core crafting component or biological material. Essential for workbench development.';
      score = 'High';
      scoreClass = 'score-high';
      badgeClass = 'rec-keep';
    } else if (item.type === 'Blueprint') {
      action = 'KEEP';
      reason = 'Essential crafting blueprint. Keep to unlock recipe; sell duplicates.';
      score = 'High';
      scoreClass = 'score-high';
      badgeClass = 'rec-keep';
    } else if (item.type === 'Key') {
      action = 'KEEP';
      reason = 'Access key or gate code. Retain to unlock secure areas/vaults during raids.';
      score = 'High';
      scoreClass = 'score-high';
      badgeClass = 'rec-keep';
    } else if (item.type === 'Ammunition' || item.type === 'Quick Use') {
      const isReusable = item.repairCost && Object.keys(item.repairCost).length > 0;
      if (isReusable) {
        const isInstrument = ['acoustic_guitar', 'recorder', 'shaker'].includes(item.id);
        if (isInstrument) {
          action = 'KEEP 1x / SELL';
          reason = `Playable social instrument. Keep 1 copy for hangar fun; otherwise, SELL duplicates/all for a credit payout (${item.value}c).`;
          score = 'Medium';
          scoreClass = 'score-med';
          badgeClass = 'rec-keep-sell';
        } else {
          action = 'KEEP 1x / SELL';
          reason = `Reusable utility/movement gear. KEEP 1 copy for active loadouts; SELL all duplicates for high credits (${item.value}c).`;
          score = 'High';
          scoreClass = 'score-high';
          badgeClass = 'rec-keep-sell';
        }
      } else {
        action = 'KEEP';
        reason = 'Consumable item. Retain for active combat loadouts; sell excess.';
        score = 'Medium';
        scoreClass = 'score-med';
        badgeClass = 'rec-keep';
      }
    } else {
      if (recycleValue === 0) {
        action = 'SELL';
        reason = `Has no recycling yield. Sell to vendors for maximum credit value (${item.value}c).`;
        score = 'Low';
        scoreClass = 'score-low';
        badgeClass = 'rec-sell';
        highSellCount++;
      } else if (item.value > recycleValue * 1.2) {
        action = 'SELL';
        reason = `Selling yields a credit premium (${item.value}c) compared to component value (${recycleValue}c).`;
        score = 'Low';
        scoreClass = 'score-low';
        badgeClass = 'rec-sell';
        highSellCount++;
      } else {
        action = 'RECYCLE';
        reason = 'Common scrap. Break down for component materials.';
        score = 'Low';
        scoreClass = 'score-low';
        badgeClass = 'rec-recycle';
        safeToRecycleCount++;
      }
    }

    return {
      ...item,
      action,
      reason,
      score,
      scoreClass,
      badgeClass,
      recycleValue
    };
  });

  // Save audited items to global state for filtering
  window.auditedItemsDb = auditedItems;

  // Update summary badges
  document.getElementById('count-safe-recycle').textContent = safeToRecycleCount;
  document.getElementById('count-high-sell').textContent = highSellCount;

  // Render Strategy Table
  filterStrategyTable();
};

window.filterStrategyTable = function() {
  const query = document.getElementById('strategy-search').value.toLowerCase();
  const tableBody = document.getElementById('strategy-table-body');
  tableBody.innerHTML = '';

  const filtered = window.auditedItemsDb.filter(item => {
    const name = (item.name.en || item.id).toLowerCase();
    const reason = item.reason.toLowerCase();
    const type = (item.type || "").toLowerCase();
    return name.includes(query) || reason.includes(query) || type.includes(query);
  });

  if (filtered.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No items match search filter.</td>`;
    tableBody.appendChild(row);
    return;
  }

  filtered.forEach(item => {
    const row = document.createElement('tr');
    
    // Build recycle yield string
    let yieldStr = 'None';
    if (item.recyclesInto && Object.keys(item.recyclesInto).length > 0) {
      yieldStr = Object.entries(item.recyclesInto)
        .map(([mId, qty]) => {
          const mItem = itemsDb.find(i => i.id === mId);
          return `${qty}x ${mItem ? mItem.name.en : mId}`;
        })
        .join(', ');
    }

    const itemIcon = item.icon || item.imageFilename || '';

    row.innerHTML = `
      <td style="font-weight: 700; cursor: pointer; color: var(--rarity-${item.rarity.toLowerCase()});" onclick="openDetailDrawer('${item.id}')">
        <div style="display:flex; align-items:center;">
          ${itemIcon ? `<img class="material-icon" src="${itemIcon}" alt="" onerror="this.style.display='none';">` : ''}
          <span>${item.name.en || item.id}</span>
        </div>
      </td>
      <td style="color: var(--text-secondary); font-size: 0.8rem;">${item.type}</td>
      <td style="font-family: var(--font-mono); font-weight: 600;">${item.value || 0}c</td>
      <td style="color: var(--text-secondary); font-size: 0.8rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${yieldStr}">
        ${yieldStr}
      </td>
      <td>
        <span class="rec-badge ${item.badgeClass}">${item.action}</span>
      </td>
      <td style="color: var(--text-secondary); max-width: 400px; line-height: 1.4;">${item.reason}</td>
    `;
    tableBody.appendChild(row);
  });
};

// Backpack Strategist State
let backpackItems = [];
let backpackCategory = 'all';
let weaponRowTiers = {};
let trackedItems = new Set();

window.toggleTrackItem = function(itemId) {
  if (trackedItems.has(itemId)) {
    trackedItems.delete(itemId);
  } else {
    trackedItems.add(itemId);
  }
  filterBackpackTable();
  updateBackpackSimulator();
};

window.setBackpackCategory = function(category) {
  backpackCategory = category;
  document.querySelectorAll('.filter-tab').forEach(btn => {
    if (btn.getAttribute('data-category') === category) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  filterBackpackTable();
};

window.changeWeaponRowTier = function(baseName, index) {
  weaponRowTiers[baseName] = parseInt(index);
  filterBackpackTable();
};

window.initBackpackStrategist = function() {
  filterBackpackTable();
  updateBackpackSimulator();
};

window.filterBackpackTable = function() {
  const query = document.getElementById('backpack-search').value.toLowerCase();
  const tableBody = document.getElementById('backpack-table-body');
  tableBody.innerHTML = '';

  // 1. First pass filter by query and category
  const filtered = itemsDb.filter(item => {
    const name = (item.name.en || item.id).toLowerCase();
    const type = (item.type || "").toLowerCase();
    
    const matchesSearch = name.includes(query) || type.includes(query);
    if (!matchesSearch) return false;
    
    if (backpackCategory === 'all') return true;
    
    const isWeapon = isWeaponItem(item);
    const isMaterial = ['Basic Material', 'Topside Material', 'Refined Material', 'Nature'].includes(item.type);
    const isConsumable = ['Quick Use', 'Key', 'Blueprint'].includes(item.type);
    const isJunk = ['Recyclable', 'Trinket'].includes(item.type);
    const isGadget = ['Armor', 'Modification', 'Shield', 'Augment'].includes(item.type);
    
    if (backpackCategory === 'material') return isMaterial;
    if (backpackCategory === 'consumable') return isConsumable;
    if (backpackCategory === 'junk') return isJunk;
    if (backpackCategory === 'weapon') return isWeapon;
    if (backpackCategory === 'gadget') return isGadget;
    
    return true;
  });

  if (filtered.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No items match search filter.</td>`;
    tableBody.appendChild(row);
    return;
  }

  // 2. Group weapon tiers under family name
  const displayItems = [];
  const weaponGroups = {};

  filtered.forEach(item => {
    if (isWeaponItem(item)) {
      const nameEn = item.name.en || item.id;
      const baseName = nameEn.replace(/\s+(IV|III|II|I|V|VI)$/i, '').trim();
      
      if (!weaponGroups[baseName]) {
        weaponGroups[baseName] = [];
      }
      weaponGroups[baseName].push(item);
    } else {
      displayItems.push({
        isGroup: false,
        item: item
      });
    }
  });

  Object.keys(weaponGroups).forEach(baseName => {
    const list = weaponGroups[baseName];
    list.sort((a, b) => {
      const aName = a.name.en || a.id;
      const bName = b.name.en || b.id;
      return aName.localeCompare(bName);
    });

    let activeIndex = weaponRowTiers[baseName] !== undefined ? weaponRowTiers[baseName] : 0;
    if (query) {
      list.forEach((tier, idx) => {
        const tierName = (tier.name.en || tier.id).toLowerCase();
        if (tierName === query || tierName.includes(query)) {
          activeIndex = idx;
        }
      });
    }
    
    weaponRowTiers[baseName] = activeIndex;

    displayItems.push({
      isGroup: true,
      baseName: baseName,
      tiers: list
    });
  });

  // Sort displayItems alphabetically by name
  displayItems.sort((a, b) => {
    const nameA = a.isGroup ? a.baseName : (a.item.name.en || a.item.id);
    const nameB = b.isGroup ? b.baseName : (b.item.name.en || b.item.id);
    return nameA.localeCompare(nameB);
  });

  // 3. Render items
  displayItems.forEach(dItem => {
    const item = dItem.isGroup ? dItem.tiers[weaponRowTiers[dItem.baseName] || 0] : dItem.item;
    if (!item) return;

    const row = document.createElement('tr');
    const density = item.weightKg > 0 ? (item.value / item.weightKg) : 0;
    
    let densityClass = 'low';
    if (density >= 1000) densityClass = 'high';
    else if (density >= 250) densityClass = 'med';

    // Build Field Salvage vs Hideout Recycle yields
    let yieldCellContent = '<div style="font-size: 0.75rem; color: var(--text-muted);">None</div>';
    let fieldYieldStr = '';
    let hideoutYieldStr = '';

    if (item.salvagesInto && Object.keys(item.salvagesInto).length > 0) {
      fieldYieldStr = Object.entries(item.salvagesInto)
        .map(([mId, qty]) => {
          const mItem = itemsDb.find(i => i.id === mId);
          return `${qty}x ${mItem ? mItem.name.en : mId}`;
        })
        .join(', ');
    }

    if (item.recyclesInto && Object.keys(item.recyclesInto).length > 0) {
      hideoutYieldStr = Object.entries(item.recyclesInto)
        .map(([mId, qty]) => {
          const mItem = itemsDb.find(i => i.id === mId);
          return `${qty}x ${mItem ? mItem.name.en : mId}`;
        })
        .join(', ');
    }

    if (fieldYieldStr || hideoutYieldStr) {
      yieldCellContent = `
        <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem;">
          ${fieldYieldStr ? `<div style="display: flex; align-items: center;"><span class="yield-tag yield-field">Field</span><span style="color: var(--text-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${fieldYieldStr}">${fieldYieldStr}</span></div>` : ''}
          ${hideoutYieldStr ? `<div style="display: flex; align-items: center;"><span class="yield-tag yield-hideout">Speranza</span><span style="color: var(--text-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${hideoutYieldStr}">${hideoutYieldStr}</span></div>` : ''}
        </div>
      `;
    }

    const rec = getInRoundRecommendation(item);
    const itemIcon = item.icon || item.imageFilename || '';

    const isTracked = trackedItems.has(item.id);
    const trackedBadge = isTracked ? `<span style="font-size:0.65rem; color:var(--rarity-legendary); margin-left:0.5rem; border:1px solid var(--rarity-legendary); padding:0.05rem 0.2rem; border-radius:3px; font-weight:700;">★ TRACKED</span>` : '';

    let nameCellContent = '';
    if (dItem.isGroup) {
      const activeIdx = weaponRowTiers[dItem.baseName] || 0;
      nameCellContent = `
        <div style="display:flex; align-items:center; gap:0.5rem;">
          ${itemIcon ? `<img class="material-icon" src="${itemIcon}" alt="" onerror="this.style.display='none';">` : ''}
          <span style="cursor:pointer;" onclick="openDetailDrawer('${item.id}')">${dItem.baseName}</span>
          <select class="tier-select" onchange="changeWeaponRowTier('${dItem.baseName}', this.value)">
            ${dItem.tiers.map((t, idx) => {
              const tierName = t.name.en.replace(dItem.baseName, '').trim() || t.id;
              const selected = idx === activeIdx ? 'selected' : '';
              return `<option value="${idx}" ${selected}>${tierName}</option>`;
            }).join('')}
          </select>
          ${trackedBadge}
        </div>
      `;
    } else {
      nameCellContent = `
        <div style="display:flex; align-items:center;">
          ${itemIcon ? `<img class="material-icon" src="${itemIcon}" alt="" onerror="this.style.display='none';">` : ''}
          <span onclick="openDetailDrawer('${item.id}')" style="cursor:pointer;">${item.name.en || item.id}</span>
          ${item.stackSize > 1 ? `<span style="font-size:0.65rem; color:var(--text-muted); margin-left:0.5rem; border:1px solid rgba(255,255,255,0.1); padding:0.05rem 0.2rem; border-radius:3px;">Stack: ${item.stackSize}</span>` : ''}
          ${trackedBadge}
        </div>
      `;
    }

    row.innerHTML = `
      <td style="text-align: center;">
        <button class="track-star-btn ${isTracked ? 'tracked' : ''}" onclick="toggleTrackItem('${item.id}')">
          ${isTracked ? '★' : '☆'}
        </button>
      </td>
      <td style="font-weight: 700; color: var(--rarity-${item.rarity.toLowerCase()});">
        ${nameCellContent}
      </td>
      <td style="font-family: var(--font-mono); font-size: 0.8rem;">${(item.weightKg || 0).toFixed(2)} kg</td>
      <td style="font-family: var(--font-mono); font-weight: 600;">${item.value || 0}c</td>
      <td>
        <span class="density-badge ${densityClass}">${Math.round(density)} c/kg</span>
      </td>
      <td>
        ${yieldCellContent}
      </td>
      <td>
        <span class="rec-badge ${rec.badgeClass} ${isTracked ? 'tracked-border' : ''}" title="${rec.reason}">${rec.action}</span>
      </td>
      <td>
        <button class="btn-sm btn-add" onclick="addToBackpack('${item.id}')">
          <i class="fa-solid fa-plus"></i> Add
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });
};

function getInRoundRecommendation(item) {
  if (typeof trackedItems !== 'undefined' && trackedItems.has(item.id)) {
    return {
      action: 'TRACKED - KEEP',
      badgeClass: 'rec-keep',
      reason: 'User-tracked project resource. Do NOT drop or salvage.'
    };
  }
  const isWeapon = isWeaponItem(item) || ['Armor', 'Modification'].includes(item.type);
  if (isWeapon) {
    return {
      action: 'KEEP & EXTRACT',
      badgeClass: 'rec-keep',
      reason: 'Active loadout equipment. Extract to use or sell at Speranza.'
    };
  }
  if (item.type === 'Key') {
    return {
      action: 'KEEP (Key)',
      badgeClass: 'rec-keep',
      reason: 'Vault key/code. Weightless (0.05kg). Keep to unlock gates.'
    };
  }
  if (item.type === 'Blueprint') {
    return {
      action: 'KEEP (Recipe)',
      badgeClass: 'rec-keep',
      reason: 'Workbench blueprint. Very light (0.1kg). Keep to learn.'
    };
  }
  
  // Reusable Quick Use Gear
  const isReusable = item.repairCost && Object.keys(item.repairCost).length > 0;
  if (isReusable && item.type === 'Quick Use') {
    return {
      action: 'KEEP & EXTRACT',
      badgeClass: 'rec-keep',
      reason: 'Reusable movement/utility tool. Extract for loadout deployment.'
    };
  }

  // Calculate salvage value and weight reduction
  let salvageValue = 0;
  let salvageWeight = 0;
  if (item.salvagesInto) {
    Object.entries(item.salvagesInto).forEach(([yieldId, qty]) => {
      const yieldItem = itemsDb.find(i => i.id === yieldId);
      salvageValue += (yieldItem ? yieldItem.value : 0) * qty;
      salvageWeight += (yieldItem ? yieldItem.weightKg : 0) * qty;
    });
  }

  const weightReduction = item.weightKg - salvageWeight;
  const isCraftingMat = ['Basic Material', 'Topside Material', 'Refined Material', 'Nature'].includes(item.type);

  if (item.type === 'Recyclable' || item.type === 'Trinket' || isCraftingMat) {
    if (salvageValue > 0) {
      if (salvageValue > item.value) {
        return {
          action: 'SALVAGE IN-ROUND',
          badgeClass: 'rec-recycle',
          reason: `Salvaging increases total credit value (+${salvageValue - item.value}c) and reduces weight.`
        };
      }
      if (weightReduction >= 0.5 && item.value - salvageValue <= 300) {
        return {
          action: 'SALVAGE (Compress)',
          badgeClass: 'rec-recycle',
          reason: `Salvage in-round to compress weight by ${weightReduction.toFixed(2)} kg (yields ${salvageValue}c components).`
        };
      }
    }
  }

  // If density is very low
  const density = item.weightKg > 0 ? (item.value / item.weightKg) : 0;
  if (density < 100 && !isCraftingMat) {
    return {
      action: 'DROP FIRST',
      badgeClass: 'rec-sell',
      reason: `Extremely low value density (${Math.round(density)} c/kg). Drop to make room for better loot.`
    };
  }

  // Fallback: extract
  if (item.value >= 1000) {
    return {
      action: 'EXTRACT ONLY',
      badgeClass: 'rec-keep-sell',
      reason: `High value extraction target. Do NOT salvage (loses ${item.value - salvageValue}c of value).`
    };
  }

  return {
    action: 'EXTRACT',
    badgeClass: 'rec-keep',
    reason: `Standard extract target. Recycle at Speranza for 100% material yields.`
  };
}

window.addToBackpack = function(itemId) {
  const existing = backpackItems.find(i => i.id === itemId);
  if (existing) {
    existing.qty++;
  } else {
    backpackItems.push({ id: itemId, qty: 1 });
  }
  updateBackpackSimulator();
};

window.removeFromBackpack = function(itemId) {
  const existingIndex = backpackItems.findIndex(i => i.id === itemId);
  if (existingIndex > -1) {
    backpackItems[existingIndex].qty--;
    if (backpackItems[existingIndex].qty <= 0) {
      backpackItems.splice(existingIndex, 1);
    }
  }
  updateBackpackSimulator();
};

window.updateBackpackSimulator = function() {
  const augmentSelect = document.getElementById('equipped-augment');
  const augmentWeight = parseFloat(augmentSelect.value) || 70.0;
  const slotLimit = parseInt(augmentSelect.options[augmentSelect.selectedIndex]?.getAttribute('data-slots')) || 18;
  const skillBonus = parseFloat(document.getElementById('skill-broad-shoulders').value) || 0.0;
  const limit = augmentWeight + skillBonus;
  const listContainer = document.getElementById('pack-items-list');
  listContainer.innerHTML = '';

  // Calculate equipped weapon weight
  const primaryId = document.getElementById('primary-weapon-select')?.value || '0';
  const secondaryId = document.getElementById('secondary-weapon-select')?.value || '0';
  const armsMultiplier = parseFloat(document.getElementById('skill-loaded-arms')?.value) || 1.0;
  
  let weaponWeight = 0;
  if (primaryId !== '0') {
    const w = itemsDb.find(i => i.id === primaryId);
    if (w) weaponWeight += w.weightKg || 0;
  }
  if (secondaryId !== '0') {
    const w = itemsDb.find(i => i.id === secondaryId);
    if (w) weaponWeight += w.weightKg || 0;
  }
  const effectiveWeaponWeight = weaponWeight * armsMultiplier;

  let totalWeight = effectiveWeaponWeight;
  let totalValue = 0;
  let totalSlots = 0;

  if (backpackItems.length === 0) {
    listContainer.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding: 1.5rem; font-size:0.75rem;">Your backpack has no loot. Add items from the directory to simulate.</div>`;
    if (effectiveWeaponWeight > 0) {
      listContainer.innerHTML = `
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem; font-style:italic;">Equipped Weapons loadout:</div>
        <div class="material-item" style="padding: 0.25rem 0; font-size:0.75rem; color:var(--text-secondary);">
          <span>Equipped Weapons Burden</span>
          <span style="font-family:var(--font-mono);">${effectiveWeaponWeight.toFixed(2)} kg</span>
        </div>
      `;
    }
    
    document.getElementById('pack-weight-text').textContent = `${totalWeight.toFixed(2)} / ${limit.toFixed(2)} kg`;
    const fillPercent = Math.min(100, (totalWeight / limit) * 100);
    const bar = document.getElementById('pack-weight-bar');
    bar.style.width = `${fillPercent}%`;
    if (totalWeight > limit) {
      bar.classList.add('overloaded');
    } else {
      bar.classList.remove('overloaded');
    }

    document.getElementById('pack-slots-text').textContent = `0 / ${slotLimit} slots`;
    const slotsBar = document.getElementById('pack-slots-bar');
    if (slotsBar) {
      slotsBar.style.width = '0%';
      slotsBar.classList.remove('overloaded');
    }

    document.getElementById('pack-total-value').textContent = '0 c';
    document.getElementById('pack-avg-density').textContent = '0 c/kg';

    document.getElementById('pack-advice-card').className = 'advice-card';
    document.getElementById('pack-advice-title').className = 'advice-title';
    document.getElementById('pack-advice-title').innerHTML = '<i class="fa-solid fa-circle-info"></i> In-Round Advice';
    if (effectiveWeaponWeight > limit) {
      document.getElementById('pack-advice-card').className = 'advice-card warning';
      document.getElementById('pack-advice-title').className = 'advice-title warning';
      document.getElementById('pack-advice-title').innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Overloaded by Weapons!';
      document.getElementById('pack-advice-text').innerHTML = `Your equipped weapons weight (<strong>${effectiveWeaponWeight.toFixed(2)} kg</strong>) exceeds your augment capacity. You are overloaded before picking up any loot! Equip a higher carry augment (e.g. Looting Mk. 2/3) or invest in the <strong>Loaded Arms</strong> skill.`;
    } else {
      document.getElementById('pack-advice-text').textContent = 'Pick up loot on your raid, and this strategist will guide you on what to keep, drop, or salvage in-round to maximize extraction profits.';
    }
    return;
  }

  // Render pack items and calculate totals
  if (effectiveWeaponWeight > 0) {
    const weaponRow = document.createElement('div');
    weaponRow.className = 'material-item';
    weaponRow.style.padding = '0.35rem 0';
    weaponRow.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
    weaponRow.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.15rem; max-width:200px;">
        <span style="font-weight:600; font-size:0.8rem; color:var(--text-secondary);">
          Equipped Weapons Loadout
        </span>
        <span style="font-size:0.65rem; color:var(--text-muted);">
          Burden Weight: ${effectiveWeaponWeight.toFixed(2)} kg
        </span>
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span class="density-badge low" style="font-size:0.6rem; padding:0.05rem 0.2rem;">
          0 c/kg
        </span>
      </div>
    `;
    listContainer.appendChild(weaponRow);
  }

  backpackItems.forEach(packItem => {
    const item = itemsDb.find(i => i.id === packItem.id);
    if (!item) return;

    const itemWeight = (item.weightKg || 0) * packItem.qty;
    const itemValue = (item.value || 0) * packItem.qty;
    totalWeight += itemWeight;
    totalValue += itemValue;

    const stackSize = item.stackSize || 1;
    const itemSlots = Math.ceil(packItem.qty / stackSize);
    totalSlots += itemSlots;

    const density = item.weightKg > 0 ? (item.value / item.weightKg) : 0;
    const slotsStr = stackSize > 1 ? ` | Slots: ${itemSlots} (limit ${stackSize})` : '';

    const row = document.createElement('div');
    row.className = 'material-item';
    row.style.padding = '0.35rem 0';
    row.style.borderBottom = '1px solid rgba(255,255,255,0.02)';

    const isTracked = typeof trackedItems !== 'undefined' && trackedItems.has(item.id);
    const starStr = isTracked ? ' <span style="color:var(--rarity-legendary);">★</span>' : '';

    row.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.15rem; max-width:200px;">
        <span style="font-weight:600; font-size:0.8rem; color: var(--rarity-${item.rarity.toLowerCase()}); cursor:pointer;" onclick="openDetailDrawer('${item.id}')">
          ${item.name.en} ${packItem.qty > 1 ? `(x${packItem.qty})` : ''}${starStr}
        </span>
        <span style="font-size:0.65rem; color:var(--text-muted);">
          Wt: ${itemWeight.toFixed(2)}kg | Val: ${itemValue}c${slotsStr}
        </span>
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span class="density-badge ${density >= 1000 ? 'high' : (density >= 250 ? 'med' : 'low')}" style="font-size:0.6rem; padding:0.05rem 0.2rem;">
          ${Math.round(density)} c/kg
        </span>
        <button class="btn-sm btn-remove" onclick="removeFromBackpack('${item.id}')" style="padding:0.1rem 0.3rem;">
          <i class="fa-solid fa-minus"></i>
        </button>
      </div>
    `;
    listContainer.appendChild(row);
  });

  const avgDensity = totalWeight > 0 ? (totalValue / totalWeight) : 0;

  // Update simulator UI Weight
  document.getElementById('pack-weight-text').textContent = `${totalWeight.toFixed(2)} / ${limit.toFixed(2)} kg`;
  const fillPercent = Math.min(100, (totalWeight / limit) * 100);
  const bar = document.getElementById('pack-weight-bar');
  bar.style.width = `${fillPercent}%`;

  if (totalWeight > limit) {
    bar.classList.add('overloaded');
  } else {
    bar.classList.remove('overloaded');
  }

  // Update simulator UI Slots
  document.getElementById('pack-slots-text').textContent = `${totalSlots} / ${slotLimit} slots`;
  const slotsPercent = Math.min(100, (totalSlots / slotLimit) * 100);
  const slotsBar = document.getElementById('pack-slots-bar');
  if (slotsBar) {
    slotsBar.style.width = `${slotsPercent}%`;
    if (totalSlots > slotLimit) {
      slotsBar.classList.add('overloaded');
    } else {
      slotsBar.classList.remove('overloaded');
    }
  }

  document.getElementById('pack-total-value').textContent = `${totalValue} c`;
  document.getElementById('pack-avg-density').textContent = `${Math.round(avgDensity)} c/kg`;

  // Generate dynamic optimization advice
  let adviceTitle = '<i class="fa-solid fa-circle-info"></i> In-Round Advice';
  let adviceText = '';
  let adviceClass = 'advice-card';
  let titleClass = 'advice-title';

  const isWeightOver = totalWeight > limit;
  const isSlotsOver = totalSlots > slotLimit;

  if (isWeightOver || isSlotsOver) {
    adviceClass = 'advice-card warning';
    titleClass = 'advice-title warning';
    
    if (isWeightOver && isSlotsOver) {
      adviceTitle = '<i class="fa-solid fa-triangle-exclamation"></i> Weight & Slots Exceeded!';
    } else if (isWeightOver) {
      adviceTitle = '<i class="fa-solid fa-triangle-exclamation"></i> Weight Limit Exceeded!';
    } else {
      adviceTitle = '<i class="fa-solid fa-triangle-exclamation"></i> Backpack Slots Full!';
    }

    // Find non-critical items and sort by value density (ascending)
    const dropCandidates = [];
    backpackItems.forEach(packItem => {
      const item = itemsDb.find(i => i.id === packItem.id);
      if (!item) return;
      
      const isCritical = ['Key', 'Blueprint'].includes(item.type) || (typeof trackedItems !== 'undefined' && trackedItems.has(item.id));
      if (isCritical) return;

      const density = item.weightKg > 0 ? (item.value / item.weightKg) : 0;
      dropCandidates.push({
        item: item,
        density: density,
        qty: packItem.qty
      });
    });

    dropCandidates.sort((a, b) => a.density - b.density);

    if (dropCandidates.length > 0) {
      const first = dropCandidates[0];
      const second = dropCandidates[1];
      let dropSuggestion = `<strong>${first.item.name.en}</strong> (density: <strong>${Math.round(first.density)} c/kg</strong>)`;
      if (second) {
        dropSuggestion += ` or <strong>${second.item.name.en}</strong> (density: <strong>${Math.round(second.density)} c/kg</strong>)`;
      }
      
      if (isSlotsOver && !isWeightOver) {
        adviceText = `Your slots limit is exceeded (${totalSlots} / ${slotLimit}). We recommend dropping ${dropSuggestion} to free up slot capacity.`;
      } else {
        adviceText = `Your weight capacity is exceeded (${totalWeight.toFixed(2)} kg). We recommend dropping or salvaging ${dropSuggestion} first to compress weight.`;
      }
    } else {
      adviceText = `Backpack limit exceeded. Drop or salvage your heaviest non-critical equipment to enable extraction.`;
    }
  } else {
    // Check if we have salvageable items in the pack that offer compression
    let salvageCandidate = null;
    let bestWeightSaved = 0;
    let bestSalvageYield = '';

    backpackItems.forEach(packItem => {
      const item = itemsDb.find(i => i.id === packItem.id);
      if (!item) return;

      let salvageValue = 0;
      let salvageWeight = 0;
      if (item.salvagesInto) {
        Object.entries(item.salvagesInto).forEach(([yieldId, qty]) => {
          const yieldItem = itemsDb.find(i => i.id === yieldId);
          salvageValue += (yieldItem ? yieldItem.value : 0) * qty;
          salvageWeight += (yieldItem ? yieldItem.weightKg : 0) * qty;
        });
      }

      if (salvageValue > 0) {
        const weightSaved = item.weightKg - salvageWeight;
        const valueDifference = item.value - salvageValue;
        if (weightSaved >= 0.5 && valueDifference <= 300 && weightSaved > bestWeightSaved) {
          bestWeightSaved = weightSaved;
          salvageCandidate = item;
          bestSalvageYield = Object.entries(item.salvagesInto)
            .map(([yId, qty]) => {
              const yItem = itemsDb.find(i => i.id === yId);
              return `${qty}x ${yItem ? yItem.name.en : yId}`;
            })
            .join(', ');
        }
      }
    });

    if (salvageCandidate) {
      adviceText = `Inventory status nominal. To optimize weight, you can salvage <strong>${salvageCandidate.name.en}</strong> in-round. This will compress its cargo weight by <strong>${bestWeightSaved.toFixed(2)} kg</strong>, converting it into <strong>${bestSalvageYield}</strong> while preserving its crafting utility.`;
    } else {
      // Check if we have high-value items that should NEVER be salvaged in-round
      let warningItems = [];
      backpackItems.forEach(packItem => {
        const item = itemsDb.find(i => i.id === packItem.id);
        if (item && item.value >= 2000 && item.salvagesInto) {
          let salvageValue = 0;
          Object.entries(item.salvagesInto).forEach(([yieldId, qty]) => {
            const yieldItem = itemsDb.find(i => i.id === yieldId);
            salvageValue += (yieldItem ? yieldItem.value : 0) * qty;
          });
          if (item.value - salvageValue >= 1500) {
            warningItems.push(item.name.en);
          }
        }
      });

      if (warningItems.length > 0) {
        adviceText = `Extraction cargo optimal. <strong>CRITICAL:</strong> Do NOT salvage <strong>${warningItems.join(', ')}</strong> in-round. Doing so will destroy their value (over 70% loss). Carry them out safely to Speranza.`;
      } else {
        adviceText = `Backpack loadout is highly optimal (average value density: <strong>${Math.round(avgDensity)} c/kg</strong>). Ready for extraction at the nearest outpost!`;
      }
    }
  }

  document.getElementById('pack-advice-card').className = adviceClass;
  document.getElementById('pack-advice-title').className = titleClass;
  document.getElementById('pack-advice-title').innerHTML = adviceTitle;
  document.getElementById('pack-advice-text').innerHTML = adviceText;
};

// Skill Planner Database & State
const SKILLS_DB = {
  conditioning: [
    // Tier 1 (0 points required)
    { id: 'used_to_weight', name: 'Used to the Weight', tier: 1, icon: 'fa-shield-halved', maxPoints: 5, desc: 'Reduces movement speed penalty by 30% when wearing a shield.' },
    { id: 'blast_born', name: 'Blast-Born', tier: 1, icon: 'fa-burst', maxPoints: 5, desc: 'Reduces the duration of hearing impairment and shake caused by nearby explosions by 50%.' },
    { id: 'a_little_extra', name: 'A Little Extra', tier: 1, icon: 'fa-cubes', maxPoints: 5, desc: 'Breaching doors and containers generates additional random crafting materials.' },
    { id: 'effortless_swing', name: 'Effortless Swing', tier: 1, icon: 'fa-hand-fist', maxPoints: 5, desc: 'Reduces the stamina cost of all melee attacks by 25%.' },
    { id: 'sky_clearing_swing', name: 'Sky-Clearing Swing', tier: 1, icon: 'fa-circle-arrow-up', maxPoints: 5, desc: 'Increases melee damage against airborne drones by 50%.' },
    // Tier 2 (15 points required)
    { id: 'proficient_pryer', name: 'Proficient Pryer', tier: 2, icon: 'fa-key', maxPoints: 5, desc: 'Reduces container and door prying time by 25%.' },
    { id: 'gentle_pressure', name: 'Gentle Pressure', tier: 2, icon: 'fa-volume-xmark', maxPoints: 5, desc: 'Reduces noise made when breaching doors or containers by 40%.' },
    { id: 'loaded_arms', name: 'Loaded Arms', tier: 2, icon: 'fa-gun', maxPoints: 1, desc: 'Reduces the weight contribution of equipped weapons to your encumbrance by 50%.' },
    { id: 'turtle_crawl', name: 'Turtle Crawl', tier: 2, icon: 'fa-turtle', maxPoints: 5, desc: 'Reduces damage taken by 40% while in a downed (crawling) state.' },
    { id: 'unburdened_roll', name: 'Unburdened Roll', tier: 2, icon: 'fa-person-running', maxPoints: 1, desc: 'Allows your first dodge roll after a shield breaks to cost no stamina.' },
    // Tier 3 (36 points required)
    { id: 'fight_or_flight', name: 'Fight or Flight', tier: 3, icon: 'fa-heart-pulse', maxPoints: 5, desc: 'Regain 15 stamina instantly when taking damage in combat (15s cooldown).' },
    { id: 'survivor_stamina', name: 'Survivor\'s Stamina', tier: 3, icon: 'fa-bolt', maxPoints: 1, desc: 'Stamina regenerates 30% faster when your health drops below 25%.' },
    { id: 'downed_determined', name: 'Downed But Determined', tier: 3, icon: 'fa-hand-holding-heart', maxPoints: 5, desc: 'Increases bleed-out time when downed by 30%, giving allies more time to revive you.' },
    { id: 'back_on_your_feet', name: 'Back on Your Feet', tier: 3, icon: 'fa-kit-medical', maxPoints: 1, desc: 'Automatically regenerates health slowly up to a limit when critically wounded.' },
    { id: 'flyswatter', name: 'Flyswatter', tier: 3, icon: 'fa-bug-slash', maxPoints: 1, desc: 'Allows you to destroy small ARC units like Wasps and Turrets with a single melee strike.' }
  ],
  mobility: [
    // Tier 1 (0 points required)
    { id: 'marathon_runner', name: 'Marathon Runner', tier: 1, icon: 'fa-gauge-high', maxPoints: 5, desc: 'Sprinting consumes 20% less stamina.' },
    { id: 'youthful_lungs', name: 'Youthful Lungs', tier: 1, icon: 'fa-lungs', maxPoints: 5, desc: 'Increases maximum stamina pool by 25 points.' },
    { id: 'nimble_climber', name: 'Nimble Climber', tier: 1, icon: 'fa-person-climbing', maxPoints: 5, desc: 'Increases climbing, vaulting, and ladder traversal speeds by 30%.' },
    { id: 'effortless_roll', name: 'Effortless Roll', tier: 1, icon: 'fa-rotate', maxPoints: 5, desc: 'Reduces the stamina cost of dodge rolls by 25%.' },
    { id: 'sturdy_ankles', name: 'Sturdy Ankles', tier: 1, icon: 'fa-shoe-prints', maxPoints: 5, desc: 'Reduces falling damage by 50% from non-lethal heights.' },
    // Tier 2 (15 points required)
    { id: 'slip_slide', name: 'Slip and Slide', tier: 2, icon: 'fa-person-skating', maxPoints: 5, desc: 'Increases slide distance by 25% and slide speed by 15%.' },
    { id: 'heroic_leap', name: 'Heroic Leap', tier: 2, icon: 'fa-arrows-up-to-line', maxPoints: 5, desc: 'Increases the distance of sprint dodge rolls by 30%.' },
    { id: 'crawl_before_walk', name: 'Crawl Before You Walk', tier: 2, icon: 'fa-baby', maxPoints: 5, desc: 'Increases movement speed while in a downed crawling state by 40%.' },
    { id: 'vigorous_vaulter', name: 'Vigorous Vaulter', tier: 2, icon: 'fa-person-running', maxPoints: 1, desc: 'Eliminates the vault speed reduction when you are completely out of stamina.' },
    { id: 'ready_to_roll', name: 'Ready to Roll', tier: 2, icon: 'fa-arrows-spin', maxPoints: 5, desc: 'Increases the timing window for a recovery roll after falling to avoid damage.' },
    // Tier 3 (36 points required)
    { id: 'carry_momentum', name: 'Carry the Momentum', tier: 3, icon: 'fa-forward', maxPoints: 1, desc: 'Executing a sprint dodge roll negates sprint stamina cost for 2 seconds.' },
    { id: 'calming_stroll', name: 'Calming Stroll', tier: 3, icon: 'fa-person-walking', maxPoints: 1, desc: 'Allows stamina to regenerate at 100% speed while walking.' },
    { id: 'vaults_on_vaults', name: 'Vaults on Vaults on Vaults', tier: 3, icon: 'fa-arrow-up-right-from-square', maxPoints: 1, desc: 'Vaulting over obstacles no longer consumes any stamina.' },
    { id: 'vault_spring', name: 'Vault Spring', tier: 3, icon: 'fa-arrow-up-from-bracket', maxPoints: 1, desc: 'Allows executing a high jump immediately after a vault animation.' },
    { id: 'off_the_wall', name: 'Off the Wall', tier: 3, icon: 'fa-border-all', maxPoints: 5, desc: 'Increases wall-bound leap distance by 40%.' }
  ],
  survival: [
    // Tier 1 (0 points required)
    { id: 'agile_croucher', name: 'Agile Croucher', tier: 1, icon: 'fa-child', maxPoints: 5, desc: 'Increases crouching movement speed by 25%.' },
    { id: 'silent_scavenger', name: 'Silent Scavenger', tier: 1, icon: 'fa-volume-mute', maxPoints: 5, desc: 'Reduces the radius of noise generated when searching containers by 50%.' },
    { id: 'revitalizing_squat', name: 'Revitalizing Squat', tier: 1, icon: 'fa-arrows-down-to-line', maxPoints: 5, desc: 'Increases stamina regeneration rate by 20% while crouched.' },
    { id: 'good_as_new', name: 'Good as New', tier: 1, icon: 'fa-heart-circle-check', maxPoints: 5, desc: 'Increases stamina regeneration rate by 30% while under healing effects.' },
    { id: 'suffer_in_silence', name: 'Suffer in Silence', tier: 1, icon: 'fa-volume-off', maxPoints: 5, desc: 'Reduces noise generated by your movement when critically injured by 50%.' },
    // Tier 2 (15 points required)
    { id: 'in_round_crafting', name: 'In-Round Crafting', tier: 2, icon: 'fa-screwdriver-wrench', maxPoints: 1, desc: 'Unlocks the ability to craft basic medical supplies and ammo stacks topside during raids.' },
    { id: 'looters_luck', name: 'Looter\'s Luck', tier: 2, icon: 'fa-clover', maxPoints: 5, desc: 'Increases the chance of finding rare components in industrial chests by 15%.' },
    { id: 'three_deep_breaths', name: 'Three Deep Breaths', tier: 2, icon: 'fa-wind', maxPoints: 5, desc: 'Reduces the stamina recovery delay by 30% after an ability completely drains it.' },
    { id: 'minesweeper', name: 'Minesweeper', tier: 2, icon: 'fa-triangle-exclamation', maxPoints: 1, desc: 'Allows defusing of enemy mines and explosive traps while slow crouch-walking.' },
    { id: 'one_raiders_scraps', name: 'One Raider\'s Scraps', tier: 2, icon: 'fa-recycle', maxPoints: 5, desc: 'Adds a 15% chance to find additional field-crafted utility items inside containers.' },
    // Tier 3 (36 points required)
    { id: 'broad_shoulders', name: 'Broad Shoulders', tier: 3, icon: 'fa-weight-hanging', maxPoints: 3, desc: 'Increases maximum carry weight limit by up to 15.0 kg (+5.0 kg per point).' },
    { id: 'traveling_tinkerer', name: 'Traveling Tinkerer', tier: 3, icon: 'fa-hammer', maxPoints: 1, desc: 'Allows field crafting of high-tier gadgets (e.g. traps, shield rechargers) during raids.' },
    { id: 'looters_instincts', name: 'Looter\'s Instincts', tier: 3, icon: 'fa-eye', maxPoints: 5, desc: 'Container icons are highlighted through walls within a 15-meter range.' },
    { id: 'stubborn_mule', name: 'Stubborn Mule', tier: 3, icon: 'fa-truck-ramp-box', maxPoints: 5, desc: 'Reduces the movement speed penalty and stamina drain when over-encumbered by 40%.' },
    { id: 'security_breach', name: 'Security Breach', tier: 3, icon: 'fa-lock-open', maxPoints: 1, desc: 'Enables prying open high-value security lockers topside during raids.' }
  ]
};

const SKILL_BUILDS = [
  {
    name: 'PvP Apex Skirmisher',
    summary: 'High-mobility aggressive player hunter',
    desc: 'Optimized for high-stakes player-vs-player combat. Maximizes dodge rolls, sprint stamina, and shield break recovery, while utilizing loaded weapon weight reductions to carry heavy combat gear.',
    focus: 'PvP',
    risk: 'High',
    points: { conditioning: 23, mobility: 37, survival: 15 },
    augment: 'Combat Mk. 3 (Aggressive)',
    weapons: 'Tempest IV (Assault Rifle), Toro IV (Shotgun) or Stitcher IV (SMG) | Grenades, Combat Stimulants, Shield Rechargers',
    unlocked: [],
    defaultAllocations: {
      blast_born: 5, effortless_swing: 5, a_little_extra: 5, loaded_arms: 1, unburdened_roll: 1,
      turtle_crawl: 5, proficient_pryer: 1, marathon_runner: 5, youthful_lungs: 5, nimble_climber: 5,
      effortless_roll: 5, slip_slide: 5, heroic_leap: 5, ready_to_roll: 5, vigorous_vaulter: 1,
      carry_momentum: 1, agile_croucher: 5, silent_scavenger: 5, good_as_new: 5
    },
    priorityList: [
      { id: 'marathon_runner', target: 1 },
      { id: 'youthful_lungs', target: 1 },
      { id: 'agile_croucher', target: 1 },
      { id: 'silent_scavenger', target: 1 },
      { id: 'blast_born', target: 1 },
      { id: 'effortless_swing', target: 1 },
      { id: 'marathon_runner', target: 5 },
      { id: 'youthful_lungs', target: 5 },
      { id: 'agile_croucher', target: 5 },
      { id: 'silent_scavenger', target: 5 },
      { id: 'blast_born', target: 5 },
      { id: 'effortless_swing', target: 5 },
      { id: 'nimble_climber', target: 5 },
      { id: 'effortless_roll', target: 5 },
      { id: 'slip_slide', target: 5 },
      { id: 'heroic_leap', target: 5 },
      { id: 'ready_to_roll', target: 5 },
      { id: 'vigorous_vaulter', target: 1 },
      { id: 'carry_momentum', target: 1 },
      { id: 'good_as_new', target: 5 },
      { id: 'a_little_extra', target: 5 },
      { id: 'loaded_arms', target: 1 },
      { id: 'unburdened_roll', target: 1 },
      { id: 'turtle_crawl', target: 5 },
      { id: 'proficient_pryer', target: 1 }
    ],
    branchPriority: ['mobility', 'conditioning', 'survival']
  },
  {
    name: 'Pure Scavenger',
    summary: 'Survival-heavy solo loot collector',
    desc: 'Designed for maximizing scrap extraction. Focuses on carrying massive weight, looting silently, crouching stealthily, and evading combat patrols.',
    focus: 'Mixed',
    risk: 'High',
    points: { conditioning: 9, mobility: 20, survival: 46 },
    augment: 'Looting Mk. 3 (Survivor)',
    weapons: 'Renegade IV (Battle Rifle), Light Shield | Heals, Shield Rechargers, Ammo',
    unlocked: [],
    defaultAllocations: {
      silent_scavenger: 5, agile_croucher: 5, suffer_in_silence: 5, in_round_crafting: 1, looters_luck: 5,
      marathon_runner: 5, youthful_lungs: 5, nimble_climber: 5, slip_slide: 5, good_as_new: 5,
      three_deep_breaths: 5, one_raiders_scraps: 5, broad_shoulders: 3, looters_instincts: 5, security_breach: 1,
      a_little_extra: 5, used_to_weight: 4, minesweeper: 1
    },
    priorityList: [
      { id: 'silent_scavenger', target: 1 },
      { id: 'agile_croucher', target: 1 },
      { id: 'marathon_runner', target: 1 },
      { id: 'youthful_lungs', target: 1 },
      { id: 'silent_scavenger', target: 5 },
      { id: 'agile_croucher', target: 5 },
      { id: 'suffer_in_silence', target: 5 },
      { id: 'in_round_crafting', target: 1 },
      { id: 'looters_luck', target: 5 },
      { id: 'marathon_runner', target: 5 },
      { id: 'youthful_lungs', target: 5 },
      { id: 'nimble_climber', target: 5 },
      { id: 'slip_slide', target: 5 },
      { id: 'good_as_new', target: 5 },
      { id: 'three_deep_breaths', target: 5 },
      { id: 'one_raiders_scraps', target: 5 },
      { id: 'minesweeper', target: 1 },
      { id: 'broad_shoulders', target: 3 },
      { id: 'looters_instincts', target: 5 },
      { id: 'security_breach', target: 1 },
      { id: 'a_little_extra', target: 5 },
      { id: 'used_to_weight', target: 4 }
    ],
    branchPriority: ['survival', 'mobility', 'conditioning']
  },
  {
    name: 'Combat Vanguard',
    summary: 'Shield-tanking front-line brawler',
    desc: 'Optimized for heavy combat, door-breaching, and team defense. Negates speed penalties when carrying shields, resists blasts, and recovers stamina under fire.',
    focus: 'PvE',
    risk: 'High',
    points: { conditioning: 48, mobility: 22, survival: 5 },
    augment: 'Tactical Mk. 3 (Defensive)',
    weapons: 'Torrente IV (LMG), Heavy Shield | Surge Medical Kits, Shield Rechargers, Heavy Ammo',
    unlocked: [],
    defaultAllocations: {
      used_to_weight: 5, blast_born: 5, effortless_swing: 5, unburdened_roll: 1, loaded_arms: 1,
      a_little_extra: 4, turtle_crawl: 5, marathon_runner: 5, youthful_lungs: 5, nimble_climber: 5,
      slip_slide: 5, heroic_leap: 2, sky_clearing_swing: 5, proficient_pryer: 5, fight_or_flight: 5,
      downed_determined: 4, survivor_stamina: 1, back_on_your_feet: 1, flyswatter: 1, agile_croucher: 5
    },
    priorityList: [
      { id: 'used_to_weight', target: 1 },
      { id: 'blast_born', target: 1 },
      { id: 'marathon_runner', target: 1 },
      { id: 'youthful_lungs', target: 1 },
      { id: 'used_to_weight', target: 5 },
      { id: 'blast_born', target: 5 },
      { id: 'effortless_swing', target: 5 },
      { id: 'unburdened_roll', target: 1 },
      { id: 'loaded_arms', target: 1 },
      { id: 'a_little_extra', target: 4 },
      { id: 'turtle_crawl', target: 5 },
      { id: 'marathon_runner', target: 5 },
      { id: 'youthful_lungs', target: 5 },
      { id: 'nimble_climber', target: 5 },
      { id: 'slip_slide', target: 5 },
      { id: 'heroic_leap', target: 2 },
      { id: 'sky_clearing_swing', target: 5 },
      { id: 'proficient_pryer', target: 5 },
      { id: 'fight_or_flight', target: 5 },
      { id: 'downed_determined', target: 4 },
      { id: 'survivor_stamina', target: 1 },
      { id: 'back_on_your_feet', target: 1 },
      { id: 'flyswatter', target: 1 },
      { id: 'agile_croucher', target: 5 }
    ],
    branchPriority: ['conditioning', 'mobility', 'survival']
  },
  {
    name: 'High-Mobility Scout',
    summary: 'Traversal speed runner & pathfinder',
    desc: 'Unmatched speed and vertical parkour agility. Slides, vaults, and climbs through ruins to locate drop zones and extraction points before patrol bots spot you.',
    focus: 'Mixed',
    risk: 'Medium',
    points: { conditioning: 9, mobility: 45, survival: 21 },
    augment: 'Looting Mk. 3 (Cautious)',
    weapons: 'Stitcher IV (SMG), Light Shield | Stimulants, Heals, Standard Ammo',
    unlocked: [],
    defaultAllocations: {
      marathon_runner: 5, youthful_lungs: 5, nimble_climber: 5, vigorous_vaulter: 1, slip_slide: 5,
      heroic_leap: 5, agile_croucher: 5, silent_scavenger: 5, good_as_new: 5, in_round_crafting: 1,
      looters_luck: 5, effortless_roll: 5, ready_to_roll: 5, carry_momentum: 1, sturdy_ankles: 1,
      vaults_on_vaults: 1, vault_spring: 1, off_the_wall: 5, effortless_swing: 4, used_to_weight: 5
    },
    priorityList: [
      { id: 'marathon_runner', target: 1 },
      { id: 'youthful_lungs', target: 1 },
      { id: 'agile_croucher', target: 1 },
      { id: 'silent_scavenger', target: 1 },
      { id: 'marathon_runner', target: 5 },
      { id: 'youthful_lungs', target: 5 },
      { id: 'nimble_climber', target: 5 },
      { id: 'vigorous_vaulter', target: 1 },
      { id: 'slip_slide', target: 5 },
      { id: 'heroic_leap', target: 5 },
      { id: 'agile_croucher', target: 5 },
      { id: 'silent_scavenger', target: 5 },
      { id: 'good_as_new', target: 5 },
      { id: 'in_round_crafting', target: 1 },
      { id: 'looters_luck', target: 5 },
      { id: 'effortless_roll', target: 5 },
      { id: 'ready_to_roll', target: 5 },
      { id: 'carry_momentum', target: 1 },
      { id: 'sturdy_ankles', target: 1 },
      { id: 'vaults_on_vaults', target: 1 },
      { id: 'vault_spring', target: 1 },
      { id: 'off_the_wall', target: 5 },
      { id: 'effortless_swing', target: 4 },
      { id: 'used_to_weight', target: 5 }
    ],
    branchPriority: ['mobility', 'survival', 'conditioning']
  },
  {
    name: 'Stealth Infiltrator',
    summary: 'Quiet lockbreaker & vault burglar',
    desc: 'Sneaks past ARC defenses, opens secure doors/vaults silently, and escapes with rare blueprints. Ideal for high-risk, low-detection looting raids.',
    focus: 'Mixed',
    risk: 'High',
    points: { conditioning: 20, mobility: 10, survival: 45 },
    augment: 'Looting Mk. 3 (Safekeeper)',
    weapons: 'Osprey IV (Sniper), Light Shield | Silenced Pistol, Decoys, Ammo',
    unlocked: [],
    defaultAllocations: {
      silent_scavenger: 5, agile_croucher: 5, suffer_in_silence: 5, in_round_crafting: 1, looters_luck: 5,
      three_deep_breaths: 5, a_little_extra: 5, used_to_weight: 5, effortless_swing: 5, gentle_pressure: 5,
      marathon_runner: 5, youthful_lungs: 5, good_as_new: 5, one_raiders_scraps: 5, broad_shoulders: 3,
      looters_instincts: 5, minesweeper: 1
    },
    priorityList: [
      { id: 'silent_scavenger', target: 1 },
      { id: 'agile_croucher', target: 1 },
      { id: 'marathon_runner', target: 1 },
      { id: 'youthful_lungs', target: 1 },
      { id: 'silent_scavenger', target: 5 },
      { id: 'agile_croucher', target: 5 },
      { id: 'suffer_in_silence', target: 5 },
      { id: 'in_round_crafting', target: 1 },
      { id: 'looters_luck', target: 5 },
      { id: 'three_deep_breaths', target: 5 },
      { id: 'a_little_extra', target: 5 },
      { id: 'used_to_weight', target: 5 },
      { id: 'effortless_swing', target: 5 },
      { id: 'gentle_pressure', target: 5 },
      { id: 'marathon_runner', target: 5 },
      { id: 'youthful_lungs', target: 5 },
      { id: 'good_as_new', target: 5 },
      { id: 'one_raiders_scraps', target: 5 },
      { id: 'minesweeper', target: 1 },
      { id: 'broad_shoulders', target: 3 },
      { id: 'looters_instincts', target: 5 }
    ],
    branchPriority: ['survival', 'conditioning', 'mobility']
  },
  {
    name: 'Outpost Tinkerer',
    summary: 'Survival craftsman & gadget support',
    desc: 'Controls zones and supports squad survival by field-crafting traps, decoys, and healing sprays topside. Highly self-sufficient in late raids.',
    focus: 'PvE',
    risk: 'Medium',
    points: { conditioning: 18, mobility: 15, survival: 42 },
    augment: 'Tactical Mk. 3 (Healing)',
    weapons: 'Rattler IV (Assault Rifle), Medium Shield | Nanite Healers, Deployable Turrets, Ammo',
    unlocked: [],
    defaultAllocations: {
      agile_croucher: 5, silent_scavenger: 5, good_as_new: 5, in_round_crafting: 1, three_deep_breaths: 5,
      effortless_swing: 5, used_to_weight: 5, a_little_extra: 5, proficient_pryer: 3, marathon_runner: 5,
      youthful_lungs: 5, nimble_climber: 5, one_raiders_scraps: 5, suffer_in_silence: 5, looters_luck: 5,
      traveling_tinkerer: 1, broad_shoulders: 3, minesweeper: 1, security_breach: 1
    },
    priorityList: [
      { id: 'agile_croucher', target: 1 },
      { id: 'silent_scavenger', target: 1 },
      { id: 'marathon_runner', target: 1 },
      { id: 'youthful_lungs', target: 1 },
      { id: 'agile_croucher', target: 5 },
      { id: 'silent_scavenger', target: 5 },
      { id: 'good_as_new', target: 5 },
      { id: 'in_round_crafting', target: 1 },
      { id: 'three_deep_breaths', target: 5 },
      { id: 'effortless_swing', target: 5 },
      { id: 'used_to_weight', target: 5 },
      { id: 'a_little_extra', target: 5 },
      { id: 'proficient_pryer', target: 3 },
      { id: 'marathon_runner', target: 5 },
      { id: 'youthful_lungs', target: 5 },
      { id: 'nimble_climber', target: 5 },
      { id: 'one_raiders_scraps', target: 5 },
      { id: 'suffer_in_silence', target: 5 },
      { id: 'looters_luck', target: 5 },
      { id: 'minesweeper', target: 1 },
      { id: 'traveling_tinkerer', target: 1 },
      { id: 'broad_shoulders', target: 3 },
      { id: 'security_breach', target: 1 }
    ],
    branchPriority: ['survival', 'conditioning', 'mobility']
  },
  {
    name: 'Naked Scrapper',
    summary: 'Zero-to-Hero fists & stealth scavenger',
    desc: 'Designed for extreme Zero-to-Hero runs. Starts with no weapons, shields, or custom augments. Relies on melee damage (fists), fast crouching, silent search, and traversal stamina to survive and carry found loot home.',
    focus: 'Mixed',
    risk: 'Zero',
    points: { conditioning: 15, mobility: 15, survival: 45 },
    augment: 'None (Bare Bones)',
    weapons: 'None (Bare Bones) | Fists / Melee',
    unlocked: [],
    defaultAllocations: {
      effortless_swing: 5, sky_clearing_swing: 5, a_little_extra: 5,
      marathon_runner: 5, youthful_lungs: 5, nimble_climber: 5,
      agile_croucher: 5, silent_scavenger: 5, suffer_in_silence: 5, good_as_new: 5,
      in_round_crafting: 1, looters_luck: 5, minesweeper: 1, three_deep_breaths: 5,
      one_raiders_scraps: 4, broad_shoulders: 3, looters_instincts: 4, security_breach: 1,
      stubborn_mule: 1
    },
    priorityList: [
      { id: 'effortless_swing', target: 1 },
      { id: 'sky_clearing_swing', target: 1 },
      { id: 'marathon_runner', target: 1 },
      { id: 'youthful_lungs', target: 1 },
      { id: 'agile_croucher', target: 1 },
      { id: 'silent_scavenger', target: 1 },
      { id: 'effortless_swing', target: 5 },
      { id: 'sky_clearing_swing', target: 5 },
      { id: 'a_little_extra', target: 5 },
      { id: 'marathon_runner', target: 5 },
      { id: 'youthful_lungs', target: 5 },
      { id: 'nimble_climber', target: 5 },
      { id: 'agile_croucher', target: 5 },
      { id: 'silent_scavenger', target: 5 },
      { id: 'suffer_in_silence', target: 5 },
      { id: 'good_as_new', target: 5 },
      { id: 'in_round_crafting', target: 1 },
      { id: 'looters_luck', target: 5 },
      { id: 'minesweeper', target: 1 },
      { id: 'three_deep_breaths', target: 5 },
      { id: 'one_raiders_scraps', target: 4 },
      { id: 'broad_shoulders', target: 3 },
      { id: 'looters_instincts', target: 4 },
      { id: 'security_breach', target: 1 },
      { id: 'stubborn_mule', target: 1 }
    ],
    branchPriority: ['survival', 'conditioning', 'mobility']
  },
  {
    name: 'Freeloader',
    summary: 'Low-risk starter kit value runner',
    desc: 'Uses only the basic free gear provided by default (Free Loadout Augment, Ferro I, Hairpin I). Focuses on balanced stamina recovery, trap awareness, and scrap prying to secure profit with zero investment risk.',
    focus: 'Mixed',
    risk: 'Low',
    points: { conditioning: 10, mobility: 20, survival: 45 },
    augment: 'Free Loadout (Basic)',
    weapons: 'Ferro I (Battle Rifle), Hairpin I (Pistol) | Bandages, Light/Medium Ammo',
    unlocked: [],
    defaultAllocations: {
      blast_born: 5, a_little_extra: 5,
      marathon_runner: 5, youthful_lungs: 5, nimble_climber: 5, slip_slide: 5,
      agile_croucher: 5, silent_scavenger: 5, suffer_in_silence: 5, good_as_new: 5,
      in_round_crafting: 1, looters_luck: 5, three_deep_breaths: 5, one_raiders_scraps: 4,
      minesweeper: 1, broad_shoulders: 3, looters_instincts: 5, security_breach: 1
    },
    priorityList: [
      { id: 'blast_born', target: 1 },
      { id: 'a_little_extra', target: 1 },
      { id: 'marathon_runner', target: 1 },
      { id: 'youthful_lungs', target: 1 },
      { id: 'agile_croucher', target: 1 },
      { id: 'silent_scavenger', target: 1 },
      { id: 'blast_born', target: 5 },
      { id: 'a_little_extra', target: 5 },
      { id: 'marathon_runner', target: 5 },
      { id: 'youthful_lungs', target: 5 },
      { id: 'nimble_climber', target: 5 },
      { id: 'slip_slide', target: 5 },
      { id: 'agile_croucher', target: 5 },
      { id: 'silent_scavenger', target: 5 },
      { id: 'suffer_in_silence', target: 5 },
      { id: 'good_as_new', target: 5 },
      { id: 'in_round_crafting', target: 1 },
      { id: 'looters_luck', target: 5 },
      { id: 'three_deep_breaths', target: 5 },
      { id: 'one_raiders_scraps', target: 4 },
      { id: 'minesweeper', target: 1 },
      { id: 'broad_shoulders', target: 3 },
      { id: 'looters_instincts', target: 5 },
      { id: 'security_breach', target: 1 }
    ],
    branchPriority: ['survival', 'mobility', 'conditioning']
  },
  {
    name: 'Custom Build',
    summary: 'Your hand-crafted skill combination',
    desc: 'Experiment by toggling individual skills in the columns. Click any node to add or remove it from your loadout.',
    points: { conditioning: 0, mobility: 0, survival: 0 },
    augment: 'None / Custom Loadout',
    weapons: 'None / Custom Loadout',
    unlocked: []
  }
];

let activeBuildIndex = 0;
let customBaselineAllocations = {};

window.initSkillPlanner = function() {
  const listContainer = document.getElementById('build-list-container');
  if (!listContainer) return;
  
  listContainer.innerHTML = '';
  
  SKILL_BUILDS.forEach((build, index) => {
    // Pre-calculate points based on unlocked skill list
    updateBuildStats(build);

    const card = document.createElement('div');
    card.className = `build-card ${index === activeBuildIndex ? 'active' : ''}`;
    card.onclick = () => selectBuild(index);
    
    card.innerHTML = `
      <div class="build-card-title">${build.name}</div>
      <div class="build-card-summary">${build.summary}</div>
      ${build.focus ? `
        <div class="build-card-badges">
          <span class="badge badge-focus badge-${build.focus.toLowerCase().replace('/', '-')}" title="Core Focus: ${build.focus}">${build.focus}</span>
          <span class="badge badge-risk badge-${build.risk.toLowerCase()}" title="Risk Profile: ${build.risk} Risk">${build.risk} Risk</span>
        </div>
      ` : ''}
    `;
    listContainer.appendChild(card);
  });
  
  selectBuild(activeBuildIndex);
};

window.selectBuild = function(buildIndex) {
  activeBuildIndex = buildIndex;
  
  // Highlight active sidebar card
  document.querySelectorAll('.build-card').forEach((card, index) => {
    if (index === buildIndex) card.classList.add('active');
    else card.classList.remove('active');
  });
  
  const build = SKILL_BUILDS[buildIndex];
  
  // Expedition limit logic (Level + Bonus points)
  const levelInput = document.getElementById('character-level-input');
  const bonusInput = document.getElementById('expedition-bonus-input');
  const charLevel = levelInput ? parseInt(levelInput.value) || 1 : 75;
  const bonusPoints = bonusInput ? parseInt(bonusInput.value) || 0 : 0;
  
  const pointsFromLevel = charLevel;
  const maxPoints = pointsFromLevel + bonusPoints;

  // Check if auto-adjust is enabled
  const autoAdjustToggle = document.getElementById('auto-adjust-toggle');
  const isAutoAdjust = autoAdjustToggle ? autoAdjustToggle.checked : true;
  
  const baseline = buildIndex === 8 ? customBaselineAllocations : (build.defaultAllocations || {});
  
  if (isAutoAdjust) {
    if (build.priorityList) {
      build.allocations = autoAdjustBuild(null, maxPoints, getBranchPriority(build), build.priorityList);
    } else {
      const branchPriority = getBranchPriority(build);
      build.allocations = autoAdjustBuild(baseline, maxPoints, branchPriority, null);
    }
  } else {
    build.allocations = { ...baseline };
  }
  
  // Always calculate points dynamically to ensure consistency
  updateBuildStats(build);
  
  // Update header/descriptions
  document.getElementById('active-build-title').innerHTML = `
    ${build.name} Skill Matrix
    ${build.focus ? `
      <span class="active-badge badge-focus badge-${build.focus.toLowerCase().replace('/', '-')}" style="margin-left:0.5rem; vertical-align:middle;">${build.focus}</span>
      <span class="active-badge badge-risk badge-${build.risk.toLowerCase()}" style="margin-left:0.25rem; vertical-align:middle;">${build.risk} Risk</span>
    ` : ''}
  `;
  document.getElementById('active-build-desc').innerHTML = build.desc;
  
  // Calculate total allocated points
  const totalAllocated = build.points.conditioning + build.points.mobility + build.points.survival;
  
  const pointsCounter = document.getElementById('build-total-points');
  if (pointsCounter) {
    pointsCounter.textContent = `${totalAllocated} / ${maxPoints}`;
    if (totalAllocated > maxPoints) {
      pointsCounter.style.color = '#ef4444';
      pointsCounter.style.fontWeight = '800';
    } else {
      pointsCounter.style.color = 'var(--accent-color)';
      pointsCounter.style.fontWeight = '600';
    }
  }

  const adviceTextEl = document.getElementById('expedition-advice-text');
  if (adviceTextEl) {
    const baselineTotal = Object.values(baseline).reduce((sum, v) => sum + v, 0);
    if (totalAllocated > maxPoints) {
      adviceTextEl.innerHTML = `<span style="color:#ef4444; font-weight:700;">LIMIT EXCEEDED!</span> Lower your requirements or remove ${totalAllocated - maxPoints} pts to activate this setup.`;
    } else if (isAutoAdjust && totalAllocated < baselineTotal) {
      adviceTextEl.innerHTML = `<span style="color:var(--accent-color); font-weight:700;">AUTO-ADJUSTED (Downscaled):</span> Pruned ${baselineTotal - totalAllocated} points from highest tiers to fit within limit.`;
    } else if (isAutoAdjust && totalAllocated > baselineTotal && baselineTotal > 0) {
      adviceTextEl.innerHTML = `<span style="color:var(--accent-color); font-weight:700;">AUTO-ADJUSTED (Upscaled):</span> Distributed ${totalAllocated - baselineTotal} extra points to match your level budget.`;
    } else {
      if (maxPoints <= 15) {
        adviceTextEl.textContent = 'Rookie stage. Prioritize Tier 1 recovery or stamina skills first.';
      } else if (maxPoints <= 35) {
        adviceTextEl.textContent = 'Early Raider. Invest in Tier 1 passives and one core Tier 2 upgrade.';
      } else if (maxPoints <= 55) {
        adviceTextEl.textContent = 'Mid-game Scrapper. Balanced layout. Select up to one Tier 3 skill.';
      } else if (maxPoints <= 75) {
        adviceTextEl.textContent = 'Experienced Raider. High-efficiency skill branch investments.';
      } else if (maxPoints <= 95) {
        adviceTextEl.textContent = 'Veteran level. Highly optimized hybrid layouts are available.';
      } else {
        adviceTextEl.textContent = 'Endgame build fully active. All synergy bonuses unlocked.';
      }
    }
  }

  // Update builds overview cards
  document.getElementById('build-rec-augment').textContent = build.augment;
  document.getElementById('build-rec-weapons').textContent = build.weapons;
  
  // Update path point numbers
  document.getElementById('points-conditioning').textContent = `${build.points.conditioning} pts`;
  document.getElementById('points-mobility').textContent = `${build.points.mobility} pts`;
  document.getElementById('points-survival').textContent = `${build.points.survival} pts`;
  
  // Calculate highest tier reached
  let maxTier = 0;
  build.unlocked.forEach(skillId => {
    for (const branch in SKILLS_DB) {
      const skill = SKILLS_DB[branch].find(s => s.id === skillId);
      if (skill && skill.tier > maxTier) {
        maxTier = skill.tier;
      }
    }
  });
  document.getElementById('build-highest-tier').textContent = maxTier > 0 ? `Tier ${maxTier}` : 'None';

  // Toggle reset button visibility
  const resetBtn = document.getElementById('reset-build-btn');
  if (resetBtn) {
    resetBtn.style.display = buildIndex === 8 ? 'block' : 'none';
  }

  // Render nodes for each branch
  renderBranchNodes('conditioning', build);
  renderBranchNodes('mobility', build);
  renderBranchNodes('survival', build);
  
  // Reset skill details panel
  document.getElementById('skill-detail-text').textContent = 'Hover over or click any skill node in the planner columns to view its full mechanical description, tier requirements, and active bonuses.';
};

function getMaxPointsForSkill(skill) {
  if (!skill) return 5;
  return skill.maxPoints || 5;
}

function findSkillById(skillId) {
  for (const branch in SKILLS_DB) {
    const skill = SKILLS_DB[branch].find(s => s.id === skillId);
    if (skill) return skill;
  }
  return null;
}

function getSkillBranch(skillId) {
  for (const branch in SKILLS_DB) {
    if (SKILLS_DB[branch].some(s => s.id === skillId)) {
      return branch;
    }
  }
  return null;
}

function getBranchPriority(build) {
  if (build.branchPriority) {
    return build.branchPriority;
  }
  // For Custom Build, calculate based on customBaselineAllocations
  const points = { conditioning: 0, mobility: 0, survival: 0 };
  Object.entries(customBaselineAllocations).forEach(([skillId, pts]) => {
    const branch = getSkillBranch(skillId);
    if (branch) {
      points[branch] += pts;
    }
  });
  // Sort branches by points descending
  const sorted = Object.entries(points).sort((a, b) => b[1] - a[1]);
  return sorted.map(entry => entry[0]);
}

function autoAdjustBuild(baseline, targetPoints, branchPriority, priorityList) {
  if (priorityList && priorityList.length > 0) {
    // PRESET SCALING: use the ordered priority steps
    const allocations = {};
    let pointsLeft = targetPoints;
    
    for (const step of priorityList) {
      if (pointsLeft <= 0) break;
      const currentPts = allocations[step.id] || 0;
      const targetPts = step.target;
      if (currentPts < targetPts) {
        const needed = targetPts - currentPts;
        const toAllocate = Math.min(needed, pointsLeft);
        allocations[step.id] = currentPts + toAllocate;
        pointsLeft -= toAllocate;
      }
    }
    
    // If we have remaining points (e.g. above 76 points), allocate them to other unlocked skills
    if (pointsLeft > 0) {
      const allSkills = [];
      for (const branch in SKILLS_DB) {
        SKILLS_DB[branch].forEach(s => allSkills.push(s));
      }
      
      const isSkillUnlockedUnderAllocations = (skill, allocs) => {
        if (skill.tier === 1) return true;
        const branch = getSkillBranch(skill.id);
        const branchSkills = SKILLS_DB[branch];
        let t1Pts = 0;
        let t2Pts = 0;
        branchSkills.forEach(s => {
          if (s.tier === 1) t1Pts += (allocs[s.id] || 0);
          if (s.tier === 2) t2Pts += (allocs[s.id] || 0);
        });
        if (skill.tier === 2) return t1Pts >= 15;
        if (skill.tier === 3) return (t1Pts + t2Pts) >= 36;
        return false;
      };
      
      while (pointsLeft > 0) {
        const candidates = allSkills.filter(s => {
          const current = allocations[s.id] || 0;
          const max = getMaxPointsForSkill(s);
          return current < max && isSkillUnlockedUnderAllocations(s, allocations);
        });
        
        if (candidates.length === 0) break;
        
        candidates.sort((a, b) => {
          const aHas = (allocations[a.id] || 0) > 0 ? 1 : 0;
          const bHas = (allocations[b.id] || 0) > 0 ? 1 : 0;
          if (aHas !== bHas) return bHas - aHas;
          
          if (branchPriority) {
            const aBranch = getSkillBranch(a.id);
            const bBranch = getSkillBranch(b.id);
            if (aBranch !== bBranch) {
              const aBranchIdx = branchPriority.indexOf(aBranch);
              const bBranchIdx = branchPriority.indexOf(bBranch);
              if (aBranchIdx !== -1 && bBranchIdx !== -1) {
                return aBranchIdx - bBranchIdx;
              }
            }
          }
          if (a.tier !== b.tier) return a.tier - b.tier;
          return a.id.localeCompare(b.id);
        });
        
        allocations[candidates[0].id] = (allocations[candidates[0].id] || 0) + 1;
        pointsLeft--;
      }
    }
    
    return allocations;
  } else {
    // CUSTOM SCALING: scale custom build based on baseline
    return scaleCustomBuild(baseline, targetPoints, branchPriority);
  }
}

function scaleCustomBuild(baseline, targetPoints, branchPriority) {
  const allocations = { ...baseline };
  
  Object.keys(allocations).forEach(id => {
    if (allocations[id] <= 0) delete allocations[id];
  });
  
  let currentTotal = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  
  if (currentTotal > targetPoints) {
    while (currentTotal > targetPoints) {
      const activeSkills = Object.keys(allocations).map(id => findSkillById(id)).filter(Boolean);
      if (activeSkills.length === 0) break;
      
      const isPruneSafe = (skill) => {
        const branch = getSkillBranch(skill.id);
        const branchSkills = SKILLS_DB[branch];
        
        let t1Spent = 0;
        let t2Spent = 0;
        let t3Spent = 0;
        branchSkills.forEach(s => {
          const pts = allocations[s.id] || 0;
          if (s.tier === 1) t1Spent += pts;
          if (s.tier === 2) t2Spent += pts;
          if (s.tier === 3) t3Spent += pts;
        });
        
        if (skill.tier === 3) return true;
        
        if (skill.tier === 2) {
          if (t3Spent > 0 && (t1Spent + t2Spent - 1) < 36) return false;
          return true;
        }
        
        if (skill.tier === 1) {
          if (t2Spent > 0 && (t1Spent - 1) < 15) return false;
          if (t3Spent > 0 && (t1Spent + t2Spent - 1) < 36) return false;
          return true;
        }
        
        return true;
      };
      
      const safeCandidates = activeSkills.filter(isPruneSafe);
      
      if (safeCandidates.length === 0) {
        // Fallback to avoid deadlocks: prune highest tier active skill
        activeSkills.sort((a, b) => b.tier - a.tier);
        const skillToPrune = activeSkills[0];
        allocations[skillToPrune.id]--;
        if (allocations[skillToPrune.id] === 0) delete allocations[skillToPrune.id];
      } else {
        safeCandidates.sort((a, b) => {
          if (b.tier !== a.tier) return b.tier - a.tier;
          const aBranch = getSkillBranch(a.id);
          const bBranch = getSkillBranch(b.id);
          const aBranchIdx = branchPriority.indexOf(aBranch);
          const bBranchIdx = branchPriority.indexOf(bBranch);
          if (bBranchIdx !== aBranchIdx) return bBranchIdx - aBranchIdx;
          return b.id.localeCompare(a.id);
        });
        
        const skillToPrune = safeCandidates[0];
        allocations[skillToPrune.id]--;
        if (allocations[skillToPrune.id] === 0) delete allocations[skillToPrune.id];
      }
      currentTotal--;
    }
  } else if (currentTotal < targetPoints) {
    // Disable automatic upscaling for custom builds to allow manual/incremental allocation.
    // This prevents the system from automatically filling in remaining points.
  }
  
  return allocations;
}

function updateBuildStats(build) {
  // Ensure allocations dictionary exists
  if (!build.allocations) {
    build.allocations = {};
    if (build.defaultAllocations) {
      build.allocations = { ...build.defaultAllocations };
    } else {
      build.unlocked.forEach(skillId => {
        const skill = findSkillById(skillId);
        if (skill) {
          build.allocations[skillId] = getMaxPointsForSkill(skill);
        }
      });
    }
  }
  
  let condPts = 0;
  let mobPts = 0;
  let survPts = 0;
  
  Object.entries(build.allocations).forEach(([skillId, pts]) => {
    let skill = SKILLS_DB.conditioning.find(s => s.id === skillId);
    if (skill) condPts += pts;
    
    skill = SKILLS_DB.mobility.find(s => s.id === skillId);
    if (skill) mobPts += pts;
    
    skill = SKILLS_DB.survival.find(s => s.id === skillId);
    if (skill) survPts += pts;
  });
  
  build.points.conditioning = condPts;
  build.points.mobility = mobPts;
  build.points.survival = survPts;
  
  // Sync the unlocked list for compatibility with standard checks
  build.unlocked = Object.keys(build.allocations).filter(id => build.allocations[id] > 0);
}

window.toggleSkill = function(skillId, branchKey) {
  const customBuild = SKILL_BUILDS[8];
  
  // If active build is one of the templates (0-7), clone its allocations to baseline to start
  if (activeBuildIndex < 8) {
    const activeTemplate = SKILL_BUILDS[activeBuildIndex];
    customBaselineAllocations = { ...(activeTemplate.allocations || activeTemplate.defaultAllocations || {}) };
    customBuild.allocations = { ...customBaselineAllocations };
    customBuild.augment = activeTemplate.augment;
    customBuild.weapons = activeTemplate.weapons;
    activeBuildIndex = 8;
  } else {
    // Sync the baseline with currently active/visible allocations to prevent stale/hidden state overrides
    customBaselineAllocations = { ...customBuild.allocations };
  }
  
  const skill = findSkillById(skillId);
  if (!skill) return;
  
  const maxPts = getMaxPointsForSkill(skill);
  
  // Calculate current branch allocations under customBaselineAllocations
  const branchSkills = SKILLS_DB[branchKey];
  let t1Spent = 0;
  let t2Spent = 0;
  let t3Spent = 0;
  branchSkills.forEach(s => {
    const pts = customBaselineAllocations[s.id] || 0;
    if (s.tier === 1) t1Spent += pts;
    if (s.tier === 2) t2Spent += pts;
    if (s.tier === 3) t3Spent += pts;
  });

  const currentPts = customBaselineAllocations[skillId] || 0;
  let nextPts = currentPts + 1;
  if (nextPts > maxPts) {
    nextPts = 0; // Wrap around to 0
  }

  // Calculate simulated branch totals if we apply this change
  let newT1 = t1Spent;
  let newT2 = t2Spent;
  let newT3 = t3Spent;
  if (skill.tier === 1) newT1 = t1Spent - currentPts + nextPts;
  if (skill.tier === 2) newT2 = t2Spent - currentPts + nextPts;
  if (skill.tier === 3) newT3 = t3Spent - currentPts + nextPts;

  // Validation Checks:
  const showErrorMsg = (msg) => {
    const textContainer = document.getElementById('skill-detail-text');
    if (textContainer) {
      textContainer.innerHTML = `
        <div style="margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#ef4444; font-size:1.05rem;"><i class="fa-solid fa-triangle-exclamation"></i> Action Blocked</strong>
        </div>
        <div style="line-height:1.5; color:#f87171; font-size:0.9rem; margin-bottom:0.5rem;">
          ${msg}
        </div>
        <div style="font-size:0.75rem; color:var(--text-muted); border-top: 1px dashed var(--panel-border); padding-top: 0.5rem; margin-top: 0.5rem;">
          <i class="fa-solid fa-circle-info" style="color:#ef4444; margin-right:0.25rem;"></i>
          Prerequisite requirements not met or removal would violate higher-tier allocations.
        </div>
      `;
    }
  };

  if (nextPts > currentPts) {
    // Increment: check locks
    if (skill.tier === 2 && t1Spent < 15) {
      showErrorMsg(`Cannot invest in Tier 2: requires at least 15 points spent in Tier 1 of this branch (currently has ${t1Spent} pts).`);
      return;
    }
    if (skill.tier === 3 && (t1Spent + t2Spent) < 36) {
      showErrorMsg(`Cannot invest in Tier 3: requires at least 36 points spent in Tiers 1 & 2 of this branch (currently has ${t1Spent + t2Spent} pts).`);
      return;
    }
  } else {
    // Decrement or reset to 0: check if we violate requirements of remaining active skills
    if ((t2Spent > 0 || t3Spent > 0) && newT1 < 15) {
      showErrorMsg(`Cannot remove points: this would reduce Tier 1 spent to ${newT1} pts (minimum 15 required), but you still have points allocated in Tier 2/3.`);
      return;
    }
    if (t3Spent > 0 && (newT1 + newT2) < 36) {
      showErrorMsg(`Cannot remove points: this would reduce Tiers 1 & 2 combined spent to ${newT1 + newT2} pts (minimum 36 required), but you still have points allocated in Tier 3.`);
      return;
    }
  }

  // If validation passes, apply change
  if (nextPts === 0) {
    delete customBaselineAllocations[skillId];
  } else {
    customBaselineAllocations[skillId] = nextPts;
  }
  
  // Update sidebar selection visual
  document.querySelectorAll('.build-card').forEach((card, i) => {
    if (i === activeBuildIndex) card.classList.add('active');
    else card.classList.remove('active');
  });

  // Re-select / Re-render build
  selectBuild(activeBuildIndex);
  
  // Update details panel to keep focus on toggled skill
  if (skill) {
    const activeAllocatedPts = customBuild.allocations[skillId] || 0;
    const isUnlockedNow = activeAllocatedPts > 0;
    // Calculate if it is locked under the newly rendered allocations
    const { isLocked } = checkSkillLockState(skill, customBuild.allocations);
    showSkillDetail(skill, isUnlockedNow, branchKey, activeAllocatedPts, isLocked);
  }
};

// Helper to determine skill lock state dynamically
function checkSkillLockState(skill, allocations) {
  if (skill.tier === 1) return { isLocked: false };
  
  const branch = getSkillBranch(skill.id);
  const branchSkills = SKILLS_DB[branch];
  
  let t1Spent = 0;
  let t2Spent = 0;
  branchSkills.forEach(s => {
    const pts = allocations[s.id] || 0;
    if (s.tier === 1) t1Spent += pts;
    if (s.tier === 2) t2Spent += pts;
  });
  
  if (skill.tier === 2) {
    return { isLocked: t1Spent < 15, req: 15, current: t1Spent, tierTarget: 1 };
  }
  if (skill.tier === 3) {
    return { isLocked: (t1Spent + t2Spent) < 36, req: 36, current: t1Spent + t2Spent, tierTarget: 2 };
  }
  
  return { isLocked: false };
}

window.resetCustomBuild = function() {
  const customBuild = SKILL_BUILDS[8];
  customBuild.unlocked = [];
  customBuild.allocations = {};
  customBaselineAllocations = {};
  customBuild.weapons = 'None / Custom Loadout';
  customBuild.augment = 'None / Custom Loadout';
  updateBuildStats(customBuild);
  selectBuild(8);
};

window.updateExpeditionLimit = function() {
  selectBuild(activeBuildIndex);
};

function getSkillScaleInfo(id) {
  const db = {
    used_to_weight: { pattern: 'Reduces movement speed penalty by {val}% when wearing a shield.', calc: (p) => p * 6 },
    blast_born: { pattern: 'Reduces the duration of hearing impairment and shake caused by nearby explosions by {val}%.', calc: (p) => p * 10 },
    a_little_extra: { pattern: 'Breaching doors and containers generates additional random crafting materials (Level {val}).', calc: (p) => p },
    effortless_swing: { pattern: 'Reduces the stamina cost of all melee attacks by {val}%.', calc: (p) => p * 5 },
    sky_clearing_swing: { pattern: 'Increases melee damage against airborne drones by {val}%.', calc: (p) => p * 10 },
    proficient_pryer: { pattern: 'Reduces container and door prying time by {val}%.', calc: (p) => p * 5 },
    gentle_pressure: { pattern: 'Reduces noise made when breaching doors or containers by {val}%.', calc: (p) => p * 8 },
    turtle_crawl: { pattern: 'Reduces damage taken by {val}% while in a downed (crawling) state.', calc: (p) => p * 8 },
    fight_or_flight: { pattern: 'Regain {val} stamina instantly when taking damage in combat (15s cooldown).', calc: (p) => p * 3 },
    downed_determined: { pattern: 'Increases bleed-out time when downed by {val}%, giving allies more time to revive you.', calc: (p) => p * 6 },
    marathon_runner: { pattern: 'Sprinting consumes {val}% less stamina.', calc: (p) => p * 4 },
    youthful_lungs: { pattern: 'Increases maximum stamina pool by {val} points.', calc: (p) => p * 5 },
    nimble_climber: { pattern: 'Increases climbing, vaulting, and ladder traversal speeds by {val}%.', calc: (p) => p * 6 },
    effortless_roll: { pattern: 'Reduces the stamina cost of dodge rolls by {val}%.', calc: (p) => p * 5 },
    sturdy_ankles: { pattern: 'Reduces falling damage by {val}% from non-lethal heights.', calc: (p) => p * 10 },
    slip_slide: { pattern: 'Increases slide distance by {val1}% and slide speed by {val2}%.', calcMulti: (p) => ({ val1: p * 5, val2: p * 3 }) },
    heroic_leap: { pattern: 'Increases the distance of sprint dodge rolls by {val}%.', calc: (p) => p * 6 },
    crawl_before_walk: { pattern: 'Increases movement speed while in a downed crawling state by {val}%.', calc: (p) => p * 8 },
    ready_to_roll: { pattern: 'Increases the timing window for a recovery roll after falling to avoid damage by {val}%.', calc: (p) => p * 20 },
    off_the_wall: { pattern: 'Increases wall-bound leap distance by {val}%.', calc: (p) => p * 8 },
    agile_croucher: { pattern: 'Increases crouching movement speed by {val}%.', calc: (p) => p * 5 },
    silent_scavenger: { pattern: 'Reduces the radius of noise generated when searching containers by {val}%.', calc: (p) => p * 10 },
    revitalizing_squat: { pattern: 'Increases stamina regeneration rate by {val}% while crouched.', calc: (p) => p * 4 },
    good_as_new: { pattern: 'Increases stamina regeneration rate by {val}% while under healing effects.', calc: (p) => p * 6 },
    suffer_in_silence: { pattern: 'Reduces noise generated by your movement when critically injured by {val}%.', calc: (p) => p * 10 },
    looters_luck: { pattern: 'Increases the chance of finding rare components in industrial chests by {val}%.', calc: (p) => p * 3 },
    three_deep_breaths: { pattern: 'Reduces the stamina recovery delay by {val}% after an ability completely drains it.', calc: (p) => p * 6 },
    one_raiders_scraps: { pattern: 'Adds a {val}% chance to find additional field-crafted utility items inside containers.', calc: (p) => p * 3 },
    broad_shoulders: { pattern: 'Increases maximum carry weight limit by up to {val} kg.', calc: (p) => (p * 5.0).toFixed(1) },
    looters_instincts: { pattern: 'Container icons are highlighted through walls within a {val}-meter range.', calc: (p) => p * 3 },
    stubborn_mule: { pattern: 'Reduces the movement speed penalty and stamina drain when over-encumbered by {val}%.', calc: (p) => p * 8 }
  };
  return db[id] || null;
}

function formatDescPattern(pattern, val) {
  if (typeof val === 'object') {
    let result = pattern;
    for (const key in val) {
      result = result.replace(`{${key}}`, val[key]);
    }
    return result;
  }
  return pattern.replace('{val}', val);
}

function getSkillDescriptionHTML(skill, allocatedPoints) {
  const maxPts = skill.maxPoints || 5;
  let html = '';
  
  if (maxPts === 1) {
    html += `<div style="color:var(--text-secondary); line-height:1.4; font-size:0.78rem; font-family:var(--font-sans); font-weight:400;">${skill.desc}</div>`;
  } else {
    const scaleInfo = getSkillScaleInfo(skill.id);
    if (scaleInfo) {
      const displayLvl = Math.max(1, allocatedPoints);
      const currentVal = scaleInfo.calcMulti ? scaleInfo.calcMulti(displayLvl) : scaleInfo.calc(displayLvl);
      const currentDesc = formatDescPattern(scaleInfo.pattern, currentVal);
      
      const statusPrefix = allocatedPoints > 0 ? `Lvl ${allocatedPoints} (Active):` : `Lvl 1 (Preview):`;
      html += `<div style="color:var(--text-secondary); line-height:1.4; font-size:0.78rem; font-family:var(--font-sans); font-weight:400;">`;
      html += `<strong style="color:${allocatedPoints > 0 ? 'var(--accent-color)' : 'var(--text-muted)'}; margin-right:0.25rem;">${statusPrefix}</strong>`;
      html += `${currentDesc}`;
      html += `</div>`;
    } else {
      html += `<div style="color:var(--text-secondary); line-height:1.4; font-size:0.78rem; font-family:var(--font-sans); font-weight:400;">${skill.desc}</div>`;
    }
  }
  return html;
}

function renderBranchNodes(branchKey, build) {
  const container = document.getElementById(`nodes-${branchKey}`);
  if (!container) return;
  
  container.innerHTML = '';
  const skills = SKILLS_DB[branchKey];
  
  // Ensure allocations exists
  if (!build.allocations) {
    build.allocations = {};
    build.unlocked.forEach(id => {
      const s = findSkillById(id);
      if (s) build.allocations[id] = getMaxPointsForSkill(s);
    });
  }

  // Group skills by tier (1, 2, 3)
  const tiers = { 1: [], 2: [], 3: [] };
  skills.forEach(s => {
    if (tiers[s.tier]) {
      tiers[s.tier].push(s);
    } else {
      tiers[1].push(s);
    }
  });
  
  // Render each tier
  Object.keys(tiers).forEach(tierNum => {
    const tierSkills = tiers[tierNum];
    if (tierSkills.length === 0) return;
    
    // Add Tier Divider
    const divider = document.createElement('div');
    divider.className = 'tier-divider';
    
    let reqText = '';
    if (tierNum == 1) reqText = '0 pts req.';
    else if (tierNum == 2) reqText = '15 pts req.';
    else if (tierNum == 3) reqText = '36 pts req.';
    
    divider.innerHTML = `
      <span class="tier-divider-text">Tier ${tierNum} <span style="font-size:0.55rem; color:var(--text-muted); font-weight:400; text-transform:none; margin-left:0.25rem;">(${reqText})</span></span>
    `;
    container.appendChild(divider);
    
    tierSkills.forEach(skill => {
      const allocatedPoints = build.allocations[skill.id] || 0;
      const maxPts = getMaxPointsForSkill(skill);
      const isUnlocked = allocatedPoints > 0;
      
      const { isLocked } = checkSkillLockState(skill, build.allocations);
      
      const card = document.createElement('div');
      card.className = `skill-node-card ${isLocked ? 'tier-locked' : (isUnlocked ? `unlocked ${branchKey}` : 'locked')}`;
      
      card.onmouseover = () => showSkillDetail(skill, isUnlocked, branchKey, allocatedPoints, isLocked);
      card.onclick = () => toggleSkill(skill.id, branchKey);
      
      let lockIcon = isLocked ? `<i class="fa-solid fa-lock" style="margin-left:0.25rem; font-size:0.65rem; color:#ef4444;" title="Tier Locked"></i>` : '';
      
      let tooltipStatus = '';
      if (isLocked) {
        let req = skill.tier === 2 ? 'Requires 15 pts in Tier 1' : 'Requires 36 pts in Tiers 1 & 2';
        tooltipStatus = `<span style="color:#ef4444; font-weight:700;"><i class="fa-solid fa-lock" style="margin-right:0.15rem;"></i>LOCKED (${req})</span>`;
      } else if (allocatedPoints > 0) {
        tooltipStatus = `<span style="color:var(--accent-color); font-weight:700;">INVESTED: ${allocatedPoints}/${maxPts} PTS</span>`;
      } else {
        tooltipStatus = `<span style="color:var(--text-muted);">NOT INVESTED</span>`;
      }

      card.innerHTML = `
        <div class="skill-node-icon">
          <i class="fa-solid ${skill.icon}"></i>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.15rem; flex:1;">
          <span class="skill-node-name">${skill.name} ${lockIcon}</span>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.72rem; color:var(--text-muted); font-family:var(--font-mono);">
            <span>Max: ${maxPts} pts</span>
            <span class="node-point-counter" style="color: ${isUnlocked ? 'var(--accent-color)' : 'var(--text-muted)'}; font-weight:${isUnlocked ? '700' : '400'};">${allocatedPoints}/${maxPts}</span>
          </div>
        </div>
        
        <!-- Hover Tooltip -->
        <div class="skill-tooltip">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:0.35rem; margin-bottom:0.35rem; font-weight:700; gap:0.5rem;">
            <span style="color:#fff; font-size:0.88rem; font-weight:700; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; max-width:160px;">${skill.name}</span>
            <span style="font-size:0.7rem; font-family:var(--font-mono); white-space:nowrap;">${tooltipStatus}</span>
          </div>
          <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.35rem; font-family:var(--font-mono);">
            Tier ${skill.tier} | ${branchKey.charAt(0).toUpperCase() + branchKey.slice(1)}
          </div>
          ${getSkillDescriptionHTML(skill, allocatedPoints)}
        </div>
      `;
      container.appendChild(card);
    });
  });
}

function showSkillDetail(skill, isUnlocked, branchKey, allocatedPoints = 0, isTierLocked = false) {
  const textContainer = document.getElementById('skill-detail-text');
  if (!textContainer) return;
  
  const branchName = branchKey.charAt(0).toUpperCase() + branchKey.slice(1);
  const maxPts = getMaxPointsForSkill(skill);
  
  let statusHtml = '';
  if (isTierLocked) {
    let req = skill.tier === 2 ? '15 pts spent in Tier 1' : '36 pts spent in Tiers 1 & 2';
    statusHtml = `<span style="color:#ef4444; font-weight:700;"><i class="fa-solid fa-lock"></i> LOCKED (Requires ${req})</span>`;
  } else if (allocatedPoints > 0) {
    statusHtml = `<span style="color:var(--accent-color); font-weight:700;">[INVESTED: ${allocatedPoints}/${maxPts} PTS]</span>`;
  } else {
    statusHtml = `<span style="color:var(--text-muted);">[NOT INVESTED]</span>`;
  }
    
  textContainer.innerHTML = `
    <div style="margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
      <strong style="color:#fff; font-size:1.1rem;">${skill.name}</strong>
      ${statusHtml}
    </div>
    <div style="font-size:0.82rem; color:var(--text-muted); margin-bottom:0.5rem; font-family:var(--font-mono); text-transform:uppercase;">
      Branch: ${branchName} | Tier: ${skill.tier} (Max: ${maxPts} pts)
    </div>
    <div style="margin-bottom:0.5rem;">
      ${getSkillDescriptionHTML(skill, allocatedPoints)}
    </div>
    <div style="font-size:0.78rem; color:var(--text-muted); border-top: 1px dashed var(--panel-border); padding-top: 0.5rem; margin-top: 0.5rem;">
      <i class="fa-solid fa-circle-info" style="color: var(--accent-color); margin-right:0.25rem;"></i>
      Click node to increment points (wraps to 0 at max).
    </div>
  `;
}
