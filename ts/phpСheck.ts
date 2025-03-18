import * as vscode from 'vscode';
import { ExtensionSettings } from "./ExtensionSettings";
import * as path from 'path';

async function debug(message: string) {
	if (ExtensionSettings.DEBUG) {
		console.log(message);
	}
}


export class PhpСheck {
	private static context: vscode.ExtensionContext | null;
	private static diagnosticCollection: vscode.DiagnosticCollection;

	static async CheckBlade(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
		let diagnostics: vscode.Diagnostic[] = [];
		if (ExtensionSettings.CHECK_BLADE_TEMPLATES) {
			let text = document.getText();
			const lines = text.split('\n');
			lines.forEach(async (line, index) => {
				if (line.includes("<?php")) {
					const message = `Error in line: ${index + 1} - old Blade template`;
					
					// Проверяем, какой текст содержится в строке, чтобы определить его индекс
					let startPos = line.indexOf("<?php");
					let endPos = startPos + "<?php".length; // Длина строки, которую мы выделяем
				
					if (startPos !== -1) { // Убедимся, что элемент найден
						const range = new vscode.Range(
							new vscode.Position(index, startPos), // Начальная позиция
							new vscode.Position(index, endPos)    // Конечная позиция
						);
				
						const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
						diagnostics.push(diagnostic);
					}
				}
				if (line.includes("<?=")) {
					const message = `Error in line: ${index + 1} - old Blade template`;
					
					// Проверяем, какой текст содержится в строке, чтобы определить его индекс
					let startPos = line.indexOf("<?=");
					let endPos = startPos + "<?=".length; // Длина строки, которую мы выделяем
				
					if (startPos !== -1) { // Убедимся, что элемент найден
						const range = new vscode.Range(
							new vscode.Position(index, startPos), // Начальная позиция
							new vscode.Position(index, endPos)    // Конечная позиция
						);
				
						const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
						diagnostics.push(diagnostic);
					}
				}
				if (line.includes("?>")) {
					const message = `Error in line: ${index + 1} - old Blade template`;
				
					// Проверяем индекс символа "?>"
					let startPos = line.indexOf("?>");
					let endPos = startPos + "?>".length; // Длина строки, которую мы выделяем
				
					if (startPos !== -1) { // Убедимся, что символ найден
						const range = new vscode.Range(
							new vscode.Position(index, startPos), // Начальная позиция
							new vscode.Position(index, endPos)    // Конечная позиция
						);
				
						const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
						diagnostics.push(diagnostic);
					}
				}
				// Проверка на два пробела подряд в строке
				let twoSpacesIndex = line.indexOf('  ');
				while (twoSpacesIndex !== -1) {
					const message = `Error in line:${index + 1} - consecutive spaces detected (remove extra spaces)`;
					const range = new vscode.Range(new vscode.Position(index, twoSpacesIndex), new vscode.Position(index, twoSpacesIndex + 2));
					const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
					diagnostics.push(diagnostic);
					// Найдем следующее совпадение
					twoSpacesIndex = line.indexOf('  ', twoSpacesIndex + 1);
				}
	
				// Проверка на пробел в конце строки
				if (/\s$/.test(line)) {
					const message = `Error in line:${index + 1} - trailing space detected (remove space at the end)`;
					const range = new vscode.Range(new vscode.Position(index, line.length - 1), new vscode.Position(index, line.length));
					const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
					diagnostics.push(diagnostic);
				}
			});
		}
		return diagnostics;
	}
	static async CheckPHPCode(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
		let diagnostics: vscode.Diagnostic[] = [];
		if (ExtensionSettings.CHECK_PHP_CODE) {
			let text = document.getText();
			const lines = text.split('\n');
			lines.forEach(async (line, index) => {
				const variableRegex = /\$[a-zA-Z_][a-zA-Z0-9_]*\b/g;
				let match;

				while ((match = variableRegex.exec(line)) !== null) {
					const variableName = match[0];
					if (!/^[a-z_][a-z0-9_]*$/.test(variableName.slice(1))) {
						const message = `Error in line:${index + 1} - variable '${variableName}' must be in snake_case`;
						const range = new vscode.Range(
							new vscode.Position(index, match.index),
							new vscode.Position(index, match.index + variableName.length)
						);
						const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
						diagnostics.push(diagnostic);
					}
					
				}
				// Проверка на два пробела подряд в строке
				let twoSpacesIndex = line.indexOf('  ');
				while (twoSpacesIndex !== -1) {
					const message = `Error in line:${index + 1} - consecutive spaces detected (remove extra spaces)`;
					const range = new vscode.Range(new vscode.Position(index, twoSpacesIndex), new vscode.Position(index, twoSpacesIndex + 2));
					const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
					diagnostics.push(diagnostic);
					// Найдем следующее совпадение
					twoSpacesIndex = line.indexOf('  ', twoSpacesIndex + 1);
				}
	
				// Проверка на пробел в конце строки
				if (/\s$/.test(line)) {
					const message = `Error in line:${index + 1} - trailing space detected (remove space at the end)`;
					const range = new vscode.Range(new vscode.Position(index, line.length - 1), new vscode.Position(index, line.length));
					const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
					diagnostics.push(diagnostic);
				}
			});
		}
		return diagnostics;
	}

