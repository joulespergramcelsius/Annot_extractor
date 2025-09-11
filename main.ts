import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, normalizePath  } from 'obsidian';
import { PDFDocument,PDFDict,PDFName  } from "pdf-lib"; //PDFArray



interface AnnotExtractorSettings {
  attachmentsPath: string;
  outputPath: string;
}

const DEFAULT_SETTINGS: AnnotExtractorSettings = {
  attachmentsPath: "", // empty string = vault root
  outputPath: "",
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
      			const mdFileName = normalizePath(`${this.settings.outputPath}/Annotations of ${file.name}.md`);
      			await this.app.vault.create(mdFileName, content);
      			new Notice(`Annotations extracted to ${mdFileName}`);
    			}
  			},
			});

	
		
		

		// Setting tab to configure path
		this.addSettingTab(new SettingTab(this.app, this));

		
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		
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


class SettingTab extends PluginSettingTab {
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
				createFragment((frag) => {
					frag.createEl("div",{ text: "Folder path to save PDFs. Leave empty for vault root."});
					frag.createEl("div",{ text: "Example: Attachment/PDF_files"});
				})
        		
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


		new Setting(containerEl)
      		.setName("Output Folder Path")
      		.setDesc(
				createFragment((frag) => {
					frag.createEl("div",{ text: "Folder path to save generated annotation notes. Leave empty for vault root."});
					frag.createEl("div",{ text: "Example: Notes/PDF_notes"});
				})
        		
      		)
      		.addText((text) =>
        		text
          		.setPlaceholder("Path to notes")
          		.setValue(this.plugin.settings.outputPath)
          		.onChange(async (value) => {
            		this.plugin.settings.outputPath = value.trim();
            		await this.plugin.saveSettings();
          		})
      		);
	}
}
