import { App, Editor, MarkdownView, Modal, Notice, TFile, Plugin, PluginSettingTab, Setting, normalizePath  } from 'obsidian';
import { PDFDocument,PDFArray,PDFDict,PDFName  } from "pdf-lib";

// Remember to rename these classes and interfaces!

interface AnnotExtractorSettings {
  attachmentsPath: string;
}

const DEFAULT_SETTINGS: AnnotExtractorSettings = {
  attachmentsPath: "", // empty string = vault root
};



export default class Annot_Extractor extends Plugin {
	settings: AnnotExtractorSettings;

	async onload() {
		await this.loadSettings();
		
		console.log('loading plugin');

		this.addCommand({
  			id: "extract-pdf-annotations",
  			name: "Extract PDF Annotations",
  			callback: async () => {
    	//Let the user pick a PDF
    			const file = await this.pickFile(".pdf");
    			if (!file) return;
				const targetPath = this.settings.attachmentsPath
          		? `${this.settings.attachmentsPath}/${file.name}`
          		: file.name;
    //  Save it to attachments
    			//const targetPath = `Attachments/${file.name}`;
    			const arrayBuffer = await file.arrayBuffer();
    			await this.app.vault.createBinary(targetPath, arrayBuffer);

    // Read the PDF using pdf-lib
    			const pdfBytes = await this.app.vault.adapter.readBinary(targetPath);
    			const pdfDoc = await PDFDocument.load(pdfBytes);

    			const nPages = pdfDoc.getPageCount();
    			
    			let content = `PDF File: [[${targetPath}]]\n\n`;

    			let hasAnnotations = false;

    // Extract annotations per page
    			for (let i = 0; i < nPages; i++) {
      			const page = pdfDoc.getPage(i);
      			const annotsArray = page.node.Annots?.();
      			if (!annotsArray) continue;

      			const annots = annotsArray.asArray();

      			for (const annotRef of annots) {
        			const obj = pdfDoc.context.lookup(annotRef);
        			if (!(obj instanceof PDFDict)) continue;

        			const contents = obj.get(PDFName.of("Contents"))?.toString();
        			if (contents) {
          			hasAnnotations = true;
          			content += `## Page ${i + 1}\n`;
          			content += `${contents}\n\n`;
        			}
      			}
    			}

    // Create new markdown file in vault
    			if (!hasAnnotations) {
      			new Notice("No annotations found in the PDF.");
    			} else {
      			const mdFileName = normalizePath(`Annotations of ${file.name}.md`);
      			await this.app.vault.create(mdFileName, content);
      			new Notice(`Annotations extracted to ${mdFileName}`);
    			}
  			},
			});

	
		
		

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}
	

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
	private pickFile(accept = ".pdf"): Promise<File | null> {
    	return new Promise((resolve) => {
      	const input = document.createElement("input");
      	input.type = "file";
      	input.accept = accept;
      	input.onchange = () => resolve(input.files?.[0] ?? null);
      	input.click();
    });
	};
}


class SampleSettingTab extends PluginSettingTab {
	plugin: Annot_Extractor;

	constructor(app: App, plugin: Annot_Extractor) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl("h2", { text: "Annot Extractor Settings" });


		new Setting(containerEl)
      		.setName("Attachments Folder Path")
      		.setDesc(
        		"Folder path to save PDFs and generated annotation notes. Leave empty for vault root."
      		)
      		.addText((text) =>
        		text
          		.setPlaceholder("Path to attachments")
          		.setValue(this.plugin.settings.attachmentsPath)
          		.onChange(async (value) => {
            		this.plugin.settings.attachmentsPath = value.trim();
            		await this.plugin.saveSettings();
          		})
      		);
	}
}
