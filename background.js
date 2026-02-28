const ROOT_MENU_ID = "move-tab-root";
const WINDOW_MENU_PREFIX = "move-tab-window-";

let activeMenuWindowMap = new Map();
let activeSourceTabIds = [];
let activeSourceWindowId = null;

async function ensureRootMenu() {
  try {
    await browser.menus.remove(ROOT_MENU_ID);
  } catch (_) {
    // Ignore when the menu does not yet exist.
  }

  browser.menus.create({
    id: ROOT_MENU_ID,
    title: "Move tab to…",
    contexts: ["tab"],
    enabled: false,
  });
}

function clearDynamicWindowItems() {
  for (const menuId of activeMenuWindowMap.keys()) {
    browser.menus.remove(menuId).catch(() => {
      // Ignore races when menus are already gone.
    });
  }
  activeMenuWindowMap = new Map();
}

function getWindowLabel(allTabs) {
  const activeTab = allTabs.find((tab) => tab.active);
  const activeTitle = activeTab?.title || "(untitled tab)";
  const count = allTabs.length;
  const tabWord = count === 1 ? "tab" : "tabs";

  return `${count} ${tabWord} — ${activeTitle}`;
}

async function getSelectedTabsForContext(contextTab) {
  if (!contextTab || contextTab.windowId == null) {
    return [];
  }

  const highlighted = await browser.tabs.query({
    windowId: contextTab.windowId,
    highlighted: true,
  });

  if (!highlighted.length) {
    return [contextTab];
  }

  const highlightedIds = new Set(highlighted.map((tab) => tab.id));
  if (!highlightedIds.has(contextTab.id)) {
    return [contextTab];
  }

  return highlighted;
}

async function rebuildWindowSubmenu(contextTab) {
  clearDynamicWindowItems();

  const sourceTabs = await getSelectedTabsForContext(contextTab);
  if (!sourceTabs.length) {
    browser.menus.update(ROOT_MENU_ID, {
      title: "Move tab to…",
      enabled: false,
    });
    return;
  }

  activeSourceTabIds = sourceTabs.map((tab) => tab.id);
  activeSourceWindowId = sourceTabs[0].windowId;

  const windows = await browser.windows.getAll({ populate: true, windowTypes: ["normal"] });
  const targetWindows = windows.filter((win) => win.id !== activeSourceWindowId);

  if (!targetWindows.length) {
    browser.menus.update(ROOT_MENU_ID, {
      title: "Move tab to… (no other windows)",
      enabled: false,
    });
    return;
  }

  const moveCount = activeSourceTabIds.length;
  const rootTitle = moveCount > 1 ? `Move ${moveCount} tabs to…` : "Move tab to…";
  browser.menus.update(ROOT_MENU_ID, {
    title: rootTitle,
    enabled: true,
  });

  for (const win of targetWindows) {
    const tabs = win.tabs || [];
    const menuId = `${WINDOW_MENU_PREFIX}${win.id}`;
    activeMenuWindowMap.set(menuId, win.id);
    browser.menus.create({
      id: menuId,
      parentId: ROOT_MENU_ID,
      title: getWindowLabel(tabs),
      contexts: ["tab"],
    });
  }
}

browser.runtime.onInstalled.addListener(() => {
  ensureRootMenu();
});

browser.runtime.onStartup.addListener(() => {
  ensureRootMenu();
});

ensureRootMenu();

browser.menus.onShown.addListener(async (info, tab) => {
  if (!info.contexts.includes("tab")) {
    return;
  }

  try {
    await rebuildWindowSubmenu(tab);
    browser.menus.refresh();
  } catch (error) {
    console.error("Failed to build move-tab submenu", error);
    browser.menus.update(ROOT_MENU_ID, {
      title: "Move tab to…",
      enabled: false,
    });
    browser.menus.refresh();
  }
});

browser.menus.onHidden.addListener(() => {
  clearDynamicWindowItems();
  activeSourceTabIds = [];
  activeSourceWindowId = null;

  browser.menus.update(ROOT_MENU_ID, {
    title: "Move tab to…",
    enabled: false,
  });
});

browser.menus.onClicked.addListener(async (info) => {
  const { menuItemId } = info;
  if (typeof menuItemId !== "string" || !menuItemId.startsWith(WINDOW_MENU_PREFIX)) {
    return;
  }

  const targetWindowId = activeMenuWindowMap.get(menuItemId);
  if (!targetWindowId || !activeSourceTabIds.length) {
    return;
  }

  try {
    await browser.tabs.move(activeSourceTabIds, {
      windowId: targetWindowId,
      index: -1,
    });

    const movedLastTabId = activeSourceTabIds[activeSourceTabIds.length - 1];
    await browser.tabs.update(movedLastTabId, { active: true });
    await browser.windows.update(targetWindowId, { focused: true });
  } catch (error) {
    console.error("Failed to move tab(s)", error);
  }
});
