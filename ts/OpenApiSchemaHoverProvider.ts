import * as vscode from 'vscode';
import { ExtensionSettings } from './ExtensionSettings';

type OpenApiSchemaProperty = {
	name: string;
	type?: string;
	description?: string;
	nullable?: boolean;
	example?: string;
	ref?: string;
	items?: string;
	oneOf?: string[];
	anyOf?: string[];
	allOf?: string[];
};

type OpenApiSchemaInfo = {
	name: string;
	type?: string;
	title?: string;
	description?: string;
	properties: OpenApiSchemaProperty[];
	uri: vscode.Uri;
	/** Character offset in the document where #[OA\Schema( starts */
	offset: number;
};

type ExtractedBlock = {
	body: string;
	endIndex: number;
};

export class OpenApiSchemaHoverProvider implements vscode.HoverProvider, vscode.DefinitionProvider, vscode.Disposable {
	private schemaIndexPromise: Promise<Map<string, OpenApiSchemaInfo[]>> | null = null;
	private readonly disposables: vscode.Disposable[] = [];

	static register(context: vscode.ExtensionContext): void {
		const provider = new OpenApiSchemaHoverProvider();
		const selector: vscode.DocumentSelector = [
			{ language: 'php' },
			{ language: 'blade' },
			{ language: 'json' },
			{ language: 'yaml' },
			{ pattern: '**/*.php' },
			{ pattern: '**/*.blade.php' },
			{ pattern: '**/*.json' },
			{ pattern: '**/*.yaml' },
			{ pattern: '**/*.yml' }
		];

		context.subscriptions.push(
			provider,
			vscode.languages.registerHoverProvider(selector, provider),
			vscode.languages.registerDefinitionProvider(selector, provider)
		);
	}

	constructor() {
		this.disposables.push(
			vscode.workspace.onDidChangeTextDocument(() => this.invalidateIndex()),
			vscode.workspace.onDidSaveTextDocument(() => this.invalidateIndex()),
			vscode.workspace.onDidCreateFiles(() => this.invalidateIndex()),
			vscode.workspace.onDidDeleteFiles(() => this.invalidateIndex()),
			vscode.workspace.onDidRenameFiles(() => this.invalidateIndex())
		);
	}

	dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
	}

	async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | null> {
		if (!ExtensionSettings.OPENAPI_SCHEMA_HOVER) {
			return null;
		}

		const reference = this.getSchemaReferenceAtPosition(document, position);
		if (!reference) {
			return null;
		}

		const schemaIndex = await this.getSchemaIndex();
		const schemas = schemaIndex.get(reference.schemaName);
		if (!schemas || schemas.length === 0) {
			return null;
		}

		return new vscode.Hover(this.buildHoverMarkdown(reference.schemaName, schemas), reference.range);
	}

	async provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[] | null> {
		if (!ExtensionSettings.OPENAPI_SCHEMA_HOVER) {
			return null;
		}

		const reference = this.getSchemaReferenceAtPosition(document, position);
		if (!reference) {
			return null;
		}

		const schemaIndex = await this.getSchemaIndex();
		const schemas = schemaIndex.get(reference.schemaName);
		if (!schemas || schemas.length === 0) {
			return null;
		}

		const locations = await Promise.all(schemas.map(async schema => {
			const doc = await vscode.workspace.openTextDocument(schema.uri);
			const pos = doc.positionAt(schema.offset);
			return new vscode.Location(schema.uri, pos);
		}));
		return locations;
	}

	private invalidateIndex(): void {
		this.schemaIndexPromise = null;
	}

	private async getSchemaIndex(): Promise<Map<string, OpenApiSchemaInfo[]>> {
		if (!this.schemaIndexPromise) {
			this.schemaIndexPromise = this.buildSchemaIndex();
		}

		return this.schemaIndexPromise;
	}

	private async buildSchemaIndex(): Promise<Map<string, OpenApiSchemaInfo[]>> {
		const schemaIndex = new Map<string, OpenApiSchemaInfo[]>();
		const files = await vscode.workspace.findFiles('**/*.php');

		for (const file of files) {
			if (this.shouldSkipFile(file)) {
				continue;
			}

			const document = await vscode.workspace.openTextDocument(file);
			for (const schema of this.extractSchemasFromDocument(document)) {
				const current = schemaIndex.get(schema.name) ?? [];
				current.push(schema);
				schemaIndex.set(schema.name, current);
			}
		}

		return schemaIndex;
	}

	private shouldSkipFile(uri: vscode.Uri): boolean {
		const normalizedPath = uri.fsPath.replace(/\\/g, '/').toLowerCase();
		return normalizedPath.includes('/node_modules/')
			|| normalizedPath.includes('/vendor/')
			|| normalizedPath.includes('/out/');
	}

	private getSchemaReferenceAtPosition(document: vscode.TextDocument, position: vscode.Position): { schemaName: string; range: vscode.Range } | null {
		const line = document.lineAt(position.line).text;
		const referenceRegex = /#\/components\/schemas\/([A-Za-z0-9_.-]+)/g;
		let match: RegExpExecArray | null;

		while ((match = referenceRegex.exec(line)) !== null) {
			const start = match.index;
			const end = start + match[0].length;
			if (position.character < start || position.character > end) {
				continue;
			}

			return {
				schemaName: match[1],
				range: new vscode.Range(position.line, start, position.line, end)
			};
		}

		return null;
	}

	private extractSchemasFromDocument(document: vscode.TextDocument): OpenApiSchemaInfo[] {
		const text = document.getText();
		const marker = '#[OA\\Schema(';
		const schemas: OpenApiSchemaInfo[] = [];
		let searchIndex = 0;

		while (searchIndex < text.length) {
			const startIndex = text.indexOf(marker, searchIndex);
			if (startIndex === -1) {
				break;
			}

			const block = this.extractBalancedBlock(text, startIndex + marker.length);
			if (!block) {
				break;
			}

			const schemaName = this.readNamedString(block.body, 'schema');
			if (schemaName) {
				schemas.push({
					name: schemaName,
					type: this.readNamedString(block.body, 'type'),
					title: this.readNamedString(block.body, 'title'),
					description: this.readNamedString(block.body, 'description'),
					properties: this.extractProperties(block.body),
					uri: document.uri,
					offset: startIndex
				});
			}

			searchIndex = block.endIndex;
		}

		return schemas;
	}

	private extractProperties(schemaBody: string): OpenApiSchemaProperty[] {
		const propertiesBody = this.extractNamedArray(schemaBody, 'properties');
		if (!propertiesBody) {
			return [];
		}

		const properties: OpenApiSchemaProperty[] = [];
		const marker = 'new OA\\Property(';
		let searchIndex = 0;

		while (searchIndex < propertiesBody.length) {
			const startIndex = propertiesBody.indexOf(marker, searchIndex);
			if (startIndex === -1) {
				break;
			}

			const block = this.extractBalancedBlock(propertiesBody, startIndex + marker.length);
			if (!block) {
				break;
			}

			const propertyName = this.readNamedString(block.body, 'property');
			if (propertyName) {
				properties.push({
					name: propertyName,
					type: this.readNamedString(block.body, 'type'),
					description: this.readNamedString(block.body, 'description'),
					nullable: this.readNamedBoolean(block.body, 'nullable'),
					example: this.readNamedValue(block.body, 'example'),
					ref: this.readSchemaRef(block.body, 'ref'),
					items: this.readItemsRef(block.body),
					oneOf: this.readCompositeRefs(block.body, 'oneOf'),
					anyOf: this.readCompositeRefs(block.body, 'anyOf'),
					allOf: this.readCompositeRefs(block.body, 'allOf')
				});
			}

			searchIndex = block.endIndex;
		}

		return properties;
	}

	private extractNamedArray(body: string, key: string): string | null {
		const keyIndex = body.search(new RegExp(`\\b${key}\\s*:`));
		if (keyIndex === -1) {
			return null;
		}

		const arrayStart = body.indexOf('[', keyIndex);
		if (arrayStart === -1) {
			return null;
		}

		let depth = 1;
		let index = arrayStart + 1;
		let inString = false;
		let stringQuote = '';

		while (index < body.length) {
			const char = body[index];

			if (inString) {
				if (char === stringQuote && body[index - 1] !== '\\') {
					inString = false;
				}
				index += 1;
				continue;
			}

			if (char === '"' || char === '\'') {
				inString = true;
				stringQuote = char;
				index += 1;
				continue;
			}

			if (char === '[') {
				depth += 1;
			} else if (char === ']') {
				depth -= 1;
				if (depth === 0) {
					return body.slice(arrayStart + 1, index);
				}
			}

			index += 1;
		}

		return null;
	}

	private extractBalancedBlock(text: string, startIndex: number): ExtractedBlock | null {
		let depth = 1;
		let index = startIndex;
		let inString = false;
		let stringQuote = '';

		while (index < text.length) {
			const char = text[index];

			if (inString) {
				if (char === stringQuote && text[index - 1] !== '\\') {
					inString = false;
				}
				index += 1;
				continue;
			}

			if (char === '"' || char === '\'') {
				inString = true;
				stringQuote = char;
				index += 1;
				continue;
			}

			if (char === '(') {
				depth += 1;
			} else if (char === ')') {
				depth -= 1;
				if (depth === 0) {
					const attributeEndIndex = text[index + 1] === ']' ? index + 2 : index + 1;
					return {
						body: text.slice(startIndex, index),
						endIndex: attributeEndIndex
					};
				}
			}

			index += 1;
		}

		return null;
	}

	private readNamedString(body: string, key: string): string | undefined {
		const match = body.match(new RegExp(`\\b${key}\\s*:\\s*([\"'])(.*?)\\1`, 's'));
		return match?.[2]?.trim() || undefined;
	}

	private readNamedBoolean(body: string, key: string): boolean | undefined {
		const match = body.match(new RegExp(`\\b${key}\\s*:\\s*(true|false)\\b`, 'i'));
		if (!match) {
			return undefined;
		}

		return match[1].toLowerCase() === 'true';
	}

	private readNamedValue(body: string, key: string): string | undefined {
		const match = body.match(new RegExp(`\\b${key}\\s*:\\s*([^,\\r\\n)]+)`, 's'));
		return match?.[1]?.trim() || undefined;
	}

	/**
	 * Reads ref: "#/components/schemas/Name" => returns "Name"
	 */
	private readSchemaRef(body: string, key: string): string | undefined {
		const raw = this.readNamedString(body, key);
		if (!raw) {
			return undefined;
		}
		const match = raw.match(/#\/components\/schemas\/([A-Za-z0-9_.-]+)/);
		return match?.[1] ?? raw;
	}

	/**
	 * Reads items: new OA\Items(ref: "#/components/schemas/Name") => returns "Name"
	 */
	private readItemsRef(body: string): string | undefined {
		const itemsMatch = body.match(/\bitems\s*:\s*new\s+OA\\Items\s*\(([^)]+)\)/);
		if (!itemsMatch) {
			return undefined;
		}
		const refMatch = itemsMatch[1].match(/ref\s*:\s*["']([^"']+)["']/);
		if (!refMatch) {
			return undefined;
		}
		const schemaMatch = refMatch[1].match(/#\/components\/schemas\/([A-Za-z0-9_.-]+)/);
		return schemaMatch?.[1] ?? refMatch[1];
	}

	/**
	 * Reads oneOf/anyOf/allOf: [new OA\Schema(ref: "..."), ...] => returns array of schema names
	 */
	private readCompositeRefs(body: string, key: string): string[] | undefined {
		const arrayBody = this.extractNamedArray(body, key);
		if (!arrayBody) {
			return undefined;
		}
		const refRegex = /ref\s*:\s*["']([^"']+)["']/g;
		const results: string[] = [];
		let match: RegExpExecArray | null;
		while ((match = refRegex.exec(arrayBody)) !== null) {
			const schemaMatch = match[1].match(/#\/components\/schemas\/([A-Za-z0-9_.-]+)/);
			results.push(schemaMatch?.[1] ?? match[1]);
		}
		return results.length > 0 ? results : undefined;
	}

	private buildHoverMarkdown(schemaName: string, schemas: OpenApiSchemaInfo[]): vscode.MarkdownString {
		const markdown = new vscode.MarkdownString();
		markdown.isTrusted = false;
		markdown.supportHtml = false;

		for (let index = 0; index < schemas.length; index += 1) {
			const schema = schemas[index];
			if (index > 0) {
				markdown.appendMarkdown('\n\n---\n\n');
			}

			markdown.appendMarkdown(`**${this.escapeMarkdown(schema.title ?? schema.name)}**`);
			if (schema.description) {
				markdown.appendMarkdown(`\n\n${this.escapeMarkdown(schema.description)}`);
			}

			const metadata: string[] = [];
			if (schema.type) {
				metadata.push(`Type: \`${this.escapeCode(schema.type)}\``);
			}
			metadata.push(`Schema: \`${this.escapeCode(schema.name)}\``);
			metadata.push(`File: ${this.escapeMarkdown(vscode.workspace.asRelativePath(schema.uri))}`);
			markdown.appendMarkdown(`\n\n${metadata.join('  \n')}`);

			if (schema.properties.length > 0) {
				markdown.appendMarkdown('\n\n**Properties**');
				for (const property of schema.properties) {
					const details: string[] = [];
					if (property.type) {
						details.push(`type: ${property.type}`);
					}
					if (property.ref) {
						details.push(`$ref: ${property.ref}`);
					}
					if (property.items) {
						details.push(`items: ${property.items}`);
					}
					if (property.oneOf) {
						details.push(`oneOf: ${property.oneOf.join(' | ')}`);
					}
					if (property.anyOf) {
						details.push(`anyOf: ${property.anyOf.join(' | ')}`);
					}
					if (property.allOf) {
						details.push(`allOf: ${property.allOf.join(' & ')}`);
					}
					if (property.nullable) {
						details.push('nullable');
					}
					if (property.example) {
						details.push(`example: ${property.example}`);
					}

					let line = `\n- \`${this.escapeCode(property.name)}\``;
					if (details.length > 0) {
						line += ` (${this.escapeMarkdown(details.join(', '))})`;
					}
					if (property.description) {
						line += `: ${this.escapeMarkdown(property.description)}`;
					}
					markdown.appendMarkdown(line);
				}
			}
		}

		return markdown;
	}

	private escapeMarkdown(value: string): string {
		return value.replace(/[\\`*_{}\[\]()#+\-.!|>]/g, '\\$&');
	}

	private escapeCode(value: string): string {
		return value.replace(/`/g, '\\`');
	}
}