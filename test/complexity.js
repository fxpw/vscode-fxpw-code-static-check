"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeScriptExample = void 0;
exports.calculate = calculate;
function calculate(items) {
    let total = 0;
    for (const item of items) {
        if (item.active && item.value > 0) {
            total += item.value;
        }
    }
    return total;
}
class TypeScriptExample {
    transform(input) {
        if (input < 0) {
            return 0;
        }
        switch (input) {
            case 1:
                return 10;
            case 2:
                return 20;
            default:
                return input;
        }
    }
}
exports.TypeScriptExample = TypeScriptExample;
//# sourceMappingURL=complexity.js.map