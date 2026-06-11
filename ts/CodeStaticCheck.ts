import * as path from 'path';
import * as vscode from 'vscode';
import { ComplexityAnalyzer } from './ComplexityAnalyzer';
import { ExtensionSettings } from './ExtensionSettings';

export class CodeStaticCheck {
	private static context: vscode.ExtensionContext | null;
	private static diagnosticCollection: vscode.DiagnosticCollection;

	private static isLanguageFolder(document: vscode.TextDocument): boolean {
		const normalizedPath = document.uri.fsPath.toLowerCase();
		const langSegment = `${path.sep}lang${path.sep}`;
		return normalizedPath.includes(langSegment) || normalizedPath.endsWith(`${path.sep}lang`);
	}

	private static isBladeDocument(document: vscode.TextDocument): boolean {
		return document.uri.fsPath.toLowerCase().endsWith('.blade.php');
	}

	private static isPhpOrVueDocument(document: vscode.TextDocument): boolean {
		const normalizedPath = document.uri.fsPath.toLowerCase();
		return (normalizedPath.endsWith('.php') || normalizedPath.endsWith('.vue')) && !this.isBladeDocument(document);
	}

	private static shouldAnalyze(document: vscode.TextDocument): boolean {
		return this.isBladeDocument(document) || this.isPhpOrVueDocument(document) || ComplexityAnalyzer.supports(document);
	}

	private static createLineDiagnostics(
		document: vscode.TextDocument,
		lineCheck: (line: string, index: number) => vscode.Diagnostic[]
	): vscode.Diagnostic[] {
		const diagnostics: vscode.Diagnostic[] = [];
		const lines = document.getText().split('\n');

		lines.forEach((line, index) => {
			diagnostics.push(...lineCheck(line, index));
		});

		return diagnostics;
	}

	private static createWhitespaceDiagnostics(line: string, index: number): vscode.Diagnostic[] {
		const diagnostics: vscode.Diagnostic[] = [];
		let twoSpacesIndex = line.indexOf('  ');
		while (twoSpacesIndex !== -1) {
			const message = `Error in line:${index + 1} - consecutive spaces detected (remove extra spaces)`;
			const range = new vscode.Range(
				new vscode.Position(index, twoSpacesIndex),
				new vscode.Position(index, twoSpacesIndex + 2)
			);
			diagnostics.push(new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning));
			twoSpacesIndex = line.indexOf('  ', twoSpacesIndex + 1);
		}

