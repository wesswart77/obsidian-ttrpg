import {
	App,
	ItemView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	WorkspaceLeaf,
} from "obsidian";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TTRPGSettings {
	campaignsFolder: string;
}

const DEFAULT_SETTINGS: TTRPGSettings = {
	campaignsFolder: "TTRPG/Campaigns",
};

type GameSystem =
	| "D&D 5e"
	| "Pathfinder"
	| "Call of Cthulhu"
	| "Shadowrun"
	| "Custom";

const GAME_SYSTEMS: GameSystem[] = [
	"D&D 5e",
	"Pathfinder",
	"Call of Cthulhu",
	"Shadowrun",
	"Custom",
];

type CampaignStatus = "planning" | "active" | "hiatus" | "complete";
const CAMPAIGN_STATUSES: CampaignStatus[] = ["planning", "active", "hiatus", "complete"];

type NPCRole = "ally" | "neutral" | "enemy" | "boss";
const NPC_ROLES: NPCRole[] = ["ally", "neutral", "enemy", "boss"];

type QuestStatus = "active" | "complete" | "failed";
const QUEST_STATUSES: QuestStatus[] = ["active", "complete", "failed"];

const VIEW_TYPE_TTRPG = "ttrpg-campaign-sidebar";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeName(s: string) { return s.replace(/[\\/:*?"<>|]/g, "-"); }
function today() { return new Date().toISOString().split("T")[0]; }

async function ensureFolder(app: App, path: string) {
	await app.vault.createFolder(path).catch(() => {});
}

function getCampaigns(app: App, folder: string): string[] {
	const dirs = new Set<string>();
	for (const file of app.vault.getMarkdownFiles()) {
		if (!file.path.startsWith(folder + "/")) continue;
		const parts = file.path.slice(folder.length + 1).split("/");
		if (parts.length > 1) dirs.add(parts[0]);
	}
	return Array.from(dirs).sort();
}

// ─── Sidebar View ─────────────────────────────────────────────────────────────

class TTRPGView extends ItemView {
	plugin: TTRPGPlugin;
	private activeTab: "npcs" | "sessions" | "quests" = "npcs";
	private selectedCampaign = "";

	constructor(leaf: WorkspaceLeaf, plugin: TTRPGPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() { return VIEW_TYPE_TTRPG; }
	getDisplayText() { return "TTRPG"; }
	getIcon() { return "sword"; }

	async onOpen() { await this.render(); }
	async onClose() {}

	async render() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ttrpg-container");

		const header = contentEl.createDiv({ cls: "ttrpg-header" });
		header.createEl("h2", { text: "TTRPG" });
		const addBtn = header.createEl("button", { text: "+", cls: "ttrpg-btn-primary" });
		addBtn.title = "New Campaign";
		addBtn.onclick = () => new CampaignModal(this.app, this.plugin, () => this.render()).open();

		// Campaign selector
		const campaigns = getCampaigns(this.app, this.plugin.settings.campaignsFolder);
		const sel = contentEl.createEl("select", { cls: "ttrpg-campaign-select" }) as HTMLSelectElement;
		sel.createEl("option", { value: "", text: "All campaigns" });
		for (const c of campaigns) {
			const opt = sel.createEl("option", { value: c, text: c });
			if (c === this.selectedCampaign) opt.selected = true;
		}
		sel.onchange = () => { this.selectedCampaign = sel.value; this.renderCards(list); };

		// Tabs
		const tabs = contentEl.createDiv({ cls: "ttrpg-tabs" });
		const makeTab = (label: string, tab: "npcs" | "sessions" | "quests") => {
			const btn = tabs.createEl("button", { text: label, cls: "ttrpg-tab" });
			if (this.activeTab === tab) btn.addClass("active");
			btn.onclick = () => { this.activeTab = tab; this.render(); };
		};
		makeTab("NPCs", "npcs");
		makeTab("Sessions", "sessions");
		makeTab("Quests", "quests");

		const list = contentEl.createDiv({ cls: "ttrpg-list" });
		await this.renderCards(list);
	}

	async renderCards(container: HTMLElement) {
		container.empty();
		const base = this.plugin.settings.campaignsFolder;
		const subFolder = this.activeTab === "npcs" ? "NPCs" : this.activeTab === "sessions" ? "Sessions" : "Quests";

		const files = this.app.vault.getMarkdownFiles().filter((f) => {
			if (!f.path.startsWith(base + "/")) return false;
			if (!f.path.includes("/" + subFolder + "/")) return false;
			if (this.selectedCampaign) {
				const parts = f.path.slice(base.length + 1).split("/");
				if (parts[0] !== this.selectedCampaign) return false;
			}
			return true;
		});

		if (files.length === 0) {
			container.createEl("p", { cls: "ttrpg-empty", text: "No entries found." });
			return;
		}

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter ?? {};

			const card = container.createDiv({ cls: "ttrpg-card" });
			const title = card.createDiv({ cls: "ttrpg-card-title", text: file.basename });
			title.onclick = () => this.app.workspace.openLinkText(file.path, "", false);

			const meta = card.createDiv({ cls: "ttrpg-card-meta" });

			if (this.activeTab === "npcs") {
				const role: string = fm["role"] ?? "";
				if (role) meta.createSpan({ cls: `ttrpg-badge ttrpg-badge-role-${role}`, text: role });
				const loc: string = fm["location"] ?? "";
				if (loc) meta.createSpan({ cls: "ttrpg-badge", text: loc });
			} else if (this.activeTab === "sessions") {
				const num = fm["session_number"] ?? "";
				const date = fm["date"] ?? "";
				if (num) meta.createSpan({ cls: "ttrpg-badge", text: `Session ${num}` });
				if (date) meta.createSpan({ cls: "ttrpg-badge", text: date });
			} else {
				const status: string = fm["status"] ?? "";
				if (status) meta.createSpan({ cls: `ttrpg-badge ttrpg-badge-status-${status}`, text: status });
				const giver: string = fm["giver"] ?? "";
				if (giver) card.createDiv({ cls: "ttrpg-card-desc", text: `Given by: ${giver}` });
			}
		}
	}
}

// ─── New Campaign Modal ───────────────────────────────────────────────────────

class CampaignModal extends Modal {
	plugin: TTRPGPlugin;
	onSave: () => void;

	private name = "";
	private system: GameSystem = "D&D 5e";
	private setting = "";
	private partySize = "4";
	private status: CampaignStatus = "planning";

	constructor(app: App, plugin: TTRPGPlugin, onSave: () => void) {
		super(app);
		this.plugin = plugin;
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("ttrpg-modal");
		contentEl.createEl("h2", { text: "New Campaign" });

		new Setting(contentEl).setName("Campaign Name").addText((t) => {
			t.setPlaceholder("e.g. Curse of Strahd").onChange((v) => (this.name = v));
		});

		new Setting(contentEl).setName("System").addDropdown((d) => {
			GAME_SYSTEMS.forEach((s) => d.addOption(s, s));
			d.setValue(this.system);
			d.onChange((v) => (this.system = v as GameSystem));
		});

		new Setting(contentEl).setName("Setting / World").addText((t) => {
			t.setPlaceholder("e.g. Barovia").onChange((v) => (this.setting = v));
		});

		new Setting(contentEl).setName("Party Size").addText((t) => {
			t.setValue(this.partySize).onChange((v) => (this.partySize = v));
		});

		new Setting(contentEl).setName("Status").addDropdown((d) => {
			CAMPAIGN_STATUSES.forEach((s) => d.addOption(s, s));
			d.setValue(this.status);
			d.onChange((v) => (this.status = v as CampaignStatus));
		});

		new Setting(contentEl).addButton((b) =>
			b.setButtonText("Save Campaign").setCta().onClick(() => this.save())
		);
	}

	async save() {
		if (!this.name.trim()) { new Notice("Campaign name is required."); return; }
		const base = this.plugin.settings.campaignsFolder;
		const campaignDir = `${base}/${safeName(this.name)}`;
		await ensureFolder(this.app, base);
		await ensureFolder(this.app, campaignDir);
		await ensureFolder(this.app, `${campaignDir}/NPCs`);
		await ensureFolder(this.app, `${campaignDir}/Sessions`);
		await ensureFolder(this.app, `${campaignDir}/Quests`);

		const path = `${campaignDir}/${safeName(this.name)}.md`;
		if (this.app.vault.getAbstractFileByPath(path)) {
			new Notice("A campaign with that name already exists."); return;
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
			"## Notes",
		].join("\n");

		await this.app.vault.create(path, content);
		new Notice(`Campaign "${this.name}" created.`);
		this.close();
		this.onSave();
	}

	onClose() { this.contentEl.empty(); }
}

// ─── New NPC Modal ────────────────────────────────────────────────────────────

class NPCModal extends Modal {
	plugin: TTRPGPlugin;
	onSave: () => void;

	private campaign = "";
	private name = "";
	private race = "";
	private role: NPCRole = "neutral";
	private location = "";
	private description = "";
	private secret = "";
	private loot = "";

	constructor(app: App, plugin: TTRPGPlugin, onSave: () => void) {
		super(app);
		this.plugin = plugin;
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("ttrpg-modal");
		contentEl.createEl("h2", { text: "New NPC" });

		const campaigns = getCampaigns(this.app, this.plugin.settings.campaignsFolder);

		new Setting(contentEl).setName("Campaign").addDropdown((d) => {
			d.addOption("", "-- Select Campaign --");
			campaigns.forEach((c) => d.addOption(c, c));
			d.onChange((v) => (this.campaign = v));
		});

		new Setting(contentEl).setName("Name").addText((t) => {
			t.setPlaceholder("e.g. Strahd von Zarovich").onChange((v) => (this.name = v));
		});

		new Setting(contentEl).setName("Race / Species").addText((t) => {
			t.setPlaceholder("e.g. Vampire, Human").onChange((v) => (this.race = v));
		});

		new Setting(contentEl).setName("Role").addDropdown((d) => {
			NPC_ROLES.forEach((r) => d.addOption(r, r));
			d.setValue(this.role);
			d.onChange((v) => (this.role = v as NPCRole));
		});

		new Setting(contentEl).setName("Location").addText((t) => {
			t.setPlaceholder("e.g. Castle Ravenloft").onChange((v) => (this.location = v));
		});

		new Setting(contentEl).setName("Description").addTextArea((t) => {
			t.inputEl.addClass("ttrpg-textarea");
			t.inputEl.rows = 3;
			t.setPlaceholder("Appearance, personality...").onChange((v) => (this.description = v));
		});

		new Setting(contentEl).setName("Secret").addTextArea((t) => {
			t.inputEl.addClass("ttrpg-textarea");
			t.inputEl.rows = 2;
			t.setPlaceholder("Hidden motivations, backstory...").onChange((v) => (this.secret = v));
		});

		new Setting(contentEl).setName("Loot (if defeated)").addText((t) => {
			t.setPlaceholder("e.g. Sunsword, 500 gp").onChange((v) => (this.loot = v));
		});

		new Setting(contentEl).addButton((b) =>
			b.setButtonText("Save NPC").setCta().onClick(() => this.save())
		);
	}

	async save() {
		if (!this.name.trim()) { new Notice("NPC name is required."); return; }
		if (!this.campaign) { new Notice("Please select a campaign."); return; }

		const base = this.plugin.settings.campaignsFolder;
		const dir = `${base}/${this.campaign}/NPCs`;
		await ensureFolder(this.app, dir);

		const path = `${dir}/${safeName(this.name)}.md`;
		if (this.app.vault.getAbstractFileByPath(path)) {
			new Notice("An NPC with that name already exists."); return;
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
			this.loot ? `## Loot\n\n${this.loot}` : "",
			"",
			"## Notes",
		].join("\n");

		await this.app.vault.create(path, content);
		new Notice(`NPC "${this.name}" saved.`);
		this.close();
		this.onSave();
	}

	onClose() { this.contentEl.empty(); }
}

// ─── New Session Log Modal ────────────────────────────────────────────────────

class SessionModal extends Modal {
	plugin: TTRPGPlugin;
	onSave: () => void;

	private campaign = "";
	private sessionNumber = "";
	private date = today();
	private summary = "";
	private whatHappened = "";
	private cliffhanger = "";
	private xp = "";
	private loot = "";
	private npcsEncountered = "";

	constructor(app: App, plugin: TTRPGPlugin, onSave: () => void) {
		super(app);
		this.plugin = plugin;
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("ttrpg-modal");
		contentEl.createEl("h2", { text: "New Session Log" });

		const campaigns = getCampaigns(this.app, this.plugin.settings.campaignsFolder);

		new Setting(contentEl).setName("Campaign").addDropdown((d) => {
			d.addOption("", "-- Select Campaign --");
			campaigns.forEach((c) => d.addOption(c, c));
			d.onChange((v) => (this.campaign = v));
		});

		new Setting(contentEl).setName("Session Number").addText((t) => {
			t.setPlaceholder("e.g. 5").onChange((v) => (this.sessionNumber = v));
		});

		new Setting(contentEl).setName("Date").addText((t) => {
			t.setValue(this.date).onChange((v) => (this.date = v));
		});

		new Setting(contentEl).setName("Summary (one line)").addText((t) => {
			t.setPlaceholder("Brief session title...").onChange((v) => (this.summary = v));
		});

		new Setting(contentEl).setName("What Happened").addTextArea((t) => {
			t.inputEl.addClass("ttrpg-textarea");
			t.inputEl.rows = 4;
			t.setPlaceholder("Full session recap...").onChange((v) => (this.whatHappened = v));
		});

		new Setting(contentEl).setName("Cliffhanger").addTextArea((t) => {
			t.inputEl.addClass("ttrpg-textarea");
			t.inputEl.rows = 2;
			t.setPlaceholder("Where did the session end?").onChange((v) => (this.cliffhanger = v));
		});

		new Setting(contentEl).setName("XP Awarded").addText((t) => {
			t.setPlaceholder("e.g. 500").onChange((v) => (this.xp = v));
		});

		new Setting(contentEl).setName("Loot Found").addText((t) => {
			t.setPlaceholder("e.g. +1 sword, 200 gp").onChange((v) => (this.loot = v));
		});

		new Setting(contentEl).setName("NPCs Encountered (comma-separated)").addText((t) => {
			t.setPlaceholder("e.g. Strahd, Ireena").onChange((v) => (this.npcsEncountered = v));
		});

		new Setting(contentEl).addButton((b) =>
			b.setButtonText("Save Session Log").setCta().onClick(() => this.save())
		);
	}

	async save() {
		if (!this.campaign) { new Notice("Please select a campaign."); return; }
		if (!this.sessionNumber.trim()) { new Notice("Session number is required."); return; }

		const base = this.plugin.settings.campaignsFolder;
		const dir = `${base}/${this.campaign}/Sessions`;
		await ensureFolder(this.app, dir);

		const title = `Session ${this.sessionNumber}${this.summary ? " - " + this.summary : ""}`;
		const path = `${dir}/Session-${this.sessionNumber.padStart(3, "0")}.md`;
		if (this.app.vault.getAbstractFileByPath(path)) {
			new Notice("A session log with that number already exists."); return;
		}

		const npcLinks = this.npcsEncountered
			.split(",")
			.map((n) => n.trim())
			.filter(Boolean)
			.map((n) => `[[${n}]]`)
			.join(", ");

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
			npcLinks ? `## NPCs Encountered\n\n${npcLinks}` : "",
		].join("\n");

		await this.app.vault.create(path, content);
		new Notice(`Session ${this.sessionNumber} saved.`);
		this.close();
		this.onSave();
	}

	onClose() { this.contentEl.empty(); }
}

// ─── New Quest Modal ──────────────────────────────────────────────────────────

class QuestModal extends Modal {
	plugin: TTRPGPlugin;
	onSave: () => void;

	private campaign = "";
	private title = "";
	private giver = "";
	private status: QuestStatus = "active";
	private description = "";
	private reward = "";

	constructor(app: App, plugin: TTRPGPlugin, onSave: () => void) {
		super(app);
		this.plugin = plugin;
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("ttrpg-modal");
		contentEl.createEl("h2", { text: "New Quest" });

		const campaigns = getCampaigns(this.app, this.plugin.settings.campaignsFolder);

		new Setting(contentEl).setName("Campaign").addDropdown((d) => {
			d.addOption("", "-- Select Campaign --");
			campaigns.forEach((c) => d.addOption(c, c));
			d.onChange((v) => (this.campaign = v));
		});

		new Setting(contentEl).setName("Quest Title").addText((t) => {
			t.setPlaceholder("e.g. The Lost Sword of Athos").onChange((v) => (this.title = v));
		});

		new Setting(contentEl).setName("Quest Giver").addText((t) => {
			t.setPlaceholder("e.g. Lady Aribeth").onChange((v) => (this.giver = v));
		});

		new Setting(contentEl).setName("Status").addDropdown((d) => {
			QUEST_STATUSES.forEach((s) => d.addOption(s, s));
			d.setValue(this.status);
			d.onChange((v) => (this.status = v as QuestStatus));
		});

		new Setting(contentEl).setName("Description").addTextArea((t) => {
			t.inputEl.addClass("ttrpg-textarea");
			t.inputEl.rows = 3;
			t.setPlaceholder("What needs to be done?").onChange((v) => (this.description = v));
		});

		new Setting(contentEl).setName("Reward").addText((t) => {
			t.setPlaceholder("e.g. 1000 gp, magic item").onChange((v) => (this.reward = v));
		});

		new Setting(contentEl).addButton((b) =>
			b.setButtonText("Save Quest").setCta().onClick(() => this.save())
		);
	}

	async save() {
		if (!this.title.trim()) { new Notice("Quest title is required."); return; }
		if (!this.campaign) { new Notice("Please select a campaign."); return; }

		const base = this.plugin.settings.campaignsFolder;
		const dir = `${base}/${this.campaign}/Quests`;
		await ensureFolder(this.app, dir);

		const path = `${dir}/${safeName(this.title)}.md`;
		if (this.app.vault.getAbstractFileByPath(path)) {
			new Notice("A quest with that title already exists."); return;
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
			"- [ ] ",
		].join("\n");

		await this.app.vault.create(path, content);
		new Notice(`Quest "${this.title}" saved.`);
		this.close();
		this.onSave();
	}

	onClose() { this.contentEl.empty(); }
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

class TTRPGSettingTab extends PluginSettingTab {
	plugin: TTRPGPlugin;

	constructor(app: App, plugin: TTRPGPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "TTRPG Campaign Manager Settings" });

		new Setting(containerEl)
			.setName("Campaigns folder")
			.setDesc("Root folder for all campaign data.")
			.addText((t) =>
				t.setValue(this.plugin.settings.campaignsFolder).onChange(async (v) => {
					this.plugin.settings.campaignsFolder = v;
					await this.plugin.saveSettings();
				})
			);
	}
}

