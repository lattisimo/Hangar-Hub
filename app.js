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
    return name.includes(query) || type.includes(query);
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
    
    const weapons = itemsDb.filter(isWeaponItem)
      .sort((a, b) => (a.name.en || a.id).localeCompare(b.name.en || b.id));
      
    weapons.forEach(w => {
      const opt1 = document.createElement('option');
      opt1.value = w.id;
      opt1.textContent = `${w.name.en || w.id} (${(w.weightKg || 0).toFixed(2)} kg)`;
      
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
    const matchesSearch = nameEn.includes(searchVal) || descEn.includes(searchVal) || id.includes(searchVal);

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
      switchTab('crafting-tab', document.querySelectorAll('.tab-btn')[1]);
      
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

window.initBackpackStrategist = function() {
  filterBackpackTable();
  updateBackpackSimulator();
};

window.filterBackpackTable = function() {
  const query = document.getElementById('backpack-search').value.toLowerCase();
  const tableBody = document.getElementById('backpack-table-body');
  tableBody.innerHTML = '';

  const filtered = itemsDb.filter(item => {
    const name = (item.name.en || item.id).toLowerCase();
    const type = (item.type || "").toLowerCase();
    return name.includes(query) || type.includes(query);
  });

  if (filtered.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No items match search filter.</td>`;
    tableBody.appendChild(row);
    return;
  }

  filtered.forEach(item => {
    const row = document.createElement('tr');
    const density = item.weightKg > 0 ? (item.value / item.weightKg) : 0;
    
    // Build density badge
    let densityClass = 'low';
    if (density >= 1000) densityClass = 'high';
    else if (density >= 250) densityClass = 'med';

    // Build salvage yield string
    let salvageStr = 'None';
    if (item.salvagesInto && Object.keys(item.salvagesInto).length > 0) {
      salvageStr = Object.entries(item.salvagesInto)
        .map(([mId, qty]) => {
          const mItem = itemsDb.find(i => i.id === mId);
          return `${qty}x ${mItem ? mItem.name.en : mId}`;
        })
        .join(', ');
    }

    const rec = getInRoundRecommendation(item);
    const itemIcon = item.icon || item.imageFilename || '';

    row.innerHTML = `
      <td style="font-weight: 700; cursor: pointer; color: var(--rarity-${item.rarity.toLowerCase()});" onclick="openDetailDrawer('${item.id}')">
        <div style="display:flex; align-items:center;">
          ${itemIcon ? `<img class="material-icon" src="${itemIcon}" alt="" onerror="this.style.display='none';">` : ''}
          <span>${item.name.en || item.id}</span>
        </div>
      </td>
      <td style="font-family: var(--font-mono); font-size: 0.8rem;">${(item.weightKg || 0).toFixed(2)} kg</td>
      <td style="font-family: var(--font-mono); font-weight: 600;">${item.value || 0}c</td>
      <td>
        <span class="density-badge ${densityClass}">${Math.round(density)} c/kg</span>
      </td>
      <td style="color: var(--text-secondary); font-size: 0.8rem;" title="${salvageStr}">
        ${salvageStr}
      </td>
      <td>
        <span class="rec-badge ${rec.badgeClass}" title="${rec.reason}">${rec.action}</span>
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
  const augmentWeight = parseFloat(document.getElementById('equipped-augment').value) || 70.0;
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

    const density = item.weightKg > 0 ? (item.value / item.weightKg) : 0;

    const row = document.createElement('div');
    row.className = 'material-item';
    row.style.padding = '0.35rem 0';
    row.style.borderBottom = '1px solid rgba(255,255,255,0.02)';

    row.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.15rem; max-width:200px;">
        <span style="font-weight:600; font-size:0.8rem; color: var(--rarity-${item.rarity.toLowerCase()}); cursor:pointer;" onclick="openDetailDrawer('${item.id}')">
          ${item.name.en} ${packItem.qty > 1 ? `(x${packItem.qty})` : ''}
        </span>
        <span style="font-size:0.65rem; color:var(--text-muted);">
          Wt: ${itemWeight.toFixed(2)}kg | Val: ${itemValue}c
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

  // Update simulator UI
  document.getElementById('pack-weight-text').textContent = `${totalWeight.toFixed(2)} / ${limit.toFixed(2)} kg`;
  
  const fillPercent = Math.min(100, (totalWeight / limit) * 100);
  const bar = document.getElementById('pack-weight-bar');
  bar.style.width = `${fillPercent}%`;

  if (totalWeight > limit) {
    bar.classList.add('overloaded');
  } else {
    bar.classList.remove('overloaded');
  }

  document.getElementById('pack-total-value').textContent = `${totalValue} c`;
  document.getElementById('pack-avg-density').textContent = `${Math.round(avgDensity)} c/kg`;

  // Generate dynamic optimization advice
  let adviceTitle = '<i class="fa-solid fa-circle-info"></i> In-Round Advice';
  let adviceText = '';
  let adviceClass = 'advice-card';
  let titleClass = 'advice-title';

  if (totalWeight > limit) {
    // Overloaded! Find the lowest density item in the backpack
    let lowestDensityItem = null;
    let lowestDensityVal = Infinity;

    backpackItems.forEach(packItem => {
      const item = itemsDb.find(i => i.id === packItem.id);
      if (!item) return;
      
      const isCritical = ['Key', 'Blueprint'].includes(item.type);
      if (isCritical) return; // Never recommend dropping keys/blueprints

      const density = item.weightKg > 0 ? (item.value / item.weightKg) : 0;
      if (density < lowestDensityVal) {
        lowestDensityVal = density;
        lowestDensityItem = item;
      }
    });

    adviceClass = 'advice-card warning';
    titleClass = 'advice-title warning';
    adviceTitle = '<i class="fa-solid fa-triangle-exclamation"></i> Backpack Overloaded!';
    
    if (lowestDensityItem) {
      adviceText = `Your backpack weight (${totalWeight.toFixed(2)} kg) exceeds the limit. To free up capacity, we recommend dropping <strong>${lowestDensityItem.name.en}</strong> first. It has the lowest value density in your pack (<strong>${Math.round(lowestDensityVal)} c/kg</strong>) and yields poor returns.`;
    } else {
      adviceText = `Your backpack weight (${totalWeight.toFixed(2)} kg) exceeds the limit. Drop your heaviest non-critical equipment to enable extraction.`;
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
        // If weight reduction is high and value loss is low or negative
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
    { id: 'used_to_weight', name: 'Used to the Weight', tier: 1, icon: 'fa-shield-halved', desc: 'Reduces movement speed penalty by 30% when wearing a shield.' },
    { id: 'blast_born', name: 'Blast-Born', tier: 1, icon: 'fa-burst', desc: 'Reduces the duration of hearing impairment and shake caused by nearby explosions by 50%.' },
    { id: 'proficient_pryer', name: 'Proficient Pryer', tier: 2, icon: 'fa-key', desc: 'Reduces container and door prying time by 25%.' },
    { id: 'gentle_pressure', name: 'Gentle Pressure', tier: 2, icon: 'fa-volume-xmark', desc: 'Reduces noise made when breaching doors or containers by 40%.' },
    { id: 'fight_or_flight', name: 'Fight or Flight', tier: 3, icon: 'fa-heart-pulse', desc: 'Regain 15 stamina instantly when taking damage in combat (15s cooldown).' },
    { id: 'survivor_stamina', name: 'Survivor\'s Stamina', tier: 3, icon: 'fa-bolt', desc: 'Stamina regenerates 30% faster when your health drops below 25%.' },
    { id: 'downed_determined', name: 'Downed But Determined', tier: 3, icon: 'fa-hand-holding-heart', desc: 'Increases bleed-out time when downed by 30%, giving allies more time to revive you.' }
  ],
  mobility: [
    { id: 'marathon_runner', name: 'Marathon Runner', tier: 1, icon: 'fa-gauge-high', desc: 'Sprinting consumes 20% less stamina.' },
    { id: 'youthful_lungs', name: 'Youthful Lungs', tier: 1, icon: 'fa-lungs', desc: 'Increases maximum stamina pool by 25 points.' },
    { id: 'nimble_climber', name: 'Nimble Climber', tier: 2, icon: 'fa-person-climbing', desc: 'Increases vaulting, climbing, and ladder traversal speeds by 30%.' },
    { id: 'sturdy_ankles', name: 'Sturdy Ankles', tier: 2, icon: 'fa-shoe-prints', desc: 'Reduces falling damage by 50% from non-lethal heights.' },
    { id: 'slip_slide', name: 'Slip and Slide', tier: 2, icon: 'fa-person-skating', desc: 'Increases slide distance by 25% and slide speed by 15%.' },
    { id: 'carry_momentum', name: 'Carry the Momentum', tier: 3, icon: 'fa-forward', desc: 'Executing a sprint dodge roll negates sprint stamina cost for 2 seconds.' },
    { id: 'calming_stroll', name: 'Calming Stroll', tier: 3, icon: 'fa-person-walking', desc: 'Allows stamina to regenerate at 100% speed while walking (normally requires standing still).' }
  ],
  survival: [
    { id: 'agile_croucher', name: 'Agile Croucher', tier: 1, icon: 'fa-person-running', desc: 'Increases crouching movement speed by 25%.' },
    { id: 'silent_scavenger', name: 'Silent Scavenger', tier: 1, icon: 'fa-volume-mute', desc: 'Reduces the radius of noise generated when searching containers by 50%.' },
    { id: 'in_round_crafting', name: 'In-Round Crafting', tier: 2, icon: 'fa-screwdriver-wrench', desc: 'Unlocks the ability to craft basic medical supplies and ammo stacks topside during raids.' },
    { id: 'looters_luck', name: 'Looter\'s Luck', tier: 2, icon: 'fa-clover', desc: 'Increases the chance of finding rare components in industrial chests by 15%.' },
    { id: 'broad_shoulders', name: 'Broad Shoulders', tier: 3, icon: 'fa-weight-hanging', desc: 'Increases maximum carry weight limit by 15.0 kg.' },
    { id: 'traveling_tinkerer', name: 'Traveling Tinkerer', tier: 3, icon: 'fa-hammer', desc: 'Allows field crafting of high-tier gadgets (e.g. traps, shield rechargers) during raids.' },
    { id: 'looters_instincts', name: 'Looter\'s Instincts', tier: 3, icon: 'fa-eye', desc: 'Container icons are highlighted through walls within a 15-meter range.' }
  ]
};

const SKILL_BUILDS = [
  {
    name: 'Pure Scavenger',
    summary: 'Survival-heavy solo loot collector',
    desc: 'Designed for maximizing scrap extraction. Focuses on carrying massive weight, looting silently, crouching stealthily, and evading combat patrols.',
    points: { conditioning: 5, mobility: 15, survival: 35 },
    augment: 'Looting Mk. 3 (Survivor)',
    weapons: 'Renegade IV (Battle Rifle), Burletta II (Silenced Pistol)',
    unlocked: ['agile_croucher', 'silent_scavenger', 'looters_luck', 'broad_shoulders', 'looters_instincts', 'marathon_runner', 'youthful_lungs', 'nimble_climber', 'blast_born']
  },
  {
    name: 'Combat Vanguard',
    summary: 'Shield-tanking front-line brawler',
    desc: 'Optimized for heavy combat, door-breaching, and team defense. Negates speed penalties when carrying shields, resists blasts, and recovers stamina under fire.',
    points: { conditioning: 35, mobility: 15, survival: 5 },
    augment: 'Tactical Mk. 3 (Defensive)',
    weapons: 'Torrente IV (LMG), Vulcano IV (Shotgun)',
    unlocked: ['used_to_weight', 'blast_born', 'proficient_pryer', 'fight_or_flight', 'survivor_stamina', 'downed_determined', 'youthful_lungs', 'slip_slide', 'carry_momentum', 'agile_croucher']
  },
  {
    name: 'High-Mobility Scout',
    summary: 'Traversal speed runner & pathfinder',
    desc: 'Unmatched speed and vertical parkour agility. Slides, vaults, and climbs through ruins to locate drop zones and extraction points before patrol bots spot you.',
    points: { conditioning: 5, mobility: 35, survival: 15 },
    augment: 'Looting Mk. 3 (Cautious)',
    weapons: 'Stitcher IV (SMG), Burletta IV (Pistol)',
    unlocked: ['marathon_runner', 'youthful_lungs', 'nimble_climber', 'sturdy_ankles', 'slip_slide', 'carry_momentum', 'calming_stroll', 'agile_croucher', 'in_round_crafting', 'blast_born']
  },
  {
    name: 'Stealth Infiltrator',
    summary: 'Quiet lockbreaker & vault burglar',
    desc: 'Sneaks past ARC defenses, opens secure doors/vaults silently, and escapes with rare blueprints. Ideal for high-risk, low-detection looting raids.',
    points: { conditioning: 15, mobility: 10, survival: 30 },
    augment: 'Looting Mk. 3 (Safekeeper)',
    weapons: 'Osprey IV (Sniper), Burletta II (Silenced)',
    unlocked: ['agile_croucher', 'silent_scavenger', 'looters_luck', 'broad_shoulders', 'looters_instincts', 'blast_born', 'proficient_pryer', 'gentle_pressure', 'marathon_runner', 'slip_slide']
  },
  {
    name: 'Outpost Tinkerer',
    summary: 'Survival craftsman & gadget support',
    desc: 'Controls zones and supports squad survival by field-crafting traps, decoys, and healing sprays topside. Highly self-sufficient in late raids.',
    points: { conditioning: 20, mobility: 5, survival: 30 },
    augment: 'Tactical Mk. 3 (Healing)',
    weapons: 'Rattler IV (Assault Rifle), Wasp Driver (Special)',
    unlocked: ['agile_croucher', 'silent_scavenger', 'in_round_crafting', 'traveling_tinkerer', 'broad_shoulders', 'blast_born', 'proficient_pryer', 'gentle_pressure', 'survivor_stamina', 'marathon_runner']
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

window.initSkillPlanner = function() {
  const listContainer = document.getElementById('build-list-container');
  if (!listContainer) return;
  
  listContainer.innerHTML = '';
  
  SKILL_BUILDS.forEach((build, index) => {
    const card = document.createElement('div');
    card.className = `build-card ${index === activeBuildIndex ? 'active' : ''}`;
    card.onclick = () => selectBuild(index);
    
    card.innerHTML = `
      <div class="build-card-title">${build.name}</div>
      <div class="build-card-summary">${build.summary}</div>
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
  
  // If custom build, calculate points dynamically
  if (buildIndex === 5) {
    updateBuildStats(build);
  }
  
  // Update header/descriptions
  document.getElementById('active-build-title').textContent = `${build.name} Skill Matrix`;
  document.getElementById('active-build-desc').innerHTML = build.desc;
  
  // Calculate total allocated points
  const totalAllocated = build.points.conditioning + build.points.mobility + build.points.survival;
  
  // Expedition limit logic
  const expeditionsSelect = document.getElementById('expeditions-select');
  const maxPoints = expeditionsSelect ? parseInt(expeditionsSelect.value) : 55;
  
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
    if (totalAllocated > maxPoints) {
      adviceTextEl.innerHTML = `<span style="color:#ef4444; font-weight:700;">LIMIT EXCEEDED!</span> Complete more expeditions or remove ${totalAllocated - maxPoints} pts to activate this setup.`;
    } else {
      if (maxPoints === 5) {
        adviceTextEl.textContent = 'Rookie stage. Prioritize Tier 1 recovery or stamina skills first.';
      } else if (maxPoints === 15) {
        adviceTextEl.textContent = 'Early Raider. Invest in Tier 1 passives and one core Tier 2 upgrade.';
      } else if (maxPoints === 25) {
        adviceTextEl.textContent = 'Mid-game Scrapper. Balanced layout. Select up to one Tier 3 skill.';
      } else if (maxPoints === 35) {
        adviceTextEl.textContent = 'Experienced. Capped access to Tier 3 skills like Broad Shoulders.';
      } else if (maxPoints === 45) {
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
    resetBtn.style.display = buildIndex === 5 ? 'block' : 'none';
  }

  // Render nodes for each branch
  renderBranchNodes('conditioning', build);
  renderBranchNodes('mobility', build);
  renderBranchNodes('survival', build);
  
  // Reset skill details panel
  document.getElementById('skill-detail-text').textContent = 'Hover over or click any skill node in the planner columns to view its full mechanical description, tier requirements, and active bonuses.';
};

function updateBuildStats(build) {
  let condPts = 0;
  let mobPts = 0;
  let survPts = 0;
  
  build.unlocked.forEach(skillId => {
    let skill = SKILLS_DB.conditioning.find(s => s.id === skillId);
    if (skill) condPts += (skill.tier === 1 ? 5 : (skill.tier === 2 ? 10 : 15));
    
    skill = SKILLS_DB.mobility.find(s => s.id === skillId);
    if (skill) mobPts += (skill.tier === 1 ? 5 : (skill.tier === 2 ? 10 : 15));
    
    skill = SKILLS_DB.survival.find(s => s.id === skillId);
    if (skill) survPts += (skill.tier === 1 ? 5 : (skill.tier === 2 ? 10 : 15));
  });
  
  build.points.conditioning = condPts;
  build.points.mobility = mobPts;
  build.points.survival = survPts;
}

window.toggleSkill = function(skillId, branchKey) {
  const customBuild = SKILL_BUILDS[5];
  
  // If active build is one of the templates (0-4), clone its unlocked array to start
  if (activeBuildIndex < 5) {
    const activeTemplate = SKILL_BUILDS[activeBuildIndex];
    customBuild.unlocked = [...activeTemplate.unlocked];
    customBuild.augment = activeTemplate.augment;
    customBuild.weapons = activeTemplate.weapons;
    activeBuildIndex = 5;
  }
  
  // Toggle the skill
  const idx = customBuild.unlocked.indexOf(skillId);
  if (idx > -1) {
    customBuild.unlocked.splice(idx, 1);
  } else {
    customBuild.unlocked.push(skillId);
  }
  
  // Re-calculate points for custom build
  updateBuildStats(customBuild);
  
  // Update sidebar selection visual
  document.querySelectorAll('.build-card').forEach((card, i) => {
    if (i === activeBuildIndex) card.classList.add('active');
    else card.classList.remove('active');
  });

  // Re-select / Re-render build
  selectBuild(activeBuildIndex);
  
  // Update details panel to keep focus on toggled skill
  const skill = SKILLS_DB[branchKey].find(s => s.id === skillId);
  if (skill) {
    const isUnlockedNow = customBuild.unlocked.includes(skillId);
    showSkillDetail(skill, isUnlockedNow, branchKey);
  }
};

window.resetCustomBuild = function() {
  const customBuild = SKILL_BUILDS[5];
  customBuild.unlocked = [];
  customBuild.weapons = 'None / Custom Loadout';
  customBuild.augment = 'None / Custom Loadout';
  updateBuildStats(customBuild);
  selectBuild(5);
};

window.updateExpeditionLimit = function() {
  selectBuild(activeBuildIndex);
};

function renderBranchNodes(branchKey, build) {
  const container = document.getElementById(`nodes-${branchKey}`);
  if (!container) return;
  
  container.innerHTML = '';
  const skills = SKILLS_DB[branchKey];
  
  skills.forEach(skill => {
    const isUnlocked = build.unlocked.includes(skill.id);
    const card = document.createElement('div');
    card.className = `skill-node-card ${isUnlocked ? `unlocked ${branchKey}` : 'locked'}`;
    
    card.onmouseover = () => showSkillDetail(skill, isUnlocked, branchKey);
    card.onclick = () => toggleSkill(skill.id, branchKey);
    
    card.innerHTML = `
      <div class="skill-node-icon">
        <i class="fa-solid ${skill.icon}"></i>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.15rem;">
        <span class="skill-node-name">${skill.name}</span>
        <span style="font-size:0.6rem; color:var(--text-muted); font-family:var(--font-mono);">Tier ${skill.tier}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function showSkillDetail(skill, isUnlocked, branchKey) {
  const panel = document.getElementById('skill-detail-panel');
  const textContainer = document.getElementById('skill-detail-text');
  
  const branchName = branchKey.charAt(0).toUpperCase() + branchKey.slice(1);
  const statusHtml = isUnlocked 
    ? `<span style="color:var(--accent-color); font-weight:700;">[UNLOCKED IN BUILD]</span>`
    : `<span style="color:var(--text-muted);">[LOCKED IN BUILD]</span>`;
    
  textContainer.innerHTML = `
    <div style="margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
      <strong style="color:#fff; font-size:0.95rem;">${skill.name}</strong>
      ${statusHtml}
    </div>
    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.5rem; font-family:var(--font-mono); text-transform:uppercase;">
      Branch: ${branchName} | Requirement: Tier ${skill.tier}
    </div>
    <div style="line-height:1.5; color:var(--text-secondary);">
      ${skill.desc}
    </div>
  `;
}
