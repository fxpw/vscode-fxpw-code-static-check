import * as vscode from 'vscode';
import { ExtensionSettings } from './ExtensionSettings';

export interface FunctionMetric {
	name: string;
	startLine: number;
	startCharacter: number;
	cognitiveComplexity: number;
	cyclomaticComplexity: number;
}

interface OffsetPosition {
	line: number;
	character: number;
}

abstract class BaseComplexityAnalyzer {
	protected createLineMap(text: string): number[] {
		const lineStarts = [0];
		for (let index = 0; index < text.length; index++) {
			if (text[index] === '\n') {
				lineStarts.push(index + 1);
			}
		}
		return lineStarts;
	}

	protected getPositionFromOffset(offset: number, lineStarts: number[]): OffsetPosition {
		let low = 0;
		let high = lineStarts.length - 1;

		while (low <= high) {
			const middle = Math.floor((low + high) / 2);
			if (lineStarts[middle] <= offset) {
				if (middle === lineStarts.length - 1 || lineStarts[middle + 1] > offset) {
					return {
						line: middle,
						character: offset - lineStarts[middle]
					};
				}
				low = middle + 1;
			} else {
				high = middle - 1;
			}
		}

		return { line: 0, character: 0 };
	}

	protected createDiagnostic(metric: FunctionMetric): vscode.Diagnostic {
		const range = new vscode.Range(
			new vscode.Position(metric.startLine, metric.startCharacter),
			new vscode.Position(metric.startLine, metric.startCharacter + metric.name.length)
		);
		const severity = this.resolveSeverity(metric);
		const message = `Function '${metric.name}': Cognitive Complexity = ${metric.cognitiveComplexity}, Cyclomatic Complexity = ${metric.cyclomaticComplexity}`;
		const diagnostic = new vscode.Diagnostic(range, message, severity);
		diagnostic.source = 'vscode-fxpw-code-static-check';
		return diagnostic;
	}

	protected resolveSeverity(metric: FunctionMetric): vscode.DiagnosticSeverity {
		if (
			metric.cognitiveComplexity >= ExtensionSettings.COGNITIVE_COMPLEXITY_WARNING_THRESHOLD ||
			metric.cyclomaticComplexity >= ExtensionSettings.CYCLOMATIC_COMPLEXITY_WARNING_THRESHOLD
		) {
			return vscode.DiagnosticSeverity.Warning;
		}

		return vscode.DiagnosticSeverity.Information;
	}

	protected calculateCyclomaticComplexity(body: string): number {
		const keywordMatches = body.match(/\b(if|elseif|else\s+if|for|foreach|while|case|catch|when)\b/g);
		const keywordComplexity = keywordMatches ? keywordMatches.length : 0;
		const ternaryComplexity = (body.match(/\?(?![?.])/g) || []).length;
		const nullCoalescingComplexity = (body.match(/\?\?/g) || []).length;
		const logicalComplexity = (body.match(/&&|\|\||\band\b|\bor\b|\bxor\b/g) || []).length;
		return 1 + keywordComplexity + ternaryComplexity + nullCoalescingComplexity + logicalComplexity;
	}

	protected calculateCognitiveComplexity(body: string): number {
		const lines = body.split('\n');
		let complexity = 0;
		let nesting = 0;
		const stack: number[] = [];

		for (const originalLine of lines) {
			const line = originalLine.trim();
			if (!line) {
				continue;
			}

			const closingBraces = (line.match(/[}]/g) || []).length;
			for (let index = 0; index < closingBraces; index++) {
				if (stack.length > 0) {
					stack.pop();
					nesting = Math.max(0, nesting - 1);
				}
			}

			const booleanChains = line.match(/&&|\|\||\band\b|\bor\b|\bxor\b/g);
			if (booleanChains) {
				complexity += booleanChains.length;
			}

			const controlMatches = line.match(/\b(elseif|else\s+if|if|for|foreach|while|catch|case|default|switch|when)\b/g) || [];
			for (const match of controlMatches) {
				const normalized = match.replace(/\s+/g, ' ').trim();
				if (normalized === 'switch') {
					continue;
				}

				complexity += 1 + nesting;
			}

			const ternaryMatches = (line.match(/\?(?![?.])/g) || []).length;
			if (ternaryMatches > 0) {
				complexity += ternaryMatches * (1 + nesting);
			}

			const openings = (line.match(/{/g) || []).length;
			const startsControlBlock = /\b(if|else\s+if|elseif|else|for|foreach|while|switch|catch|do|try)\b/.test(line);
			for (let index = 0; index < openings; index++) {
				if (startsControlBlock || stack.length > 0) {
					stack.push(1);
					nesting++;
				}
			}
		}

		return complexity;
	}

	abstract supports(document: vscode.TextDocument): boolean;
	abstract analyze(document: vscode.TextDocument): vscode.Diagnostic[];
	abstract analyzeText(text: string): FunctionMetric[];
}

abstract class BraceLanguageComplexityAnalyzer extends BaseComplexityAnalyzer {
	protected abstract functionPatterns: RegExp[];
	protected abstract controlKeywords: Set<string>;

