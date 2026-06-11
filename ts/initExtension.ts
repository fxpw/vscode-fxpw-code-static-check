import * as vscode from 'vscode';
import { OpenApiSchemaHoverProvider } from './OpenApiSchemaHoverProvider';
import { CodeStaticCheck } from './CodeStaticCheck';

export async function activate(context: vscode.ExtensionContext) {
	try {
		await CodeStaticCheck.init(context);
		OpenApiSchemaHoverProvider.register(context);
		const version = context.extension.packageJSON.version;
		console.log(`vscode-fxpw-code-static-check version: ${version}`);
	} catch (error) {
		console.error(error);
	}
}

// This method is called when your extension is deactivated
export function deactivate() { }
