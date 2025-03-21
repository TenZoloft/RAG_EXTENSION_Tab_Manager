const RAGExtension = {
    clickTimeout: null,
    
adjectives: [
        "Tacky", "Stinky", "Oily", "Icky", "Messy", "Gooey", "Gummy", "Moldy", "Steamy", "Pasty", "Wet", "Hot", "Viscous",
        "Slimy", "Soggy", "Thick", "Dirty", "Lumpy", "Damp", "Milky", "Syrupy", "Mushy", "Creamy", "Buttery", "MOIST",
        "Shiny", "Crusty", "Grimy", "Cheesy", "Dusty", "Squishy", "Gritty", "Drippy", "Fuzzy", "Greasy", "Chalky",
        "Sticky", "Sandy", "Chunky", "Foul", "Pungent", "Yucky"
    ],

    getRandomAdjective() {
        return this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
    },

    setupListeners() {
        chrome.runtime.onInstalled.addListener(() => {
            chrome.contextMenus.create({ id: "collapseCurrentRAG", title: "Collapse Current RAG", contexts: ["action"] });
            chrome.contextMenus.create({ id: "collapseAllRAGs", title: "Collapse All RAGs", contexts: ["action"] });
            chrome.contextMenus.create({ id: "deleteCurrentRAG", title: "Delete Current RAG", contexts: ["action"] });
        });

        chrome.action.onClicked.addListener(() => {
            if (this.clickTimeout) {
                clearTimeout(this.clickTimeout);
                this.clickTimeout = null;
                this.ungroupOpenTabGroups();
            } else {
                this.clickTimeout = setTimeout(() => {
                    this.groupUngroupedTabs();
                    this.clickTimeout = null;
                }, 300);
            }
        });

        chrome.contextMenus.onClicked.addListener((info, tab) => {
            if (info.menuItemId === "collapseCurrentRAG") {
                this.collapseCurrentRAG(tab);
            } else if (info.menuItemId === "collapseAllRAGs") {
                this.collapseAllRAGs();
            } else if (info.menuItemId === "deleteCurrentRAG") {
                this.deleteCurrentRAG(tab);
            }
        });
    },

    async groupUngroupedTabs() {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const ungrouped = tabs.filter(t => t.groupId === -1);
        if (ungrouped.length > 0) {
            await this.collapseExpandedRAGs();
            const groupId = await chrome.tabs.group({ tabIds: ungrouped.map(t => t.id) });
            const groupName = `${this.getRandomAdjective()} RAG`;
            await chrome.tabGroups.update(groupId, { title: groupName, collapsed: false });
        }
    },

    async collapseExpandedRAGs() {
        const groups = await chrome.tabGroups.query({ collapsed: false });
        for (const group of groups) {
            if (group.title && group.title.includes("RAG")) {
                await chrome.tabGroups.update(group.id, { collapsed: true });
            }
        }
    },

    async ungroupOpenTabGroups() {
        const groups = await chrome.tabGroups.query({ collapsed: false });
        for (const group of groups) {
            const groupTabs = await chrome.tabs.query({ groupId: group.id });
            for (const tab of groupTabs) {
                await chrome.tabs.ungroup(tab.id);
            }
        }
    },

    async collapseCurrentRAG(tab) {
        if (tab.groupId !== -1) {
            const group = await chrome.tabGroups.get(tab.groupId);
            if (group.title && group.title.includes("RAG")) {
                await chrome.tabGroups.update(group.id, { collapsed: true });
            }
        }
    },

    async collapseAllRAGs() {
        const groups = await chrome.tabGroups.query({});
        for (const group of groups) {
            if (group.title && group.title.includes("RAG")) {
                await chrome.tabGroups.update(group.id, { collapsed: true });
            }
        }
    },

    async deleteCurrentRAG(tab) {
        if (tab.groupId !== -1) {
            const group = await chrome.tabGroups.get(tab.groupId);
            if (group.title && group.title.includes("RAG")) {
                const groupTabs = await chrome.tabs.query({ groupId: group.id });

                await chrome.tabs.create({ active: false });

                await chrome.tabs.remove(groupTabs.map(t => t.id));
            }
        }
    }
};

// Initialize all event listeners
RAGExtension.setupListeners();

let hasPromptedThisSession = false;

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (
        changeInfo.status === "complete" &&
        !hasPromptedThisSession &&
        tab.active &&
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://")
    ) {
        hasPromptedThisSession = true;

        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                if (confirm("This extension works best when pinned to the toolbar. Would you like to do that now?")) {
                    chrome.runtime.sendMessage({ action: "openExtensionsPage" });
                }
            }
        }).catch((err) => {
            console.warn("Script injection failed:", err);
        });
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "openExtensionsPage") {
        chrome.tabs.create({ url: "chrome://extensions/?id=" + chrome.runtime.id });
    }
});