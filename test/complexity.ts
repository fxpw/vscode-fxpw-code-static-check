type Item = {
    active: boolean;
    value: number;
};

export function calculate(items: Item[]): number {
    let total = 0;

    for (const item of items) {
        if (item.active && item.value > 0) {
            total += item.value;
        }
    }

    return total;
}

export class TypeScriptExample {
    public transform(input: number): number {
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
