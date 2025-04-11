import * as vscode from 'vscode';
import {PhpСheck} from "./phpСheck";
export async function activate(context: vscode.ExtensionContext) {
	try {
		await PhpСheck.Init(context);
		const version = context.extension.packageJSON.version;
		console.log(`vscode-fxpw-php-static-check version: ${version}`);
	} catch (error) {
		console.error(error);
	}
}

// This method is called when your extension is deactivated
export function deactivate() { }
