import * as vscode from 'vscode';

export class ExtensionSettings {
	static readonly CONFIG_SECTION = 'vscode-fxpw-code-static-check';

	static get config(): vscode.WorkspaceConfiguration {
		return vscode.workspace.getConfiguration(this.CONFIG_SECTION);
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
	static get CHECK_COMPLEXITY_METRICS(): boolean {
		return this.config.get<boolean>('complexityMetrics') ?? true;
	}
	static get COGNITIVE_COMPLEXITY_WARNING_THRESHOLD(): number {
		return this.config.get<number>('cognitiveComplexityWarningThreshold') ?? 15;
	}
	static get CYCLOMATIC_COMPLEXITY_WARNING_THRESHOLD(): number {
		return this.config.get<number>('cyclomaticComplexityWarningThreshold') ?? 10;
	}
	static get DEBUG(): boolean {
		return this.config.get<boolean>('debug') ?? false;
	}

	static updateSettingsHandler(): void {
		try {
			// console.log("UpdateSettingsHandler");
		} catch (error) {
			console.error(error);
		}
	}

	// Инициализация класса с подпиской на изменения конфигурации
	static async init(context: vscode.ExtensionContext): Promise<void> {
		context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(this.CONFIG_SECTION)) {
				this.updateSettingsHandler();
			}
		}));
	}
}
