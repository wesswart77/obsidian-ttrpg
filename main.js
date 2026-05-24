var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TTRPGPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  campaignsFolder: "TTRPG/Campaigns"
};
var GAME_SYSTEMS = [
  "D&D 5e",
  "Pathfinder",
  "Call of Cthulhu",
  "Shadowrun",
  "Custom"
];
var CAMPAIGN_STATUSES = ["planning", "active", "hiatus", "complete"];
var NPC_ROLES = ["ally", "neutral", "enemy", "boss"];
var QUEST_STATUSES = ["active", "complete", "failed"];
var VIEW_TYPE_TTRPG = "ttrpg-campaign-sidebar";
function safeName(s) {
  return s.replace(/[\\/:*?"<>|]/g, "-");
}
function today() {
  return new Date().toISOString().split("T")[0];
}
async function ensureFolder(app, path) {
  await app.vault.createFolder(path).catch(() => {
  });
}
function getCampaigns(app, folder) {
  const dirs = /* @__PURE__ */ new Set();
  for (const file of app.vault.getMarkdownFiles()) {
    if (!file.path.startsWith(folder + "/"))
      continue;
    const parts = file.path.slice(folder.length + 1).split("/");
    if (parts.length > 1)
      dirs.add(parts[0]);
  }
  return Array.from(dirs).sort();
}
var TTRPGView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.activeTab = "npcs";
    this.selectedCampaign = "";
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_TTRPG;
  }
  getDisplayText() {
    return "TTRPG";
  }
  getIcon() {
    return "sword";
  }
  async onOpen() {
    await this.render();
  }
  async onClose() {
  }
  async render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ttrpg-container");
    const header = contentEl.createDiv({ cls: "ttrpg-header" });
    header.createEl("h2", { text: "TTRPG" });
    const addBtn = header.createEl("button", { text: "+", cls: "ttrpg-btn-primary" });
    addBtn.title = "New Campaign";
    addBtn.onclick = () => new CampaignModal(this.app, this.plugin, () => this.render()).open();
    const campaigns = getCampaigns(this.app, this.plugin.settings.campaignsFolder);
    const sel = contentEl.createEl("select", { cls: "ttrpg-campaign-select" });
    sel.createEl("option", { value: "", text: "All campaigns" });
    for (const c of campaigns) {
      const opt = sel.createEl("option", { value: c, text: c });
      if (c === this.selectedCampaign)
        opt.selected = true;
    }
    sel.onchange = () => {
      this.selectedCampaign = sel.value;
      this.renderCards(list);
    };
    const tabs = contentEl.createDiv({ cls: "ttrpg-tabs" });
    const makeTab = (label, tab) => {
      const btn = tabs.createEl("button", { text: label, cls: "ttrpg-tab" });
      if (this.activeTab === tab)
        btn.addClass("active");
      btn.onclick = () => {
        this.activeTab = tab;
        this.render();
      };
    };
    makeTab("NPCs", "npcs");
    makeTab("Sessions", "sessions");
    makeTab("Quests", "quests");
    const list = contentEl.createDiv({ cls: "ttrpg-list" });
    await this.renderCards(list);
  }
  async renderCards(container) {
    var _a, _b, _c, _d, _e, _f, _g;
    container.empty();
    const base = this.plugin.settings.campaignsFolder;
    const subFolder = this.activeTab === "npcs" ? "NPCs" : this.activeTab === "sessions" ? "Sessions" : "Quests";
    const files = this.app.vault.getMarkdownFiles().filter((f) => {
      if (!f.path.startsWith(base + "/"))
        return false;
      if (!f.path.includes("/" + subFolder + "/"))
        return false;
      if (this.selectedCampaign) {
        const parts = f.path.slice(base.length + 1).split("/");
        if (parts[0] !== this.selectedCampaign)
          return false;
      }
      return true;
    });
    if (files.length === 0) {
      container.createEl("p", { cls: "ttrpg-empty", text: "No entries found." });
      return;
    }
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = (_a = cache == null ? void 0 : cache.frontmatter) != null ? _a : {};
      const card = container.createDiv({ cls: "ttrpg-card" });
      const title = card.createDiv({ cls: "ttrpg-card-title", text: file.basename });
      title.onclick = () => this.app.workspace.openLinkText(file.path, "", false);
      const meta = card.createDiv({ cls: "ttrpg-card-meta" });
      if (this.activeTab === "npcs") {
        const role = (_b = fm["role"]) != null ? _b : "";
        if (role)
          meta.createSpan({ cls: `ttrpg-badge ttrpg-badge-role-${role}`, text: role });
        const loc = (_c = fm["location"]) != null ? _c : "";
        if (loc)
          meta.createSpan({ cls: "ttrpg-badge", text: loc });
      } else if (this.activeTab === "sessions") {
        const num = (_d = fm["session_number"]) != null ? _d : "";
        const date = (_e = fm["date"]) != null ? _e : "";
        if (num)
          meta.createSpan({ cls: "ttrpg-badge", text: `Session ${num}` });
        if (date)
          meta.createSpan({ cls: "ttrpg-badge", text: date });
      } else {
        const status = (_f = fm["status"]) != null ? _f : "";
        if (status)
          meta.createSpan({ cls: `ttrpg-badge ttrpg-badge-status-${status}`, text: status });
        const giver = (_g = fm["giver"]) != null ? _g : "";
        if (giver)
          card.createDiv({ cls: "ttrpg-card-desc", text: `Given by: ${giver}` });
      }
    }
  }
};
var CampaignModal = class extends import_obsidian.Modal {
  constructor(app, plugin, onSave) {
    super(app);
    this.name = "";
    this.system = "D&D 5e";
    this.setting = "";
    this.partySize = "4";
    this.status = "planning";
    this.plugin = plugin;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("ttrpg-modal");
    contentEl.createEl("h2", { text: "New Campaign" });
    new import_obsidian.Setting(contentEl).setName("Campaign Name").addText((t) => {
      t.setPlaceholder("e.g. Curse of Strahd").onChange((v) => this.name = v);
    });
    new import_obsidian.Setting(contentEl).setName("System").addDropdown((d) => {
      GAME_SYSTEMS.forEach((s) => d.addOption(s, s));
      d.setValue(this.system);
      d.onChange((v) => this.system = v);
    });
    new import_obsidian.Setting(contentEl).setName("Setting / World").addText((t) => {
      t.setPlaceholder("e.g. Barovia").onChange((v) => this.setting = v);
    });
    new import_obsidian.Setting(contentEl).setName("Party Size").addText((t) => {
      t.setValue(this.partySize).onChange((v) => this.partySize = v);
    });
    new import_obsidian.Setting(contentEl).setName("Status").addDropdown((d) => {
      CAMPAIGN_STATUSES.forEach((s) => d.addOption(s, s));
      d.setValue(this.status);
      d.onChange((v) => this.status = v);
    });
    new import_obsidian.Setting(contentEl).addButton(
      (b) => b.setButtonText("Save Campaign").setCta().onClick(() => this.save())
    );
  }
  async save() {
    if (!this.name.trim()) {
      new import_obsidian.Notice("Campaign name is required.");
      return;
    }
    const base = this.plugin.settings.campaignsFolder;
    const campaignDir = `${base}/${safeName(this.name)}`;
    await ensureFolder(this.app, base);
    await ensureFolder(this.app, campaignDir);
    await ensureFolder(this.app, `${campaignDir}/NPCs`);
    await ensureFolder(this.app, `${campaignDir}/Sessions`);
    await ensureFolder(this.app, `${campaignDir}/Quests`);
    const path = `${campaignDir}/${safeName(this.name)}.md`;
    if (this.app.vault.getAbstractFileByPath(path)) {
      new import_obsidian.Notice("A campaign with that name already exists.");
      return;
    }
    const content = [
      "---",
      `title: "${this.name}"`,
      `system: "${this.system}"`,
      `setting: "${this.setting}"`,
      `party_size: ${this.partySize}`,
      `status: ${this.status}`,
      `created: ${today()}`,
      "---",
      "",
      `# ${this.name}`,
      "",
      `**System:** ${this.system}  `,
      `**Setting:** ${this.setting}  `,
      `**Party Size:** ${this.partySize}  `,
      `**Status:** ${this.status}`,
      "",
      "## Overview",
      "",
      "## Party Members",
      "",
      "## Notes"
    ].join("\n");
    await this.app.vault.create(path, content);
    new import_obsidian.Notice(`Campaign "${this.name}" created.`);
    this.close();
    this.onSave();
  }
  onClose() {
    this.contentEl.empty();
  }
};
var NPCModal = class extends import_obsidian.Modal {
  constructor(app, plugin, onSave) {
    super(app);
    this.campaign = "";
    this.name = "";
    this.race = "";
    this.role = "neutral";
    this.location = "";
    this.description = "";
    this.secret = "";
    this.loot = "";
    this.plugin = plugin;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("ttrpg-modal");
    contentEl.createEl("h2", { text: "New NPC" });
    const campaigns = getCampaigns(this.app, this.plugin.settings.campaignsFolder);
    new import_obsidian.Setting(contentEl).setName("Campaign").addDropdown((d) => {
      d.addOption("", "-- Select Campaign --");
      campaigns.forEach((c) => d.addOption(c, c));
      d.onChange((v) => this.campaign = v);
    });
    new import_obsidian.Setting(contentEl).setName("Name").addText((t) => {
      t.setPlaceholder("e.g. Strahd von Zarovich").onChange((v) => this.name = v);
    });
    new import_obsidian.Setting(contentEl).setName("Race / Species").addText((t) => {
      t.setPlaceholder("e.g. Vampire, Human").onChange((v) => this.race = v);
    });
    new import_obsidian.Setting(contentEl).setName("Role").addDropdown((d) => {
      NPC_ROLES.forEach((r) => d.addOption(r, r));
      d.setValue(this.role);
      d.onChange((v) => this.role = v);
    });
    new import_obsidian.Setting(contentEl).setName("Location").addText((t) => {
      t.setPlaceholder("e.g. Castle Ravenloft").onChange((v) => this.location = v);
    });
    new import_obsidian.Setting(contentEl).setName("Description").addTextArea((t) => {
      t.inputEl.addClass("ttrpg-textarea");
      t.inputEl.rows = 3;
      t.setPlaceholder("Appearance, personality...").onChange((v) => this.description = v);
    });
    new import_obsidian.Setting(contentEl).setName("Secret").addTextArea((t) => {
      t.inputEl.addClass("ttrpg-textarea");
      t.inputEl.rows = 2;
      t.setPlaceholder("Hidden motivations, backstory...").onChange((v) => this.secret = v);
    });
    new import_obsidian.Setting(contentEl).setName("Loot (if defeated)").addText((t) => {
      t.setPlaceholder("e.g. Sunsword, 500 gp").onChange((v) => this.loot = v);
    });
    new import_obsidian.Setting(contentEl).addButton(
      (b) => b.setButtonText("Save NPC").setCta().onClick(() => this.save())
    );
  }
  async save() {
    if (!this.name.trim()) {
      new import_obsidian.Notice("NPC name is required.");
      return;
    }
    if (!this.campaign) {
      new import_obsidian.Notice("Please select a campaign.");
      return;
    }
    const base = this.plugin.settings.campaignsFolder;
    const dir = `${base}/${this.campaign}/NPCs`;
    await ensureFolder(this.app, dir);
    const path = `${dir}/${safeName(this.name)}.md`;
    if (this.app.vault.getAbstractFileByPath(path)) {
      new import_obsidian.Notice("An NPC with that name already exists.");
      return;
    }
    const content = [
      "---",
      `title: "${this.name}"`,
      `campaign: "${this.campaign}"`,
      `race: "${this.race}"`,
      `role: ${this.role}`,
      `location: "${this.location}"`,
      `created: ${today()}`,
      "---",
      "",
      `# ${this.name}`,
      "",
      `**Race:** ${this.race}  `,
      `**Role:** ${this.role}  `,
      `**Location:** ${this.location}`,
      "",
      "## Description",
      "",
      this.description,
      "",
      "## Secret",
      "",
      this.secret,
      "",
      this.loot ? `## Loot

${this.loot}` : "",
      "",
      "## Notes"
    ].join("\n");
    await this.app.vault.create(path, content);
    new import_obsidian.Notice(`NPC "${this.name}" saved.`);
    this.close();
    this.onSave();
  }
  onClose() {
    this.contentEl.empty();
  }
};
var SessionModal = class extends import_obsidian.Modal {
  constructor(app, plugin, onSave) {
    super(app);
    this.campaign = "";
    this.sessionNumber = "";
    this.date = today();
    this.summary = "";
    this.whatHappened = "";
    this.cliffhanger = "";
    this.xp = "";
    this.loot = "";
    this.npcsEncountered = "";
    this.plugin = plugin;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("ttrpg-modal");
    contentEl.createEl("h2", { text: "New Session Log" });
    const campaigns = getCampaigns(this.app, this.plugin.settings.campaignsFolder);
    new import_obsidian.Setting(contentEl).setName("Campaign").addDropdown((d) => {
      d.addOption("", "-- Select Campaign --");
      campaigns.forEach((c) => d.addOption(c, c));
      d.onChange((v) => this.campaign = v);
    });
    new import_obsidian.Setting(contentEl).setName("Session Number").addText((t) => {
      t.setPlaceholder("e.g. 5").onChange((v) => this.sessionNumber = v);
    });
    new import_obsidian.Setting(contentEl).setName("Date").addText((t) => {
      t.setValue(this.date).onChange((v) => this.date = v);
    });
    new import_obsidian.Setting(contentEl).setName("Summary (one line)").addText((t) => {
      t.setPlaceholder("Brief session title...").onChange((v) => this.summary = v);
    });
    new import_obsidian.Setting(contentEl).setName("What Happened").addTextArea((t) => {
      t.inputEl.addClass("ttrpg-textarea");
      t.inputEl.rows = 4;
      t.setPlaceholder("Full session recap...").onChange((v) => this.whatHappened = v);
    });
    new import_obsidian.Setting(contentEl).setName("Cliffhanger").addTextArea((t) => {
      t.inputEl.addClass("ttrpg-textarea");
      t.inputEl.rows = 2;
      t.setPlaceholder("Where did the session end?").onChange((v) => this.cliffhanger = v);
    });
    new import_obsidian.Setting(contentEl).setName("XP Awarded").addText((t) => {
      t.setPlaceholder("e.g. 500").onChange((v) => this.xp = v);
    });
    new import_obsidian.Setting(contentEl).setName("Loot Found").addText((t) => {
      t.setPlaceholder("e.g. +1 sword, 200 gp").onChange((v) => this.loot = v);
    });
    new import_obsidian.Setting(contentEl).setName("NPCs Encountered (comma-separated)").addText((t) => {
      t.setPlaceholder("e.g. Strahd, Ireena").onChange((v) => this.npcsEncountered = v);
    });
    new import_obsidian.Setting(contentEl).addButton(
      (b) => b.setButtonText("Save Session Log").setCta().onClick(() => this.save())
    );
  }
  async save() {
    if (!this.campaign) {
      new import_obsidian.Notice("Please select a campaign.");
      return;
    }
    if (!this.sessionNumber.trim()) {
      new import_obsidian.Notice("Session number is required.");
      return;
    }
    const base = this.plugin.settings.campaignsFolder;
    const dir = `${base}/${this.campaign}/Sessions`;
    await ensureFolder(this.app, dir);
    const title = `Session ${this.sessionNumber}${this.summary ? " - " + this.summary : ""}`;
    const path = `${dir}/Session-${this.sessionNumber.padStart(3, "0")}.md`;
    if (this.app.vault.getAbstractFileByPath(path)) {
      new import_obsidian.Notice("A session log with that number already exists.");
      return;
    }
    const npcLinks = this.npcsEncountered.split(",").map((n) => n.trim()).filter(Boolean).map((n) => `[[${n}]]`).join(", ");
    const content = [
      "---",
      `title: "${title}"`,
      `campaign: "${this.campaign}"`,
      `session_number: ${this.sessionNumber}`,
      `date: ${this.date}`,
      `xp_awarded: ${this.xp}`,
      "---",
      "",
      `# ${title}`,
      "",
      `**Date:** ${this.date}  `,
      `**XP Awarded:** ${this.xp}`,
      "",
      "## Summary",
      "",
      this.summary,
      "",
      "## What Happened",
      "",
      this.whatHappened,
      "",
      "## Cliffhanger",
      "",
      this.cliffhanger,
      "",
      "## Loot",
      "",
      this.loot,
      "",
      npcLinks ? `## NPCs Encountered

${npcLinks}` : ""
    ].join("\n");
    await this.app.vault.create(path, content);
    new import_obsidian.Notice(`Session ${this.sessionNumber} saved.`);
    this.close();
    this.onSave();
  }
  onClose() {
    this.contentEl.empty();
  }
};
var QuestModal = class extends import_obsidian.Modal {
  constructor(app, plugin, onSave) {
    super(app);
    this.campaign = "";
    this.title = "";
    this.giver = "";
    this.status = "active";
    this.description = "";
    this.reward = "";
    this.plugin = plugin;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("ttrpg-modal");
    contentEl.createEl("h2", { text: "New Quest" });
    const campaigns = getCampaigns(this.app, this.plugin.settings.campaignsFolder);
    new import_obsidian.Setting(contentEl).setName("Campaign").addDropdown((d) => {
      d.addOption("", "-- Select Campaign --");
      campaigns.forEach((c) => d.addOption(c, c));
      d.onChange((v) => this.campaign = v);
    });
    new import_obsidian.Setting(contentEl).setName("Quest Title").addText((t) => {
      t.setPlaceholder("e.g. The Lost Sword of Athos").onChange((v) => this.title = v);
    });
    new import_obsidian.Setting(contentEl).setName("Quest Giver").addText((t) => {
      t.setPlaceholder("e.g. Lady Aribeth").onChange((v) => this.giver = v);
    });
    new import_obsidian.Setting(contentEl).setName("Status").addDropdown((d) => {
      QUEST_STATUSES.forEach((s) => d.addOption(s, s));
      d.setValue(this.status);
      d.onChange((v) => this.status = v);
    });
    new import_obsidian.Setting(contentEl).setName("Description").addTextArea((t) => {
      t.inputEl.addClass("ttrpg-textarea");
      t.inputEl.rows = 3;
      t.setPlaceholder("What needs to be done?").onChange((v) => this.description = v);
    });
    new import_obsidian.Setting(contentEl).setName("Reward").addText((t) => {
      t.setPlaceholder("e.g. 1000 gp, magic item").onChange((v) => this.reward = v);
    });
    new import_obsidian.Setting(contentEl).addButton(
      (b) => b.setButtonText("Save Quest").setCta().onClick(() => this.save())
    );
  }
  async save() {
    if (!this.title.trim()) {
      new import_obsidian.Notice("Quest title is required.");
      return;
    }
    if (!this.campaign) {
      new import_obsidian.Notice("Please select a campaign.");
      return;
    }
    const base = this.plugin.settings.campaignsFolder;
    const dir = `${base}/${this.campaign}/Quests`;
    await ensureFolder(this.app, dir);
    const path = `${dir}/${safeName(this.title)}.md`;
    if (this.app.vault.getAbstractFileByPath(path)) {
      new import_obsidian.Notice("A quest with that title already exists.");
      return;
    }
    const content = [
      "---",
      `title: "${this.title}"`,
      `campaign: "${this.campaign}"`,
      `giver: "${this.giver}"`,
      `status: ${this.status}`,
      `reward: "${this.reward}"`,
      `created: ${today()}`,
      "---",
      "",
      `# ${this.title}`,
      "",
      `**Given by:** [[${this.giver}]]  `,
      `**Status:** ${this.status}  `,
      `**Reward:** ${this.reward}`,
      "",
      "## Description",
      "",
      this.description,
      "",
      "## Progress",
      "",
      "- [ ] "
    ].join("\n");
    await this.app.vault.create(path, content);
    new import_obsidian.Notice(`Quest "${this.title}" saved.`);
    this.close();
    this.onSave();
  }
  onClose() {
    this.contentEl.empty();
  }
};
var TTRPGSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "TTRPG Campaign Manager Settings" });
    new import_obsidian.Setting(containerEl).setName("Campaigns folder").setDesc("Root folder for all campaign data.").addText(
      (t) => t.setValue(this.plugin.settings.campaignsFolder).onChange(async (v) => {
        this.plugin.settings.campaignsFolder = v;
        await this.plugin.saveSettings();
      })
    );
  }
};
var TTRPGPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_TTRPG, (leaf) => new TTRPGView(leaf, this));
    this.addRibbonIcon("sword", "TTRPG Campaign Manager", () => this.activateSidebar());
    this.addCommand({
      id: "open-sidebar",
      name: "Open Campaign Sidebar",
      callback: () => this.activateSidebar()
    });
    this.addCommand({
      id: "new-campaign",
      name: "New Campaign",
      callback: () => new CampaignModal(this.app, this, () => this.refreshSidebar()).open()
    });
    this.addCommand({
      id: "new-npc",
      name: "New NPC",
      callback: () => new NPCModal(this.app, this, () => this.refreshSidebar()).open()
    });
    this.addCommand({
      id: "new-session-log",
      name: "New Session Log",
      callback: () => new SessionModal(this.app, this, () => this.refreshSidebar()).open()
    });
    this.addCommand({
      id: "new-quest",
      name: "New Quest",
      callback: () => new QuestModal(this.app, this, () => this.refreshSidebar()).open()
    });
    this.addSettingTab(new TTRPGSettingTab(this.app, this));
  }
  async activateSidebar() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_TTRPG);
    if (existing.length) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_TTRPG, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }
  refreshSidebar() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_TTRPG).forEach((leaf) => {
      if (leaf.view instanceof TTRPGView)
        leaf.view.render();
    });
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
