import * as vscode from 'vscode';

export class ExtensionSettings {
	static get config(): vscode.WorkspaceConfiguration {
		return vscode.workspace.getConfiguration('vscode-fxpw-php-static-check');
	}

	static get CHECK_LOCALIZATION(): boolean {
		return this.config.get<boolean>('localization') ?? false;
	}
	static get CHECK_BLADE_TEMPLATES(): boolean {
		return this.config.get<boolean>('bladeTemplates') ?? false;
	}
	static get CHECK_PHP_CODE(): boolean {
		return this.config.get<boolean>('phpCode') ?? false;
	}
	static get OPENAPI_SCHEMA_HOVER(): boolean {
		return this.config.get<boolean>('openApiSchemaHover') ?? true;
	}
	static get DEBUG(): boolean {
		return this.config.get<boolean>('DEBUG') ?? false;
	}

	static UpdateSettingsHandler(): void {
		try {
			// console.log("UpdateSettingsHandler");
		} catch (error) {
			console.error(error);
		}
	}

	// Инициализация класса с подпиской на изменения конфигурации
	static async Init(context: vscode.ExtensionContext): Promise<void> {
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('vscode-fxpw-php-static-check')) {
				this.UpdateSettingsHandler();
			}
		});
	}
}