// ─── Main Plugin ──────────────────────────────────────────────────────────────

export default class TTRPGPlugin extends Plugin {
	settings: TTRPGSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_TTRPG, (leaf) => new TTRPGView(leaf, this));

		this.addRibbonIcon("sword", "TTRPG Campaign Manager", () => this.activateSidebar());

		this.addCommand({
			id: "open-sidebar",
			name: "Open Campaign Sidebar",
			callback: () => this.activateSidebar(),
		});

		this.addCommand({
			id: "new-campaign",
			name: "New Campaign",
			callback: () => new CampaignModal(this.app, this, () => this.refreshSidebar()).open(),
		});

		this.addCommand({
			id: "new-npc",
			name: "New NPC",
			callback: () => new NPCModal(this.app, this, () => this.refreshSidebar()).open(),
		});

		this.addCommand({
			id: "new-session-log",
			name: "New Session Log",
			callback: () => new SessionModal(this.app, this, () => this.refreshSidebar()).open(),
		});

		this.addCommand({
			id: "new-quest",
			name: "New Quest",
			callback: () => new QuestModal(this.app, this, () => this.refreshSidebar()).open(),
		});

		this.addSettingTab(new TTRPGSettingTab(this.app, this));
	}

	async activateSidebar() {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_TTRPG);
		if (existing.length) { this.app.workspace.revealLeaf(existing[0]); return; }
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: VIEW_TYPE_TTRPG, active: true });
			this.app.workspace.revealLeaf(leaf);
		}
	}

	refreshSidebar() {
		this.app.workspace.getLeavesOfType(VIEW_TYPE_TTRPG).forEach((leaf) => {
			if (leaf.view instanceof TTRPGView) leaf.view.render();
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() { await this.saveData(this.settings); }
}