	protected stripCommentsAndStrings(text: string): string {
		return text
			.replace(/\/\*[\s\S]*?\*\//g, ' ')
			.replace(/\/\/.*$/gm, ' ')
			.replace(/#.*$/gm, ' ')
			.replace(/'(?:\\.|[^'\\])*'/g, "''")
			.replace(/"(?:\\.|[^"\\])*"/g, '""')
			.replace(/`(?:\\.|[^`\\])*`/g, '``');
	}

	protected findMatchingBrace(text: string, openBraceOffset: number): number {
		let depth = 0;
		for (let index = openBraceOffset; index < text.length; index++) {
			if (text[index] === '{') {
				depth++;
			} else if (text[index] === '}') {
				depth--;
				if (depth === 0) {
					return index;
				}
			}
		}
		return -1;
	}

	analyze(document: vscode.TextDocument): vscode.Diagnostic[] {
		const metrics = this.analyzeText(document.getText());
		return metrics.map(metric => this.createDiagnostic(metric));
	}

	analyzeText(text: string): FunctionMetric[] {
		const sanitizedText = this.stripCommentsAndStrings(text);
		const lineStarts = this.createLineMap(text);
		const metrics: FunctionMetric[] = [];

		for (const pattern of this.functionPatterns) {
			pattern.lastIndex = 0;
			let match: RegExpExecArray | null;
			while ((match = pattern.exec(sanitizedText)) !== null) {
				const functionName = match[1];
				if (!functionName || this.controlKeywords.has(functionName)) {
					continue;
				}

				const fullMatch = match[0];
				const nameIndexInMatch = fullMatch.indexOf(functionName);
				const functionOffset = match.index + Math.max(nameIndexInMatch, 0);
				const openBraceOffset = match.index + fullMatch.lastIndexOf('{');
				if (openBraceOffset < 0) {
					continue;
				}

				const closeBraceOffset = this.findMatchingBrace(sanitizedText, openBraceOffset);
				if (closeBraceOffset === -1) {
					continue;
				}

				const body = sanitizedText.slice(openBraceOffset + 1, closeBraceOffset);
				const position = this.getPositionFromOffset(functionOffset, lineStarts);
				metrics.push({
					name: functionName,
					startLine: position.line,
					startCharacter: position.character,
					cognitiveComplexity: this.calculateCognitiveComplexity(body),
					cyclomaticComplexity: this.calculateCyclomaticComplexity(body)
				});
			}
		}

		return this.deduplicate(metrics);
	}

	private deduplicate(metrics: FunctionMetric[]): FunctionMetric[] {
		const seen = new Set<string>();
		return metrics.filter(metric => {
			const key = `${metric.name}:${metric.startLine}:${metric.startCharacter}`;
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	}
}

class PhpComplexityAnalyzer extends BraceLanguageComplexityAnalyzer {
	protected functionPatterns = [
		/\bfunction\s+&?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(?::\s*[^{;]+)?\s*{/g
	];

	protected controlKeywords = new Set<string>();

	supports(document: vscode.TextDocument): boolean {
		return document.languageId === 'php' && !document.uri.fsPath.endsWith('.blade.php');
	}
}

class JavaScriptTypeScriptComplexityAnalyzer extends BraceLanguageComplexityAnalyzer {
	protected functionPatterns = [
		/\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*{/g,
		/\bfunction\s*\*\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*{/g,
		/\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=]+)?=>\s*{/g,
		/\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?[a-zA-Z_$][a-zA-Z0-9_$]*\s*(?::\s*[^=]+)?=>\s*{/g,
		/(?:^|\n)\s*(?:public|private|protected|static|async|get|set|readonly|override|\s)*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^;\n{}]*\)\s*(?::\s*[^{=]+)?\s*{/g
	];

	protected controlKeywords = new Set<string>([
		'if',
		'for',
		'while',
		'switch',
		'catch',
		'constructor'
	]);

	supports(document: vscode.TextDocument): boolean {
		return [
			'javascript',
			'javascriptreact',
			'typescript',
			'typescriptreact'
		].includes(document.languageId);
	}
}

class CppComplexityAnalyzer extends BraceLanguageComplexityAnalyzer {
	protected functionPatterns = [
		/(?:^|\n)\s*(?:template\s*<[^>]+>\s*)?(?:inline\s+)?(?:virtual\s+)?(?:static\s+)?(?:constexpr\s+)?(?:[\w:<>,~*&\s]+\s+)?([A-Za-z_~][A-Za-z0-9_:~]*)\s*\([^;{}]*\)\s*(?:const\s*)?(?:override\s*)?(?:final\s*)?(?:noexcept(?:\([^)]*\))?\s*)?(?:->\s*[^{]+)?\s*{/g
	];

	protected controlKeywords = new Set<string>([
		'if',
		'for',
		'while',
		'switch',
		'catch'
	]);

	supports(document: vscode.TextDocument): boolean {
		return document.languageId === 'cpp';
	}
}

class LuaComplexityAnalyzer extends BaseComplexityAnalyzer {
	private readonly controlKeywords = new Set(['if', 'for', 'while', 'switch', 'repeat']);

	supports(document: vscode.TextDocument): boolean {
		return document.languageId === 'lua';
	}

	analyze(document: vscode.TextDocument): vscode.Diagnostic[] {
		const metrics = this.analyzeText(document.getText());
		return metrics.map(metric => this.createDiagnostic(metric));
	}

	private stripCommentsAndStrings(text: string): string {
		return text
			.replace(/--\[\[[\s\S]*?\]\]/g, ' ')
			.replace(/--.*$/gm, ' ')
			.replace(/'(?:\\.|[^'\\])*'/g, "''")
			.replace(/"(?:\\.|[^"\\])*"/g, '""');
	}

	analyzeText(text: string): FunctionMetric[] {
		const sanitizedText = this.stripCommentsAndStrings(text);
		const lineStarts = this.createLineMap(text);
		const patterns = [
			/\blocal\s+function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/g,
			/\bfunction\s+([a-zA-Z_][a-zA-Z0-9_:.]*)\s*\([^)]*\)/g,
			/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*function\s*\([^)]*\)/g
		];
		const metrics: FunctionMetric[] = [];

		for (const pattern of patterns) {
			pattern.lastIndex = 0;
			let match: RegExpExecArray | null;
			while ((match = pattern.exec(sanitizedText)) !== null) {
				const functionName = match[1];
				const startOffset = match.index + match[0].indexOf(functionName);
				const bodyStart = pattern.lastIndex;
				const bodyEnd = this.findLuaFunctionEnd(sanitizedText, bodyStart);
				if (bodyEnd === -1) {
					continue;
				}

				const body = sanitizedText.slice(bodyStart, bodyEnd);
				const position = this.getPositionFromOffset(startOffset, lineStarts);
				metrics.push({
					name: functionName,
					startLine: position.line,
					startCharacter: position.character,
					cognitiveComplexity: this.calculateLuaCognitiveComplexity(body),
					cyclomaticComplexity: this.calculateLuaCyclomaticComplexity(body)
				});
			}
		}

		return this.deduplicate(metrics);
	}

	private deduplicate(metrics: FunctionMetric[]): FunctionMetric[] {
		const seen = new Set<string>();
		return metrics.filter(metric => {
			const key = `${metric.name}:${metric.startLine}:${metric.startCharacter}`;
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	}

	private findLuaFunctionEnd(text: string, startOffset: number): number {
		const tokenRegex = /\b(function|if|for|while|repeat|do|end|until)\b/g;
		tokenRegex.lastIndex = startOffset;
		let depth = 1;
		let match: RegExpExecArray | null;

		while ((match = tokenRegex.exec(text)) !== null) {
			const token = match[1];
			if (token === 'function' || token === 'if' || token === 'for' || token === 'while' || token === 'do' || token === 'repeat') {
				depth++;
				continue;
			}

			if (token === 'until') {
				depth--;
			}

			if (token === 'end') {
				depth--;
			}

			if (depth === 0) {
				return match.index;
			}
		}

		return -1;
	}

	private calculateLuaCyclomaticComplexity(body: string): number {
		const keywordMatches = body.match(/\b(if|elseif|for|while)\b/g);
		const keywordComplexity = keywordMatches ? keywordMatches.length : 0;
		const logicalComplexity = (body.match(/\band\b|\bor\b/g) || []).length;
		return 1 + keywordComplexity + logicalComplexity;
	}

	private calculateLuaCognitiveComplexity(body: string): number {
		const tokenRegex = /\b(function|if|elseif|for|while|repeat|do|end|until)\b/g;
		let complexity = 0;
		let nesting = 0;
		let match: RegExpExecArray | null;

		while ((match = tokenRegex.exec(body)) !== null) {
			const token = match[1];
			if (token === 'end' || token === 'until') {
				nesting = Math.max(0, nesting - 1);
				continue;
			}

			if (this.controlKeywords.has(token)) {
				complexity += 1 + nesting;
			}

			if (token === 'if' || token === 'for' || token === 'while' || token === 'repeat' || token === 'do') {
				nesting++;
			}
		}

		complexity += (body.match(/\band\b|\bor\b/g) || []).length;
		return complexity;
	}
}

export class ComplexityAnalyzer {
	private static readonly analyzers: BaseComplexityAnalyzer[] = [
		new PhpComplexityAnalyzer(),
		new JavaScriptTypeScriptComplexityAnalyzer(),
		new LuaComplexityAnalyzer(),
		new CppComplexityAnalyzer()
	];

	static supports(document: vscode.TextDocument): boolean {
		return this.analyzers.some(analyzer => analyzer.supports(document));
	}

	static createDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
		if (!ExtensionSettings.CHECK_COMPLEXITY_METRICS) {
			return [];
		}

		const analyzer = this.analyzers.find(candidate => candidate.supports(document));
		if (!analyzer) {
			return [];
		}

		return analyzer.analyze(document);
	}

	static analyzeText(languageId: string, text: string): FunctionMetric[] {
		const analyzer = this.analyzers.find(candidate => candidate.supports({ languageId } as vscode.TextDocument));
		if (!analyzer) {
			return [];
		}

		return analyzer.analyzeText(text);
	}
}