		if (/\s$/.test(line)) {
			const message = `Error in line:${index + 1} - trailing space detected (remove space at the end)`;
			const range = new vscode.Range(
				new vscode.Position(index, Math.max(line.length - 1, 0)),
				new vscode.Position(index, line.length)
			);
			diagnostics.push(new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning));
		}

		return diagnostics;
	}

	private static checkBlade(document: vscode.TextDocument): vscode.Diagnostic[] {
		if (!ExtensionSettings.CHECK_BLADE_TEMPLATES) {
			return [];
		}

		return this.createLineDiagnostics(document, (line, index) => {
			const diagnostics: vscode.Diagnostic[] = [];
			const deprecatedTokens = ['<?php', '<?=', '?>'];

			for (const token of deprecatedTokens) {
				const startPos = line.indexOf(token);
				if (startPos !== -1) {
					const range = new vscode.Range(
						new vscode.Position(index, startPos),
						new vscode.Position(index, startPos + token.length)
					);
					diagnostics.push(
						new vscode.Diagnostic(
							range,
							`Error in line: ${index + 1} - old Blade template`,
							vscode.DiagnosticSeverity.Warning
						)
					);
				}
			}

			diagnostics.push(...this.createWhitespaceDiagnostics(line, index));
			return diagnostics;
		});
	}

	private static checkPhpAndVueCode(document: vscode.TextDocument): vscode.Diagnostic[] {
		if (!ExtensionSettings.CHECK_PHP_CODE) {
			return [];
		}

		return this.createLineDiagnostics(document, (line, index) => {
			const diagnostics: vscode.Diagnostic[] = [];
			const variableRegex = /\$[a-zA-Z_][a-zA-Z0-9_]*\b/g;
			let match: RegExpExecArray | null;

			while ((match = variableRegex.exec(line)) !== null) {
				const variableName = match[0];
				if (!/^[a-z_][a-z0-9_]*$/.test(variableName.slice(1))) {
					const range = new vscode.Range(
						new vscode.Position(index, match.index),
						new vscode.Position(index, match.index + variableName.length)
					);
					diagnostics.push(
						new vscode.Diagnostic(
							range,
							`Error in line:${index + 1} - variable '${variableName}' must be in snake_case`,
							vscode.DiagnosticSeverity.Warning
						)
					);
				}
			}

			diagnostics.push(...this.createWhitespaceDiagnostics(line, index));
			return diagnostics;
		});
	}

	private static checkLocalizationPhp(document: vscode.TextDocument): vscode.Diagnostic[] {
		if (!ExtensionSettings.CHECK_LOCALIZATION) {
			return [];
		}

		return this.createLineDiagnostics(document, (line, index) => {
			const diagnostics: vscode.Diagnostic[] = [];
			const regex = /(['"])(.*?[\u0400-\u04FF].*?)\1/g;
			let match: RegExpExecArray | null;

			while ((match = regex.exec(line)) !== null) {
				const startPos = match.index + 1;
				const endPos = startPos + match[0].length - 2;
				const range = new vscode.Range(
					new vscode.Position(index, startPos),
					new vscode.Position(index, endPos)
				);
				diagnostics.push(
					new vscode.Diagnostic(
						range,
						`Error in line:${index + 1} - localization required`,
						vscode.DiagnosticSeverity.Warning
					)
				);
			}

			return diagnostics;
		});
	}

	private static checkLocalizationBlade(document: vscode.TextDocument): vscode.Diagnostic[] {
		if (!ExtensionSettings.CHECK_LOCALIZATION) {
			return [];
		}

		return this.createLineDiagnostics(document, (line, index) => {
			const diagnostics: vscode.Diagnostic[] = [];
			const regex = /[\u0400-\u04FF]+/g;
			let match: RegExpExecArray | null;

			while ((match = regex.exec(line)) !== null) {
				const startPos = match.index;
				const endPos = startPos + match[0].length;
				const range = new vscode.Range(
					new vscode.Position(index, startPos),
					new vscode.Position(index, endPos)
				);
				diagnostics.push(
					new vscode.Diagnostic(
						range,
						`Error in line: ${index + 1} - localization required`,
						vscode.DiagnosticSeverity.Warning
					)
				);
			}

			return diagnostics;
		});
	}

	private static collectDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
		if (this.isLanguageFolder(document)) {
			return [];
		}

		const diagnostics: vscode.Diagnostic[] = [];

		if (this.isBladeDocument(document)) {
			diagnostics.push(...this.checkBlade(document));
			diagnostics.push(...this.checkLocalizationBlade(document));
			return diagnostics;
		}

		if (this.isPhpOrVueDocument(document)) {
			diagnostics.push(...this.checkPhpAndVueCode(document));
			diagnostics.push(...this.checkLocalizationPhp(document));
		}

		diagnostics.push(...ComplexityAnalyzer.createDiagnostics(document));
		return diagnostics;
	}

	private static refreshDiagnostics(document: vscode.TextDocument): void {
		if (!this.shouldAnalyze(document)) {
			this.diagnosticCollection.delete(document.uri);
			return;
		}

		const diagnostics = this.collectDiagnostics(document);
		if (diagnostics.length === 0) {
			this.diagnosticCollection.delete(document.uri);
			return;
		}

		this.diagnosticCollection.set(document.uri, diagnostics);
	}

	private static registerDocumentListeners(): void {
		if (!this.context) {
			return;
		}

		this.diagnosticCollection = vscode.languages.createDiagnosticCollection('vscode-fxpw-code-static-check');
		this.context.subscriptions.push(this.diagnosticCollection);

		this.context.subscriptions.push(
			vscode.workspace.onDidOpenTextDocument(document => this.refreshDiagnostics(document)),
			vscode.workspace.onDidChangeTextDocument(event => this.refreshDiagnostics(event.document)),
			vscode.workspace.onDidSaveTextDocument(document => this.refreshDiagnostics(document)),
			vscode.workspace.onDidChangeConfiguration(event => {
				if (event.affectsConfiguration(ExtensionSettings.CONFIG_SECTION)) {
					vscode.workspace.textDocuments.forEach(document => this.refreshDiagnostics(document));
				}
			}),
			vscode.workspace.onDidCloseTextDocument(document => this.diagnosticCollection.delete(document.uri))
		);

		vscode.workspace.textDocuments.forEach(document => this.refreshDiagnostics(document));
	}

	static async init(context: vscode.ExtensionContext): Promise<boolean> {
		try {
			this.context = context;
			await ExtensionSettings.init(context);
			this.registerDocumentListeners();
			return true;
		} catch (error) {
			console.error(error);
			return false;
		}
	}
}