	static async CheckLocalizationPHP(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
		let diagnostics: vscode.Diagnostic[] = [];
		if (ExtensionSettings.CHECK_LOCALIZATION) {
			let text = document.getText();
			const lines = text.split('\n');
			const regex = /(['"])(.*?[\u0400-\u04FF].*?)\1/g; // Находит строки, содержащие кириллицу

			lines.forEach((line, index) => {
				let match;

				// Ищем все строки, содержащие кириллические символы
				while ((match = regex.exec(line)) !== null) {
					const message = `Error in line:${index + 1} - localization required`;
					const startPos = match.index + 1; // Начало строки, исключая кавычки
					const endPos = startPos + match[0].length - 2; // Конец строки, исключая кавычки

					const range = new vscode.Range(
						new vscode.Position(index, startPos),
						new vscode.Position(index, endPos)
					);

					const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
					diagnostics.push(diagnostic);
				}
			});
		}
		return diagnostics;
	}
	static async CheckLocalizationPHPBlade(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
		let diagnostics: vscode.Diagnostic[] = [];
		if (ExtensionSettings.CHECK_LOCALIZATION) {
			let text = document.getText();
			const lines = text.split('\n');
			const regex = /[\u0400-\u04FF]+/g; // Находит строки, содержащие кириллицу

			lines.forEach((line, index) => {
				let match;

				// Ищем все строки, содержащие кириллические символы
				while ((match = regex.exec(line)) !== null) {
					const message = `Error in line: ${index + 1} - localization required`;
	
					const startPos = match.index; // Начало найденной кириллической строки
					const endPos = startPos + match[0].length; // Конец найденной кириллической строки
	
					const range = new vscode.Range(
						new vscode.Position(index, startPos),
						new vscode.Position(index, endPos)
					);
	
					const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
					diagnostics.push(diagnostic);
				}
			});
		}
		return diagnostics;
	}


	static async InitWatchPHPBlade(): Promise<boolean> {
		if (this.context) {
			this.diagnosticCollection = vscode.languages.createDiagnosticCollection('fxpw-php-blade');
			this.context.subscriptions.push(
				vscode.workspace.onDidChangeTextDocument(async (event) => {
					
					let document = event.document;
					if (document.uri.path.includes(`${path.sep}lang${path.sep}`) || document.uri.path.endsWith('lang')) {
						return;
					}
					if (document.uri.path.includes('.blade.php') ) {
						let allDiagnostics: vscode.Diagnostic[] = [];
						this.diagnosticCollection.set(document.uri, undefined);

						let diagnosticsBlade: vscode.Diagnostic[] = await this.CheckBlade(document);
						allDiagnostics.push(...diagnosticsBlade);

						let diagnosticsLocalization: vscode.Diagnostic[] = await this.CheckLocalizationPHPBlade(document);
						allDiagnostics.push(...diagnosticsLocalization);
						if (allDiagnostics.length > 0) {
							this.diagnosticCollection.set(document.uri, allDiagnostics);
						}
					}
				}),
				vscode.workspace.onDidCloseTextDocument((document) => {
					this.diagnosticCollection.set(document.uri, undefined);
				})
			);
		}
		return true;
	}

	static async InitWatchPHP(): Promise<boolean> {
		if (this.context) {
			this.diagnosticCollection = vscode.languages.createDiagnosticCollection('fxpw-php');
			this.context.subscriptions.push(
				vscode.workspace.onDidChangeTextDocument(async (event) => {
					let document = event.document;

					if ((document.uri.path.includes('.php')||document.uri.path.includes('.vue')) && !document.uri.path.includes('.blade.php')) {
						if (document.uri.path.includes(`${path.sep}lang${path.sep}`) || document.uri.path.endsWith('lang')) {
							return;
						}
						let allDiagnostics: vscode.Diagnostic[] = [];
						this.diagnosticCollection.set(document.uri, undefined);

						let diagnosticsBlade: vscode.Diagnostic[] = await this.CheckPHPCode(document);
						allDiagnostics.push(...diagnosticsBlade);

						let diagnosticsLocalization: vscode.Diagnostic[] = await this.CheckLocalizationPHP(document);
						allDiagnostics.push(...diagnosticsLocalization);
						if (allDiagnostics.length > 0) {
							this.diagnosticCollection.set(document.uri, allDiagnostics);
						}
					}
				}),
				vscode.workspace.onDidCloseTextDocument((document) => {
					this.diagnosticCollection.set(document.uri, undefined);
				})
			);
		}
		return true;
	}

	static async Init(context: vscode.ExtensionContext): Promise<boolean> {
		try {
			this.context = context;
			await ExtensionSettings.Init(context);
			await this.InitWatchPHPBlade();
			await this.InitWatchPHP();
			return true;
		} catch (error) {
			console.error(error);
			return false;
		}
	}
}